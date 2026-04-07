-- ============================================================
-- ConvoEngine — Initial Database Schema
-- Afterlife Intelligent Chatbot Platform
-- ============================================================

-- Enable pgvector extension for RAG embeddings
create extension if not exists vector with schema extensions;

-- ============================================================
-- 1. TENANTS — Multi-tenancy support (Afterlife = tenant 1)
-- ============================================================
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  industry text,
  config jsonb default '{}',
  tone_preferences text,
  brand_voice text,
  welcome_message text default 'Hi! How can I help you today?',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Seed Afterlife as tenant 1
insert into public.tenants (name, industry, tone_preferences, brand_voice, welcome_message)
values (
  'Afterlife',
  'Financial Literacy / Succession Planning',
  'Warm, empathetic, professional. Never transactional on sensitive topics.',
  'Confident but caring. Like a knowledgeable friend explaining something important.',
  'Hi! Planning for your family''s future? I can help you understand how Afterlife works. Ask me anything!'
);

-- ============================================================
-- 2. KNOWLEDGE_ARTICLES — Knowledge bank with vector embeddings
-- ============================================================
create table public.knowledge_articles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  title text,
  content text not null,
  embedding vector(1536), -- OpenAI text-embedding-3-small dimension
  source_type text not null default 'manual', -- manual, document, url, unanswered_q
  source_reference text, -- filename, URL, or unanswered_question_id
  category text, -- features, pricing, faq, security, b2b, general
  metadata jsonb default '{}',
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for fast vector similarity search
create index on public.knowledge_articles
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Index for tenant-scoped queries
create index idx_knowledge_tenant on public.knowledge_articles(tenant_id) where is_active = true;

-- ============================================================
-- 3. CTAS — Configurable calls-to-action per tenant
-- ============================================================
create table public.ctas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  cta_key text not null, -- unlock_access, promo_offer, book_demo, etc.
  label text not null, -- "Unlock Lifetime Access"
  url text, -- Payment link, booking link, app store link
  action_type text default 'link', -- link, callback_form, internal
  agent_modes text[] default '{}', -- SALES, ONBOARDING, SUPPORT, B2B
  intent_tags text[] default '{}', -- pricing, consultation, demo, etc.
  priority_weight integer default 5 check (priority_weight between 1 and 10),
  cooldown_messages integer default 5, -- Min messages between re-presenting
  description text, -- Context for the LLM on when to use this CTA
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Seed Afterlife CTAs
insert into public.ctas (tenant_id, cta_key, label, url, agent_modes, intent_tags, priority_weight, cooldown_messages, description) values
  ((select id from public.tenants where name = 'Afterlife'), 'unlock_access', 'Unlock Lifetime Access', 'https://u.payu.in/PAYUMN/SJZ8eFSdgfVZ', '{SALES}', '{pricing,purchase,buy}', 8, 5, 'Use when user shows clear purchase intent, has asked about pricing, is ready to buy.'),
  ((select id from public.tenants where name = 'Afterlife'), 'promo_offer', 'Get Started at ₹3,999', 'https://u.payu.in/PAYUMN/SJZ8eFSdgfVZ', '{SALES,ONBOARDING}', '{pricing,discount,value}', 7, 5, 'Use when user is price-sensitive or on the fence. Only when promo is active.'),
  ((select id from public.tenants where name = 'Afterlife'), 'book_demo', 'Book a Free Consultation', NULL, '{SALES,ONBOARDING,B2B}', '{consultation,demo,questions}', 6, 5, 'Use when user wants to talk to someone, has complex questions, or is a B2B lead.'),
  ((select id from public.tenants where name = 'Afterlife'), 'download_app', 'Download the App', 'https://play.google.com/store/apps/details?id=in.myafterlife.app', '{ONBOARDING}', '{app,try,explore}', 5, 8, 'Use when user wants to see the product or try it.'),
  ((select id from public.tenants where name = 'Afterlife'), 'learn_vault', 'See How the Digital Vault Works', NULL, '{ONBOARDING,SUPPORT}', '{vault,storage,security,documents}', 4, 6, 'Use when user asks about document storage, security, how their data is kept.'),
  ((select id from public.tenants where name = 'Afterlife'), 'learn_will', 'Create Your Digital Will', NULL, '{ONBOARDING,SALES}', '{will,succession,estate,legal}', 5, 6, 'Use when user asks about wills, succession, estate planning.'),
  ((select id from public.tenants where name = 'Afterlife'), 'callback_b2b', 'Get a Callback from Our Team', NULL, '{B2B}', '{corporate,partnership,advisor,bulk}', 7, 3, 'Use for B2B visitors who prefer callback over booking link.'),
  ((select id from public.tenants where name = 'Afterlife'), 'refer_friend', 'Refer a Friend, Get 3 Months Free', NULL, '{SUPPORT}', '{referral,share,recommend}', 3, 10, 'Use for existing users who are happy and engaged. Post-resolution only.');

-- ============================================================
-- 4. CONVERSATIONS — Chat sessions
-- ============================================================
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  channel text not null default 'web', -- web, whatsapp, in_app
  channel_user_id text, -- WhatsApp phone number or widget session ID
  user_id uuid, -- FK to users table (set after identification)
  audience_type text default 'B2C', -- B2C, B2B
  status text default 'active', -- active, resolved, handed_off, abandoned
  current_agent_mode text default 'ONBOARDING', -- SUPPORT, ONBOARDING, SALES
  page_context text, -- Which page the user was on when chat started
  metadata jsonb default '{}',
  started_at timestamptz default now(),
  ended_at timestamptz,
  updated_at timestamptz default now()
);

