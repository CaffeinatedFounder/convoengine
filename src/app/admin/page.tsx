'use client';

import { useEffect, useState } from 'react';

interface DashboardStats {
  totalConversations: number;
  activeConversations: number;
  unansweredQuestions: number;
  pendingHandoffs: number;
  knowledgeArticles: number;
  activeCTAs: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/stats')
      .then((res) => res.json())
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const cards = stats
    ? [
        { label: 'Total Conversations', value: stats.totalConversations, color: 'bg-blue-50 text-blue-700' },
        { label: 'Active Now', value: stats.activeConversations, color: 'bg-green-50 text-green-700' },
        { label: 'Unanswered Questions', value: stats.unansweredQuestions, color: 'bg-yellow-50 text-yellow-700' },
        { label: 'Pending Handoffs', value: stats.pendingHandoffs, color: 'bg-red-50 text-red-700' },
        { label: 'Knowledge Articles', value: stats.knowledgeArticles, color: 'bg-purple-50 text-purple-700' },
        { label: 'Active CTAs', value: stats.activeCTAs, color: 'bg-indigo-50 text-indigo-700' },
      ]
    : [];

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h2>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-6 shadow-sm animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-3" />
              <div className="h-8 bg-gray-200 rounded w-1/4" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card) => (
            <div key={card.label} className="bg-white rounded-xl p-6 shadow-sm">
              <p className="text-sm text-gray-500 mb-1">{card.label}</p>
              <p className={`text-3xl font-bold ${card.color} inline-block px-3 py-1 rounded-lg`}>
                {card.value}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 bg-white rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <a
            href="/admin/knowledge"
            className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <strong className="block text-sm">📚 Add Knowledge</strong>
            <span className="text-xs text-gray-500">Add articles to the knowledge bank</span>
          </a>
          <a
            href="/admin/unanswered"
            className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <strong className="block text-sm">❓ Review Unanswered</strong>
            <span className="text-xs text-gray-500">Answer questions the bot couldn&apos;t handle</span>
          </a>
          <a
            href="/admin/handoffs"
            className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <strong className="block text-sm">🤝 Process Handoffs</strong>
            <span className="text-xs text-gray-500">Follow up on callback requests</span>
          </a>
          <a
            href="/admin/conversations"
            className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <strong className="block text-sm">💬 View Conversations</strong>
            <span className="text-xs text-gray-500">Browse recent chat conversations</span>
          </a>
        </div>
      </div>
    </div>
  );
}
