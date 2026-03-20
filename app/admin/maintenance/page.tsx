'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';

interface Request { id: number; title: string; description: string; status: string; created_at: string; }

const statusOptions = [
  { value: 'pending', label: 'Хүлээгдэж буй', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'in_progress', label: 'Хийгдэж байна', color: 'bg-blue-100 text-blue-700' },
  { value: 'completed', label: 'Дууссан', color: 'bg-green-100 text-green-700' },
  { value: 'rejected', label: 'Цуцлагдсан', color: 'bg-red-100 text-red-700' },
];

export default function AdminMaintenance() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => { fetchRequests(); }, []);

  const fetchRequests = async () => {
    const { data } = await supabase.from('maintenance_requests').select('*').order('created_at', { ascending: false });
    setRequests(data || []);
    setLoading(false);
  };

  const updateStatus = async (id: number, status: string) => {
    await supabase.from('maintenance_requests').update({ status }).eq('id', id);
    await fetchRequests();
  };

  const deleteRequest = async (id: number) => {
    if (!confirm('Устгах уу?')) return;
    await supabase.from('maintenance_requests').delete().eq('id', id);
    await fetchRequests();
  };

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter);
  const getStatus = (s: string) => statusOptions.find(o => o.value === s) || statusOptions[0];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">🔧 Засвар үйлчилгээ</h1>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {statusOptions.map(s => {
          const count = requests.filter(r => r.status === s.value).length;
          return (
            <button key={s.value} onClick={() => setFilter(s.value === filter ? 'all' : s.value)}
              className={`rounded-xl border p-3 text-center transition ${filter === s.value ? 'ring-2 ring-blue-500' : ''}`}>
              <p className="text-xl font-bold">{count}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </button>
          );
        })}
      </div>

      {/* List */}
      {loading ? (
        <p className="text-gray-400 text-center py-8">Ачаалж байна...</p>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => {
            const st = getStatus(r.status);
            return (
              <div key={r.id} className="bg-white border rounded-xl p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold text-sm">{r.title}</h3>
                    {r.description && <p className="text-sm text-gray-500 mt-1">{r.description}</p>}
                    <p className="text-xs text-gray-400 mt-1">{new Date(r.created_at).toLocaleDateString('mn-MN')}</p>
                  </div>
                  <button onClick={() => deleteRequest(r.id)} className="text-red-400 text-xs hover:underline">Устгах</button>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-gray-500">Төлөв:</span>
                  {statusOptions.map(s => (
                    <button key={s.value} onClick={() => updateStatus(r.id, s.value)}
                      className={`text-xs px-2 py-1 rounded-full transition ${r.status === s.value ? s.color + ' font-semibold' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <p className="text-gray-400 text-center py-8">Хүсэлт байхгүй</p>}
        </div>
      )}
    </div>
  );
}
