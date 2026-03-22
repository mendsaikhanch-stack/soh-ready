'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';

interface Space {
  id: number;
  name: string;
  type: string;
  capacity: number;
  description: string;
}

interface Booking {
  id: number;
  space_id: number;
  resident_name: string;
  unit_number: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  common_spaces?: Space;
}

const typeMap: Record<string, { icon: string }> = {
  meeting: { icon: '🏢' },
  gym: { icon: '🏋️' },
  playground: { icon: '🎠' },
  party: { icon: '🎉' },
  bbq: { icon: '🍖' },
  laundry: { icon: '🧺' },
  other: { icon: '📍' },
};

export default function BookingPage() {
  const params = useParams();
  const router = useRouter();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [selectedSpace, setSelectedSpace] = useState<number>(0);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('12:00');
  const [residentName, setResidentName] = useState('');
  const [unitNumber, setUnitNumber] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem(`booking-info-${params.id}`);
    if (saved) { const d = JSON.parse(saved); setResidentName(d.name); setUnitNumber(d.unit); }
    fetchData();
  }, [params.id]);

  const fetchData = async () => {
    const { data: sp } = await supabase.from('common_spaces').select('*').eq('sokh_id', params.id).order('name');
    setSpaces(sp || []);
    if (sp?.length) setSelectedSpace(sp[0].id);

    const { data: bk } = await supabase
      .from('space_bookings')
      .select('*, common_spaces(name, type)')
      .eq('sokh_id', params.id)
      .gte('date', new Date().toISOString().split('T')[0])
      .order('date', { ascending: true });
    setBookings(bk || []);
    setLoading(false);
  };

  const submit = async () => {
    if (!selectedSpace || !residentName || !date) return;
    setSaving(true);
    localStorage.setItem(`booking-info-${params.id}`, JSON.stringify({ name: residentName, unit: unitNumber }));

    await supabase.from('space_bookings').insert([{
      sokh_id: params.id, space_id: selectedSpace, resident_name: residentName,
      unit_number: unitNumber, date, start_time: startTime, end_time: endTime, status: 'confirmed',
    }]);

    setShowForm(false); setSaving(false);
    await fetchData();
  };

  const myBookings = bookings.filter(b => b.resident_name === residentName);
  const todayBookings = bookings.filter(b => b.date === new Date().toISOString().split('T')[0]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-indigo-600 text-white px-4 py-4">
        <button onClick={() => router.push(`/sokh/${params.id}`)} className="text-white/80 text-sm mb-1">← Буцах</button>
        <h1 className="text-lg font-bold">🏢 Нийтийн зай захиалга</h1>
      </div>

      <div className="px-4 py-4">
        {/* Available spaces */}
        <h2 className="text-sm font-semibold text-gray-500 mb-2">БОЛОМЖИТ ЗАЙНУУД</h2>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {spaces.map(s => {
            const t = typeMap[s.type] || typeMap.other;
            return (
              <div key={s.id} className="bg-white rounded-xl p-3 shadow-sm text-center">
                <p className="text-2xl">{t.icon}</p>
                <p className="font-medium text-sm mt-1">{s.name}</p>
                {s.capacity > 0 && <p className="text-xs text-gray-500">{s.capacity} хүн</p>}
              </div>
            );
          })}
          {spaces.length === 0 && !loading && (
            <p className="text-gray-400 text-sm col-span-2 text-center py-4">Нийтийн зай бүртгэгдээгүй</p>
          )}
        </div>

        <button onClick={() => setShowForm(!showForm)}
          className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium active:bg-indigo-700 transition mb-4">
          + Захиалга өгөх
        </button>

        {showForm && (
          <div className="bg-white rounded-xl p-4 shadow-sm mb-4 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Таны нэр" value={residentName} onChange={e => setResidentName(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm" />
              <input placeholder="Тоот" value={unitNumber} onChange={e => setUnitNumber(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm" />
            </div>
            <select value={selectedSpace} onChange={e => setSelectedSpace(Number(e.target.value))}
              className="w-full border rounded-lg px-3 py-2 text-sm">
              {spaces.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500">Эхлэх</label>
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Дуусах</label>
                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-lg border text-sm">Цуцлах</button>
              <button onClick={submit} disabled={saving || !residentName || !selectedSpace}
                className="flex-1 py-2 rounded-lg bg-indigo-600 text-white text-sm disabled:opacity-50">
                {saving ? '...' : 'Захиалах'}
              </button>
            </div>
          </div>
        )}

        {/* Today */}
        {todayBookings.length > 0 && (
          <>
            <h2 className="text-sm font-semibold text-gray-500 mb-2">ӨНӨӨДРИЙН ЗАХИАЛГА</h2>
            <div className="space-y-2 mb-4">
              {todayBookings.map(b => (
                <div key={b.id} className="bg-indigo-50 border border-indigo-200 rounded-xl p-3">
                  <div className="flex justify-between">
                    <span className="font-medium text-sm">{(b.common_spaces as any)?.name}</span>
                    <span className="text-xs text-indigo-600">{b.start_time} - {b.end_time}</span>
                  </div>
                  <p className="text-xs text-gray-500">{b.resident_name} · {b.unit_number} тоот</p>
                </div>
              ))}
            </div>
          </>
        )}

        {/* My bookings */}
        <h2 className="text-sm font-semibold text-gray-500 mb-2">МИНИЙ ЗАХИАЛГА</h2>
        {loading ? (
          <p className="text-gray-400 text-center py-8">Ачаалж байна...</p>
        ) : myBookings.length === 0 ? (
          <div className="bg-white rounded-xl p-6 text-center">
            <p className="text-3xl mb-2">📅</p>
            <p className="text-gray-400">Захиалга байхгүй</p>
          </div>
        ) : (
          <div className="space-y-2">
            {myBookings.map(b => (
              <div key={b.id} className="bg-white rounded-xl p-3 shadow-sm">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-sm">{(b.common_spaces as any)?.name}</span>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Баталгаажсан</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  📅 {new Date(b.date).toLocaleDateString('mn-MN')} · {b.start_time} - {b.end_time}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
