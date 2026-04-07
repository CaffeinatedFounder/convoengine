// ============================================================
// WhatsApp Webhook — Meta Cloud API integration
// Handles: verification (GET) + incoming messages (POST)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { normalizeWhatsAppMessage } from '@/lib/channel-adapter';
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

const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || '';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || '';
const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || '';

// ---- GET: Webhook Verification (Meta requires this) ----
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse('Forbidden', { status: 403 });
}

// ---- POST: Incoming Messages ----
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    // Normalize the WhatsApp message
    const normalized = normalizeWhatsAppMessage(payload);
    if (!normalized) {
      // Not a text message (could be status update, delivery receipt, etc.)
      return NextResponse.json({ status: 'ok' });
    }

    normalized.tenantId = DEFAULT_TENANT_ID;

    // Get or create conversation (keyed by WhatsApp phone number)
    const conversation = await getOrCreateConversation({
      tenantId: normalized.tenantId,
      channel: 'WHATSAPP',
      channelUserId: normalized.channelUserId,
    });

    const history = await getConversationHistory(conversation.id);

    // Save user message
    await saveMessage({
      conversationId: conversation.id,
      role: 'user',
      content: normalized.text,
    });

    // Knowledge search
    const { matches: knowledgeMatches, topConfidence } = await searchKnowledge(
      normalized.text,
      normalized.tenantId
    );

    // Intent classification
    const { intent, confidence: intentConfidence } = await classifyIntent(
      normalized.text,
      history.map((m) => ({ role: m.role, content: m.content })),
      conversation.current_agent_mode
    );

    // Agent mode
    const agentMode = determineAgentMode(intent, conversation.current_agent_mode);
    if (agentMode !== conversation.current_agent_mode) {
      await updateConversation(conversation.id, { current_agent_mode: agentMode });
    }

    let responseText: string;

    // Handle special cases
    if (intent === 'HANDOFF_NEEDED') {
      responseText = await generateHandoffResponse(
        normalized.text,
        conversation.audience_type === 'B2B'
      );
    } else if (isLowConfidence(topConfidence) && intentConfidence < 0.7) {
      responseText = await generateClarifyingQuestion(normalized.text);
      await queueUnansweredQuestion({
        tenantId: normalized.tenantId,
        conversationId: conversation.id,
        question: normalized.text,
      });
    } else {
      // Normal flow with CTA
      const recentCTAKeys = await getRecentCTAKeys(conversation.id);
      const ctaResult = await selectCTA({
        tenantId: normalized.tenantId,
        intent,
        agentMode,
        messageCount: history.length + 1,
        recentCTAKeys,
        isEmotionalContext: intent === 'HANDOFF_NEEDED',
      });

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

      responseText = llmResult.content;

      // Save with metadata
      await saveMessage({
        conversationId: conversation.id,
        role: 'assistant',
        content: responseText,
        intent,
        agentMode,
        ctaShown: ctaResult?.cta.cta_key,
        confidenceScore: topConfidence,
        tokenUsage: llmResult.usage,
      });

      // Queue low-confidence questions
      if (isLowConfidence(topConfidence)) {
        await queueUnansweredQuestion({
          tenantId: normalized.tenantId,
          conversationId: conversation.id,
          question: normalized.text,
          context: `Low confidence (${topConfidence}). Intent: ${intent}`,
        });
      }

      // Send WhatsApp reply
      await sendWhatsAppMessage(normalized.channelUserId, responseText, normalized.metadata);
      return NextResponse.json({ status: 'ok' });
    }

    // Save and send for special cases
    await saveMessage({
      conversationId: conversation.id,
      role: 'assistant',
      content: responseText,
      intent,
      agentMode,
    });

    await sendWhatsAppMessage(normalized.channelUserId, responseText, normalized.metadata);

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    // Always return 200 to Meta (they'll retry on non-200)
    return NextResponse.json({ status: 'error' });
  }
}

// ---- Send WhatsApp Message via Meta Cloud API ----
async function sendWhatsAppMessage(
  to: string,
  text: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const phoneNumberId = metadata?.phone_number_id as string;
  if (!phoneNumberId || !WHATSAPP_TOKEN) {
    console.error('WhatsApp not configured — missing phone_number_id or token');
    return;
  }

  try {
    // Strip markdown formatting for WhatsApp
    const cleanText = text
      .replace(/\*\*(.*?)\*\*/g, '*$1*') // Bold: ** → *
      .replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '$1: $2'); // Links: [text](url) → text: url

    await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: cleanText },
        }),
      }
    );
  } catch (err) {
    console.error('Failed to send WhatsApp message:', err);
  }
}
