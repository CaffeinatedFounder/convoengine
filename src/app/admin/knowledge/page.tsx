'use client';

import { useEffect, useState } from 'react';

interface KnowledgeArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  source_type: string;
  is_active: boolean;
  created_at: string;
}

export default function KnowledgePage() {
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', category: 'general' });
  const [saving, setSaving] = useState(false);

  const categories = ['features', 'pricing', 'faq', 'security', 'b2b', 'general', 'process', 'legal'];

  useEffect(() => {
    fetchArticles();
  }, []);

  async function fetchArticles() {
    const res = await fetch('/api/admin/knowledge');
    const data = await res.json();
    setArticles(data.articles || []);
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch('/api/admin/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setForm({ title: '', content: '', category: 'general' });
      setShowForm(false);
      fetchArticles();
    } catch (err) {
      console.error('Failed to save:', err);
    }
    setSaving(false);
  }

  async function toggleActive(id: string, isActive: boolean) {
    await fetch('/api/admin/knowledge', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: !isActive }),
    });
    fetchArticles();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Knowledge Bank</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-afterlife-navy text-white rounded-lg text-sm hover:bg-afterlife-dark transition-colors"
        >
          {showForm ? 'Cancel' : '+ Add Article'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 shadow-sm mb-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="e.g., How to create a Digital Will"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Content *</label>
              <textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm min-h-[150px]"
                placeholder="Write the knowledge article content here. The bot will use this to answer questions."
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="border rounded-lg px-3 py-2 text-sm"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={saving || !form.content}
              className="px-4 py-2 bg-afterlife-navy text-white rounded-lg text-sm disabled:opacity-50"
            >
              {saving ? 'Saving & Embedding...' : 'Save Article'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-4 shadow-sm animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : articles.length === 0 ? (
        <div className="bg-white rounded-xl p-8 shadow-sm text-center text-gray-500">
          <p className="text-lg mb-2">No knowledge articles yet</p>
          <p className="text-sm">Add articles to train the chatbot. The bot can only answer from what&apos;s in the knowledge bank.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {articles.map((article) => (
            <div key={article.id} className={`bg-white rounded-xl p-4 shadow-sm ${!article.is_active ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-sm">{article.title || 'Untitled'}</h3>
                    <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full">{article.category}</span>
                    <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">{article.source_type}</span>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2">{article.content}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Added {new Date(article.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => toggleActive(article.id, article.is_active)}
                  className={`ml-4 text-xs px-3 py-1 rounded-full ${
                    article.is_active
                      ? 'bg-green-50 text-green-700 hover:bg-green-100'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {article.is_active ? 'Active' : 'Disabled'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
