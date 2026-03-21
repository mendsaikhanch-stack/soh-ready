'use client';

import { useState, useEffect } from 'react';

interface Vehicle {
  id: string;
  plateNumber: string;
  ownerName: string;
  carModel: string;
  color: string;
  parkingSpot: string;
  registeredAt: string;
}

interface BlockingIncident {
  id: string;
  blockingPlate: string;
  blockedPlate: string;
  timestamp: string;
  resolved: boolean;
  notificationSent: boolean;
}

interface GuestVehicle {
  id: string;
  plateNumber: string;
  hostName: string;        // Зочлогдсон айл
  hostApartment: string;   // Тоот
  enteredAt: string;       // Орсон цаг
  allowedMinutes: number;  // Зөвшөөрсөн хугацаа (минут)
  exitedAt: string | null; // Гарсан цаг
  overCharge: number;      // Хугацаа хэтэрсний торгууль
  charged: boolean;        // Төлбөр нэмэгдсэн эсэх
}

interface GateSettings {
  ipAddress: string;
  port: string;
  connected: boolean;
  autoOpen: boolean;
  overchargePerHour: number; // Хугацаа хэтэрсний цагийн төлбөр
}

const STORAGE_KEYS = {
  vehicles: 'sokh-parking-vehicles',
  incidents: 'sokh-parking-incidents',
  gateSettings: 'sokh-parking-gate',
  spots: 'sokh-parking-spots',
  guests: 'sokh-parking-guests',
};

const TOTAL_SPOTS = 30;

const COLORS = [
  'Цагаан', 'Хар', 'Мөнгөлөг', 'Саарал', 'Улаан', 'Цэнхэр', 'Хүрэн', 'Ногоон', 'Шар', 'Бусад',
];

