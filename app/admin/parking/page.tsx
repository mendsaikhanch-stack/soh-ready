'use client';

import { useState, useEffect } from 'react';
import { adminFrom } from '@/app/lib/admin-db';
import { getAdminSokhId } from '@/app/lib/admin-config';

interface Vehicle {
  id: number;
  plate_number: string;
  resident_name: string | null;
  apartment: string | null;
  car_model: string | null;
  color: string | null;
  parking_spot: string | null;
  parking_type: 'garage' | 'outdoor' | null;
  status: string;
  created_at: string;
}

interface BlockingReport {
  id: number;
  blocking_plate: string | null;
  blocked_plate: string;
  reporter_name: string | null;
  reporter_apartment: string | null;
  status: 'pending' | 'notified' | 'resolved';
  admin_note: string | null;
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
  const [reports, setReports] = useState<BlockingReport[]>([]);
  const [gateSetting, setGateSetting] = useState<GateSettings>({
    ip_address: '192.168.1.100', port: '8080', connected: false, auto_open: true, overcharge_per_hour: 5000,
  });
  const [guests, setGuests] = useState<GuestVehicle[]>([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'vehicles' | 'spots' | 'blocking' | 'guests' | 'gate'>('vehicles');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ plate_number: '', resident_name: '', apartment: '', car_model: '', color: 'Цагаан', parking_spot: '', parking_type: '' as '' | 'garage' | 'outdoor' });
  const [blockingForm, setBlockingForm] = useState({ blocking_plate: '', blocked_plate: '' });
  const [gateForm, setGateForm] = useState({ ip_address: '192.168.1.100', port: '8080', auto_open: true, overcharge_per_hour: 5000 });
  const [guestForm, setGuestForm] = useState({ plate_number: '', host_name: '', host_apartment: '', allowed_minutes: 60 });
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    const sokhId = await getAdminSokhId();
    const [{ data: v }, { data: rep }, { data: g }, { data: gs }] = await Promise.all([
      adminFrom('parking_vehicles').select('*').eq('sokh_id', sokhId).eq('status', 'active').order('created_at'),
      adminFrom('blocking_reports').select('*').eq('sokh_id', sokhId).order('created_at', { ascending: false }),
      adminFrom('guest_vehicles').select('*').eq('sokh_id', sokhId).order('entered_at', { ascending: false }),
      adminFrom('gate_settings').select('*').eq('sokh_id', sokhId).single(),
    ]);
    setVehicles((v as unknown as Vehicle[]) || []);
    setReports((rep as unknown as BlockingReport[]) || []);
    setGuests((g as unknown as GuestVehicle[]) || []);
    if (gs) {
      const gsTyped = gs as unknown as GateSettings;
      setGateSetting(gsTyped);
      setGateForm({ ip_address: gsTyped.ip_address, port: gsTyped.port, auto_open: gsTyped.auto_open, overcharge_per_hour: gsTyped.overcharge_per_hour });
    }
    setLoading(false);
  };

  // Vehicle CRUD
  const saveVehicle = async () => {
    if (!form.plate_number || !form.resident_name) return;
    const sokhId = await getAdminSokhId();
    const payload = { ...form, parking_type: form.parking_type || null };
    if (editId) {
      await adminFrom('parking_vehicles').update(payload).eq('id', editId);
    } else {
      await adminFrom('parking_vehicles').insert({ sokh_id: sokhId, status: 'active', ...payload });
    }
    setShowForm(false);
    fetchAll();
  };

  const deleteVehicle = async (id: number) => {
    if (!confirm('Машин устгах уу?')) return;
    await adminFrom('parking_vehicles').update({ status: 'removed' }).eq('id', id);
    fetchAll();
  };

  const openAdd = () => {
    setEditId(null);
    setForm({ plate_number: '', resident_name: '', apartment: '', car_model: '', color: 'Цагаан', parking_spot: '', parking_type: '' });
    setShowForm(true);
  };
  const openEdit = (v: Vehicle) => {
    setEditId(v.id);
    setForm({
      plate_number: v.plate_number,
      resident_name: v.resident_name || '',
      apartment: v.apartment || '',
      car_model: v.car_model || '',
      color: v.color || 'Цагаан',
      parking_spot: v.parking_spot || '',
      parking_type: v.parking_type || '',
    });
    setShowForm(true);
  };

  // Blocking reports
  const addBlocking = async () => {
    if (!blockingForm.blocked_plate) return;
    const sokhId = await getAdminSokhId();
    await adminFrom('blocking_reports').insert({ sokh_id: sokhId, status: 'pending', ...blockingForm });
    setBlockingForm({ blocking_plate: '', blocked_plate: '' });
    fetchAll();
  };

  const updateReportStatus = async (id: number, status: BlockingReport['status']) => {
    const patch: Record<string, unknown> = { status };
    if (status === 'resolved') patch.resolved_at = new Date().toISOString();
    await adminFrom('blocking_reports').update(patch).eq('id', id);
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

  const filtered = vehicles.filter(v => {
    const q = search.toLowerCase();
    return v.plate_number.toLowerCase().includes(q) || (v.resident_name || '').toLowerCase().includes(q);
  });
  const occupiedSpots = vehicles.map(v => v.parking_spot).filter(Boolean) as string[];
  const activeGuests = guests.filter(g => !g.exited_at);
  const pendingReports = reports.filter(r => r.status !== 'resolved');

  const tabs = [
    { key: 'vehicles' as const, label: 'Машин', icon: '🚗' },
    { key: 'spots' as const, label: 'Зогсоол', icon: '🅿️' },
    { key: 'blocking' as const, label: `Хориглол${pendingReports.length ? ` (${pendingReports.length})` : ''}`, icon: '🚫' },
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
                <input placeholder="Эзэмшигч" value={form.resident_name} onChange={e => setForm({ ...form, resident_name: e.target.value })} className="border rounded-lg px-3 py-2 text-sm" />
                <input placeholder="Тоот" value={form.apartment} onChange={e => setForm({ ...form, apartment: e.target.value })} className="border rounded-lg px-3 py-2 text-sm" />
                <input placeholder="Машины загвар" value={form.car_model} onChange={e => setForm({ ...form, car_model: e.target.value })} className="border rounded-lg px-3 py-2 text-sm" />
                <select value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="border rounded-lg px-3 py-2 text-sm">{COLORS.map(c => <option key={c}>{c}</option>)}</select>
                <select value={form.parking_type} onChange={e => setForm({ ...form, parking_type: e.target.value as '' | 'garage' | 'outdoor' })} className="border rounded-lg px-3 py-2 text-sm">
                  <option value="">Төрөл сонгох</option>
                  <option value="garage">🏚 Гараж</option>
                  <option value="outdoor">🅿️ Задгай</option>
                </select>
                <input placeholder={form.parking_type === 'garage' ? 'жнь: Г-15' : 'Зогсоолын дугаар'} value={form.parking_spot} onChange={e => setForm({ ...form, parking_spot: e.target.value })} className="border rounded-lg px-3 py-2 text-sm" />
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
                  <th className="px-4 py-3">Дугаар</th>
                  <th className="px-4 py-3">Эзэмшигч</th>
                  <th className="px-4 py-3">Тоот</th>
                  <th className="px-4 py-3">Загвар</th>
                  <th className="px-4 py-3">Өнгө</th>
                  <th className="px-4 py-3">Зогсоол</th>
                  <th className="px-4 py-3 text-right">Үйлдэл</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(v => (
                  <tr key={v.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-bold">{v.plate_number}</td>
                    <td className="px-4 py-3 text-sm">{v.resident_name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{v.apartment || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{v.car_model || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{v.color || '-'}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-1">
                        {v.parking_type === 'garage' && <span title="Гараж">🏚</span>}
                        {v.parking_type === 'outdoor' && <span title="Задгай">🅿️</span>}
                        <span>{v.parking_spot || '-'}</span>
                      </div>
                    </td>
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
                      <p className="text-[10px] text-gray-500">{vehicle.resident_name || '-'}</p>
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
            {reports.map(rep => (
              <div key={rep.id} className={`bg-white rounded-xl p-4 border ${rep.status !== 'resolved' ? 'border-red-300' : ''}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm">
                      <span className="font-bold text-red-600">{rep.blocking_plate || '—'}</span>
                      {' → '}
                      <span className="font-bold">{rep.blocked_plate}</span>
                    </p>
                    {rep.reporter_name && (
                      <p className="text-xs text-gray-500 mt-1">Мэдэгдсэн: {rep.reporter_name}{rep.reporter_apartment ? ` (${rep.reporter_apartment})` : ''}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">{new Date(rep.created_at).toLocaleString('mn-MN')}</p>
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                      rep.status === 'resolved' ? 'bg-green-100 text-green-700' :
                      rep.status === 'notified' ? 'bg-blue-100 text-blue-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {rep.status === 'resolved' ? '✅ Шийдсэн' : rep.status === 'notified' ? '📢 Мэдэгдсэн' : '🕐 Хүлээгдэж буй'}
                    </span>
                    {rep.status !== 'resolved' && (
                      <div className="flex gap-1">
                        {rep.status === 'pending' && (
                          <button onClick={() => updateReportStatus(rep.id, 'notified')} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">Мэдэгдсэн</button>
                        )}
                        <button onClick={() => updateReportStatus(rep.id, 'resolved')} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">Шийдсэн</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {reports.length === 0 && <div className="bg-white rounded-xl p-8 text-center border"><p className="text-gray-400">Хориглол бүртгэгдээгүй</p></div>}
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
