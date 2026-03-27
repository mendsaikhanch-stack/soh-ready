'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { adminFrom } from '@/app/lib/admin-db';
import { getAdminSokhId } from '@/app/lib/admin-config';

interface Space { id: number; name: string; type: string; capacity: number; description: string; }
interface Booking {
  id: number; space_id: number; resident_name: string; unit_number: string;
  date: string; start_time: string; end_time: string; status: string;
  common_spaces?: Space;
}

const typeOptions = [
  { value: 'meeting', label: 'Хурлын өрөө', icon: '🏢' },
  { value: 'gym', label: 'Спорт заал', icon: '🏋️' },
  { value: 'playground', label: 'Тоглоомын талбай', icon: '🎠' },
  { value: 'party', label: 'Баяр зугаа', icon: '🎉' },
  { value: 'bbq', label: 'BBQ', icon: '🍖' },
  { value: 'laundry', label: 'Угаалга', icon: '🧺' },
  { value: 'other', label: 'Бусад', icon: '📍' },
];

export default function AdminBooking() {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSpaceForm, setShowSpaceForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [spName, setSpName] = useState('');
  const [spType, setSpType] = useState('meeting');
  const [spCapacity, setSpCapacity] = useState('');
  const [spDesc, setSpDesc] = useState('');

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    const sokhId = await getAdminSokhId();
    const [{ data: sp }, { data: bk }] = await Promise.all([
      supabase.from('common_spaces').select('*').eq('sokh_id', sokhId).order('name'),
      supabase.from('space_bookings').select('*, common_spaces!inner(name, type, sokh_id)').eq('common_spaces.sokh_id', sokhId).order('date', { ascending: false }).limit(50),
    ]);
    setSpaces(sp || []); setBookings(bk || []); setLoading(false);
  };

  const addSpace = async () => {
    if (!spName) return;
    setSaving(true);
    const sokhId = await getAdminSokhId();
    await adminFrom('common_spaces').insert([{
      sokh_id: sokhId, name: spName, type: spType, capacity: spCapacity ? Number(spCapacity) : 0, description: spDesc,
    }]);
    setSpName(''); setSpDesc(''); setSpCapacity('');
    setShowSpaceForm(false); setSaving(false);
    await fetchAll();
  };

  const deleteSpace = async (id: number) => {
    if (!confirm('Устгах уу?')) return;
    await adminFrom('common_spaces').delete().eq('id', id);
    await fetchAll();
  };

  const cancelBooking = async (id: number) => {
    await adminFrom('space_bookings').update({ status: 'cancelled' }).eq('id', id);
    await fetchAll();
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">🏢 Нийтийн зай & Захиалга</h1>

      {/* Spaces management */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Нийтийн зайнууд</h2>
          <button onClick={() => setShowSpaceForm(!showSpaceForm)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
            + Зай нэмэх
          </button>
        </div>

        {showSpaceForm && (
          <div className="bg-white border rounded-xl p-4 mb-4">
            <div className="grid grid-cols-4 gap-3">
              <input placeholder="Нэр" value={spName} onChange={e => setSpName(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm" />
              <select value={spType} onChange={e => setSpType(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
                {typeOptions.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
              </select>
              <input type="number" placeholder="Багтаамж" value={spCapacity} onChange={e => setSpCapacity(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm" />
              <div className="flex gap-2">
                <button onClick={() => setShowSpaceForm(false)} className="flex-1 py-2 rounded-lg border text-sm">Цуцлах</button>
                <button onClick={addSpace} disabled={saving || !spName}
                  className="flex-1 py-2 rounded-lg bg-indigo-600 text-white text-sm disabled:opacity-50">
                  {saving ? '...' : 'Нэмэх'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          {spaces.map(s => {
            const t = typeOptions.find(o => o.value === s.type) || typeOptions[6];
            return (
              <div key={s.id} className="bg-white border rounded-xl p-4 text-center relative">
                <button onClick={() => deleteSpace(s.id)} className="absolute top-2 right-2 text-xs text-red-400 hover:underline">✕</button>
                <p className="text-2xl">{t.icon}</p>
                <p className="font-medium text-sm mt-1">{s.name}</p>
                {s.capacity > 0 && <p className="text-xs text-gray-500">{s.capacity} хүн</p>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bookings */}
      <h2 className="text-lg font-semibold mb-3">Захиалгууд</h2>
      {loading ? <p className="text-gray-400 text-center py-8">Ачаалж байна...</p> : (
        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs text-gray-500">Зай</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500">Хэн</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500">Огноо</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500">Цаг</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500">Төлөв</th>
                <th className="px-4 py-3 text-right text-xs text-gray-500"></th>
              </tr>
            </thead>
            <tbody>
              {bookings.map(b => (
                <tr key={b.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">{(b.common_spaces as any)?.name}</td>
                  <td className="px-4 py-3">{b.resident_name} · {b.unit_number}</td>
                  <td className="px-4 py-3">{new Date(b.date).toLocaleDateString('mn-MN')}</td>
                  <td className="px-4 py-3">{b.start_time}-{b.end_time}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${b.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {b.status === 'confirmed' ? 'Баталсан' : 'Цуцалсан'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {b.status === 'confirmed' && (
                      <button onClick={() => cancelBooking(b.id)} className="text-xs text-red-400 hover:underline">Цуцлах</button>
                    )}
                  </td>
                </tr>
              ))}
              {bookings.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Захиалга байхгүй</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
