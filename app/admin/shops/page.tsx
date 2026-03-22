'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';

interface Shop { id: number; name: string; type: string; location: string; phone: string; hours: string; description: string; status: string; }
interface VendingMachine { id: number; name: string; type: string; location: string; status: string; description: string; operator_name: string; operator_phone: string; }

const shopTypes = [
  { value: 'grocery', label: 'Хүнсний дэлгүүр', icon: '🛒' },
  { value: 'pharmacy', label: 'Эмийн сан', icon: '💊' },
  { value: 'restaurant', label: 'Хоолны газар', icon: '🍜' },
  { value: 'cafe', label: 'Кафе', icon: '☕' },
  { value: 'salon', label: 'Үсчин / Салон', icon: '💇' },
  { value: 'laundry', label: 'Угаалгын газар', icon: '🧺' },
  { value: 'repair', label: 'Засварын газар', icon: '🔧' },
  { value: 'gym', label: 'Фитнесс', icon: '🏋️' },
  { value: 'kindergarten', label: 'Цэцэрлэг', icon: '👶' },
  { value: 'clinic', label: 'Эмнэлэг', icon: '🏥' },
  { value: 'other', label: 'Бусад', icon: '🏪' },
];

const vendingTypes = [
  { value: 'drink', label: 'Ундаа', icon: '🥤' },
  { value: 'snack', label: 'Зууш', icon: '🍿' },
  { value: 'coffee', label: 'Кофе', icon: '☕' },
  { value: 'ice_cream', label: 'Зайрмаг', icon: '🍦' },
  { value: 'water', label: 'Ус', icon: '💧' },
  { value: 'other', label: 'Бусад', icon: '🤖' },
];

