/**
 * ConvoEngine — Knowledge Bank Seeder (standalone, no deps)
 *
 * Uses native fetch to call OpenAI and Supabase REST APIs directly.
 * Usage: node scripts/seed-knowledge.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- Config (read from .env.local) ---
function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env.local');
  const content = fs.readFileSync(envPath, 'utf-8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_KEY = env.OPENAI_API_KEY;
const TENANT_ID = env.DEFAULT_TENANT_ID;

if (!SUPABASE_URL || !SERVICE_KEY || !OPENAI_KEY || !TENANT_ID) {
  console.error('❌ Missing env vars. Check .env.local');
  process.exit(1);
}

// --- OpenAI Embedding ---
async function getEmbedding(text) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.data[0].embedding;
}

// --- Supabase REST helpers ---
async function supabaseGet(table, params = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${params}`;
  const res = await fetch(url, {
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Supabase GET error: ${await res.text()}`);
  return res.json();
}

async function supabaseInsert(table, row) {
  const url = `${SUPABASE_URL}/rest/v1/${table}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase INSERT error: ${err}`);
  }
}

// --- Main ---
async function main() {
  console.log('🚀 ConvoEngine Knowledge Bank Seeder');
  console.log('=====================================\n');

  // Load articles
  const seedPath = path.resolve(__dirname, '../knowledge-seed.json');
  const articles = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
  console.log(`📚 Found ${articles.length} articles to seed\n`);

  // Check existing
  const existing = await supabaseGet(
    'knowledge_articles',
    `select=title&tenant_id=eq.${TENANT_ID}`
  );
  const existingTitles = new Set(existing.map(a => a.title));
  const newArticles = articles.filter(a => !existingTitles.has(a.title));

  if (newArticles.length === 0) {
    console.log('✅ All articles already exist. Nothing to seed.');
    return;
  }

  console.log(`📝 ${newArticles.length} new articles to insert (${existingTitles.size} already exist)\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < newArticles.length; i++) {
    const article = newArticles[i];
    const progress = `[${i + 1}/${newArticles.length}]`;

    try {
      // Generate embedding
      const embeddingText = `${article.title}\n\n${article.content}`;
      process.stdout.write(`${progress} ${article.title}... `);
      const embedding = await getEmbedding(embeddingText);

      // Insert
      await supabaseInsert('knowledge_articles', {
        tenant_id: TENANT_ID,
        title: article.title,
        content: article.content,
        category: article.category,
        embedding: JSON.stringify(embedding),
        is_active: true,
      });

      console.log('✅');
      success++;

      // Small delay for rate limiting
      if (i < newArticles.length - 1) {
        await new Promise(r => setTimeout(r, 250));
      }
    } catch (err) {
      console.log(`❌ ${err.message}`);
      failed++;
    }
  }

  console.log('\n=====================================');
  console.log(`🎉 Seeding complete!`);
  console.log(`   ✅ Success: ${success}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📊 Total in DB: ${existingTitles.size + success}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
