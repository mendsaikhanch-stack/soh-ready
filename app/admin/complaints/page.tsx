'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { adminFrom } from '@/app/lib/admin-db';

interface Complaint {
  id: number;
  sokh_id: number;
  category: string;
  title: string;
  description: string;
  status: string;
  admin_reply: string | null;
  replied_at: string | null;
  created_at: string;
}

const categoryMap: Record<string, { label: string; icon: string }> = {
  complaint: { label: 'Гомдол', icon: '😤' },
  suggestion: { label: 'Санал', icon: '💡' },
  question: { label: 'Асуулт', icon: '❓' },
};

const statusOptions = [
  { value: 'pending', label: 'Хүлээгдэж буй', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'in_progress', label: 'Шалгаж байна', color: 'bg-blue-100 text-blue-700' },
  { value: 'resolved', label: 'Шийдвэрлэсэн', color: 'bg-green-100 text-green-700' },
  { value: 'rejected', label: 'Татгалзсан', color: 'bg-red-100 text-red-700' },
];

export default function AdminComplaints() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [replyingId, setReplyingId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchComplaints(); }, []);

  const fetchComplaints = async () => {
    const { data } = await supabase
      .from('complaints')
      .select('*')
      .order('created_at', { ascending: false });

    setComplaints(data || []);
    setLoading(false);
  };

  const updateStatus = async (id: number, status: string) => {
    await adminFrom('complaints').update({ status }).eq('id', id);
    await fetchComplaints();
  };

  const submitReply = async (id: number) => {
    if (!replyText.trim()) return;
    setSaving(true);

    await adminFrom('complaints').update({
      admin_reply: replyText,
      replied_at: new Date().toISOString(),
      status: 'resolved',
    }).eq('id', id);

    setReplyText('');
    setReplyingId(null);
    setSaving(false);
    await fetchComplaints();
  };

  const deleteComplaint = async (id: number) => {
    if (!confirm('Устгах уу?')) return;
    await adminFrom('complaints').delete().eq('id', id);
    await fetchComplaints();
  };

  let filtered = complaints;
  if (filter !== 'all') filtered = filtered.filter(c => c.status === filter);
  if (categoryFilter !== 'all') filtered = filtered.filter(c => c.category === categoryFilter);

  const getStatus = (s: string) => statusOptions.find(o => o.value === s) || statusOptions[0];
  const getCategory = (c: string) => categoryMap[c] || categoryMap.complaint;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">📝 Гомдол / Санал</h1>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {statusOptions.map(s => {
          const count = complaints.filter(c => c.status === s.value).length;
          return (
            <button key={s.value} onClick={() => setFilter(s.value === filter ? 'all' : s.value)}
              className={`rounded-xl border p-3 text-center transition ${filter === s.value ? 'ring-2 ring-blue-500' : ''}`}>
              <p className="text-xl font-bold">{count}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </button>
          );
        })}
      </div>

      {/* Category filter */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setCategoryFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-sm transition ${categoryFilter === 'all' ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600'}`}
        >
          Бүгд ({complaints.length})
        </button>
        {Object.entries(categoryMap).map(([key, val]) => {
          const count = complaints.filter(c => c.category === key).length;
          return (
            <button key={key} onClick={() => setCategoryFilter(key === categoryFilter ? 'all' : key)}
              className={`px-3 py-1.5 rounded-lg text-sm transition ${categoryFilter === key ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
              {val.icon} {val.label} ({count})
            </button>
          );
        })}
      </div>

      {/* List */}
      {loading ? (
        <p className="text-gray-400 text-center py-8">Ачаалж байна...</p>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => {
            const st = getStatus(c.status);
            const cat = getCategory(c.category);

            return (
              <div key={c.id} className="bg-white border rounded-xl p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span>{cat.icon}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{cat.label}</span>
                    </div>
                    <h3 className="font-semibold text-sm">{c.title}</h3>
                    {c.description && <p className="text-sm text-gray-500 mt-1">{c.description}</p>}
                    <p className="text-xs text-gray-400 mt-1">{new Date(c.created_at).toLocaleDateString('mn-MN')}</p>
                  </div>
                  <button onClick={() => deleteComplaint(c.id)} className="text-red-400 text-xs hover:underline">Устгах</button>
                </div>

                {/* Status buttons */}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-gray-500">Төлөв:</span>
                  {statusOptions.map(s => (
                    <button key={s.value} onClick={() => updateStatus(c.id, s.value)}
                      className={`text-xs px-2 py-1 rounded-full transition ${c.status === s.value ? s.color + ' font-semibold' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}>
                      {s.label}
                    </button>
                  ))}
                </div>

                {/* Admin reply */}
                {c.admin_reply && (
                  <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-blue-700 mb-1">💬 Таны хариу:</p>
                    <p className="text-sm text-blue-800">{c.admin_reply}</p>
                    {c.replied_at && (
                      <p className="text-xs text-blue-400 mt-1">{new Date(c.replied_at).toLocaleDateString('mn-MN')}</p>
                    )}
                  </div>
                )}

                {/* Reply form */}
                <div className="mt-3">
                  {replyingId === c.id ? (
                    <div className="space-y-2">
                      <textarea
                        placeholder="Хариу бичих..."
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        rows={2}
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button onClick={() => { setReplyingId(null); setReplyText(''); }}
                          className="flex-1 py-1.5 rounded-lg border text-sm">
                          Цуцлах
                        </button>
                        <button onClick={() => submitReply(c.id)}
                          disabled={saving || !replyText.trim()}
                          className="flex-1 py-1.5 rounded-lg bg-blue-600 text-white text-sm disabled:opacity-50">
                          {saving ? 'Илгээж байна...' : 'Хариу илгээх'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setReplyingId(c.id); setReplyText(c.admin_reply || ''); }}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {c.admin_reply ? '✏️ Хариу засах' : '💬 Хариу бичих'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <p className="text-gray-400 text-center py-8">Гомдол / санал байхгүй</p>}
        </div>
      )}
    </div>
  );
}
