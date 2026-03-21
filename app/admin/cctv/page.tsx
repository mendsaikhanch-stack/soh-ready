'use client';

import { useState, useEffect } from 'react';

interface Camera {
  id: string;
  name: string;
  location: string;
  rtspUrl: string;
  ipAddress: string;
  status: 'online' | 'offline';
  aiEnabled: boolean;
  brand: string;
  onvifEnabled: boolean;
}

interface AIAlert {
  id: string;
  cameraId: string;
  cameraName: string;
  type: 'motion' | 'unknown_person' | 'suspicious' | 'fire_smoke';
  severity: 'info' | 'warning' | 'critical';
  timestamp: string;
  description: string;
}

interface FootageRequest {
  id: string;
  residentName: string;
  apartment: string;
  phone: string;
  category: string;
  description: string;
  dateFrom: string;
  dateTo: string;
  location: string;
  status: 'pending' | 'reviewing' | 'approved' | 'rejected' | 'done';
  createdAt: string;
  adminNote: string;
}

const STORAGE_KEYS = {
  cameras: 'sokh-cctv-cameras',
  alerts: 'sokh-cctv-alerts',
  footageRequests: 'sokh-cctv-footage-requests',
};

const FOOTAGE_CATEGORIES = [
  { id: 'parking_incident', label: 'Зогсоолын осол', icon: '🚗', desc: 'Мөргөлдсөн, шүргэсэн, шүргэлцсэн' },
  { id: 'suspicious_person', label: 'Сэжигтэй хүн', icon: '👤', desc: 'Гадны танихгүй хүн холхисон' },
  { id: 'theft_crime', label: 'Хулгай/Гэмт хэрэг', icon: '🚨', desc: 'Хулгай, эвдрэл, гэмт хэргийн шинжтэй' },
  { id: 'lost_item', label: 'Алдсан/Унагаасан эд зүйл', icon: '📦', desc: 'Гээсэн, орхисон, унагаасан юм хайх' },
  { id: 'playground', label: 'Хүүхдийн тоглоомын талбай', icon: '🧒', desc: 'Хүүхэд хянах, аюулгүй байдал' },
  { id: 'property_damage', label: 'Эд хөрөнгийн хохирол', icon: '💥', desc: 'Байрны эд хогшил гэмтээсэн' },
  { id: 'other', label: 'Бусад', icon: '📹', desc: 'Дээрхээс бусад шалтгаан' },
];

const REQUEST_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Хүлээгдэж буй', color: 'bg-yellow-100 text-yellow-700' },
  reviewing: { label: 'Шалгаж байна', color: 'bg-blue-100 text-blue-700' },
  approved: { label: 'Зөвшөөрсөн', color: 'bg-green-100 text-green-700' },
  rejected: { label: 'Татгалзсан', color: 'bg-red-100 text-red-700' },
  done: { label: 'Бичлэг хүргэсэн', color: 'bg-purple-100 text-purple-700' },
};

const ALERT_TYPE_MAP: Record<string, { label: string; icon: string }> = {
  motion: { label: 'Хөдөлгөөн илэрсэн', icon: '🏃' },
  unknown_person: { label: 'Танигдаагүй хүн', icon: '👤' },
  suspicious: { label: 'Сэжигтэй үйлдэл', icon: '⚠️' },
  fire_smoke: { label: 'Гал/Утаа илэрсэн', icon: '🔥' },
};

