// ============================================================
// Module 2: Context Manager — Conversation state management
// ============================================================

import { createServerClient } from './supabase';
import type {
  Conversation,
  Message,
  Channel,
  AgentMode,
  AudienceType,
  Intent,
} from '@/types';

/**
 * Get or create a conversation.
 */
export async function getOrCreateConversation(params: {
  conversationId?: string;
  tenantId: string;
  channel: Channel;
  channelUserId?: string;
  pageContext?: string;
}): Promise<Conversation> {
  const supabase = createServerClient();

  // If conversation ID provided, fetch it
  if (params.conversationId) {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', params.conversationId)
      .single();

    if (data && !error) return data as Conversation;
  }

  // Create new conversation
  const { data, error } = await supabase
    .from('conversations')
    .insert({
      tenant_id: params.tenantId,
      channel: params.channel,
      channel_user_id: params.channelUserId,
      page_context: params.pageContext,
      current_agent_mode: 'ONBOARDING', // Default
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create conversation: ${error.message}`);
  return data as Conversation;
}

/**
 * Get conversation history (recent messages).
 */
export async function getConversationHistory(
  conversationId: string,
  limit: number = 15
): Promise<Message[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Failed to fetch history:', error);
    return [];
  }

  return (data ?? []) as Message[];
}

/**
 * Save a message to the conversation.
 */
export async function saveMessage(params: {
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  intent?: Intent;
  agentMode?: AgentMode;
  ctaShown?: string;
  confidenceScore?: number;
  tokenUsage?: { input_tokens: number; output_tokens: number; model: string };
}): Promise<Message> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: params.conversationId,
      role: params.role,
      content: params.content,
      intent: params.intent,
      agent_mode: params.agentMode,
      cta_shown: params.ctaShown,
      confidence_score: params.confidenceScore,
      token_usage: params.tokenUsage,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to save message: ${error.message}`);
  return data as Message;
}

/**
 * Update conversation state (agent mode, audience type, status).
 */
export async function updateConversation(
  conversationId: string,
  updates: Partial<{
    current_agent_mode: AgentMode;
    audience_type: AudienceType;
    status: string;
    ended_at: string;
  }>
): Promise<void> {
  const supabase = createServerClient();

  const { error } = await supabase
    .from('conversations')
    .update(updates)
    .eq('id', conversationId);

  if (error) console.error('Failed to update conversation:', error);
}

/**
 * Create a handoff request.
 */
export async function createHandoffRequest(params: {
  conversationId: string;
  tenantId: string;
  question: string;
  leadType?: AudienceType;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  contactMode?: string;
  timePreference?: string;
  companyName?: string;
}): Promise<string> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('handoff_requests')
    .insert({
      conversation_id: params.conversationId,
      tenant_id: params.tenantId,
      question: params.question,
      lead_type: params.leadType || 'B2C',
      contact_name: params.contactName,
      contact_phone: params.contactPhone,
      contact_email: params.contactEmail,
      contact_mode: params.contactMode,
      time_preference: params.timePreference,
      company_name: params.companyName,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to create handoff: ${error.message}`);
  return data.id;
}

/**
 * Queue an unanswered question for admin review.
 */
export async function queueUnansweredQuestion(params: {
  tenantId: string;
  conversationId: string;
  question: string;
  context?: string;
}): Promise<void> {
  const supabase = createServerClient();

  // Check if a similar question already exists
  const { data: existing } = await supabase
    .from('unanswered_questions')
    .select('id, frequency')
    .eq('tenant_id', params.tenantId)
    .eq('status', 'pending')
    .ilike('question', `%${params.question.substring(0, 50)}%`)
    .limit(1);

  if (existing && existing.length > 0) {
    // Increment frequency counter
    await supabase
      .from('unanswered_questions')
      .update({ frequency: existing[0].frequency + 1 })
      .eq('id', existing[0].id);
  } else {
    // Create new unanswered question
    await supabase.from('unanswered_questions').insert({
      tenant_id: params.tenantId,
      conversation_id: params.conversationId,
      question: params.question,
      context: params.context,
    });
  }
}
