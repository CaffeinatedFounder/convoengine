/**
 * ConvoEngine — Knowledge Bank Seeder
 *
 * Reads knowledge-seed.json, generates embeddings via OpenAI,
 * and inserts all articles into Supabase knowledge_articles table.
 *
 * Usage: npx tsx scripts/seed-knowledge.ts
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

// Load env
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const TENANT_ID = process.env.DEFAULT_TENANT_ID!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !OPENAI_API_KEY || !TENANT_ID) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

interface SeedArticle {
  title: string;
  content: string;
  category: string;
}

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
}

async function main() {
  console.log('🚀 ConvoEngine Knowledge Bank Seeder');
  console.log('=====================================\n');

  // Read seed file
  const seedPath = path.resolve(__dirname, '../knowledge-seed.json');
  const articles: SeedArticle[] = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
  console.log(`📚 Found ${articles.length} articles to seed\n`);

  // Check for existing articles to avoid duplicates
  const { data: existing, error: checkError } = await supabase
    .from('knowledge_articles')
    .select('title')
    .eq('tenant_id', TENANT_ID);

  if (checkError) {
    console.error('❌ Error checking existing articles:', checkError.message);
    process.exit(1);
  }

  const existingTitles = new Set((existing || []).map((a: any) => a.title));
  const newArticles = articles.filter(a => !existingTitles.has(a.title));

  if (newArticles.length === 0) {
    console.log('✅ All articles already exist in the database. Nothing to seed.');
    return;
  }

  console.log(`📝 ${newArticles.length} new articles to insert (${existingTitles.size} already exist)\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < newArticles.length; i++) {
    const article = newArticles[i];
    const progress = `[${i + 1}/${newArticles.length}]`;

    try {
      // Generate embedding from title + content
      const embeddingText = `${article.title}\n\n${article.content}`;
      console.log(`${progress} Generating embedding for: ${article.title}...`);
      const embedding = await generateEmbedding(embeddingText);

      // Insert into Supabase
      const { error: insertError } = await supabase
        .from('knowledge_articles')
        .insert({
          tenant_id: TENANT_ID,
          title: article.title,
          content: article.content,
          category: article.category,
          embedding: embedding,
          is_active: true,
        });

      if (insertError) {
        console.error(`  ❌ Insert failed: ${insertError.message}`);
        failed++;
      } else {
        console.log(`  ✅ Inserted successfully`);
        success++;
      }

      // Rate limit: small delay between API calls
      if (i < newArticles.length - 1) {
        await new Promise(r => setTimeout(r, 200));
      }
    } catch (err: any) {
      console.error(`  ❌ Error: ${err.message}`);
      failed++;
    }
  }

  console.log('\n=====================================');
  console.log(`🎉 Seeding complete!`);
  console.log(`   ✅ Success: ${success}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📊 Total in DB: ${existingTitles.size + success}`);
}

main().catch(console.error);