const SEVERITY_MAP: Record<string, { label: string; color: string; bg: string }> = {
  info: { label: 'Мэдээлэл', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  warning: { label: 'Анхааруулга', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200' },
  critical: { label: 'Яаралтай', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
};

const NVR_BRANDS = ['Hikvision', 'Dahua', 'Uniview', 'Hanwha', 'Axis', 'Бусад'];

const DEFAULT_CAMERAS: Camera[] = [
  { id: '1', name: 'Гадна камер 1', location: '1-р байр гадна', rtspUrl: 'rtsp://192.168.1.201:554/stream1', ipAddress: '192.168.1.201', status: 'online', aiEnabled: false, brand: 'Hikvision', onvifEnabled: true },
  { id: '2', name: 'Гадна камер 2', location: '2-р байр гадна', rtspUrl: 'rtsp://192.168.1.202:554/stream1', ipAddress: '192.168.1.202', status: 'online', aiEnabled: false, brand: 'Hikvision', onvifEnabled: true },
  { id: '3', name: 'Коридор камер 1', location: '1-р давхар коридор', rtspUrl: 'rtsp://192.168.1.203:554/stream1', ipAddress: '192.168.1.203', status: 'offline', aiEnabled: false, brand: 'Dahua', onvifEnabled: true },
  { id: '4', name: 'Коридор камер 2', location: '3-р давхар коридор', rtspUrl: 'rtsp://192.168.1.204:554/stream1', ipAddress: '192.168.1.204', status: 'online', aiEnabled: false, brand: 'Dahua', onvifEnabled: true },
  { id: '5', name: 'Зогсоолын камер', location: 'Дотор зогсоол', rtspUrl: 'rtsp://192.168.1.205:554/stream1', ipAddress: '192.168.1.205', status: 'online', aiEnabled: false, brand: 'Uniview', onvifEnabled: true },
  { id: '6', name: 'Лифтний камер', location: 'Лифтний өрөө', rtspUrl: 'rtsp://192.168.1.206:554/stream1', ipAddress: '192.168.1.206', status: 'offline', aiEnabled: false, brand: 'Hikvision', onvifEnabled: true },
];

export default function AdminCCTV() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [alerts, setAlerts] = useState<AIAlert[]>([]);
  const [activeTab, setActiveTab] = useState<'grid' | 'list' | 'ai' | 'requests' | 'connection'>('grid');
  const [footageRequests, setFootageRequests] = useState<FootageRequest[]>([]);
  const [gridLayout, setGridLayout] = useState<'2x2' | '3x2'>('2x2');
  const [fullscreenCamera, setFullscreenCamera] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [testingConnection, setTestingConnection] = useState<string | null>(null);

  const [addForm, setAddForm] = useState({
    name: '',
    location: '',
    rtspUrl: '',
    ipAddress: '',
    brand: 'Hikvision',
    onvifEnabled: true,
  });

  useEffect(() => {
    const savedCameras = localStorage.getItem(STORAGE_KEYS.cameras);
    const savedAlerts = localStorage.getItem(STORAGE_KEYS.alerts);

    if (savedCameras) {
      setCameras(JSON.parse(savedCameras));
    } else {
      setCameras(DEFAULT_CAMERAS);
      localStorage.setItem(STORAGE_KEYS.cameras, JSON.stringify(DEFAULT_CAMERAS));
    }

    if (savedAlerts) {
      setAlerts(JSON.parse(savedAlerts));
    }
    const savedRequests = localStorage.getItem(STORAGE_KEYS.footageRequests);
    if (savedRequests) setFootageRequests(JSON.parse(savedRequests));
  }, []);

  const saveFootageRequests = (r: FootageRequest[]) => {
    setFootageRequests(r);
    localStorage.setItem(STORAGE_KEYS.footageRequests, JSON.stringify(r));
  };

  const updateRequestStatus = (id: string, status: FootageRequest['status'], note?: string) => {
    const updated = footageRequests.map(r => {
      if (r.id !== id) return r;
      const req = { ...r, status };
      if (note !== undefined) req.adminNote = note;
      return req;
    });
    saveFootageRequests(updated);

    // Айлд мэдэгдэл илгээх
    const req = footageRequests.find(r => r.id === id);
    if (req) {
      const statusText = REQUEST_STATUS[status].label;
      const msgs = JSON.parse(localStorage.getItem('sokh-sent-messages') || '[]');
      msgs.unshift({
        id: `msg-${Date.now()}-footage`,
        to: req.apartment,
        toName: req.residentName,
        content: `Таны камерын бичлэг шүүх хүсэлт "${statusText}" төлөвтэй боллоо. ${note ? `Тэмдэглэл: ${note}` : ''} Категори: ${FOOTAGE_CATEGORIES.find(c => c.id === req.category)?.label || req.category}`,
        type: 'custom',
        sentAt: new Date().toISOString(),
        status: 'sent',
      });
      localStorage.setItem('sokh-sent-messages', JSON.stringify(msgs));
    }
  };

  const saveCameras = (c: Camera[]) => {
    setCameras(c);
    localStorage.setItem(STORAGE_KEYS.cameras, JSON.stringify(c));
  };

  const saveAlerts = (a: AIAlert[]) => {
    setAlerts(a);
    localStorage.setItem(STORAGE_KEYS.alerts, JSON.stringify(a));
  };

  const addCamera = () => {
    if (!addForm.name || !addForm.ipAddress) return;
    const newCamera: Camera = {
      id: Date.now().toString(),
      name: addForm.name,
      location: addForm.location,
      rtspUrl: addForm.rtspUrl || `rtsp://${addForm.ipAddress}:554/stream1`,
      ipAddress: addForm.ipAddress,
      status: 'offline',
      aiEnabled: false,
      brand: addForm.brand,
      onvifEnabled: addForm.onvifEnabled,
    };
    saveCameras([...cameras, newCamera]);
    setAddForm({ name: '', location: '', rtspUrl: '', ipAddress: '', brand: 'Hikvision', onvifEnabled: true });
    setShowAddForm(false);
  };

  const deleteCamera = (id: string) => {
    if (!confirm('Камер устгах уу?')) return;
    saveCameras(cameras.filter(c => c.id !== id));
  };

  const toggleCameraStatus = (id: string) => {
    const updated = cameras.map(c =>
      c.id === id ? { ...c, status: c.status === 'online' ? 'offline' as const : 'online' as const } : c
    );
    saveCameras(updated);
  };

  const toggleAI = (id: string) => {
    const cam = cameras.find(c => c.id === id);
    if (!cam) return;

    const updated = cameras.map(c =>
      c.id === id ? { ...c, aiEnabled: !c.aiEnabled } : c
    );
    saveCameras(updated);

    // Generate sample AI alert when enabled
    if (!cam.aiEnabled) {
      const alertTypes: AIAlert['type'][] = ['motion', 'unknown_person', 'suspicious', 'fire_smoke'];
      const severities: AIAlert['severity'][] = ['info', 'warning', 'critical'];
      const randomType = alertTypes[Math.floor(Math.random() * alertTypes.length)];
      const severity = randomType === 'fire_smoke' ? 'critical' : randomType === 'suspicious' ? 'warning' : severities[Math.floor(Math.random() * 2)];

      const newAlert: AIAlert = {
        id: Date.now().toString(),
        cameraId: id,
        cameraName: cam.name,
        type: randomType,
        severity,
        timestamp: new Date().toISOString(),
        description: `${cam.name} камераас ${ALERT_TYPE_MAP[randomType].label.toLowerCase()} илэрсэн`,
      };
      saveAlerts([newAlert, ...alerts]);
    }
  };

  const testConnection = (id: string) => {
    setTestingConnection(id);
    setTimeout(() => {
      const cam = cameras.find(c => c.id === id);
      if (cam) {
        const updated = cameras.map(c =>
          c.id === id ? { ...c, status: 'online' as const } : c
        );
        saveCameras(updated);
      }
      setTestingConnection(null);
      alert('Холболт амжилттай!');
    }, 2000);
  };

  const clearAlerts = () => {
    if (!confirm('Бүх анхааруулгыг устгах уу?')) return;
    saveAlerts([]);
  };

  const onlineCount = cameras.filter(c => c.status === 'online').length;
  const gridCameras = gridLayout === '2x2' ? cameras.slice(0, 4) : cameras.slice(0, 6);

  const pendingRequests = footageRequests.filter(r => r.status === 'pending' || r.status === 'reviewing').length;

  const tabs = [
    { key: 'grid' as const, label: 'Камер', icon: '📹' },
    { key: 'list' as const, label: 'Жагсаалт', icon: '📋' },
    { key: 'ai' as const, label: 'AI', icon: '🤖' },
    { key: 'requests' as const, label: `Хүсэлт${pendingRequests ? ` (${pendingRequests})` : ''}`, icon: '🎬' },
    { key: 'connection' as const, label: 'Холболт', icon: '🔌' },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">📹 Камерын хяналт (CCTV)</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-1"></span>
            {onlineCount}/{cameras.length} идэвхтэй
          </span>
        </div>
      </div>

      {/* Fullscreen overlay */}
      {fullscreenCamera && (() => {
        const cam = cameras.find(c => c.id === fullscreenCamera);
        return cam ? (
          <div className="fixed inset-0 bg-black z-50 flex flex-col">
            <div className="flex items-center justify-between p-4 bg-black/80">
              <div>
                <h2 className="text-white font-bold">{cam.name}</h2>
                <p className="text-gray-400 text-sm">{cam.location}</p>
              </div>
              <button
                onClick={() => setFullscreenCamera(null)}
                className="text-white bg-red-600 px-4 py-2 rounded-lg text-sm hover:bg-red-700"
              >
                ✕ Хаах
              </button>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <div className="w-full max-w-4xl aspect-video bg-gray-900 rounded-xl flex items-center justify-center">
                {cam.status === 'online' ? (
                  <div className="text-center">
                    <div className="text-6xl mb-4">📹</div>
                    <p className="text-gray-400">Камерын дүрс (RTSP stream)</p>
                    <p className="text-gray-600 text-sm mt-1">{cam.rtspUrl}</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="text-6xl mb-4 opacity-30">📹</div>
                    <p className="text-red-400">Камер идэвхгүй</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null;
      })()}

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

      {/* ========== GRID TAB ========== */}
      {activeTab === 'grid' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">Камерын хяналтын дэлгэц</p>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setGridLayout('2x2')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition ${gridLayout === '2x2' ? 'bg-white shadow' : ''}`}
              >
                2x2
              </button>
              <button
                onClick={() => setGridLayout('3x2')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition ${gridLayout === '3x2' ? 'bg-white shadow' : ''}`}
              >
                3x2
              </button>
            </div>
          </div>

          <div className={`grid gap-3 ${gridLayout === '2x2' ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {gridCameras.map(cam => (
              <div key={cam.id} className="bg-white rounded-xl border overflow-hidden">
                {/* Video placeholder */}
                <div className={`aspect-video flex items-center justify-center relative ${
                  cam.status === 'online' ? 'bg-gray-800' : 'bg-gray-200'
                }`}>
                  {cam.status === 'online' ? (
                    <div className="text-center">
                      <div className="text-4xl mb-1">📹</div>
                      <p className="text-gray-500 text-xs">Live дүрс</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className="text-4xl mb-1 opacity-30">📹</div>
                      <p className="text-gray-400 text-xs">Идэвхгүй</p>
                    </div>
                  )}
                  {/* Status badge */}
                  <div className={`absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    cam.status === 'online'
                      ? 'bg-green-500/80 text-white'
                      : 'bg-red-500/80 text-white'
                  }`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${cam.status === 'online' ? 'bg-white animate-pulse' : 'bg-white/50'}`}></div>
                    {cam.status === 'online' ? 'LIVE' : 'OFFLINE'}
                  </div>
                  {/* AI badge */}
                  {cam.aiEnabled && (
                    <div className="absolute top-2 right-2 bg-purple-500/80 text-white px-2 py-0.5 rounded-full text-[10px] font-medium">
                      AI ON
                    </div>
                  )}
                  {/* Fullscreen button */}
                  <button
                    onClick={() => setFullscreenCamera(cam.id)}
                    className="absolute bottom-2 right-2 bg-black/50 text-white p-1.5 rounded-lg hover:bg-black/70 transition"
                  >
                    <span className="text-sm">⛶</span>
                  </button>
                </div>
                {/* Info */}
                <div className="p-2.5">
                  <p className="text-sm font-medium truncate">{cam.name}</p>
                  <p className="text-xs text-gray-500">{cam.location}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========== LIST TAB ========== */}
      {activeTab === 'list' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">Нийт: {cameras.length} камер</p>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
            >
              + Камер нэмэх
            </button>
          </div>

          {showAddForm && (
            <div className="bg-white border rounded-xl p-4 mb-4">
              <h3 className="font-semibold mb-3">Шинэ камер нэмэх</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Камерын нэр</label>
                  <input
                    placeholder="жнь: Гадна камер 3"
                    value={addForm.name}
                    onChange={e => setAddForm({ ...addForm, name: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Байршил</label>
                  <input
                    placeholder="жнь: 5-р давхар коридор"
                    value={addForm.location}
                    onChange={e => setAddForm({ ...addForm, location: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">IP хаяг</label>
                  <input
                    placeholder="192.168.1.xxx"
                    value={addForm.ipAddress}
                    onChange={e => setAddForm({ ...addForm, ipAddress: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">RTSP URL</label>
                  <input
                    placeholder="rtsp://ip:554/stream1"
                    value={addForm.rtspUrl}
                    onChange={e => setAddForm({ ...addForm, rtspUrl: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Брэнд</label>
                  <select
                    value={addForm.brand}
                    onChange={e => setAddForm({ ...addForm, brand: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  >
                    {NVR_BRANDS.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <button
                    onClick={() => setAddForm({ ...addForm, onvifEnabled: !addForm.onvifEnabled })}
                    className={`relative w-11 h-6 rounded-full transition ${addForm.onvifEnabled ? 'bg-blue-600' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition ${addForm.onvifEnabled ? 'left-[22px]' : 'left-0.5'}`}></span>
                  </button>
                  <span className="text-sm">ONVIF протокол</span>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => setShowAddForm(false)} className="px-4 py-2 border rounded-lg text-sm">Цуцлах</button>
                <button onClick={addCamera} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
                  Хадгалах
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr className="text-left text-sm text-gray-500">
                  <th className="px-4 py-3">Төлөв</th>
                  <th className="px-4 py-3">Нэр</th>
                  <th className="px-4 py-3">Байршил</th>
                  <th className="px-4 py-3">IP хаяг</th>
                  <th className="px-4 py-3">Брэнд</th>
                  <th className="px-4 py-3">AI</th>
                  <th className="px-4 py-3 text-right">Үйлдэл</th>
                </tr>
              </thead>
              <tbody>
                {cameras.map(cam => (
                  <tr key={cam.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <button onClick={() => toggleCameraStatus(cam.id)} title="Төлөв солих">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          cam.status === 'online'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cam.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                          {cam.status === 'online' ? 'Online' : 'Offline'}
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">{cam.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{cam.location}</td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-500">{cam.ipAddress}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{cam.brand}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        cam.aiEnabled ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {cam.aiEnabled ? 'ON' : 'OFF'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setFullscreenCamera(cam.id)} className="text-blue-500 text-sm mr-2 hover:underline">Харах</button>
                      <button onClick={() => deleteCamera(cam.id)} className="text-red-400 text-sm hover:underline">Устгах</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {cameras.length === 0 && (
              <p className="text-gray-400 text-center py-6">Камер бүртгэгдээгүй</p>
            )}
          </div>
        </div>
      )}

      {/* ========== AI TAB ========== */}
      {activeTab === 'ai' && (
        <div>
          {/* Per-camera AI toggle */}
          <div className="bg-white border rounded-xl p-4 mb-6">
            <h3 className="font-semibold mb-3">🤖 Камер тус бүрийн AI хяналт</h3>
            <div className="space-y-2">
              {cameras.map(cam => (
                <div key={cam.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${cam.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                    <div>
                      <p className="text-sm font-medium">{cam.name}</p>
                      <p className="text-xs text-gray-500">{cam.location}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleAI(cam.id)}
                    className={`relative w-11 h-6 rounded-full transition ${cam.aiEnabled ? 'bg-purple-600' : 'bg-gray-300'}`}
                    disabled={cam.status === 'offline'}
                    title={cam.status === 'offline' ? 'Камер идэвхгүй' : ''}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition ${cam.aiEnabled ? 'left-[22px]' : 'left-0.5'}`}></span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Alert types info */}
          <div className="bg-white border rounded-xl p-4 mb-6">
            <h3 className="font-semibold mb-3">📋 Илрүүлэх анхааруулгын төрлүүд</h3>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(ALERT_TYPE_MAP).map(([key, val]) => (
                <div key={key} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                  <span className="text-lg">{val.icon}</span>
                  <span className="text-sm">{val.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Alerts log */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm text-gray-500">AI АНХААРУУЛГЫН ТҮҮХ</h3>
            {alerts.length > 0 && (
              <button onClick={clearAlerts} className="text-xs text-red-500 hover:underline">
                Бүгдийг устгах
              </button>
            )}
          </div>

          {alerts.length === 0 ? (
            <div className="bg-white rounded-xl p-6 text-center border">
              <p className="text-3xl mb-2">🤖</p>
              <p className="text-gray-400">AI анхааруулга байхгүй</p>
              <p className="text-xs text-gray-400 mt-1">Камерын AI хяналтыг идэвхжүүлснээр анхааруулга илэрнэ</p>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map(alert => {
                const severity = SEVERITY_MAP[alert.severity];
                const alertType = ALERT_TYPE_MAP[alert.type];
                return (
                  <div key={alert.id} className={`rounded-xl p-4 border ${severity.bg}`}>
                    <div className="flex items-start gap-3">
                      {/* Thumbnail placeholder */}
                      <div className="w-16 h-16 bg-gray-300 rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="text-xl">{alertType.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${severity.bg} ${severity.color}`}>
                            {severity.label}
                          </span>
                          <span className="text-xs text-gray-400">{alert.cameraName}</span>
                        </div>
                        <p className="text-sm font-medium">{alertType.label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{alert.description}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(alert.timestamp).toLocaleString('mn-MN')}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========== REQUESTS TAB ========== */}
      {activeTab === 'requests' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">
              Нийт: {footageRequests.length} хүсэлт
              {pendingRequests > 0 && <span className="text-orange-500 ml-1">· {pendingRequests} хүлээгдэж буй</span>}
            </p>
          </div>

          {/* Категорийн тайлбар */}
          <div className="bg-white border rounded-xl p-4 mb-4">
            <h3 className="font-semibold mb-3 text-sm">📋 Бичлэг шүүх хүсэлтийн категориуд</h3>
            <div className="grid grid-cols-2 gap-2">
              {FOOTAGE_CATEGORIES.map(cat => (
                <div key={cat.id} className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg">
                  <span className="text-lg">{cat.icon}</span>
                  <div>
                    <p className="text-xs font-medium">{cat.label}</p>
                    <p className="text-[10px] text-gray-500">{cat.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Хүсэлтүүд */}
          {footageRequests.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center border">
              <p className="text-3xl mb-2">🎬</p>
              <p className="text-gray-400">Бичлэг шүүх хүсэлт ирээгүй</p>
              <p className="text-xs text-gray-400 mt-1">Оршин суугчид аппаар хүсэлт илгээнэ</p>
            </div>
          ) : (
            <div className="space-y-3">
              {footageRequests.map(req => {
                const cat = FOOTAGE_CATEGORIES.find(c => c.id === req.category);
                const st = REQUEST_STATUS[req.status];
                return (
                  <div key={req.id} className={`bg-white rounded-xl p-4 border ${req.status === 'pending' ? 'border-orange-300' : ''}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{cat?.icon || '📹'}</span>
                        <div>
                          <p className="text-sm font-semibold">{cat?.label || req.category}</p>
                          <p className="text-xs text-gray-500">{req.residentName} · {req.apartment}</p>
                        </div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${st.color}`}>
                        {st.label}
                      </span>
                    </div>

                    <p className="text-sm text-gray-700 mb-2">{req.description}</p>

                    <div className="flex items-center gap-4 text-xs text-gray-400 mb-3">
                      <span>📅 {new Date(req.dateFrom).toLocaleDateString('mn-MN')} — {new Date(req.dateTo).toLocaleDateString('mn-MN')}</span>
                      <span>📍 {req.location}</span>
                      {req.phone && <span>📞 {req.phone}</span>}
                    </div>

                    {req.adminNote && (
                      <div className="bg-blue-50 rounded-lg p-2 mb-3 text-xs text-blue-700">
                        Админ: {req.adminNote}
                      </div>
                    )}

                    <p className="text-[10px] text-gray-400 mb-3">
                      Илгээсэн: {new Date(req.createdAt).toLocaleString('mn-MN')}
                    </p>

                    {/* Үйлдлүүд */}
                    {(req.status === 'pending' || req.status === 'reviewing') && (
                      <div className="flex gap-2">
                        {req.status === 'pending' && (
                          <button
                            onClick={() => updateRequestStatus(req.id, 'reviewing')}
                            className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-200"
                          >
                            🔍 Шалгаж эхлэх
                          </button>
                        )}
                        <button
                          onClick={() => {
                            const note = prompt('Тэмдэглэл (заавал биш):') || '';
                            updateRequestStatus(req.id, 'approved', note);
                          }}
                          className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-medium hover:bg-green-200"
                        >
                          ✅ Зөвшөөрөх
                        </button>
                        <button
                          onClick={() => {
                            const note = prompt('Татгалзсан шалтгаан:') || '';
                            updateRequestStatus(req.id, 'rejected', note);
                          }}
                          className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-medium hover:bg-red-200"
                        >
                          ❌ Татгалзах
                        </button>
                        <button
                          onClick={() => updateRequestStatus(req.id, 'done', 'Бичлэг хүргэгдсэн')}
                          className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-xs font-medium hover:bg-purple-200"
                        >
                          🎬 Бичлэг хүргэсэн
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========== CONNECTION TAB ========== */}
      {activeTab === 'connection' && (
        <div>
          <div className="bg-white border rounded-xl p-4 mb-6">
            <h3 className="font-semibold mb-3">🔌 Камер програм холболт</h3>
            <p className="text-sm text-gray-500 mb-4">
              NVR/DVR төхөөрөмжтэй RTSP болон ONVIF протоколоор холбогдоно.
              Дэмжигдэх брэндүүд: Hikvision, Dahua, Uniview, Hanwha, Axis
            </p>

            <div className="grid grid-cols-3 gap-3 mb-4">
              {NVR_BRANDS.slice(0, -1).map(brand => (
                <div key={brand} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border">
                  <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center text-xs font-bold text-gray-500">
                    {brand.substring(0, 2).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium">{brand}</span>
                </div>
              ))}
            </div>
          </div>

          <h3 className="font-semibold text-sm text-gray-500 mb-3">КАМЕР ХОЛБОЛТЫН ТӨЛӨВ</h3>
          <div className="space-y-2">
            {cameras.map(cam => (
              <div key={cam.id} className="bg-white rounded-xl p-4 border">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-2 h-2 rounded-full ${cam.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                      <p className="text-sm font-medium">{cam.name}</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>IP: {cam.ipAddress}</span>
                      <span>|</span>
                      <span>{cam.brand}</span>
                      <span>|</span>
                      <span>ONVIF: {cam.onvifEnabled ? 'Тийм' : 'Үгүй'}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1 font-mono">{cam.rtspUrl}</p>
                  </div>
                  <button
                    onClick={() => testConnection(cam.id)}
                    disabled={testingConnection === cam.id}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      testingConnection === cam.id
                        ? 'bg-gray-200 text-gray-400'
                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    }`}
                  >
                    {testingConnection === cam.id ? 'Шалгаж байна...' : '🔗 Холболт шалгах'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
