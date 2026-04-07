// ============================================================
// Module 6: CTA Router — Dynamic CTA selection based on context
// ============================================================

import { createServerClient } from './supabase';
import type { CTA, CTAScore, Intent, AgentMode } from '@/types';

const MIN_CTA_SCORE = 5; // Minimum score to show a CTA

/**
 * Score and select the best CTA for the current conversation context.
 */
export async function selectCTA(params: {
  tenantId: string;
  intent: Intent;
  agentMode: AgentMode;
  messageCount: number; // How many messages in this conversation
  recentCTAKeys: string[]; // CTAs shown recently (for cooldown check)
  isEmotionalContext: boolean; // Suppress sales CTAs in emotional moments
}): Promise<{ cta: CTA; instruction: string } | null> {
  const {
    tenantId,
    intent,
    agentMode,
    messageCount,
    recentCTAKeys,
    isEmotionalContext,
  } = params;

  // Suppress all CTAs in emotional/bereavement context
  if (isEmotionalContext) return null;

  // Don't show CTAs for HANDOFF_NEEDED intent
  if (intent === 'HANDOFF_NEEDED') return null;

  // Fetch all active CTAs for this tenant
  const supabase = createServerClient();
  const { data: ctas, error } = await supabase
    .from('ctas')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true);

  if (error || !ctas || ctas.length === 0) return null;

  // Score each CTA
  const scored: CTAScore[] = ctas.map((cta: CTA) => {
    const breakdown = {
      intent_match: scoreIntentMatch(cta, intent),
      agent_mode_match: scoreAgentModeMatch(cta, agentMode, intent),
      conversation_stage: scoreConversationStage(cta, messageCount),
      engagement_level: 1, // Default; can be enhanced with engagement tracking
      priority_weight: cta.priority_weight,
    };

    // Cooldown check — if this CTA was shown recently, score = 0
    const isCoolingDown = recentCTAKeys.includes(cta.cta_key);
    const total_score = isCoolingDown
      ? 0
      : breakdown.intent_match +
        breakdown.agent_mode_match +
        breakdown.conversation_stage +
        breakdown.engagement_level +
        breakdown.priority_weight;

    return { cta, total_score, breakdown };
  });

  // Sort by score, pick the best
  scored.sort((a, b) => b.total_score - a.total_score);
  const best = scored[0];

  if (!best || best.total_score < MIN_CTA_SCORE) return null;

  // Generate CTA instruction for the LLM
  const instruction = generateCTAInstruction(best.cta);

  return { cta: best.cta, instruction };
}

// ---- Scoring Functions ----

function scoreIntentMatch(cta: CTA, intent: Intent): number {
  // Map intent to likely tags
  const intentTagMap: Record<string, string[]> = {
    SUPPORT: ['help', 'issue', 'support'],
    ONBOARDING: ['explore', 'features', 'learn', 'app', 'try'],
    SALES: ['pricing', 'purchase', 'buy', 'value', 'discount'],
    B2B_ENQUIRY: ['corporate', 'partnership', 'advisor', 'bulk'],
    GENERAL: [],
  };

  const relevantTags = intentTagMap[intent] || [];
  const matchCount = cta.intent_tags.filter((tag) =>
    relevantTags.some((rt) => tag.includes(rt) || rt.includes(tag))
  ).length;

  return Math.min(matchCount, 3); // Cap at 3
}

function scoreAgentModeMatch(cta: CTA, agentMode: AgentMode, intent: Intent): number {
  // For B2B, check if CTA supports B2B
  if (intent === 'B2B_ENQUIRY') {
    return cta.agent_modes.includes('B2B') ? 2 : 0;
  }
  return cta.agent_modes.includes(agentMode) ? 2 : 0;
}

function scoreConversationStage(cta: CTA, messageCount: number): number {
  // Early conversation (< 4 messages) = prefer onboarding CTAs
  // Mid conversation (4-10) = any CTA is fine
  // Late conversation (> 10) = prefer sales CTAs
  const isOnboardingCTA = cta.agent_modes.includes('ONBOARDING');
  const isSalesCTA = cta.agent_modes.includes('SALES');

  if (messageCount < 4) {
    return isOnboardingCTA ? 2 : 0;
  } else if (messageCount > 10) {
    return isSalesCTA ? 2 : 1;
  }
  return 1;
}

// ---- CTA Instruction for LLM ----

function generateCTAInstruction(cta: CTA): string {
  const urlPart = cta.url ? ` Link: ${cta.url}` : '';
  return `Naturally weave this call-to-action into your response (don't force it — only include if it fits the conversation naturally): "${cta.label}"${urlPart}. Context for when to use it: ${cta.description || 'Use when relevant.'}. Do NOT present it as a separate button — integrate it into your conversational response.`;
}

/**
 * Get recently shown CTA keys from conversation messages.
 */
export async function getRecentCTAKeys(
  conversationId: string,
  cooldownMessages: number = 5
): Promise<string[]> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from('messages')
    .select('cta_shown')
    .eq('conversation_id', conversationId)
    .not('cta_shown', 'is', null)
    .order('created_at', { ascending: false })
    .limit(cooldownMessages);

  return (data ?? []).map((m) => m.cta_shown).filter(Boolean) as string[];
}
