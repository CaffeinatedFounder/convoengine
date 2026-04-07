// ============================================================
// Module 3: Knowledge Retriever — RAG search against knowledge bank
// ============================================================

import { createServerClient } from './supabase';
import { generateEmbedding } from './openai';
import type { KnowledgeMatch } from '@/types';

const CONFIDENCE_THRESHOLD = parseFloat(process.env.CONFIDENCE_THRESHOLD || '0.7');
const MATCH_COUNT = 5;

/**
 * Search the knowledge bank for relevant articles.
 * Returns top matches with similarity scores.
 */
export async function searchKnowledge(
  query: string,
  tenantId: string
): Promise<{ matches: KnowledgeMatch[]; topConfidence: number }> {
  const supabase = createServerClient();

  // Generate embedding for the user's query
  const queryEmbedding = await generateEmbedding(query);

  // Search using the match_knowledge function we created in the migration
  const { data, error } = await supabase.rpc('match_knowledge', {
    query_embedding: queryEmbedding,
    match_tenant_id: tenantId,
    match_threshold: CONFIDENCE_THRESHOLD,
    match_count: MATCH_COUNT,
  });

  if (error) {
    console.error('Knowledge search error:', error);
    return { matches: [], topConfidence: 0 };
  }

  const matches: KnowledgeMatch[] = data ?? [];
  const topConfidence = matches.length > 0 ? matches[0].similarity : 0;

  return { matches, topConfidence };
}

/**
 * Format matched knowledge articles into context for the LLM prompt.
 */
export function formatKnowledgeContext(matches: KnowledgeMatch[]): string {
  if (matches.length === 0) {
    return '<knowledge>\nNo relevant information found in the knowledge bank.\n</knowledge>';
  }

  const chunks = matches
    .map((m, i) => {
      const title = m.title ? `Title: ${m.title}\n` : '';
      const category = m.category ? `Category: ${m.category}\n` : '';
      return `--- Article ${i + 1} (relevance: ${(m.similarity * 100).toFixed(1)}%) ---\n${title}${category}${m.content}`;
    })
    .join('\n\n');

  return `<knowledge>\n${chunks}\n</knowledge>`;
}

/**
 * Check if the confidence score is below threshold.
 */
export function isLowConfidence(topConfidence: number): boolean {
  return topConfidence < CONFIDENCE_THRESHOLD;
}

/**
 * Add a new knowledge article with embedding.
 */
export async function addKnowledgeArticle(params: {
  tenantId: string;
  title?: string;
  content: string;
  sourceType: 'manual' | 'document' | 'url' | 'unanswered_q';
  sourceReference?: string;
  category?: string;
}) {
  const supabase = createServerClient();
  const embedding = await generateEmbedding(params.content);

  const { data, error } = await supabase
    .from('knowledge_articles')
    .insert({
      tenant_id: params.tenantId,
      title: params.title,
      content: params.content,
      embedding: embedding,
      source_type: params.sourceType,
      source_reference: params.sourceReference,
      category: params.category,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
