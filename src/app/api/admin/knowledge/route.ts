import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { addKnowledgeArticle } from '@/lib/knowledge-retriever';

const TENANT_ID = process.env.DEFAULT_TENANT_ID || '';

// GET: List all knowledge articles
export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('knowledge_articles')
    .select('id, title, content, category, source_type, is_active, created_at')
    .eq('tenant_id', TENANT_ID)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ articles: data });
}

// POST: Add a new knowledge article (with embedding)
export async function POST(request: NextRequest) {
  const body = await request.json();
  try {
    const article = await addKnowledgeArticle({
      tenantId: TENANT_ID,
      title: body.title,
      content: body.content,
      sourceType: 'manual',
      category: body.category,
    });
    return NextResponse.json({ article });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH: Toggle article active status
export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const supabase = createServerClient();
  const { error } = await supabase
    .from('knowledge_articles')
    .update({ is_active: body.is_active })
    .eq('id', body.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