export default function AdminParking() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [incidents, setIncidents] = useState<BlockingIncident[]>([]);
  const [gateSettings, setGateSettings] = useState<GateSettings>({
    ipAddress: '192.168.1.100',
    port: '8080',
    connected: false,
    autoOpen: true,
    overchargePerHour: 5000,
  });
  const [guests, setGuests] = useState<GuestVehicle[]>([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'vehicles' | 'spots' | 'blocking' | 'guests' | 'gate'>('vehicles');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    plateNumber: '',
    ownerName: '',
    carModel: '',
    color: 'Цагаан',
    parkingSpot: '',
  });

  // Blocking form
  const [blockingForm, setBlockingForm] = useState({
    blockingPlate: '',
    blockedPlate: '',
  });

  // Gate settings form
  const [gateForm, setGateForm] = useState({
    ipAddress: '192.168.1.100',
    port: '8080',
    autoOpen: true,
    overchargePerHour: 5000,
  });

  // Guest form
  const [guestForm, setGuestForm] = useState({
    plateNumber: '',
    hostName: '',
    hostApartment: '',
    allowedMinutes: 60,
  });
  const [showGuestForm, setShowGuestForm] = useState(false);

  useEffect(() => {
    const savedVehicles = localStorage.getItem(STORAGE_KEYS.vehicles);
    const savedIncidents = localStorage.getItem(STORAGE_KEYS.incidents);
    const savedGate = localStorage.getItem(STORAGE_KEYS.gateSettings);

    if (savedVehicles) setVehicles(JSON.parse(savedVehicles));
    if (savedIncidents) setIncidents(JSON.parse(savedIncidents));
    if (savedGate) {
      const g = JSON.parse(savedGate);
      setGateSettings(g);
      setGateForm({ ipAddress: g.ipAddress, port: g.port, autoOpen: g.autoOpen, overchargePerHour: g.overchargePerHour || 5000 });
    }
    const savedGuests = localStorage.getItem(STORAGE_KEYS.guests);
    if (savedGuests) setGuests(JSON.parse(savedGuests));
  }, []);

  const saveVehicles = (v: Vehicle[]) => {
    setVehicles(v);
    localStorage.setItem(STORAGE_KEYS.vehicles, JSON.stringify(v));
  };

  const saveIncidents = (inc: BlockingIncident[]) => {
    setIncidents(inc);
    localStorage.setItem(STORAGE_KEYS.incidents, JSON.stringify(inc));
  };

  const saveGateSettings = (g: GateSettings) => {
    setGateSettings(g);
    localStorage.setItem(STORAGE_KEYS.gateSettings, JSON.stringify(g));
  };

  const saveGuests = (g: GuestVehicle[]) => {
    setGuests(g);
    localStorage.setItem(STORAGE_KEYS.guests, JSON.stringify(g));
  };

  const addGuest = () => {
    if (!guestForm.plateNumber || !guestForm.hostName) return;
    const guest: GuestVehicle = {
      id: Date.now().toString(),
      plateNumber: guestForm.plateNumber,
      hostName: guestForm.hostName,
      hostApartment: guestForm.hostApartment,
      enteredAt: new Date().toISOString(),
      allowedMinutes: guestForm.allowedMinutes,
      exitedAt: null,
      overCharge: 0,
      charged: false,
    };
    saveGuests([guest, ...guests]);
    setGuestForm({ plateNumber: '', hostName: '', hostApartment: '', allowedMinutes: 60 });
    setShowGuestForm(false);
  };

  const exitGuest = (id: string) => {
    const updated = guests.map(g => {
      if (g.id !== id) return g;
      const now = new Date();
      const entered = new Date(g.enteredAt);
      const minutesPassed = Math.floor((now.getTime() - entered.getTime()) / 60000);
      const overMinutes = Math.max(0, minutesPassed - g.allowedMinutes);
      const overHours = Math.ceil(overMinutes / 60);
      const charge = overHours * gateSettings.overchargePerHour;
      return { ...g, exitedAt: now.toISOString(), overCharge: charge };
    });
    saveGuests(updated);
  };

  const chargeGuest = (id: string) => {
    const updated = guests.map(g => g.id === id ? { ...g, charged: true } : g);
    saveGuests(updated);
    const guest = guests.find(g => g.id === id);
    if (guest) {
      alert(`${guest.hostName} (${guest.hostApartment} тоот)-ийн төлбөр дээр ${guest.overCharge.toLocaleString()}₮ нэмэгдлээ`);
    }
  };

  const getGuestStatus = (g: GuestVehicle) => {
    if (g.exitedAt) return 'exited';
    const now = Date.now();
    const entered = new Date(g.enteredAt).getTime();
    const minutesPassed = Math.floor((now - entered) / 60000);
    if (minutesPassed > g.allowedMinutes) return 'overdue';
    return 'active';
  };

  const getTimeRemaining = (g: GuestVehicle) => {
    const now = Date.now();
    const entered = new Date(g.enteredAt).getTime();
    const minutesPassed = Math.floor((now - entered) / 60000);
    const remaining = g.allowedMinutes - minutesPassed;
    if (remaining <= 0) {
      const over = Math.abs(remaining);
      return `${Math.floor(over / 60)} цаг ${over % 60} мин хэтэрсэн`;
    }
    return `${Math.floor(remaining / 60)} цаг ${remaining % 60} мин үлдсэн`;
  };

  const activeGuests = guests.filter(g => !g.exitedAt);

  const filtered = vehicles.filter(v =>
    v.plateNumber.toLowerCase().includes(search.toLowerCase()) ||
    v.ownerName.toLowerCase().includes(search.toLowerCase())
  );

  const occupiedSpots = vehicles.map(v => v.parkingSpot).filter(Boolean);

  const openAdd = () => {
    setEditId(null);
    setForm({ plateNumber: '', ownerName: '', carModel: '', color: 'Цагаан', parkingSpot: '' });
    setShowForm(true);
  };

  const openEdit = (v: Vehicle) => {
    setEditId(v.id);
    setForm({
      plateNumber: v.plateNumber,
      ownerName: v.ownerName,
      carModel: v.carModel,
      color: v.color,
      parkingSpot: v.parkingSpot,
    });
    setShowForm(true);
  };

  const saveVehicle = () => {
    if (!form.plateNumber || !form.ownerName) return;

    if (editId) {
      const updated = vehicles.map(v =>
        v.id === editId ? { ...v, ...form } : v
      );
      saveVehicles(updated);
    } else {
      const newVehicle: Vehicle = {
        id: Date.now().toString(),
        ...form,
        registeredAt: new Date().toISOString(),
      };
      saveVehicles([...vehicles, newVehicle]);
    }
    setShowForm(false);
  };

  const deleteVehicle = (id: string) => {
    if (!confirm('Устгах уу?')) return;
    saveVehicles(vehicles.filter(v => v.id !== id));
  };

  const reportBlocking = () => {
    if (!blockingForm.blockingPlate || !blockingForm.blockedPlate) return;
    if (blockingForm.blockingPlate === blockingForm.blockedPlate) {
      alert('Хаасан машин болон хаагдсан машин ижил байна!');
      return;
    }

    const incident: BlockingIncident = {
      id: Date.now().toString(),
      blockingPlate: blockingForm.blockingPlate,
      blockedPlate: blockingForm.blockedPlate,
      timestamp: new Date().toISOString(),
      resolved: false,
      notificationSent: true,
    };
    saveIncidents([incident, ...incidents]);
    setBlockingForm({ blockingPlate: '', blockedPlate: '' });
    alert('Мэдэгдэл амжилттай илгээгдлээ! SMS мэдэгдэл хүргэгдэх болно.');
  };

  const resolveIncident = (id: string) => {
    const updated = incidents.map(inc =>
      inc.id === id ? { ...inc, resolved: true } : inc
    );
    saveIncidents(updated);
  };

  const handleGateSave = () => {
    const updated: GateSettings = {
      ...gateSettings,
      ipAddress: gateForm.ipAddress,
      port: gateForm.port,
      autoOpen: gateForm.autoOpen,
      overchargePerHour: gateForm.overchargePerHour,
    };
    saveGateSettings(updated);
    alert('Тохиргоо хадгалагдлаа!');
  };

  const toggleGateConnection = () => {
    saveGateSettings({ ...gateSettings, connected: !gateSettings.connected });
  };

  const handleGateAction = (action: 'open' | 'close') => {
    if (!gateSettings.connected) {
      alert('Хаалт холбогдоогүй байна. Эхлээд холболтыг шалгана уу.');
      return;
    }
    alert(action === 'open' ? 'Хаалт нээгдлээ!' : 'Хаалт хаагдлаа!');
  };

  const tabs = [
    { key: 'vehicles' as const, label: 'Машинууд', icon: '🚗' },
    { key: 'spots' as const, label: 'Зогсоол', icon: '🅿️' },
    { key: 'blocking' as const, label: 'Машин хаалт', icon: '🚫' },
    { key: 'guests' as const, label: `Зочин${activeGuests.length ? ` (${activeGuests.length})` : ''}`, icon: '🎫' },
    { key: 'gate' as const, label: 'Хаалт', icon: '🚧' },
  ];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">🚗 Зогсоолын удирдлага</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition ${
              activeTab === tab.key
                ? 'bg-white shadow text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ========== VEHICLES TAB ========== */}
      {activeTab === 'vehicles' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">Нийт: {vehicles.length} машин</p>
            <button onClick={openAdd} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
              + Машин бүртгэх
            </button>
          </div>

          <input
            placeholder="Улсын дугаараар хайх..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full border rounded-lg px-4 py-2 mb-4 text-sm"
          />

          {showForm && (
            <div className="bg-white border rounded-xl p-4 mb-4">
              <h3 className="font-semibold mb-3">{editId ? 'Засах' : 'Шинэ машин бүртгэх'}</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Улсын дугаар (МН формат)</label>
                  <input
                    placeholder="жнь: 0123УБА"
                    value={form.plateNumber}
                    onChange={e => setForm({ ...form, plateNumber: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Эзэмшигч</label>
                  <input
                    placeholder="Оршин суугчийн нэр"
                    value={form.ownerName}
                    onChange={e => setForm({ ...form, ownerName: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Машины загвар</label>
                  <input
                    placeholder="жнь: Toyota Prius"
                    value={form.carModel}
                    onChange={e => setForm({ ...form, carModel: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Өнгө</label>
                  <select
                    value={form.color}
                    onChange={e => setForm({ ...form, color: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  >
                    {COLORS.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Зогсоолын дугаар</label>
                  <select
                    value={form.parkingSpot}
                    onChange={e => setForm({ ...form, parkingSpot: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">-- Сонгох --</option>
                    {Array.from({ length: TOTAL_SPOTS }, (_, i) => {
                      const spot = String(i + 1);
                      const isOccupied = occupiedSpots.includes(spot) && form.parkingSpot !== spot;
                      return (
                        <option key={spot} value={spot} disabled={isOccupied}>
                          {spot}-р зогсоол {isOccupied ? '(эзэлсэн)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg text-sm">Цуцлах</button>
                <button onClick={saveVehicle} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
                  Хадгалах
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr className="text-left text-sm text-gray-500">
                  <th className="px-4 py-3">№</th>
                  <th className="px-4 py-3">Улсын дугаар</th>
                  <th className="px-4 py-3">Эзэмшигч</th>
                  <th className="px-4 py-3">Загвар</th>
                  <th className="px-4 py-3">Өнгө</th>
                  <th className="px-4 py-3">Зогсоол</th>
                  <th className="px-4 py-3 text-right">Үйлдэл</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v, i) => (
                  <tr key={v.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-400">{i + 1}</td>
                    <td className="px-4 py-3 text-sm font-bold text-blue-700">{v.plateNumber}</td>
                    <td className="px-4 py-3 text-sm">{v.ownerName}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{v.carModel || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{v.color}</td>
                    <td className="px-4 py-3 text-sm">
                      {v.parkingSpot ? (
                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium">
                          #{v.parkingSpot}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEdit(v)} className="text-blue-500 text-sm mr-2 hover:underline">Засах</button>
                      <button onClick={() => deleteVehicle(v.id)} className="text-red-400 text-sm hover:underline">Устгах</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <p className="text-gray-400 text-center py-6">Бүртгэлтэй машин байхгүй</p>
            )}
          </div>
        </div>
      )}

      {/* ========== PARKING SPOTS TAB ========== */}
      {activeTab === 'spots' && (
        <div>
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
              <span className="text-sm text-gray-600">Сул ({TOTAL_SPOTS - occupiedSpots.length})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-100 border border-red-300 rounded"></div>
              <span className="text-sm text-gray-600">Эзэлсэн ({occupiedSpots.length})</span>
            </div>
          </div>

          <div className="grid grid-cols-6 gap-2">
            {Array.from({ length: TOTAL_SPOTS }, (_, i) => {
              const spot = String(i + 1);
              const vehicle = vehicles.find(v => v.parkingSpot === spot);
              const isOccupied = !!vehicle;

              return (
                <div
                  key={spot}
                  className={`relative rounded-xl border-2 p-3 text-center transition cursor-default ${
                    isOccupied
                      ? 'bg-red-50 border-red-300'
                      : 'bg-green-50 border-green-300'
                  }`}
                  title={vehicle ? `${vehicle.plateNumber} - ${vehicle.ownerName}` : 'Сул зогсоол'}
                >
                  <div className="text-lg font-bold text-gray-700">{spot}</div>
                  {isOccupied ? (
                    <div>
                      <div className="text-[10px] text-red-600 font-medium mt-1">🚗</div>
                      <div className="text-[10px] text-red-600 font-bold truncate">{vehicle.plateNumber}</div>
                    </div>
                  ) : (
                    <div className="text-xs text-green-600 mt-1">Сул</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========== BLOCKING TAB ========== */}
      {activeTab === 'blocking' && (
        <div>
          {/* Report blocking */}
          <div className="bg-white border rounded-xl p-4 mb-6">
            <h3 className="font-semibold mb-3 text-red-600">🚫 Машин хаасан мэдэгдэл</h3>
            <p className="text-sm text-gray-500 mb-3">Хаасан болон хаагдсан машины дугаарыг сонгон SMS мэдэгдэл илгээнэ.</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Хаасан машин (улсын дугаар)</label>
                <select
                  value={blockingForm.blockingPlate}
                  onChange={e => setBlockingForm({ ...blockingForm, blockingPlate: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">-- Сонгох --</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.plateNumber}>
                      {v.plateNumber} ({v.ownerName})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Хаагдсан машин (улсын дугаар)</label>
                <select
                  value={blockingForm.blockedPlate}
                  onChange={e => setBlockingForm({ ...blockingForm, blockedPlate: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">-- Сонгох --</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.plateNumber}>
                      {v.plateNumber} ({v.ownerName})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button
              onClick={reportBlocking}
              disabled={!blockingForm.blockingPlate || !blockingForm.blockedPlate}
              className="w-full py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-40 transition"
            >
              📩 SMS мэдэгдэл илгээх
            </button>
          </div>

          {/* Incidents log */}
          <h3 className="font-semibold mb-3 text-sm text-gray-500">МАШИН ХААЛТЫН ТҮҮХ</h3>
          {incidents.length === 0 ? (
            <div className="bg-white rounded-xl p-6 text-center border">
              <p className="text-3xl mb-2">✅</p>
              <p className="text-gray-400">Машин хаалтын бүртгэл байхгүй</p>
            </div>
          ) : (
            <div className="space-y-2">
              {incidents.map(inc => (
                <div key={inc.id} className={`bg-white rounded-xl p-4 border ${inc.resolved ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          inc.resolved ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {inc.resolved ? 'Шийдвэрлэсэн' : 'Идэвхтэй'}
                        </span>
                        {inc.notificationSent && (
                          <span className="text-xs text-blue-500">📩 SMS илгээсэн</span>
                        )}
                      </div>
                      <p className="text-sm">
                        <span className="font-bold text-red-600">{inc.blockingPlate}</span>
                        {' → '}
                        <span className="font-bold text-blue-600">{inc.blockedPlate}</span>
                        <span className="text-gray-400"> машиныг хаасан</span>
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(inc.timestamp).toLocaleString('mn-MN')}
                      </p>
                    </div>
                    {!inc.resolved && (
                      <button
                        onClick={() => resolveIncident(inc.id)}
                        className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-lg hover:bg-green-200"
                      >
                        Шийдсэн
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========== GUESTS TAB ========== */}
      {activeTab === 'guests' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-gray-500">
                Идэвхтэй: {activeGuests.length} зочин
                {activeGuests.filter(g => getGuestStatus(g) === 'overdue').length > 0 && (
                  <span className="text-red-500 ml-2">
                    ({activeGuests.filter(g => getGuestStatus(g) === 'overdue').length} хугацаа хэтэрсэн)
                  </span>
                )}
              </p>
            </div>
            <button onClick={() => setShowGuestForm(!showGuestForm)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
              + Зочин бүртгэх
            </button>
          </div>

          {/* Зочин бүртгэх форм */}
          {showGuestForm && (
            <div className="bg-white border rounded-xl p-4 mb-4">
              <h3 className="font-semibold mb-3">🎫 Зочны машин бүртгэх</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Зочны машины дугаар</label>
                  <input
                    placeholder="жнь: 0456УБА"
                    value={guestForm.plateNumber}
                    onChange={e => setGuestForm({ ...guestForm, plateNumber: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Зочилж буй айлын нэр</label>
                  <input
                    placeholder="Оршин суугчийн нэр"
                    value={guestForm.hostName}
                    onChange={e => setGuestForm({ ...guestForm, hostName: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Тоот</label>
                  <input
                    placeholder="жнь: 3-р байр, 45"
                    value={guestForm.hostApartment}
                    onChange={e => setGuestForm({ ...guestForm, hostApartment: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Зөвшөөрсөн хугацаа</label>
                  <select
                    value={guestForm.allowedMinutes}
                    onChange={e => setGuestForm({ ...guestForm, allowedMinutes: Number(e.target.value) })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value={30}>30 минут</option>
                    <option value={60}>1 цаг</option>
                    <option value={120}>2 цаг</option>
                    <option value={180}>3 цаг</option>
                    <option value={360}>6 цаг</option>
                    <option value={720}>12 цаг</option>
                    <option value={1440}>24 цаг (1 өдөр)</option>
                  </select>
                </div>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 mt-3 text-xs text-yellow-700">
                Хугацаа хэтрэхэд цаг тутам <strong>{gateSettings.overchargePerHour.toLocaleString()}₮</strong> нэмэгдэж, тухайн айлын төлбөр дээр нэмэгдэнэ.
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => setShowGuestForm(false)} className="px-4 py-2 border rounded-lg text-sm">Цуцлах</button>
                <button onClick={addGuest} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
                  Бүртгэх + Хаалт нээх
                </button>
              </div>
            </div>
          )}

          {/* Зочдын жагсаалт */}
          {guests.length === 0 ? (
            <div className="bg-white rounded-xl p-6 text-center border">
              <p className="text-3xl mb-2">🎫</p>
              <p className="text-gray-400">Зочны бүртгэл байхгүй</p>
            </div>
          ) : (
            <div className="space-y-2">
              {guests.map(g => {
                const status = getGuestStatus(g);
                return (
                  <div key={g.id} className={`bg-white rounded-xl p-4 border ${
                    status === 'overdue' ? 'border-red-300 bg-red-50' :
                    status === 'exited' ? 'opacity-60' : ''
                  }`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-blue-700">{g.plateNumber}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            status === 'active' ? 'bg-green-100 text-green-700' :
                            status === 'overdue' ? 'bg-red-100 text-red-700 animate-pulse' :
                            'bg-gray-100 text-gray-500'
                          }`}>
                            {status === 'active' ? 'Идэвхтэй' : status === 'overdue' ? 'ХУГАЦАА ХЭТЭРСЭН' : 'Гарсан'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">
                          Зочилсон: <strong>{g.hostName}</strong> ({g.hostApartment})
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Орсон: {new Date(g.enteredAt).toLocaleString('mn-MN')}
                          {' · '}Зөвшөөрсөн: {g.allowedMinutes >= 60 ? `${Math.floor(g.allowedMinutes/60)} цаг` : `${g.allowedMinutes} мин`}
                        </p>
                        {!g.exitedAt && (
                          <p className={`text-xs mt-1 font-medium ${status === 'overdue' ? 'text-red-600' : 'text-green-600'}`}>
                            ⏱ {getTimeRemaining(g)}
                          </p>
                        )}
                        {g.exitedAt && (
                          <p className="text-xs text-gray-400 mt-1">
                            Гарсан: {new Date(g.exitedAt).toLocaleString('mn-MN')}
                          </p>
                        )}
                        {g.overCharge > 0 && (
                          <p className="text-sm font-semibold text-red-600 mt-1">
                            Торгууль: {g.overCharge.toLocaleString()}₮
                            {g.charged && <span className="text-green-600 ml-2">✓ Нэмэгдсэн</span>}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        {!g.exitedAt && (
                          <button
                            onClick={() => exitGuest(g.id)}
                            className="px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg text-xs font-medium hover:bg-orange-200"
                          >
                            Гарсан
                          </button>
                        )}
                        {g.exitedAt && g.overCharge > 0 && !g.charged && (
                          <button
                            onClick={() => chargeGuest(g.id)}
                            className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700"
                          >
                            Төлбөр нэмэх
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========== GATE TAB ========== */}
      {activeTab === 'gate' && (
        <div>
          {/* Status */}
          <div className="bg-white border rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">🚧 Хаалт/Шлагбаум төлөв</h3>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${gateSettings.connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                <span className={`text-sm font-medium ${gateSettings.connected ? 'text-green-600' : 'text-red-600'}`}>
                  {gateSettings.connected ? 'Холбогдсон' : 'Салсан'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleGateAction('open')}
                className={`py-3 rounded-xl text-sm font-medium transition ${
                  gateSettings.connected
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                🔓 Хаалт нээх
              </button>
              <button
                onClick={() => handleGateAction('close')}
                className={`py-3 rounded-xl text-sm font-medium transition ${
                  gateSettings.connected
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                🔒 Хаалт хаах
              </button>
            </div>
          </div>

          {/* Connection Settings */}
          <div className="bg-white border rounded-xl p-4 mb-4">
            <h3 className="font-semibold mb-3">⚙️ Холболтын тохиргоо</h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">IP хаяг</label>
                <input
                  placeholder="192.168.1.100"
                  value={gateForm.ipAddress}
                  onChange={e => setGateForm({ ...gateForm, ipAddress: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Порт</label>
                <input
                  placeholder="8080"
                  value={gateForm.port}
                  onChange={e => setGateForm({ ...gateForm, port: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => setGateForm({ ...gateForm, autoOpen: !gateForm.autoOpen })}
                className={`relative w-11 h-6 rounded-full transition ${gateForm.autoOpen ? 'bg-blue-600' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition ${gateForm.autoOpen ? 'left-[22px]' : 'left-0.5'}`}></span>
              </button>
              <span className="text-sm">Бүртгэлтэй дугаар автоматаар нээх</span>
            </div>

            <div className="mb-4">
              <label className="text-xs text-gray-500 mb-1 block">Зочны хугацаа хэтэрсний торгууль (цаг тутам)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={gateForm.overchargePerHour}
                  onChange={e => setGateForm({ ...gateForm, overchargePerHour: Number(e.target.value) })}
                  className="w-32 border rounded-lg px-3 py-2 text-sm"
                />
                <span className="text-sm text-gray-500">₮ / цаг</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={toggleGateConnection}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                  gateSettings.connected
                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                }`}
              >
                {gateSettings.connected ? '🔌 Салгах' : '🔌 Холбогдох'}
              </button>
              <button
                onClick={handleGateSave}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                Тохиргоо хадгалах
              </button>
            </div>
          </div>

          {/* Auto-open list */}
          <div className="bg-white border rounded-xl p-4">
            <h3 className="font-semibold mb-3">🚗 Автоматаар нээх дугаарууд</h3>
            <p className="text-xs text-gray-500 mb-3">Бүртгэлтэй бүх машин автоматаар шлагбаум нээгдэнэ.</p>
            {vehicles.length === 0 ? (
              <p className="text-gray-400 text-center py-4 text-sm">Бүртгэлтэй машин байхгүй</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {vehicles.map(v => (
                  <span key={v.id} className="bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1.5 rounded-lg text-sm font-medium">
                    {v.plateNumber}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
