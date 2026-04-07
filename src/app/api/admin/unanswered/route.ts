import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { addKnowledgeArticle } from '@/lib/knowledge-retriever';

const TENANT_ID = process.env.DEFAULT_TENANT_ID || '';

// GET: List pending unanswered questions
export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('unanswered_questions')
    .select('*')
    .eq('tenant_id', TENANT_ID)
    .eq('status', 'pending')
    .order('frequency', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ questions: data });
}

// POST: Answer a question → save to knowledge bank
export async function POST(request: NextRequest) {
  const body = await request.json();
  const supabase = createServerClient();

  try {
    // Add the answer as a knowledge article with embedding
    const article = await addKnowledgeArticle({
      tenantId: TENANT_ID,
      title: body.question || 'FAQ',
      content: body.answer,
      sourceType: 'unanswered_q',
      sourceReference: body.id,
      category: 'faq',
    });

    // Mark the question as answered
    await supabase
      .from('unanswered_questions')
      .update({
        status: 'answered',
        answer: body.answer,
        knowledge_article_id: article.id,
        answered_at: new Date().toISOString(),
      })
      .eq('id', body.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH: Dismiss a question
export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const supabase = createServerClient();
  await supabase
    .from('unanswered_questions')
    .update({ status: body.status })
    .eq('id', body.id);

  return NextResponse.json({ success: true });
}
