'use client';

import { useEffect, useState } from 'react';

interface Conversation {
  id: string;
  channel: string;
  audience_type: string;
  status: string;
  current_agent_mode: string;
  started_at: string;
  message_count: number;
}

interface Message {
  id: string;
  role: string;
  content: string;
  intent: string;
  agent_mode: string;
  cta_shown: string;
  confidence_score: number;
  created_at: string;
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  useEffect(() => {
    fetch('/api/admin/conversations')
      .then((res) => res.json())
      .then((data) => { setConversations(data.conversations || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function loadMessages(conversationId: string) {
    setSelectedId(conversationId);
    setLoadingMessages(true);
    const res = await fetch(`/api/admin/conversations?id=${conversationId}`);
    const data = await res.json();
    setMessages(data.messages || []);
    setLoadingMessages(false);
  }

  const modeColors: Record<string, string> = {
    ONBOARDING: 'bg-blue-50 text-blue-700',
    SUPPORT: 'bg-yellow-50 text-yellow-700',
    SALES: 'bg-green-50 text-green-700',
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Conversations</h2>

      <div className="flex gap-6">
        {/* Conversation list */}
        <div className="w-1/3 space-y-2">
          {loading ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg p-3 shadow-sm animate-pulse">
                <div className="h-3 bg-gray-200 rounded w-2/3 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-1/3" />
              </div>
            ))
          ) : conversations.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No conversations yet</p>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => loadMessages(conv.id)}
                className={`bg-white rounded-lg p-3 shadow-sm cursor-pointer transition-colors ${
                  selectedId === conv.id ? 'ring-2 ring-afterlife-navy' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${modeColors[conv.current_agent_mode] || 'bg-gray-100'}`}>
                    {conv.current_agent_mode}
                  </span>
                  <span className="text-xs text-gray-400">{conv.channel}</span>
                  <span className="text-xs text-gray-400">{conv.audience_type}</span>
                </div>
                <p className="text-xs text-gray-500">
                  {new Date(conv.started_at).toLocaleString()} · {conv.message_count || 0} messages
                </p>
              </div>
            ))
          )}
        </div>

        {/* Message thread */}
        <div className="flex-1 bg-white rounded-xl shadow-sm p-4 min-h-[400px]">
          {!selectedId ? (
            <p className="text-sm text-gray-400 text-center mt-20">Select a conversation to view messages</p>
          ) : loadingMessages ? (
            <p className="text-sm text-gray-400 text-center mt-20">Loading...</p>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-lg p-3 text-sm ${
                    msg.role === 'user' ? 'bg-afterlife-navy text-white' : 'bg-gray-100 text-gray-800'
                  }`}>
                    <p>{msg.content}</p>
                    {msg.role === 'assistant' && (
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {msg.intent && <span className="text-xs opacity-60">{msg.intent}</span>}
                        {msg.cta_shown && <span className="text-xs text-blue-400">CTA: {msg.cta_shown}</span>}
                        {msg.confidence_score != null && (
                          <span className="text-xs opacity-60">
                            conf: {(msg.confidence_score * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                    )}
                    <p className="text-xs opacity-50 mt-1">
                      {new Date(msg.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
