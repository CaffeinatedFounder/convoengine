// ============================================================
// Module 7: Handoff Manager — Human handoff + notifications
// ============================================================

import { createServerClient } from './supabase';
import type { AudienceType } from '@/types';

// Resend email client (lazy init)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let resendClient: any = null;

async function getResend() {
  if (!resendClient) {
    const { Resend } = await import('resend');
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient!;
}

/**
 * Process a handoff — save contact details, notify team, update conversation.
 */
export async function processHandoff(params: {
  conversationId: string;
  tenantId: string;
  question: string;
  leadType: AudienceType;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  contactMode?: string;
  timePreference?: string;
  companyName?: string;
}): Promise<{ handoffId: string; message: string }> {
  const supabase = createServerClient();

  // 1. Create the handoff request in DB
  const { data, error } = await supabase
    .from('handoff_requests')
    .insert({
      conversation_id: params.conversationId,
      tenant_id: params.tenantId,
      question: params.question,
      lead_type: params.leadType,
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

  // 2. Update conversation status
  await supabase
    .from('conversations')
    .update({ status: 'handoff_pending' })
    .eq('id', params.conversationId);

  // 3. Send notification email to team
  await notifyTeam({
    handoffId: data.id,
    tenantId: params.tenantId,
    leadType: params.leadType,
    question: params.question,
    contactName: params.contactName,
    contactPhone: params.contactPhone,
    contactEmail: params.contactEmail,
    companyName: params.companyName,
  });

  return {
    handoffId: data.id,
    message: params.leadType === 'B2B'
      ? 'Our team will reach out within 24 hours to discuss how Afterlife can work for your organisation.'
      : 'Our team will get back to you shortly. In the meantime, feel free to ask me anything else about Afterlife.',
  };
}

/**
 * Send notification email to the Afterlife team about a new handoff.
 */
async function notifyTeam(params: {
  handoffId: string;
  tenantId: string;
  leadType: AudienceType;
  question: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  companyName?: string;
}): Promise<void> {
  // Get tenant notification email
  const supabase = createServerClient();
  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, notification_email')
    .eq('id', params.tenantId)
    .single();

  const notifyEmail = tenant?.notification_email || process.env.TEAM_NOTIFICATION_EMAIL;
  if (!notifyEmail) {
    console.warn('No notification email configured — skipping handoff notification');
    return;
  }

  try {
    const resend = await getResend();
    const isB2B = params.leadType === 'B2B';

    await resend.emails.send({
      from: 'ConvoEngine <notifications@myafterlife.in>',
      to: notifyEmail,
      subject: `🔔 New ${isB2B ? 'B2B' : 'B2C'} Lead — ${params.contactName || 'Anonymous'}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a2e;">New ${isB2B ? 'Business' : 'Customer'} Enquiry</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Name</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${params.contactName || 'Not provided'}</td></tr>
            ${params.contactPhone ? `<tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Phone</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${params.contactPhone}</td></tr>` : ''}
            ${params.contactEmail ? `<tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Email</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${params.contactEmail}</td></tr>` : ''}
            ${params.companyName ? `<tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Company</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${params.companyName}</td></tr>` : ''}
            <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Type</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${params.leadType}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Question</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${params.question}</td></tr>
          </table>
          <p style="margin-top: 16px; color: #666;">Handoff ID: ${params.handoffId}</p>
        </div>
      `,
    });
  } catch (err) {
    console.error('Failed to send handoff notification:', err);
    // Don't throw — the handoff is already saved in DB
  }
}

/**
 * Check if we're currently collecting handoff details from the user.
 * Returns the stage of collection (or null if not in handoff flow).
 */
export async function getHandoffState(
  conversationId: string
): Promise<'collecting_contact' | 'completed' | null> {
  const supabase = createServerClient();

  const { data } = await supabase
    .from('conversations')
    .select('status')
    .eq('id', conversationId)
    .single();

  if (data?.status === 'handoff_pending') return 'collecting_contact';
  if (data?.status === 'handoff_completed') return 'completed';
  return null;
}
