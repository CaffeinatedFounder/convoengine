import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

const TENANT_ID = process.env.DEFAULT_TENANT_ID || '';

export async function GET() {
  const supabase = createServerClient();

  const [conversations, active, unanswered, handoffs, knowledge, ctas] =
    await Promise.all([
      supabase.from('conversations').select('id', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID),
      supabase.from('conversations').select('id', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).eq('status', 'active'),
      supabase.from('unanswered_questions').select('id', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).eq('status', 'pending'),
      supabase.from('handoff_requests').select('id', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).eq('status', 'pending'),
      supabase.from('knowledge_articles').select('id', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).eq('is_active', true),
      supabase.from('ctas').select('id', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).eq('is_active', true),
    ]);

  return NextResponse.json({
    totalConversations: conversations.count ?? 0,
    activeConversations: active.count ?? 0,
    unansweredQuestions: unanswered.count ?? 0,
    pendingHandoffs: handoffs.count ?? 0,
    knowledgeArticles: knowledge.count ?? 0,
    activeCTAs: ctas.count ?? 0,
  });
}
