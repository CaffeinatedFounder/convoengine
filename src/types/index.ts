// ============================================================
// ConvoEngine — Core Type Definitions
// ============================================================

export type AgentMode = 'SUPPORT' | 'ONBOARDING' | 'SALES';

export type Intent =
  | 'SUPPORT'
  | 'ONBOARDING'
  | 'SALES'
  | 'B2B_ENQUIRY'
  | 'GENERAL'
  | 'HANDOFF_NEEDED';

export type Channel = 'WEB' | 'WHATSAPP' | 'IN_APP';

export type AudienceType = 'B2C' | 'B2B';

export type ConversationStatus = 'active' | 'resolved' | 'handed_off' | 'abandoned';

export type HandoffStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export type UnansweredStatus = 'pending' | 'answered' | 'dismissed';

// ---- Database Types ----

export interface Tenant {
  id: string;
  name: string;
  industry: string | null;
  config: Record<string, unknown>;
  tone_preferences: string | null;
  brand_voice: string | null;
  welcome_message: string;
  notification_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeArticle {
  id: string;
  tenant_id: string;
  title: string | null;
  content: string;
  source_type: 'manual' | 'document' | 'url' | 'unanswered_q';
  source_reference: string | null;
  category: string | null;
  metadata: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CTA {
  id: string;
  tenant_id: string;
  cta_key: string;
  label: string;
  url: string | null;
  action_type: 'link' | 'callback_form' | 'internal';
  agent_modes: string[];
  intent_tags: string[];
  priority_weight: number;
  cooldown_messages: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  tenant_id: string;
  channel: Channel;
  channel_user_id: string | null;
  user_id: string | null;
  audience_type: AudienceType;
  status: ConversationStatus;
  current_agent_mode: AgentMode;
  page_context: string | null;
  metadata: Record<string, unknown>;
  started_at: string;
  ended_at: string | null;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  intent: Intent | null;
  agent_mode: AgentMode | null;
  cta_shown: string | null;
  confidence_score: number | null;
  token_usage: { input_tokens: number; output_tokens: number; model: string } | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface HandoffRequest {
  id: string;
  conversation_id: string;
  tenant_id: string;
  question: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_mode: string | null;
  time_preference: string | null;
  lead_type: AudienceType;
  company_name: string | null;
  status: HandoffStatus;
  assigned_to: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface UnansweredQuestion {
  id: string;
  tenant_id: string;
  conversation_id: string | null;
  question: string;
  context: string | null;
  frequency: number;
  status: UnansweredStatus;
  answer: string | null;
  knowledge_article_id: string | null;
  created_at: string;
  answered_at: string | null;
  updated_at: string;
}

export interface User {
  id: string;
  tenant_id: string;
  channel: Channel;
  channel_user_id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  audience_type: AudienceType;
  company_name: string | null;
  metadata: Record<string, unknown>;
  conversation_count: number;
  first_seen: string;
  last_seen: string;
}

// ---- API Types ----

export interface ChatRequest {
  message: string;
  conversation_id?: string;
  visitor_id?: string;
  page_context?: string;
}

export interface ChatResponse {
  response: string;
  conversation_id: string;
  agent_mode: AgentMode;
  intent: Intent;
  requires_handoff?: boolean;
  cta?: {
    key: string;
    label: string;
    url?: string;
  };
}

export interface KnowledgeMatch {
  id: string;
  title: string | null;
  content: string;
  category: string | null;
  similarity: number;
}

// ---- CTA Scoring ----

export interface CTAScore {
  cta: CTA;
  total_score: number;
  breakdown: {
    intent_match: number;
    agent_mode_match: number;
    conversation_stage: number;
    engagement_level: number;
    priority_weight: number;
  };
}
