// ============================================================
// Module 5: Agent Mode Engine — Dynamic persona + response generation
// ============================================================

import { chatCompletion } from './openai';
import type { AgentMode, Intent, Message, KnowledgeMatch } from '@/types';
import { formatKnowledgeContext } from './knowledge-retriever';

// ---- Base System Prompt ----

const BASE_PROMPT = `You are the Afterlife assistant — a warm, knowledgeable guide for Afterlife, India's first digital succession planning platform.

CRITICAL RULES:
1. You may ONLY answer using the provided <knowledge> context. If the context does not contain the answer, say so honestly and offer to connect the user with the team.
2. NEVER make legal or financial guarantees. You provide information about Afterlife's services, not legal/financial advice.
3. NEVER hallucinate facts, statistics, or features not in the knowledge context.
4. When users mention bereavement, loss, or death in a personal context, lead with empathy. Never rush to a CTA in these moments.
5. Keep responses concise — 2-4 sentences unless the user asks for detail.
6. Use a warm, conversational tone. Like a knowledgeable friend, not a corporate chatbot.

ABOUT AFTERLIFE:
- ₹1.8 trillion+ lies unclaimed with Indian financial institutions
- Core features: Digital Vault, Digital Will, Trusted Contacts, Document Storage, Claim Assistance, Afterlife Messaging
- Pricing: ₹7,999 + GST one-time lifetime access (promo: ₹3,999 + GST)
- All features included. No recurring fees. One-time payment.
- Company: AL Experiences and Solutions Pvt. Ltd.`;

// ---- Agent Mode Prompts ----

const AGENT_PROMPTS: Record<AgentMode, string> = {
  SUPPORT: `CURRENT MODE: Support Agent
TONE: Empathetic, patient, reassuring. Acknowledge that succession planning can feel overwhelming.
STRATEGY: Acknowledge concern → provide clear solution from knowledge context → confirm resolution → offer additional help.
CTA APPROACH: Only AFTER resolution. Suggest a relevant next step if appropriate.
SENSITIVITY: If user mentions bereavement or loss, lead with empathy. "I'm sorry for what you're going through." before any product information.`,

  ONBOARDING: `CURRENT MODE: Onboarding Agent
TONE: Warm, educational, guiding. Like a knowledgeable friend explaining something important.
STRATEGY: Welcome → explain relevant features using the knowledge context → connect to their situation → guide toward next step.
CTA APPROACH: Gently guide toward trying the app, learning about specific features, or booking a consultation for complex questions.
KEY CONTENT: The ₹1.8 trillion unclaimed stat, how Digital Vault works, how Trusted Contacts work, the will creation process, pricing.`,

  SALES: `CURRENT MODE: Sales Agent
TONE: Confident, value-driven, persuasive but NEVER pushy. Succession planning is not an impulse buy — respect the decision.
STRATEGY: Highlight value (₹1.8T unclaimed, peace of mind) → address objections from knowledge context → create urgency naturally → present CTA.
CTA APPROACH: Direct when appropriate: "Unlock Lifetime Access", promo pricing, or "Book a consultation".
PRICING: ₹7,999 + GST (standard), ₹3,999 + GST (promo). One-time. Lifetime. All features. No recurring fees.`,
};

// ---- B2B Override Prompt ----

const B2B_PROMPT = `B2B MODE ACTIVE: The user appears to be asking about Afterlife for corporate/business use.
TONE: Professional, confident, solution-oriented.
KEY POINTS: Afterlife as an employee benefit, corporate pricing (₹7,999 standard / ₹1,999 bulk per employee), "The Forgotten File" workshop, ambassador/distributor program.
ACTION: Briefly explain the B2B value proposition, then offer to book a consultation or collect callback details.
EXAMPLE: "Afterlife works with companies like Wipro and Rehau to offer succession planning as an employee benefit. Would you like to book a quick call with our team to discuss how this could work for your organisation?"`;

// ---- Determine Agent Mode from Intent ----

export function determineAgentMode(
  intent: Intent,
  currentMode: AgentMode
): AgentMode {
  switch (intent) {
    case 'SUPPORT':
      return 'SUPPORT';
    case 'ONBOARDING':
      return 'ONBOARDING';
    case 'SALES':
      return 'SALES';
    case 'B2B_ENQUIRY':
      return 'SALES'; // Uses SALES mode with B2B override
    case 'GENERAL':
      return currentMode; // Stay in current mode
    case 'HANDOFF_NEEDED':
      return currentMode; // Stay in current mode, handoff handled separately
    default:
      return 'ONBOARDING';
  }
}

// ---- Generate Response ----

export async function generateResponse(params: {
  userMessage: string;
  conversationHistory: Pick<Message, 'role' | 'content'>[];
  knowledgeMatches: KnowledgeMatch[];
  agentMode: AgentMode;
  intent: Intent;
  ctaInstruction?: string;
}) {
  const {
    userMessage,
    conversationHistory,
    knowledgeMatches,
    agentMode,
    intent,
    ctaInstruction,
  } = params;

  // Assemble the full system prompt
  const knowledgeContext = formatKnowledgeContext(knowledgeMatches);
  const agentPrompt = AGENT_PROMPTS[agentMode];
  const b2bOverride = intent === 'B2B_ENQUIRY' ? `\n\n${B2B_PROMPT}` : '';
  const ctaSection = ctaInstruction
    ? `\n\nCTA INSTRUCTION: ${ctaInstruction}`
    : '';

  const systemPrompt = `${BASE_PROMPT}

${agentPrompt}${b2bOverride}

${knowledgeContext}${ctaSection}`;

  // Build message history
  const recentHistory = conversationHistory.slice(-15).map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  const messages = [
    ...recentHistory,
    { role: 'user' as const, content: userMessage },
  ];

  const result = await chatCompletion(systemPrompt, messages, {
    temperature: 0.7,
    max_tokens: 512,
  });

  return result;
}

// ---- Generate Handoff Response ----

export async function generateHandoffResponse(
  userMessage: string,
  isB2B: boolean
): Promise<string> {
  if (isB2B) {
    return `That sounds like something our team can help with directly. Would you like to:\n\n1. **Book a quick call** — I can share our scheduling link\n2. **Get a callback** — share your name, company, and phone number, and our team will reach out\n\nWhich works better for you?`;
  }

  return `That's a great question, and I want to make sure you get the most accurate answer. Let me connect you with our team.\n\nCould you share:\n- Your preferred contact method (call, WhatsApp, or email)\n- A convenient time for our team to reach out?\n\nIn the meantime, is there anything else I can help with?`;
}

// ---- Generate Clarifying Question ----

export async function generateClarifyingQuestion(
  userMessage: string
): Promise<string> {
  return `I want to make sure I give you the right information. Could you tell me a bit more about what you're looking for? For example, are you interested in:\n\n- How Afterlife works and its features\n- Pricing and what's included\n- A specific feature like Digital Vault or Digital Will\n- Something else entirely?\n\nThis will help me point you in the right direction.`;
}
