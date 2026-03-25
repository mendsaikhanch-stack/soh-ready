'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { adminFrom } from '@/app/lib/admin-db';
import { getAdminSokhId } from '@/app/lib/admin-config';

interface Poll {
  id: number;
  title: string;
  description: string;
  status: string;
  yes_count: number;
  no_count: number;
  total_voters: number;
  ends_at: string;
  created_at: string;
}

export default function AdminPolling() {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', ends_at: '', total_voters: '0' });
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [tab, setTab] = useState<'active' | 'ended'>('active');

  useEffect(() => { fetchPolls(); }, []);

  const fetchPolls = async () => {
    const sokhId = await getAdminSokhId();
    const { data } = await supabase
      .from('polls')
      .select('*')
      .eq('sokh_id', sokhId)
      .order('created_at', { ascending: false });
    setPolls(data || []);
    setLoading(false);
  };

  const activePolls = polls.filter(p => p.status === 'active');
  const endedPolls = polls.filter(p => p.status !== 'active');

  const openAdd = () => {
    setEditId(null);
    setForm({ title: '', description: '', ends_at: '', total_voters: '0' });
    setShowForm(true);
  };

  const openEdit = (p: Poll) => {
    setEditId(p.id);
    setForm({
      title: p.title,
      description: p.description || '',
      ends_at: p.ends_at ? p.ends_at.split('T')[0] : '',
      total_voters: String(p.total_voters || 0),
    });
    setShowForm(true);
  };

  const savePoll = async () => {
    if (!form.title) return;
    setSaving(true);
    const sokhId = await getAdminSokhId();

    const payload = {
      sokh_id: sokhId,
      title: form.title,
      description: form.description || null,
      ends_at: form.ends_at ? new Date(form.ends_at + 'T23:59:59').toISOString() : null,
      total_voters: Number(form.total_voters) || 0,
    };

    if (editId) {
      await adminFrom('polls').update(payload).eq('id', editId);
    } else {
      await adminFrom('polls').insert([{ ...payload, status: 'active', yes_count: 0, no_count: 0 }]);
    }

    setShowForm(false);
    setSaving(false);
    await fetchPolls();
  };

  const endPoll = async (id: number) => {
    await adminFrom('polls').update({ status: 'ended' }).eq('id', id);
    await fetchPolls();
  };

  const deletePoll = async (id: number) => {
    if (!confirm('Устгах уу?')) return;
    await adminFrom('polls').delete().eq('id', id);
    await fetchPolls();
  };

  const today = new Date().toISOString().split('T')[0];

  if (loading) return <div className="p-6 text-gray-400">Ачаалж байна...</div>;

  const displayPolls = tab === 'active' ? activePolls : endedPolls;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">🗳 Санал хураалт</h1>
        <button onClick={openAdd} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
          + Шинэ санал
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
        <button
          onClick={() => setTab('active')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
            tab === 'active' ? 'bg-white shadow-sm' : 'text-gray-500'
          }`}
        >
          Идэвхтэй ({activePolls.length})
        </button>
        <button
          onClick={() => setTab('ended')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
            tab === 'ended' ? 'bg-white shadow-sm' : 'text-gray-500'
          }`}
        >
          Дууссан ({endedPolls.length})
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white border rounded-xl p-4 mb-4">
          <h3 className="font-semibold mb-3">{editId ? 'Засах' : 'Шинэ санал хураалт'}</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Гарчиг</label>
              <input
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="Жнь: Орцны хаалга солих уу?"
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Тайлбар</label>
              <textarea
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Дэлгэрэнгүй мэдээлэл..."
                className="w-full border rounded-lg px-3 py-2 text-sm h-20 resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Дуусах огноо</label>
                <input
                  type="date"
                  value={form.ends_at}
                  onChange={e => setForm({ ...form, ends_at: e.target.value })}
                  min={today}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Нийт санал өгөгч</label>
                <input
                  type="number"
                  value={form.total_voters}
                  onChange={e => setForm({ ...form, total_voters: e.target.value })}
                  placeholder="0"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg text-sm">Цуцлах</button>
            <button onClick={savePoll} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
              {saving ? 'Хадгалж байна...' : 'Хадгалах'}
            </button>
          </div>
        </div>
      )}

      {/* Polls list */}
      {displayPolls.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center">
          <p className="text-3xl mb-2">{tab === 'active' ? '🗳' : '📊'}</p>
          <p className="text-gray-400">{tab === 'active' ? 'Идэвхтэй санал хураалт байхгүй' : 'Дууссан санал хураалт байхгүй'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayPolls.map(p => {
            const total = p.yes_count + p.no_count;
            const yesPercent = total > 0 ? Math.round((p.yes_count / total) * 100) : 0;
            const noPercent = total > 0 ? Math.round((p.no_count / total) * 100) : 0;

            return (
              <div key={p.id} className="bg-white border rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-sm font-bold">{p.title}</h3>
                    {p.description && <p className="text-xs text-gray-500 mt-1">{p.description}</p>}
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {p.status === 'active' ? 'Идэвхтэй' : 'Дууссан'}
                  </span>
                </div>

                {/* Progress bars */}
                <div className="space-y-2 my-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-green-600 font-medium">✅ Тийм ({p.yes_count})</span>
                      <span>{yesPercent}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${yesPercent}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-red-600 font-medium">❌ Үгүй ({p.no_count})</span>
                      <span>{noPercent}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-red-500 rounded-full transition-all" style={{ width: `${noPercent}%` }} />
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t">
                  <div>
                    Нийт: {total}/{p.total_voters || '?'}
                    {p.ends_at && <span className="ml-2">· Дуусах: {new Date(p.ends_at).toLocaleDateString('mn-MN')}</span>}
                  </div>
                  <div className="flex gap-2">
                    {p.status === 'active' && (
                      <>
                        <button onClick={() => openEdit(p)} className="text-blue-500 hover:underline">Засах</button>
                        <button onClick={() => endPoll(p.id)} className="text-orange-500 hover:underline">Дуусгах</button>
                      </>
                    )}
                    <button onClick={() => deletePoll(p.id)} className="text-red-500 hover:underline">Устгах</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