create index idx_conversations_tenant on public.conversations(tenant_id);
create index idx_conversations_status on public.conversations(status) where status = 'active';

-- ============================================================
-- 5. MESSAGES — Individual messages with metadata
-- ============================================================
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null, -- user, assistant, system
  content text not null,
  intent text, -- SUPPORT, ONBOARDING, SALES, B2B_ENQUIRY, GENERAL, HANDOFF_NEEDED
  agent_mode text, -- Which agent mode generated this response
  cta_shown text, -- CTA key if a CTA was included in this message
  confidence_score real, -- RAG retrieval confidence for this response
  token_usage jsonb, -- {input_tokens, output_tokens, model}
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create index idx_messages_conversation on public.messages(conversation_id);

-- ============================================================
-- 6. HANDOFF_REQUESTS — Human handoff + B2B callback queue
-- ============================================================
create table public.handoff_requests (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  question text not null, -- The unanswered question or B2B enquiry
  contact_name text,
  contact_email text,
  contact_phone text,
  contact_mode text, -- call, whatsapp, email
  time_preference text,
  lead_type text default 'B2C', -- B2C, B2B
  company_name text, -- For B2B leads
  status text default 'pending', -- pending, in_progress, completed, cancelled
  assigned_to text,
  admin_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_handoff_tenant_status on public.handoff_requests(tenant_id, status);

-- ============================================================
-- 7. UNANSWERED_QUESTIONS — Knowledge gap queue
-- ============================================================
create table public.unanswered_questions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  conversation_id uuid references public.conversations(id),
  question text not null,
  context text, -- Surrounding conversation context
  frequency integer default 1, -- How many times this Q has been asked
  status text default 'pending', -- pending, answered, dismissed
  answer text, -- Admin-provided answer
  knowledge_article_id uuid references public.knowledge_articles(id), -- Link to created KB article
  created_at timestamptz default now(),
  answered_at timestamptz,
  updated_at timestamptz default now()
);

create index idx_unanswered_tenant_status on public.unanswered_questions(tenant_id, status);

-- ============================================================
-- 8. USERS — End users across channels
-- ============================================================
create table public.users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  channel text not null default 'web', -- web, whatsapp, in_app
  channel_user_id text, -- WhatsApp number, session ID, etc.
  name text,
  email text,
  phone text,
  audience_type text default 'B2C', -- B2C, B2B
  company_name text, -- For B2B users
  metadata jsonb default '{}',
  conversation_count integer default 0,
  first_seen timestamptz default now(),
  last_seen timestamptz default now()
);

create index idx_users_tenant on public.users(tenant_id);
create index idx_users_channel on public.users(channel, channel_user_id);

-- ============================================================
-- RLS Policies (basic — tighten for production)
-- ============================================================
alter table public.tenants enable row level security;
alter table public.knowledge_articles enable row level security;
alter table public.ctas enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.handoff_requests enable row level security;
alter table public.unanswered_questions enable row level security;
alter table public.users enable row level security;

-- Service role can do everything (backend API uses service role key)
create policy "Service role full access" on public.tenants for all using (true) with check (true);
create policy "Service role full access" on public.knowledge_articles for all using (true) with check (true);
create policy "Service role full access" on public.ctas for all using (true) with check (true);
create policy "Service role full access" on public.conversations for all using (true) with check (true);
create policy "Service role full access" on public.messages for all using (true) with check (true);
create policy "Service role full access" on public.handoff_requests for all using (true) with check (true);
create policy "Service role full access" on public.unanswered_questions for all using (true) with check (true);
create policy "Service role full access" on public.users for all using (true) with check (true);

-- ============================================================
-- Helper function: Search knowledge articles by embedding similarity
-- ============================================================
create or replace function match_knowledge(
  query_embedding vector(1536),
  match_tenant_id uuid,
  match_threshold float default 0.7,
  match_count int default 5
)
returns table (
  id uuid,
  title text,
  content text,
  category text,
  similarity float
)
language sql stable
as $$
  select
    ka.id,
    ka.title,
    ka.content,
    ka.category,
    1 - (ka.embedding <=> query_embedding) as similarity
  from public.knowledge_articles ka
  where ka.tenant_id = match_tenant_id
    and ka.is_active = true
    and 1 - (ka.embedding <=> query_embedding) > match_threshold
  order by ka.embedding <=> query_embedding
  limit match_count;
$$;

-- ============================================================
-- Updated_at trigger
-- ============================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger tenants_updated_at before update on public.tenants for each row execute function update_updated_at();
create trigger knowledge_articles_updated_at before update on public.knowledge_articles for each row execute function update_updated_at();
create trigger ctas_updated_at before update on public.ctas for each row execute function update_updated_at();
create trigger conversations_updated_at before update on public.conversations for each row execute function update_updated_at();
create trigger handoff_requests_updated_at before update on public.handoff_requests for each row execute function update_updated_at();
create trigger unanswered_questions_updated_at before update on public.unanswered_questions for each row execute function update_updated_at();
create trigger users_updated_at before update on public.users for each row execute function update_updated_at();
