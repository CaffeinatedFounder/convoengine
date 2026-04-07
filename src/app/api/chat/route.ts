// ============================================================
// Main Chat API Route — The Orchestrator
// Ties all 7 modules together in sequence:
//   1. Channel Adapter → normalize input
//   2. Context Manager → get/create conversation, load history
//   3. Knowledge Retriever → RAG search for relevant KB articles
//   4. Intent Classifier → determine user intent via LLM
//   5. Agent Mode Engine → select persona + generate response
//   6. CTA Router → score and inject best CTA
//   7. Handoff Manager → handle human handoff if needed
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { normalizeWebMessage } from '@/lib/channel-adapter';
import {
  getOrCreateConversation,
  getConversationHistory,
  saveMessage,
  updateConversation,
  queueUnansweredQuestion,
} from '@/lib/context-manager';
import { searchKnowledge, isLowConfidence } from '@/lib/knowledge-retriever';
import { classifyIntent } from '@/lib/intent-classifier';
import {
  determineAgentMode,
  generateResponse,
  generateHandoffResponse,
  generateClarifyingQuestion,
} from '@/lib/agent-mode-engine';
import { selectCTA, getRecentCTAKeys } from '@/lib/cta-router';
import { processHandoff } from '@/lib/handoff-manager';
import type { ChatRequest, ChatResponse, Intent } from '@/types';

// Default tenant ID (Afterlife)
const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || '';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ChatRequest;

    // ---- Step 1: Channel Adapter — Normalize input ----
    const normalized = normalizeWebMessage({
      message: body.message,
      conversation_id: body.conversation_id,
      tenant_id: DEFAULT_TENANT_ID,
      page_context: body.page_context,
      visitor_id: body.visitor_id,
    });

    if (!normalized.text) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    if (!normalized.tenantId) {
      return NextResponse.json(
        { error: 'Tenant not configured' },
        { status: 500 }
      );
    }

    // ---- Step 2: Context Manager — Get/create conversation + history ----
    const conversation = await getOrCreateConversation({
      conversationId: normalized.conversationId,
      tenantId: normalized.tenantId,
      channel: normalized.channel,
      channelUserId: normalized.channelUserId,
      pageContext: normalized.pageContext,
    });

    const history = await getConversationHistory(conversation.id);

    // Save the user's message
    await saveMessage({
      conversationId: conversation.id,
      role: 'user',
      content: normalized.text,
    });

    // ---- Step 3: Knowledge Retriever — RAG search ----
    const { matches: knowledgeMatches, topConfidence } = await searchKnowledge(
      normalized.text,
      normalized.tenantId
    );

    // ---- Step 4: Intent Classifier — Determine intent ----
    const { intent, confidence: intentConfidence } = await classifyIntent(
      normalized.text,
      history.map((m) => ({ role: m.role, content: m.content })),
      conversation.current_agent_mode
    );

    // ---- Step 5: Agent Mode Engine — Determine mode ----
    const agentMode = determineAgentMode(intent, conversation.current_agent_mode);

    // Update conversation with new agent mode if changed
    if (agentMode !== conversation.current_agent_mode) {
      await updateConversation(conversation.id, {
        current_agent_mode: agentMode,
      });
    }

    // ---- Handle special cases ----

    // Case A: Handoff needed — personal bereavement or explicit human request
    if (intent === 'HANDOFF_NEEDED') {
      const isB2B = conversation.audience_type === 'B2B';
      const handoffResponse = await generateHandoffResponse(
        normalized.text,
        isB2B
      );

      await saveMessage({
        conversationId: conversation.id,
        role: 'assistant',
        content: handoffResponse,
        intent,
        agentMode,
      });

      const response: ChatResponse = {
        response: handoffResponse,
        conversation_id: conversation.id,
        agent_mode: agentMode,
        intent,
        requires_handoff: true,
      };

      return NextResponse.json(response);
    }

    // Case B: Low confidence on KB match + ambiguous intent — ask clarifying question
    if (isLowConfidence(topConfidence) && intentConfidence < 0.7) {
      const clarifyResponse = await generateClarifyingQuestion(normalized.text);

      // Queue this as an unanswered question for admin review
      await queueUnansweredQuestion({
        tenantId: normalized.tenantId,
        conversationId: conversation.id,
        question: normalized.text,
        context: `Intent: ${intent} (${intentConfidence}), KB confidence: ${topConfidence}`,
      });

      await saveMessage({
        conversationId: conversation.id,
        role: 'assistant',
        content: clarifyResponse,
        intent,
        agentMode,
        confidenceScore: topConfidence,
      });

      const response: ChatResponse = {
        response: clarifyResponse,
        conversation_id: conversation.id,
        agent_mode: agentMode,
        intent,
      };

      return NextResponse.json(response);
    }

    // ---- Step 6: CTA Router — Score and select best CTA ----
    const recentCTAKeys = await getRecentCTAKeys(conversation.id);
    const isEmotionalContext = detectEmotionalContext(normalized.text, intent);

    const ctaResult = await selectCTA({
      tenantId: normalized.tenantId,
      intent,
      agentMode,
      messageCount: history.length + 1,
      recentCTAKeys,
      isEmotionalContext,
    });

    // ---- Step 5b: Generate LLM response ----
    const llmResult = await generateResponse({
      userMessage: normalized.text,
      conversationHistory: history.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      knowledgeMatches,
      agentMode,
      intent,
      ctaInstruction: ctaResult?.instruction,
    });

    // ---- Save assistant message ----
    await saveMessage({
      conversationId: conversation.id,
      role: 'assistant',
      content: llmResult.content,
      intent,
      agentMode,
      ctaShown: ctaResult?.cta.cta_key,
      confidenceScore: topConfidence,
      tokenUsage: llmResult.usage,
    });

    // If low KB confidence (but we still responded), queue for review
    if (isLowConfidence(topConfidence)) {
      await queueUnansweredQuestion({
        tenantId: normalized.tenantId,
        conversationId: conversation.id,
        question: normalized.text,
        context: `Answered with low confidence (${topConfidence}). Intent: ${intent}`,
      });
    }

    // Detect B2B audience and update conversation
    if (intent === 'B2B_ENQUIRY' && conversation.audience_type !== 'B2B') {
      await updateConversation(conversation.id, { audience_type: 'B2B' });
    }

    // ---- Build response ----
    const response: ChatResponse = {
      response: llmResult.content,
      conversation_id: conversation.id,
      agent_mode: agentMode,
      intent,
      cta: ctaResult
        ? {
            key: ctaResult.cta.cta_key,
            label: ctaResult.cta.label,
            url: ctaResult.cta.url || undefined,
          }
        : undefined,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}

// ---- Helper: Detect emotional context ----

function detectEmotionalContext(message: string, intent: Intent): boolean {
  if (intent === 'HANDOFF_NEEDED') return true;

  const emotionalKeywords = [
    'passed away',
    'died',
    'death',
    'lost my',
    'bereavement',
    'grief',
    'mourning',
    'funeral',
    'miss them',
    'miss him',
    'miss her',
    'gone forever',
    'no more',
    'rip',
    'rest in peace',
  ];

  const lowerMessage = message.toLowerCase();
  return emotionalKeywords.some((kw) => lowerMessage.includes(kw));
}

// ---- CORS: Handle OPTIONS preflight ----

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
