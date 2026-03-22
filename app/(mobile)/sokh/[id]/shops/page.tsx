'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';

interface Shop {
  id: number;
  name: string;
  type: string;
  location: string;
  phone: string;
  hours: string;
  description: string;
}

interface VendingMachine {
  id: number;
  name: string;
  type: string;
  location: string;
  status: string;
  description: string;
}

const shopTypeMap: Record<string, { label: string; icon: string }> = {
  grocery: { label: 'Хүнсний дэлгүүр', icon: '🛒' },
  pharmacy: { label: 'Эмийн сан', icon: '💊' },
  restaurant: { label: 'Хоолны газар', icon: '🍜' },
  cafe: { label: 'Кафе', icon: '☕' },
  salon: { label: 'Үсчин / Салон', icon: '💇' },
  laundry: { label: 'Угаалгын газар', icon: '🧺' },
  repair: { label: 'Засварын газар', icon: '🔧' },
  gym: { label: 'Фитнесс', icon: '🏋️' },
  kindergarten: { label: 'Цэцэрлэг', icon: '👶' },
  clinic: { label: 'Эмнэлэг', icon: '🏥' },
  other: { label: 'Бусад', icon: '🏪' },
};

const vendingTypeMap: Record<string, { label: string; icon: string }> = {
  drink: { label: 'Ундаа', icon: '🥤' },
  snack: { label: 'Зууш', icon: '🍿' },
  coffee: { label: 'Кофе', icon: '☕' },
  ice_cream: { label: 'Зайрмаг', icon: '🍦' },
  water: { label: 'Ус', icon: '💧' },
  other: { label: 'Бусад', icon: '🤖' },
};

export default function ShopsPage() {
  const params = useParams();
  const router = useRouter();
  const [shops, setShops] = useState<Shop[]>([]);
  const [machines, setMachines] = useState<VendingMachine[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'shops' | 'vending'>('shops');

  useEffect(() => {
    const fetchData = async () => {
      const [{ data: sh }, { data: vm }] = await Promise.all([
        supabase.from('local_shops').select('*').eq('sokh_id', params.id).eq('status', 'active').order('name'),
        supabase.from('vending_machines').select('*').eq('sokh_id', params.id).order('location'),
      ]);
      setShops(sh || []);
      setMachines(vm || []);
      setLoading(false);
    };
    fetchData();
  }, [params.id]);

  const getShopType = (t: string) => shopTypeMap[t] || shopTypeMap.other;
  const getVendType = (t: string) => vendingTypeMap[t] || vendingTypeMap.other;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-rose-600 text-white px-4 py-4">
        <button onClick={() => router.push(`/sokh/${params.id}`)} className="text-white/80 text-sm mb-1">← Буцах</button>
        <h1 className="text-lg font-bold">🏪 Дэлгүүр & Үйлчилгээ</h1>
        <p className="text-xs text-white/70">Хотхон доторхи</p>
      </div>

      <div className="px-4 py-4">
        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button onClick={() => setTab('shops')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition ${tab === 'shops' ? 'bg-rose-100 text-rose-700 border-2 border-rose-400' : 'bg-white text-gray-500 border'}`}>
            🏪 Дэлгүүр ({shops.length})
          </button>
          <button onClick={() => setTab('vending')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition ${tab === 'vending' ? 'bg-rose-100 text-rose-700 border-2 border-rose-400' : 'bg-white text-gray-500 border'}`}>
            🤖 Автомат ({machines.length})
          </button>
        </div>

        {loading ? (
          <p className="text-gray-400 text-center py-8">Ачаалж байна...</p>
        ) : tab === 'shops' ? (
          shops.length === 0 ? (
            <div className="bg-white rounded-xl p-6 text-center">
              <p className="text-3xl mb-2">🏪</p>
              <p className="text-gray-400">Дэлгүүр бүртгэгдээгүй</p>
            </div>
          ) : (
            <div className="space-y-2">
              {shops.map(s => {
                const t = getShopType(s.type);
                return (
                  <div key={s.id} className="bg-white rounded-xl p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center text-2xl">{t.icon}</div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-sm">{s.name}</h3>
                        <p className="text-xs text-rose-600">{t.label}</p>
                        {s.location && <p className="text-xs text-gray-500 mt-1">📍 {s.location}</p>}
                        {s.hours && <p className="text-xs text-gray-500">🕐 {s.hours}</p>}
                        {s.description && <p className="text-xs text-gray-500 mt-1">{s.description}</p>}
                        {s.phone && (
                          <a href={`tel:${s.phone}`} className="inline-flex items-center gap-1 mt-1.5 text-xs text-blue-600">
                            📞 {s.phone}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          machines.length === 0 ? (
            <div className="bg-white rounded-xl p-6 text-center">
              <p className="text-3xl mb-2">🤖</p>
              <p className="text-gray-400">Автомат машин бүртгэгдээгүй</p>
            </div>
          ) : (
            <div className="space-y-2">
              {machines.map(m => {
                const t = getVendType(m.type);
                return (
                  <div key={m.id} className="bg-white rounded-xl p-3 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-xl">{t.icon}</div>
                      <div className="flex-1">
                        <h3 className="font-medium text-sm">{m.name || t.label}</h3>
                        <p className="text-xs text-gray-500">📍 {m.location}</p>
                        {m.description && <p className="text-xs text-gray-500">{m.description}</p>}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${m.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {m.status === 'active' ? 'Ажиллаж байна' : 'Засвартай'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}
