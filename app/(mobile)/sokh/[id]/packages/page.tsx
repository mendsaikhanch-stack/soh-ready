'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';

interface Package {
  id: number;
  resident_name: string;
  unit_number: string;
  carrier: string;
  description: string;
  pickup_code: string;
  status: string;
  delivered_at: string;
  picked_up_at: string | null;
}

const statusMap: Record<string, { label: string; color: string; icon: string }> = {
  delivered: { label: 'Хүлээж авна уу', color: 'bg-orange-100 text-orange-700', icon: '📦' },
  picked_up: { label: 'Авсан', color: 'bg-green-100 text-green-700', icon: '✅' },
  returned: { label: 'Буцаасан', color: 'bg-red-100 text-red-700', icon: '↩️' },
};

export default function PackagesPage() {
  const params = useParams();
  const router = useRouter();
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem(`pkg-info-${params.id}`);
    if (saved) { const d = JSON.parse(saved); setName(d.name); setUnit(d.unit); }
    fetchPackages();
  }, [params.id]);

  const fetchPackages = async () => {
    const { data } = await supabase
      .from('packages')
      .select('*')
      .eq('sokh_id', params.id)
      .order('delivered_at', { ascending: false });
    setPackages(data || []);
    setLoading(false);
  };

  const confirmPickup = async (id: number) => {
    await supabase.from('packages').update({
      status: 'picked_up',
      picked_up_at: new Date().toISOString(),
    }).eq('id', id);
    await fetchPackages();
  };

  const saveName = () => {
    if (!name || !unit) return;
    localStorage.setItem(`pkg-info-${params.id}`, JSON.stringify({ name, unit }));
  };

  const myPackages = packages.filter(p => p.unit_number === unit || p.resident_name === name);
  const pending = myPackages.filter(p => p.status === 'delivered');
  const getSt = (s: string) => statusMap[s] || statusMap.delivered;

  if (!name || !unit) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-orange-600 text-white px-4 py-4">
          <button onClick={() => router.push(`/sokh/${params.id}`)} className="text-white/80 text-sm mb-1">← Буцах</button>
          <h1 className="text-lg font-bold">📦 Илгээмж</h1>
        </div>
        <div className="px-4 py-8">
          <div className="bg-white rounded-xl p-6 shadow-sm text-center">
            <p className="text-3xl mb-3">📦</p>
            <p className="font-semibold mb-3">Мэдээлэл оруулна уу</p>
            <input placeholder="Нэр" value={name} onChange={e => setName(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 mb-2 text-sm text-center" />
            <input placeholder="Тоот (жнь: 301)" value={unit} onChange={e => setUnit(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 mb-3 text-sm text-center" />
            <button onClick={saveName} disabled={!name || !unit}
              className="w-full bg-orange-600 text-white py-2.5 rounded-xl font-medium disabled:opacity-50">
              Нэвтрэх
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-orange-600 text-white px-4 py-4">
        <button onClick={() => router.push(`/sokh/${params.id}`)} className="text-white/80 text-sm mb-1">← Буцах</button>
        <h1 className="text-lg font-bold">📦 Илгээмж</h1>
        <p className="text-xs text-white/70">{name} · {unit} тоот</p>
      </div>

      <div className="px-4 py-4">
        {/* Pending packages alert */}
        {pending.length > 0 && (
          <div className="bg-orange-50 border-2 border-orange-300 rounded-xl p-4 mb-4 text-center">
            <p className="text-2xl">📦</p>
            <p className="font-bold text-orange-700 mt-1">{pending.length} илгээмж хүлээж байна!</p>
            <p className="text-xs text-orange-600 mt-0.5">Харуулаас авна уу</p>
          </div>
        )}

        <h2 className="text-sm font-semibold text-gray-500 mb-2">МИНИЙ ИЛГЭЭМЖҮҮД</h2>
        {loading ? (
          <p className="text-gray-400 text-center py-8">Ачаалж байна...</p>
        ) : myPackages.length === 0 ? (
          <div className="bg-white rounded-xl p-6 text-center">
            <p className="text-3xl mb-2">📭</p>
            <p className="text-gray-400">Илгээмж байхгүй</p>
          </div>
        ) : (
          <div className="space-y-2">
            {myPackages.map(p => {
              const st = getSt(p.status);
              return (
                <div key={p.id} className="bg-white rounded-xl p-3 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{st.icon}</span>
                      <div>
                        <h3 className="font-medium text-sm">{p.description || 'Илгээмж'}</h3>
                        <p className="text-xs text-gray-500">{p.carrier || 'Тодорхойгүй'}</p>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                  </div>
                  {p.pickup_code && p.status === 'delivered' && (
                    <div className="mt-2 bg-gray-50 rounded-lg p-2 text-center">
                      <p className="text-xs text-gray-500">Авах код</p>
                      <p className="text-lg font-bold tracking-widest">{p.pickup_code}</p>
                    </div>
                  )}
                  <div className="flex justify-between items-center mt-2">
                    <p className="text-[10px] text-gray-400">
                      Ирсэн: {new Date(p.delivered_at).toLocaleString('mn-MN')}
                    </p>
                    {p.status === 'delivered' && (
                      <button onClick={() => confirmPickup(p.id)}
                        className="text-xs bg-green-600 text-white px-3 py-1 rounded-lg">
                        ✅ Авсан
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
