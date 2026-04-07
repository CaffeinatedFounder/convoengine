// ============================================================
// Module 4: Intent Classifier — LLM-based intent analysis
// ============================================================

import { chatCompletion } from './openai';
import type { Intent, Message } from '@/types';

const CLASSIFICATION_PROMPT = `You are an intent classifier for Afterlife, a digital succession planning platform.
Analyse the user's message in the context of the conversation history and classify their intent.

INTENT CATEGORIES:
- SUPPORT: User has a problem, issue, confusion, needs help with something. Signals: "not working", "issue", "help", "error", "can't access", "vault problem", frustration.
- ONBOARDING: User is new, exploring, asking about features. Signals: "how does this work", "what is Afterlife", "digital will", "tell me about", "new here", exploratory questions.
- SALES: User shows purchase intent. Signals: "pricing", "cost", "₹7999", "subscribe", "buy", "worth it", "what do I get", comparison questions.
- B2B_ENQUIRY: Corporate, partnership, or advisor queries. Signals: "corporate", "employee benefit", "for my clients", "partnership", "bulk", "advisor", "integration".
- GENERAL: Greetings, small talk, off-topic, ambiguous.
- HANDOFF_NEEDED: User explicitly requests human, mentions bereavement/loss in a way that needs human sensitivity, or asks something completely outside Afterlife's scope.

RULES:
- Consider the FULL conversation history, not just the latest message.
- If the user mentions death, loss, or bereavement in a personal context, classify as HANDOFF_NEEDED.
- If ambiguous, default to the current conversation flow (look at prior intents).
- B2B signals should override other intents — corporate/partnership queries are always B2B_ENQUIRY.

Respond with ONLY a JSON object: {"intent": "INTENT_NAME", "confidence": 0.0-1.0, "reasoning": "brief explanation"}`;

/**
 * Classify the intent of a user message using LLM.
 */
export async function classifyIntent(
  userMessage: string,
  conversationHistory: Pick<Message, 'role' | 'content'>[],
  currentAgentMode?: string
): Promise<{ intent: Intent; confidence: number; reasoning: string }> {
  // Build context from recent history
  const recentHistory = conversationHistory.slice(-10).map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  // Add current message
  const messages = [
    ...recentHistory,
    {
      role: 'user' as const,
      content: `Current agent mode: ${currentAgentMode || 'ONBOARDING'}\n\nClassify this message: "${userMessage}"`,
    },
  ];

  const result = await chatCompletion(CLASSIFICATION_PROMPT, messages, {
    temperature: 0.1, // Low temp for consistent classification
    max_tokens: 200,
    response_format: { type: 'json_object' },
  });

  try {
    const parsed = JSON.parse(result.content);
    return {
      intent: parsed.intent as Intent,
      confidence: parsed.confidence ?? 0.8,
      reasoning: parsed.reasoning ?? '',
    };
  } catch {
    // Fallback if JSON parsing fails
    return {
      intent: 'GENERAL',
      confidence: 0.5,
      reasoning: 'Failed to parse classification response',
    };
  }
}
