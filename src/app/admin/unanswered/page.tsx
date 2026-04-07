'use client';

import { useEffect, useState } from 'react';

interface UnansweredQuestion {
  id: string;
  question: string;
  context: string;
  frequency: number;
  status: string;
  created_at: string;
}

export default function UnansweredPage() {
  const [questions, setQuestions] = useState<UnansweredQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [answerForm, setAnswerForm] = useState<{ id: string; answer: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchQuestions();
  }, []);

  async function fetchQuestions() {
    const res = await fetch('/api/admin/unanswered');
    const data = await res.json();
    setQuestions(data.questions || []);
    setLoading(false);
  }

  async function handleAnswer(id: string, answer: string) {
    setSaving(true);
    await fetch('/api/admin/unanswered', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, answer }),
    });
    setAnswerForm(null);
    setSaving(false);
    fetchQuestions();
  }

  async function dismiss(id: string) {
    await fetch('/api/admin/unanswered', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'dismissed' }),
    });
    fetchQuestions();
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Unanswered Questions</h2>
      <p className="text-sm text-gray-500 mb-6">
        Questions the bot couldn&apos;t answer confidently. Answer them here to add to the knowledge bank.
      </p>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-4 shadow-sm animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : questions.length === 0 ? (
        <div className="bg-white rounded-xl p-8 shadow-sm text-center text-gray-500">
          <p className="text-lg mb-2">No unanswered questions</p>
          <p className="text-sm">Great — the bot is handling everything from the knowledge bank.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((q) => (
            <div key={q.id} className="bg-white rounded-xl p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-medium text-sm text-gray-900">&ldquo;{q.question}&rdquo;</p>
                  {q.context && (
                    <p className="text-xs text-gray-400 mt-1">{q.context}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-gray-500">
                      Asked {q.frequency}x
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(q.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => setAnswerForm({ id: q.id, answer: '' })}
                    className="text-xs px-3 py-1.5 bg-afterlife-navy text-white rounded-lg hover:bg-afterlife-dark"
                  >
                    Answer
                  </button>
                  <button
                    onClick={() => dismiss(q.id)}
                    className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                  >
                    Dismiss
                  </button>
                </div>
              </div>

              {answerForm?.id === q.id && (
                <div className="mt-4 pt-4 border-t">
                  <textarea
                    value={answerForm.answer}
                    onChange={(e) => setAnswerForm({ ...answerForm, answer: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm min-h-[100px]"
                    placeholder="Write the answer. This will be added to the knowledge bank and the bot will use it for future questions."
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handleAnswer(q.id, answerForm.answer)}
                      disabled={saving || !answerForm.answer}
                      className="text-xs px-4 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save to Knowledge Bank'}
                    </button>
                    <button
                      onClick={() => setAnswerForm(null)}
                      className="text-xs px-3 py-2 bg-gray-100 rounded-lg"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