export default function AdminShops() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [machines, setMachines] = useState<VendingMachine[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'shops' | 'vending'>('shops');
  const [showShopForm, setShowShopForm] = useState(false);
  const [showVendForm, setShowVendForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Shop form
  const [sName, setSName] = useState(''); const [sType, setSType] = useState('grocery');
  const [sLocation, setSLocation] = useState(''); const [sPhone, setSPhone] = useState('');
  const [sHours, setSHours] = useState(''); const [sDesc, setSDesc] = useState('');

  // Vending form
  const [vName, setVName] = useState(''); const [vType, setVType] = useState('drink');
  const [vLocation, setVLocation] = useState(''); const [vDesc, setVDesc] = useState('');
  const [vOperator, setVOperator] = useState(''); const [vOpPhone, setVOpPhone] = useState('');

  useEffect(() => { fetchAll(); }, []);
  const fetchAll = async () => {
    const [{ data: sh }, { data: vm }] = await Promise.all([
      supabase.from('local_shops').select('*').order('name'),
      supabase.from('vending_machines').select('*').order('location'),
    ]);
    setShops(sh || []); setMachines(vm || []); setLoading(false);
  };

  const addShop = async () => {
    if (!sName) return; setSaving(true);
    await supabase.from('local_shops').insert([{
      sokh_id: 1, name: sName, type: sType, location: sLocation, phone: sPhone, hours: sHours, description: sDesc, status: 'active',
    }]);
    setSName(''); setSLocation(''); setSPhone(''); setSHours(''); setSDesc('');
    setShowShopForm(false); setSaving(false); await fetchAll();
  };

  const addVending = async () => {
    if (!vLocation) return; setSaving(true);
    await supabase.from('vending_machines').insert([{
      sokh_id: 1, name: vName || null, type: vType, location: vLocation, description: vDesc,
      operator_name: vOperator, operator_phone: vOpPhone, status: 'active',
    }]);
    setVName(''); setVLocation(''); setVDesc(''); setVOperator(''); setVOpPhone('');
    setShowVendForm(false); setSaving(false); await fetchAll();
  };

  const toggleShop = async (id: number, status: string) => {
    await supabase.from('local_shops').update({ status: status === 'active' ? 'inactive' : 'active' }).eq('id', id);
    await fetchAll();
  };

  const toggleVend = async (id: number, status: string) => {
    await supabase.from('vending_machines').update({ status: status === 'active' ? 'maintenance' : 'active' }).eq('id', id);
    await fetchAll();
  };

  const delShop = async (id: number) => { if (!confirm('Устгах уу?')) return; await supabase.from('local_shops').delete().eq('id', id); await fetchAll(); };
  const delVend = async (id: number) => { if (!confirm('Устгах уу?')) return; await supabase.from('vending_machines').delete().eq('id', id); await fetchAll(); };

  const getShopType = (t: string) => shopTypes.find(o => o.value === t) || shopTypes[10];
  const getVendType = (t: string) => vendingTypes.find(o => o.value === t) || vendingTypes[5];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">🏪 Дэлгүүр & Автомат машин</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab('shops')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'shops' ? 'bg-rose-600 text-white' : 'bg-gray-100'}`}>
          🏪 Дэлгүүр / Үйлчилгээ ({shops.length})
        </button>
        <button onClick={() => setTab('vending')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'vending' ? 'bg-rose-600 text-white' : 'bg-gray-100'}`}>
          🤖 Бараа түгээх автомат ({machines.length})
        </button>
      </div>

      {tab === 'shops' ? (
        <>
          <button onClick={() => setShowShopForm(!showShopForm)}
            className="bg-rose-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-rose-700 mb-4">
            + Дэлгүүр нэмэх
          </button>

          {showShopForm && (
            <div className="bg-white border rounded-xl p-4 mb-4">
              <div className="grid grid-cols-3 gap-3 mb-3">
                <input placeholder="Нэр" value={sName} onChange={e => setSName(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
                <select value={sType} onChange={e => setSType(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
                  {shopTypes.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                </select>
                <input placeholder="Байршил (жнь: 1-р давхар)" value={sLocation} onChange={e => setSLocation(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <input placeholder="Утас" value={sPhone} onChange={e => setSPhone(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
                <input placeholder="Цагийн хуваарь (жнь: 09:00-21:00)" value={sHours} onChange={e => setSHours(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
                <input placeholder="Тайлбар" value={sDesc} onChange={e => setSDesc(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowShopForm(false)} className="px-4 py-2 rounded-lg border text-sm">Цуцлах</button>
                <button onClick={addShop} disabled={saving || !sName}
                  className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm disabled:opacity-50">{saving ? '...' : 'Нэмэх'}</button>
              </div>
            </div>
          )}

          {loading ? <p className="text-gray-400 text-center py-8">Ачаалж байна...</p> : (
            <div className="space-y-3">
              {shops.map(s => {
                const t = getShopType(s.type);
                return (
                  <div key={s.id} className={`bg-white border rounded-xl p-4 ${s.status !== 'active' ? 'opacity-50' : ''}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-xl">{t.icon}</div>
                        <div>
                          <h3 className="font-semibold text-sm">{s.name}</h3>
                          <p className="text-xs text-rose-600">{t.label}</p>
                          {s.location && <p className="text-xs text-gray-500">📍 {s.location}</p>}
                          {s.hours && <p className="text-xs text-gray-500">🕐 {s.hours}</p>}
                          {s.phone && <p className="text-xs text-gray-500">📞 {s.phone}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => toggleShop(s.id, s.status)}
                          className={`text-xs px-2 py-1 rounded-full ${s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {s.status === 'active' ? 'Идэвхтэй' : 'Идэвхгүй'}
                        </button>
                        <button onClick={() => delShop(s.id)} className="text-xs text-red-400 hover:underline">Устгах</button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {shops.length === 0 && <p className="text-gray-400 text-center py-8">Дэлгүүр байхгүй</p>}
            </div>
          )}
        </>
      ) : (
        <>
          <button onClick={() => setShowVendForm(!showVendForm)}
            className="bg-rose-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-rose-700 mb-4">
            + Автомат машин нэмэх
          </button>

          {showVendForm && (
            <div className="bg-white border rounded-xl p-4 mb-4">
              <div className="grid grid-cols-3 gap-3 mb-3">
                <input placeholder="Нэр (заавал биш)" value={vName} onChange={e => setVName(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
                <select value={vType} onChange={e => setVType(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
                  {vendingTypes.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                </select>
                <input placeholder="Байршил (жнь: А блок 1-р давхар)" value={vLocation} onChange={e => setVLocation(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <input placeholder="Оператор нэр" value={vOperator} onChange={e => setVOperator(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
                <input placeholder="Оператор утас" value={vOpPhone} onChange={e => setVOpPhone(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
                <input placeholder="Тайлбар" value={vDesc} onChange={e => setVDesc(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowVendForm(false)} className="px-4 py-2 rounded-lg border text-sm">Цуцлах</button>
                <button onClick={addVending} disabled={saving || !vLocation}
                  className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm disabled:opacity-50">{saving ? '...' : 'Нэмэх'}</button>
              </div>
            </div>
          )}

          {loading ? <p className="text-gray-400 text-center py-8">Ачаалж байна...</p> : (
            <div className="space-y-3">
              {machines.map(m => {
                const t = getVendType(m.type);
                return (
                  <div key={m.id} className="bg-white border rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-xl">{t.icon}</div>
                        <div>
                          <h3 className="font-medium text-sm">{m.name || t.label}</h3>
                          <p className="text-xs text-gray-500">📍 {m.location}</p>
                          {m.operator_name && <p className="text-xs text-gray-500">👤 {m.operator_name} · 📞 {m.operator_phone}</p>}
                          {m.description && <p className="text-xs text-gray-500">{m.description}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => toggleVend(m.id, m.status)}
                          className={`text-xs px-2 py-1 rounded-full ${m.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {m.status === 'active' ? 'Ажиллаж байна' : 'Засвартай'}
                        </button>
                        <button onClick={() => delVend(m.id)} className="text-xs text-red-400 hover:underline">Устгах</button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {machines.length === 0 && <p className="text-gray-400 text-center py-8">Автомат машин байхгүй</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
