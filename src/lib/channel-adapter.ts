// ============================================================
// Module 1: Channel Adapter — Normalize input from all channels
// ============================================================

import type { Channel } from '@/types';

/**
 * Normalized message format from any channel.
 */
export interface NormalizedMessage {
  channel: Channel;
  channelUserId: string;
  text: string;
  conversationId?: string;
  tenantId: string;
  pageContext?: string; // URL path or screen name where chat was initiated
  metadata?: Record<string, unknown>;
}

/**
 * Normalize a web widget chat request.
 */
export function normalizeWebMessage(body: {
  message: string;
  conversation_id?: string;
  tenant_id?: string;
  page_context?: string;
  visitor_id?: string;
}): NormalizedMessage {
  return {
    channel: 'WEB',
    channelUserId: body.visitor_id || `web_${Date.now()}`,
    text: body.message.trim(),
    conversationId: body.conversation_id,
    tenantId: body.tenant_id || process.env.DEFAULT_TENANT_ID || '',
    pageContext: body.page_context,
  };
}

/**
 * Normalize an incoming WhatsApp message (from Meta webhook).
 */
export function normalizeWhatsAppMessage(payload: {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          from: string;
          text?: { body: string };
          id: string;
        }>;
        metadata?: { phone_number_id: string };
      };
    }>;
  }>;
}): NormalizedMessage | null {
  try {
    const entry = payload.entry?.[0];
    const change = entry?.changes?.[0];
    const message = change?.value?.messages?.[0];

    if (!message || !message.text?.body) return null;

    return {
      channel: 'WHATSAPP',
      channelUserId: message.from, // WhatsApp phone number
      text: message.text.body.trim(),
      tenantId: process.env.DEFAULT_TENANT_ID || '',
      metadata: {
        whatsapp_message_id: message.id,
        phone_number_id: change?.value?.metadata?.phone_number_id,
      },
    };
  } catch {
    console.error('Failed to normalize WhatsApp message');
    return null;
  }
}

/**
 * Normalize an in-app chat message (future).
 */
export function normalizeInAppMessage(body: {
  message: string;
  user_id: string;
  conversation_id?: string;
  tenant_id?: string;
  screen_context?: string;
}): NormalizedMessage {
  return {
    channel: 'IN_APP',
    channelUserId: body.user_id,
    text: body.message.trim(),
    conversationId: body.conversation_id,
    tenantId: body.tenant_id || process.env.DEFAULT_TENANT_ID || '',
    pageContext: body.screen_context,
  };
}
