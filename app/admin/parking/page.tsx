'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { adminFrom } from '@/app/lib/admin-db';
import { getAdminSokhId } from '@/app/lib/admin-config';

interface Vehicle {
  id: number;
  plate_number: string;
  owner_name: string;
  car_model: string;
  color: string;
  parking_spot: string;
  created_at: string;
}

interface BlockingIncident {
  id: number;
  blocking_plate: string;
  blocked_plate: string;
  resolved: boolean;
  notification_sent: boolean;
  created_at: string;
}

interface GuestVehicle {
  id: number;
  plate_number: string;
  host_name: string;
  host_apartment: string;
  entered_at: string;
  allowed_minutes: number;
  exited_at: string | null;
  over_charge: number;
  charged: boolean;
}

interface GateSettings {
  ip_address: string;
  port: string;
  connected: boolean;
  auto_open: boolean;
  overcharge_per_hour: number;
}

const TOTAL_SPOTS = 30;
const COLORS = ['Цагаан', 'Хар', 'Мөнгөлөг', 'Саарал', 'Улаан', 'Цэнхэр', 'Хүрэн', 'Ногоон', 'Шар', 'Бусад'];

export default function AdminParking() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [incidents, setIncidents] = useState<BlockingIncident[]>([]);
  const [gateSetting, setGateSetting] = useState<GateSettings>({
    ip_address: '192.168.1.100', port: '8080', connected: false, auto_open: true, overcharge_per_hour: 5000,
  });
  const [guests, setGuests] = useState<GuestVehicle[]>([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'vehicles' | 'spots' | 'blocking' | 'guests' | 'gate'>('vehicles');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ plate_number: '', owner_name: '', car_model: '', color: 'Цагаан', parking_spot: '' });
  const [blockingForm, setBlockingForm] = useState({ blocking_plate: '', blocked_plate: '' });
  const [gateForm, setGateForm] = useState({ ip_address: '192.168.1.100', port: '8080', auto_open: true, overcharge_per_hour: 5000 });
  const [guestForm, setGuestForm] = useState({ plate_number: '', host_name: '', host_apartment: '', allowed_minutes: 60 });
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    const sokhId = await getAdminSokhId();
    const [{ data: v }, { data: inc }, { data: g }, { data: gs }] = await Promise.all([
      supabase.from('vehicles').select('*').eq('sokh_id', sokhId).order('created_at'),
      supabase.from('blocking_incidents').select('*').eq('sokh_id', sokhId).order('created_at', { ascending: false }),
      supabase.from('guest_vehicles').select('*').eq('sokh_id', sokhId).order('entered_at', { ascending: false }),
      supabase.from('gate_settings').select('*').eq('sokh_id', sokhId).single(),
    ]);
    setVehicles(v || []);
    setIncidents(inc || []);
    setGuests(g || []);
    if (gs) {
      setGateSetting(gs);
      setGateForm({ ip_address: gs.ip_address, port: gs.port, auto_open: gs.auto_open, overcharge_per_hour: gs.overcharge_per_hour });
    }
    setLoading(false);
  };

  // Vehicle CRUD
  const saveVehicle = async () => {
    if (!form.plate_number || !form.owner_name) return;
    const sokhId = await getAdminSokhId();
    if (editId) {
      await adminFrom('vehicles').update(form).eq('id', editId);
    } else {
      await adminFrom('vehicles').insert({ sokh_id: sokhId, ...form });
    }
    setShowForm(false);
    fetchAll();
  };

  const deleteVehicle = async (id: number) => {
    if (!confirm('Устгах уу?')) return;
    await adminFrom('vehicles').delete().eq('id', id);
    fetchAll();
  };

  const openAdd = () => { setEditId(null); setForm({ plate_number: '', owner_name: '', car_model: '', color: 'Цагаан', parking_spot: '' }); setShowForm(true); };
  const openEdit = (v: Vehicle) => { setEditId(v.id); setForm({ plate_number: v.plate_number, owner_name: v.owner_name, car_model: v.car_model, color: v.color, parking_spot: v.parking_spot }); setShowForm(true); };

  // Blocking
  const addBlocking = async () => {
    if (!blockingForm.blocking_plate || !blockingForm.blocked_plate) return;
    const sokhId = await getAdminSokhId();
    await adminFrom('blocking_incidents').insert({ sokh_id: sokhId, ...blockingForm });
    setBlockingForm({ blocking_plate: '', blocked_plate: '' });
    fetchAll();
  };

  const resolveIncident = async (id: number) => {
    await adminFrom('blocking_incidents').update({ resolved: true }).eq('id', id);
    fetchAll();
  };

  // Guest
  const addGuest = async () => {
    if (!guestForm.plate_number || !guestForm.host_name) return;
    const sokhId = await getAdminSokhId();
    await adminFrom('guest_vehicles').insert({ sokh_id: sokhId, ...guestForm });
    setGuestForm({ plate_number: '', host_name: '', host_apartment: '', allowed_minutes: 60 });
    setShowGuestForm(false);
    alert('Зочин бүртгэгдлээ!');
    fetchAll();
  };

  const exitGuest = async (id: number) => {
    const g = guests.find(x => x.id === id);
    if (!g) return;
    const minutesPassed = Math.floor((Date.now() - new Date(g.entered_at).getTime()) / 60000);
    const overMinutes = Math.max(0, minutesPassed - g.allowed_minutes);
    const overHours = Math.ceil(overMinutes / 60);
    const charge = overHours * gateSetting.overcharge_per_hour;
    await adminFrom('guest_vehicles').update({ exited_at: new Date().toISOString(), over_charge: charge }).eq('id', id);
    fetchAll();
  };

  const chargeGuest = async (id: number) => {
    await adminFrom('guest_vehicles').update({ charged: true }).eq('id', id);
    fetchAll();
  };

  // Gate
  const saveGate = async () => {
    const sokhId = await getAdminSokhId();
    await adminFrom('gate_settings').upsert({ sokh_id: sokhId, ...gateForm, connected: gateSetting.connected });
    alert('Хаалганы тохиргоо хадгалагдлаа!');
    fetchAll();
  };

  const testGate = async () => {
    const sokhId = await getAdminSokhId();
    await adminFrom('gate_settings').upsert({ sokh_id: sokhId, ...gateForm, connected: true });
    alert('Холболт амжилттай!');
    fetchAll();
  };

  const getGuestStatus = (g: GuestVehicle) => {
    if (g.exited_at) return 'exited';
    const minutesPassed = Math.floor((Date.now() - new Date(g.entered_at).getTime()) / 60000);
    return minutesPassed > g.allowed_minutes ? 'overdue' : 'active';
  };

  const getTimeRemaining = (g: GuestVehicle) => {
    const minutesPassed = Math.floor((Date.now() - new Date(g.entered_at).getTime()) / 60000);
    const remaining = g.allowed_minutes - minutesPassed;
    if (remaining <= 0) { const over = Math.abs(remaining); return `${Math.floor(over / 60)} цаг ${over % 60} мин хэтэрсэн`; }
    return `${Math.floor(remaining / 60)} цаг ${remaining % 60} мин үлдсэн`;
  };

  const filtered = vehicles.filter(v => v.plate_number.toLowerCase().includes(search.toLowerCase()) || v.owner_name.toLowerCase().includes(search.toLowerCase()));
  const occupiedSpots = vehicles.map(v => v.parking_spot).filter(Boolean);
  const activeGuests = guests.filter(g => !g.exited_at);

  const tabs = [
    { key: 'vehicles' as const, label: 'Машин', icon: '🚗' },
    { key: 'spots' as const, label: 'Зогсоол', icon: '🅿️' },
    { key: 'blocking' as const, label: 'Хориглол', icon: '🚫' },
    { key: 'guests' as const, label: `Зочин${activeGuests.length ? ` (${activeGuests.length})` : ''}`, icon: '🎫' },
    { key: 'gate' as const, label: 'Хаалга', icon: '🚧' },
  ];

  if (loading) return <div className="p-6 text-gray-400">Ачаалж байна...</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">🚗 Зогсоол удирдлага</h1>
        <span className="text-sm text-gray-500">{vehicles.length} машин · {occupiedSpots.length}/{TOTAL_SPOTS} зогсоол</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition ${activeTab === tab.key ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>
            <span>{tab.icon}</span><span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* VEHICLES TAB */}
      {activeTab === 'vehicles' && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <input placeholder="Дугаар, нэрээр хайх..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1 border rounded-lg px-4 py-2 text-sm" />
            <button onClick={openAdd} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">+ Нэмэх</button>
          </div>
          {showForm && (
            <div className="bg-white border rounded-xl p-4 mb-4">
              <h3 className="font-semibold mb-3">{editId ? 'Засах' : 'Шинэ машин'}</h3>
              <div className="grid grid-cols-3 gap-3">
                <input placeholder="Дугаар (0000 УБА)" value={form.plate_number} onChange={e => setForm({ ...form, plate_number: e.target.value })} className="border rounded-lg px-3 py-2 text-sm" />
                <input placeholder="Эзэмшигч" value={form.owner_name} onChange={e => setForm({ ...form, owner_name: e.target.value })} className="border rounded-lg px-3 py-2 text-sm" />
                <input placeholder="Машины загвар" value={form.car_model} onChange={e => setForm({ ...form, car_model: e.target.value })} className="border rounded-lg px-3 py-2 text-sm" />
                <select value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="border rounded-lg px-3 py-2 text-sm">{COLORS.map(c => <option key={c}>{c}</option>)}</select>
                <input placeholder="Зогсоолын дугаар" value={form.parking_spot} onChange={e => setForm({ ...form, parking_spot: e.target.value })} className="border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg text-sm">Цуцлах</button>
                <button onClick={saveVehicle} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Хадгалах</button>
              </div>
            </div>
          )}
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr className="text-left text-sm text-gray-500">
                  <th className="px-4 py-3">Дугаар</th><th className="px-4 py-3">Эзэмшигч</th><th className="px-4 py-3">Загвар</th><th className="px-4 py-3">Өнгө</th><th className="px-4 py-3">Зогсоол</th><th className="px-4 py-3 text-right">Үйлдэл</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(v => (
                  <tr key={v.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-bold">{v.plate_number}</td>
                    <td className="px-4 py-3 text-sm">{v.owner_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{v.car_model || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{v.color}</td>
                    <td className="px-4 py-3 text-sm">{v.parking_spot || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEdit(v)} className="text-blue-500 text-sm mr-2 hover:underline">Засах</button>
                      <button onClick={() => deleteVehicle(v.id)} className="text-red-400 text-sm hover:underline">Устгах</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <p className="text-gray-400 text-center py-6">Машин бүртгэгдээгүй</p>}
          </div>
        </div>
      )}

      {/* SPOTS TAB */}
      {activeTab === 'spots' && (
        <div>
          <div className="flex items-center gap-4 mb-4 text-sm">
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500 rounded"></span> Сул ({TOTAL_SPOTS - occupiedSpots.length})</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-500 rounded"></span> Эзэлсэн ({occupiedSpots.length})</span>
          </div>
          <div className="grid grid-cols-6 gap-2">
            {Array.from({ length: TOTAL_SPOTS }, (_, i) => {
              const spot = `P${i + 1}`;
              const vehicle = vehicles.find(v => v.parking_spot === spot);
              return (
                <div key={spot} className={`p-3 rounded-xl text-center border-2 ${vehicle ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-300'}`}>
                  <p className="text-xs font-bold text-gray-500">{spot}</p>
                  {vehicle ? (
                    <div>
                      <p className="text-xs font-bold mt-1">{vehicle.plate_number}</p>
                      <p className="text-[10px] text-gray-500">{vehicle.owner_name}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-green-600 mt-1">Сул</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* BLOCKING TAB */}
      {activeTab === 'blocking' && (
        <div>
          <div className="bg-white border rounded-xl p-4 mb-4">
            <h3 className="font-semibold mb-3">Машин хориглол бүртгэх</h3>
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Хориглож буй дугаар" value={blockingForm.blocking_plate} onChange={e => setBlockingForm({ ...blockingForm, blocking_plate: e.target.value })} className="border rounded-lg px-3 py-2 text-sm" />
              <input placeholder="Хоригдсон дугаар" value={blockingForm.blocked_plate} onChange={e => setBlockingForm({ ...blockingForm, blocked_plate: e.target.value })} className="border rounded-lg px-3 py-2 text-sm" />
            </div>
            <button onClick={addBlocking} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm mt-3 hover:bg-red-700">Бүртгэх</button>
          </div>
          <div className="space-y-2">
            {incidents.map(inc => (
              <div key={inc.id} className={`bg-white rounded-xl p-4 border flex items-center justify-between ${!inc.resolved ? 'border-red-300' : ''}`}>
                <div>
                  <p className="text-sm"><span className="font-bold text-red-600">{inc.blocking_plate}</span> → <span className="font-bold">{inc.blocked_plate}</span></p>
                  <p className="text-xs text-gray-400">{new Date(inc.created_at).toLocaleString('mn-MN')}</p>
                </div>
                {!inc.resolved ? (
                  <button onClick={() => resolveIncident(inc.id)} className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-medium">Шийдсэн</button>
                ) : (
                  <span className="text-xs text-green-600 font-medium">✅ Шийдсэн</span>
                )}
              </div>
            ))}
            {incidents.length === 0 && <div className="bg-white rounded-xl p-8 text-center border"><p className="text-gray-400">Хориглол бүртгэгдээгүй</p></div>}
          </div>
        </div>
      )}

      {/* GUESTS TAB */}
      {activeTab === 'guests' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">Идэвхтэй: {activeGuests.length}</p>
            <button onClick={() => setShowGuestForm(!showGuestForm)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">+ Зочин бүртгэх</button>
          </div>
          {showGuestForm && (
            <div className="bg-white border rounded-xl p-4 mb-4">
              <h3 className="font-semibold mb-3">Зочны машин бүртгэх</h3>
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Машины дугаар" value={guestForm.plate_number} onChange={e => setGuestForm({ ...guestForm, plate_number: e.target.value })} className="border rounded-lg px-3 py-2 text-sm" />
                <input placeholder="Зочлогдсон айл" value={guestForm.host_name} onChange={e => setGuestForm({ ...guestForm, host_name: e.target.value })} className="border rounded-lg px-3 py-2 text-sm" />
                <input placeholder="Тоот" value={guestForm.host_apartment} onChange={e => setGuestForm({ ...guestForm, host_apartment: e.target.value })} className="border rounded-lg px-3 py-2 text-sm" />
                <select value={guestForm.allowed_minutes} onChange={e => setGuestForm({ ...guestForm, allowed_minutes: Number(e.target.value) })} className="border rounded-lg px-3 py-2 text-sm">
                  <option value={30}>30 мин</option><option value={60}>1 цаг</option><option value={120}>2 цаг</option><option value={180}>3 цаг</option><option value={360}>6 цаг</option><option value={720}>12 цаг</option><option value={1440}>24 цаг</option>
                </select>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => setShowGuestForm(false)} className="px-4 py-2 border rounded-lg text-sm">Цуцлах</button>
                <button onClick={addGuest} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Бүртгэх</button>
              </div>
            </div>
          )}
          <div className="space-y-2">
            {guests.map(g => {
              const status = getGuestStatus(g);
              return (
                <div key={g.id} className={`bg-white rounded-xl p-4 border ${status === 'overdue' ? 'border-red-300 bg-red-50' : status === 'active' ? 'border-green-300' : ''}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-bold">{g.plate_number}</p>
                      <p className="text-xs text-gray-500">{g.host_name} · {g.host_apartment}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      status === 'active' ? 'bg-green-100 text-green-700' :
                      status === 'overdue' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {status === 'active' ? 'Идэвхтэй' : status === 'overdue' ? 'Хэтэрсэн' : 'Гарсан'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">
                    Орсон: {new Date(g.entered_at).toLocaleString('mn-MN')}
                    {!g.exited_at && <span className="ml-2 font-medium">{getTimeRemaining(g)}</span>}
                  </p>
                  {g.over_charge > 0 && <p className="text-xs text-red-600 font-medium mb-2">Торгууль: {g.over_charge.toLocaleString()}₮ {g.charged ? '(нэмэгдсэн)' : ''}</p>}
                  <div className="flex gap-2">
                    {!g.exited_at && <button onClick={() => exitGuest(g.id)} className="px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg text-xs font-medium">Гаргах</button>}
                    {g.over_charge > 0 && !g.charged && <button onClick={() => chargeGuest(g.id)} className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-medium">Төлбөр нэмэх</button>}
                  </div>
                </div>
              );
            })}
            {guests.length === 0 && <div className="bg-white rounded-xl p-8 text-center border"><p className="text-gray-400">Зочны бүртгэл байхгүй</p></div>}
          </div>
        </div>
      )}

      {/* GATE TAB */}
      {activeTab === 'gate' && (
        <div>
          <div className="bg-white border rounded-xl p-4 mb-4">
            <h3 className="font-semibold mb-3">🚧 Хаалганы тохиргоо</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-gray-500 mb-1 block">IP хаяг</label><input value={gateForm.ip_address} onChange={e => setGateForm({ ...gateForm, ip_address: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Порт</label><input value={gateForm.port} onChange={e => setGateForm({ ...gateForm, port: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Хугацаа хэтэрсний торгууль (₮/цаг)</label><input type="number" value={gateForm.overcharge_per_hour} onChange={e => setGateForm({ ...gateForm, overcharge_per_hour: Number(e.target.value) })} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
              <div className="flex items-center gap-2 pt-5">
                <button onClick={() => setGateForm({ ...gateForm, auto_open: !gateForm.auto_open })} className={`relative w-11 h-6 rounded-full transition ${gateForm.auto_open ? 'bg-blue-600' : 'bg-gray-300'}`}>
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition ${gateForm.auto_open ? 'left-[22px]' : 'left-0.5'}`}></span>
                </button>
                <span className="text-sm">Автомат нээлт</span>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={saveGate} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Хадгалах</button>
              <button onClick={testGate} className="px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm">🔗 Холболт шалгах</button>
            </div>
          </div>
          <div className="bg-white border rounded-xl p-4">
            <h3 className="font-semibold mb-2">Төлөв</h3>
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${gateSetting.connected ? 'bg-green-500' : 'bg-red-500'}`}></span>
              <span className="text-sm">{gateSetting.connected ? 'Холбогдсон' : 'Холболтгүй'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
