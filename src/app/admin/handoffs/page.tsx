'use client';

import { useEffect, useState } from 'react';

interface Handoff {
  id: string;
  question: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  contact_mode: string;
  time_preference: string;
  lead_type: string;
  company_name: string;
  status: string;
  admin_notes: string;
  created_at: string;
}

export default function HandoffsPage() {
  const [handoffs, setHandoffs] = useState<Handoff[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/handoffs')
      .then((res) => res.json())
      .then((data) => { setHandoffs(data.handoffs || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function updateStatus(id: string, status: string) {
    await fetch('/api/admin/handoffs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    setHandoffs((prev) =>
      prev.map((h) => (h.id === id ? { ...h, status } : h))
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Handoff Queue</h2>
      <p className="text-sm text-gray-500 mb-6">Callback requests and leads that need human follow-up.</p>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-4 shadow-sm animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : handoffs.length === 0 ? (
        <div className="bg-white rounded-xl p-8 shadow-sm text-center text-gray-500">
          No pending handoffs
        </div>
      ) : (
        <div className="space-y-3">
          {handoffs.map((h) => (
            <div key={h.id} className="bg-white rounded-xl p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      h.lead_type === 'B2B' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'
                    }`}>{h.lead_type}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      h.status === 'pending' ? 'bg-yellow-50 text-yellow-700'
                        : h.status === 'completed' ? 'bg-green-50 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>{h.status}</span>
                  </div>
                  <p className="text-sm font-medium">{h.contact_name || 'Anonymous'}</p>
                  <p className="text-sm text-gray-600 mt-1">&ldquo;{h.question}&rdquo;</p>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                    {h.contact_phone && <span>Phone: {h.contact_phone}</span>}
                    {h.contact_email && <span>Email: {h.contact_email}</span>}
                    {h.contact_mode && <span>Prefers: {h.contact_mode}</span>}
                    {h.time_preference && <span>Time: {h.time_preference}</span>}
                    {h.company_name && <span>Company: {h.company_name}</span>}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">{new Date(h.created_at).toLocaleString()}</p>
                </div>
                <div className="flex gap-2 ml-4">
                  {h.status === 'pending' && (
                    <>
                      <button
                        onClick={() => updateStatus(h.id, 'in_progress')}
                        className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg"
                      >
                        In Progress
                      </button>
                      <button
                        onClick={() => updateStatus(h.id, 'completed')}
                        className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg"
                      >
                        Done
                      </button>
                    </>
                  )}
                  {h.status === 'in_progress' && (
                    <button
                      onClick={() => updateStatus(h.id, 'completed')}
                      className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg"
                    >
                      Mark Done
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
