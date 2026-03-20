'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';

interface Poll { id: number; title: string; description: string; status: string; yes_count: number; no_count: number; total_voters: number; created_at: string; }

export default function AdminPolls() {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [totalVoters, setTotalVoters] = useState('50');
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchPolls(); }, []);

  const fetchPolls = async () => {
    const { data } = await supabase.from('polls').select('*').order('created_at', { ascending: false });
    setPolls(data || []);
    setLoading(false);
  };

  const createPoll = async () => {
    if (!title) return;
    setSaving(true);
    await supabase.from('polls').insert([{
      sokh_id: 7, title, description, status: 'active',
      yes_count: 0, no_count: 0, total_voters: Number(totalVoters) || 50,
    }]);
    setShowForm(false);
    setTitle(''); setDescription('');
    setSaving(false);
    await fetchPolls();
  };

  const toggleStatus = async (id: number, current: string) => {
    const newStatus = current === 'active' ? 'closed' : 'active';
    await supabase.from('polls').update({ status: newStatus }).eq('id', id);
    await fetchPolls();
  };

  const deletePoll = async (id: number) => {
    if (!confirm('Устгах уу?')) return;
    await supabase.from('polls').delete().eq('id', id);
    await fetchPolls();
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">🗳 Санал хураалт</h1>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-pink-600 text-white rounded-lg text-sm hover:bg-pink-700">
          + Шинэ санал хураалт
        </button>
      </div>

      {showForm && (
        <div className="bg-white border rounded-xl p-4 mb-6">
          <h3 className="font-semibold mb-3">Шинэ санал хураалт</h3>
          <input placeholder="Асуулт" value={title} onChange={e => setTitle(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm mb-2" />
          <textarea placeholder="Тайлбар..." value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm mb-2" />
          <input placeholder="Нийт санал өгөх хүний тоо" type="number" value={totalVoters} onChange={e => setTotalVoters(e.target.value)} className="border rounded-lg px-3 py-2 text-sm mb-3" />
          <div className="flex gap-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg text-sm">Цуцлах</button>
            <button onClick={createPoll} disabled={saving} className="px-4 py-2 bg-pink-600 text-white rounded-lg text-sm disabled:opacity-50">
              {saving ? 'Үүсгэж байна...' : 'Үүсгэх'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-gray-400 text-center py-8">Ачаалж байна...</p>
      ) : (
        <div className="space-y-3">
          {polls.map(p => {
            const total = p.yes_count + p.no_count;
            const yesP = total > 0 ? Math.round((p.yes_count / total) * 100) : 0;
            return (
              <div key={p.id} className="bg-white border rounded-xl p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold text-sm">{p.title}</h3>
                    {p.description && <p className="text-xs text-gray-500 mt-1">{p.description}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => toggleStatus(p.id, p.status)}
                      className={`text-xs px-2 py-1 rounded-full ${p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {p.status === 'active' ? 'Идэвхтэй' : 'Хаагдсан'}
                    </button>
                    <button onClick={() => deletePoll(p.id)} className="text-red-400 text-xs hover:underline">Устгах</button>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-green-600">Тийм: {p.yes_count} ({yesP}%)</span>
                    <span className="text-red-500">Үгүй: {p.no_count} ({100 - yesP}%)</span>
                  </div>
                  <div className="w-full bg-red-200 rounded-full h-3">
                    <div className="bg-green-500 h-3 rounded-full" style={{ width: `${yesP}%` }} />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{total}/{p.total_voters} хүн саналаа өгсөн</p>
                </div>
              </div>
            );
          })}
          {polls.length === 0 && <p className="text-gray-400 text-center py-8">Санал хураалт байхгүй</p>}
        </div>
      )}
    </div>
  );
}
