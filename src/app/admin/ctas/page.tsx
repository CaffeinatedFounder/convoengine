'use client';

import { useEffect, useState } from 'react';

interface CTA {
  id: string;
  cta_key: string;
  label: string;
  url: string;
  agent_modes: string[];
  intent_tags: string[];
  priority_weight: number;
  is_active: boolean;
  description: string;
}

export default function CTAsPage() {
  const [ctas, setCTAs] = useState<CTA[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/ctas')
      .then((res) => res.json())
      .then((data) => { setCTAs(data.ctas || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function toggleActive(id: string, isActive: boolean) {
    await fetch('/api/admin/ctas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: !isActive }),
    });
    setCTAs((prev) =>
      prev.map((c) => (c.id === id ? { ...c, is_active: !isActive } : c))
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Call-to-Action Manager</h2>
      <p className="text-sm text-gray-500 mb-6">
        Manage the CTAs the bot can present. Higher priority weight = shown more often.
      </p>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-4 shadow-sm animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {ctas.map((cta) => (
            <div key={cta.id} className={`bg-white rounded-xl p-5 shadow-sm ${!cta.is_active ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{cta.label}</span>
                    <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full font-mono">
                      {cta.cta_key}
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full">
                      Priority: {cta.priority_weight}
                    </span>
                  </div>
                  {cta.url && (
                    <p className="text-xs text-blue-500 mt-0.5 truncate max-w-md">{cta.url}</p>
                  )}
                  <p className="text-sm text-gray-500 mt-1">{cta.description}</p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {cta.agent_modes.map((mode) => (
                      <span key={mode} className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">
                        {mode}
                      </span>
                    ))}
                    {cta.intent_tags.map((tag) => (
                      <span key={tag} className="text-xs px-2 py-0.5 bg-gray-50 text-gray-500 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => toggleActive(cta.id, cta.is_active)}
                  className={`ml-4 text-xs px-3 py-1.5 rounded-full ${
                    cta.is_active
                      ? 'bg-green-50 text-green-700 hover:bg-green-100'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {cta.is_active ? 'Active' : 'Disabled'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
