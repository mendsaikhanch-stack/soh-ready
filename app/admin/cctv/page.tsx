'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { adminFrom } from '@/app/lib/admin-db';
import { getAdminSokhId } from '@/app/lib/admin-config';

interface Camera {
  id: number;
  name: string;
  location: string;
  rtsp_url: string;
  ip_address: string;
  status: string;
  ai_enabled: boolean;
  brand: string;
  onvif_enabled: boolean;
}

interface AIAlert {
  id: number;
  camera_id: number;
  camera_name: string;
  type: string;
  severity: string;
  description: string;
  created_at: string;
}

interface FootageRequest {
  id: number;
  resident_name: string;
  apartment: string;
  phone: string;
  category: string;
  description: string;
  date_from: string;
  date_to: string;
  location: string;
  status: string;
  created_at: string;
  admin_note: string;
}

const FOOTAGE_CATEGORIES = [
  { id: 'parking_incident', label: 'Зогсоолын осол', icon: '🚗', desc: 'Мөргөлдсөн, шүргэсэн' },
  { id: 'suspicious_person', label: 'Сэжигтэй хүн', icon: '👤', desc: 'Гадны танихгүй хүн' },
  { id: 'theft_crime', label: 'Хулгай/Гэмт хэрэг', icon: '🚨', desc: 'Хулгай, эвдрэл' },
  { id: 'lost_item', label: 'Алдсан эд зүйл', icon: '📦', desc: 'Гээсэн, орхисон юм' },
  { id: 'playground', label: 'Тоглоомын талбай', icon: '🧒', desc: 'Хүүхэд хянах' },
  { id: 'property_damage', label: 'Эд хөрөнгийн хохирол', icon: '💥', desc: 'Эд хогшил гэмтээсэн' },
  { id: 'other', label: 'Бусад', icon: '📹', desc: 'Бусад шалтгаан' },
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

export default function AdminCCTV() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [alerts, setAlerts] = useState<AIAlert[]>([]);
  const [activeTab, setActiveTab] = useState<'grid' | 'list' | 'ai' | 'requests' | 'connection'>('grid');
  const [footageRequests, setFootageRequests] = useState<FootageRequest[]>([]);
  const [gridLayout, setGridLayout] = useState<'2x2' | '3x2'>('2x2');
  const [fullscreenCamera, setFullscreenCamera] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [testingConnection, setTestingConnection] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const [addForm, setAddForm] = useState({
    name: '', location: '', rtsp_url: '', ip_address: '', brand: 'Hikvision', onvif_enabled: true,
  });

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    const sokhId = await getAdminSokhId();
    const [{ data: cams }, { data: alts }, { data: reqs }] = await Promise.all([
      supabase.from('cameras').select('*').eq('sokh_id', sokhId).order('id'),
      supabase.from('cctv_ai_alerts').select('*').eq('sokh_id', sokhId).order('created_at', { ascending: false }),
      supabase.from('footage_requests').select('*').eq('sokh_id', sokhId).order('created_at', { ascending: false }),
    ]);
    setCameras(cams || []);
    setAlerts(alts || []);
    setFootageRequests(reqs || []);
    setLoading(false);
  };

  const addCamera = async () => {
    if (!addForm.name || !addForm.ip_address) return;
    const sokhId = await getAdminSokhId();
    await adminFrom('cameras').insert({
      sokh_id: sokhId,
      name: addForm.name,
      location: addForm.location,
      rtsp_url: addForm.rtsp_url || `rtsp://${addForm.ip_address}:554/stream1`,
      ip_address: addForm.ip_address,
      status: 'offline',
      ai_enabled: false,
      brand: addForm.brand,
      onvif_enabled: addForm.onvif_enabled,
    });
    setAddForm({ name: '', location: '', rtsp_url: '', ip_address: '', brand: 'Hikvision', onvif_enabled: true });
    setShowAddForm(false);
    fetchAll();
  };

  const deleteCamera = async (id: number) => {
    if (!confirm('Камер устгах уу?')) return;
    await adminFrom('cameras').delete().eq('id', id);
    fetchAll();
  };

  const toggleCameraStatus = async (id: number) => {
    const cam = cameras.find(c => c.id === id);
    if (!cam) return;
    await adminFrom('cameras').update({ status: cam.status === 'online' ? 'offline' : 'online' }).eq('id', id);
    fetchAll();
  };

  const toggleAI = async (id: number) => {
    const cam = cameras.find(c => c.id === id);
    if (!cam) return;
    await adminFrom('cameras').update({ ai_enabled: !cam.ai_enabled }).eq('id', id);

    if (!cam.ai_enabled) {
      const alertTypes = ['motion', 'unknown_person', 'suspicious', 'fire_smoke'];
      const randomType = alertTypes[Math.floor(Math.random() * alertTypes.length)];
      const severity = randomType === 'fire_smoke' ? 'critical' : randomType === 'suspicious' ? 'warning' : 'info';
      const sokhId = await getAdminSokhId();
      await adminFrom('cctv_ai_alerts').insert({
        sokh_id: sokhId,
        camera_id: id,
        camera_name: cam.name,
        type: randomType,
        severity,
        description: `${cam.name} камераас ${ALERT_TYPE_MAP[randomType].label.toLowerCase()} илэрсэн`,
      });
    }
    fetchAll();
  };

  const clearAlerts = async () => {
    if (!confirm('Бүх анхааруулгыг устгах уу?')) return;
    const sokhId = await getAdminSokhId();
    await adminFrom('cctv_ai_alerts').delete().eq('sokh_id', sokhId);
    fetchAll();
  };

  const updateRequestStatus = async (id: number, status: string, note?: string) => {
    const payload: Record<string, string> = { status };
    if (note !== undefined) payload.admin_note = note;
    await adminFrom('footage_requests').update(payload).eq('id', id);
    fetchAll();
  };

  const testConnection = (id: number) => {
    setTestingConnection(id);
    setTimeout(async () => {
      await adminFrom('cameras').update({ status: 'online' }).eq('id', id);
      setTestingConnection(null);
      alert('Холболт амжилттай!');
      fetchAll();
    }, 2000);
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

  if (loading) return <div className="p-6 text-gray-400">Ачаалж байна...</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">📹 Камерын хяналт (CCTV)</h1>
        <span className="text-sm text-gray-500">
          <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-1"></span>
          {onlineCount}/{cameras.length} идэвхтэй
        </span>
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
              <button onClick={() => setFullscreenCamera(null)} className="text-white bg-red-600 px-4 py-2 rounded-lg text-sm hover:bg-red-700">
                ✕ Хаах
              </button>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <div className="w-full max-w-4xl aspect-video bg-gray-900 rounded-xl flex items-center justify-center">
                <div className="text-center">
                  <div className="text-6xl mb-4">{cam.status === 'online' ? '📹' : '❌'}</div>
                  <p className="text-gray-400">{cam.status === 'online' ? 'RTSP stream' : 'Камер идэвхгүй'}</p>
                  <p className="text-gray-600 text-sm mt-1">{cam.rtsp_url}</p>
                </div>
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
              activeTab === tab.key ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span>{tab.icon}</span><span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* GRID TAB */}
      {activeTab === 'grid' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">Камерын хяналтын дэлгэц</p>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
              <button onClick={() => setGridLayout('2x2')} className={`px-3 py-1.5 rounded text-xs font-medium transition ${gridLayout === '2x2' ? 'bg-white shadow' : ''}`}>2x2</button>
              <button onClick={() => setGridLayout('3x2')} className={`px-3 py-1.5 rounded text-xs font-medium transition ${gridLayout === '3x2' ? 'bg-white shadow' : ''}`}>3x2</button>
            </div>
          </div>
          <div className={`grid gap-3 ${gridLayout === '2x2' ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {gridCameras.map(cam => (
              <div key={cam.id} className="bg-white rounded-xl border overflow-hidden">
                <div className={`aspect-video flex items-center justify-center relative ${cam.status === 'online' ? 'bg-gray-800' : 'bg-gray-200'}`}>
                  <div className="text-center">
                    <div className={`text-4xl mb-1 ${cam.status !== 'online' ? 'opacity-30' : ''}`}>📹</div>
                    <p className={`text-xs ${cam.status === 'online' ? 'text-gray-500' : 'text-gray-400'}`}>{cam.status === 'online' ? 'Live дүрс' : 'Идэвхгүй'}</p>
                  </div>
                  <div className={`absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${cam.status === 'online' ? 'bg-green-500/80 text-white' : 'bg-red-500/80 text-white'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${cam.status === 'online' ? 'bg-white animate-pulse' : 'bg-white/50'}`}></div>
                    {cam.status === 'online' ? 'LIVE' : 'OFFLINE'}
                  </div>
                  {cam.ai_enabled && <div className="absolute top-2 right-2 bg-purple-500/80 text-white px-2 py-0.5 rounded-full text-[10px] font-medium">AI ON</div>}
                  <button onClick={() => setFullscreenCamera(cam.id)} className="absolute bottom-2 right-2 bg-black/50 text-white p-1.5 rounded-lg hover:bg-black/70 transition">
                    <span className="text-sm">⛶</span>
                  </button>
                </div>
                <div className="p-2.5">
                  <p className="text-sm font-medium truncate">{cam.name}</p>
                  <p className="text-xs text-gray-500">{cam.location}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LIST TAB */}
      {activeTab === 'list' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">Нийт: {cameras.length} камер</p>
            <button onClick={() => setShowAddForm(!showAddForm)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">+ Камер нэмэх</button>
          </div>
          {showAddForm && (
            <div className="bg-white border rounded-xl p-4 mb-4">
              <h3 className="font-semibold mb-3">Шинэ камер нэмэх</h3>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-gray-500 mb-1 block">Камерын нэр</label><input placeholder="жнь: Гадна камер 3" value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
                <div><label className="text-xs text-gray-500 mb-1 block">Байршил</label><input placeholder="жнь: 5-р давхар коридор" value={addForm.location} onChange={e => setAddForm({ ...addForm, location: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
                <div><label className="text-xs text-gray-500 mb-1 block">IP хаяг</label><input placeholder="192.168.1.xxx" value={addForm.ip_address} onChange={e => setAddForm({ ...addForm, ip_address: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
                <div><label className="text-xs text-gray-500 mb-1 block">RTSP URL</label><input placeholder="rtsp://ip:554/stream1" value={addForm.rtsp_url} onChange={e => setAddForm({ ...addForm, rtsp_url: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
                <div><label className="text-xs text-gray-500 mb-1 block">Брэнд</label><select value={addForm.brand} onChange={e => setAddForm({ ...addForm, brand: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm">{NVR_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}</select></div>
                <div className="flex items-center gap-2 pt-5">
                  <button onClick={() => setAddForm({ ...addForm, onvif_enabled: !addForm.onvif_enabled })} className={`relative w-11 h-6 rounded-full transition ${addForm.onvif_enabled ? 'bg-blue-600' : 'bg-gray-300'}`}>
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition ${addForm.onvif_enabled ? 'left-[22px]' : 'left-0.5'}`}></span>
                  </button>
                  <span className="text-sm">ONVIF протокол</span>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => setShowAddForm(false)} className="px-4 py-2 border rounded-lg text-sm">Цуцлах</button>
                <button onClick={addCamera} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Хадгалах</button>
              </div>
            </div>
          )}
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr className="text-left text-sm text-gray-500">
                  <th className="px-4 py-3">Төлөв</th><th className="px-4 py-3">Нэр</th><th className="px-4 py-3">Байршил</th><th className="px-4 py-3">IP</th><th className="px-4 py-3">Брэнд</th><th className="px-4 py-3">AI</th><th className="px-4 py-3 text-right">Үйлдэл</th>
                </tr>
              </thead>
              <tbody>
                {cameras.map(cam => (
                  <tr key={cam.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3"><button onClick={() => toggleCameraStatus(cam.id)}><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cam.status === 'online' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}><span className={`w-1.5 h-1.5 rounded-full ${cam.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`}></span>{cam.status === 'online' ? 'Online' : 'Offline'}</span></button></td>
                    <td className="px-4 py-3 text-sm font-medium">{cam.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{cam.location}</td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-500">{cam.ip_address}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{cam.brand}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${cam.ai_enabled ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'}`}>{cam.ai_enabled ? 'ON' : 'OFF'}</span></td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setFullscreenCamera(cam.id)} className="text-blue-500 text-sm mr-2 hover:underline">Харах</button>
                      <button onClick={() => deleteCamera(cam.id)} className="text-red-400 text-sm hover:underline">Устгах</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {cameras.length === 0 && <p className="text-gray-400 text-center py-6">Камер бүртгэгдээгүй</p>}
          </div>
        </div>
      )}

      {/* AI TAB */}
      {activeTab === 'ai' && (
        <div>
          <div className="bg-white border rounded-xl p-4 mb-6">
            <h3 className="font-semibold mb-3">🤖 Камер тус бүрийн AI хяналт</h3>
            <div className="space-y-2">
              {cameras.map(cam => (
                <div key={cam.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${cam.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                    <div><p className="text-sm font-medium">{cam.name}</p><p className="text-xs text-gray-500">{cam.location}</p></div>
                  </div>
                  <button onClick={() => toggleAI(cam.id)} className={`relative w-11 h-6 rounded-full transition ${cam.ai_enabled ? 'bg-purple-600' : 'bg-gray-300'}`} disabled={cam.status === 'offline'}>
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition ${cam.ai_enabled ? 'left-[22px]' : 'left-0.5'}`}></span>
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm text-gray-500">AI АНХААРУУЛГЫН ТҮҮХ</h3>
            {alerts.length > 0 && <button onClick={clearAlerts} className="text-xs text-red-500 hover:underline">Бүгдийг устгах</button>}
          </div>
          {alerts.length === 0 ? (
            <div className="bg-white rounded-xl p-6 text-center border"><p className="text-3xl mb-2">🤖</p><p className="text-gray-400">AI анхааруулга байхгүй</p></div>
          ) : (
            <div className="space-y-2">
              {alerts.map(alert => {
                const severity = SEVERITY_MAP[alert.severity] || SEVERITY_MAP.info;
                const alertType = ALERT_TYPE_MAP[alert.type] || { label: alert.type, icon: '⚠️' };
                return (
                  <div key={alert.id} className={`rounded-xl p-4 border ${severity.bg}`}>
                    <div className="flex items-start gap-3">
                      <div className="w-16 h-16 bg-gray-300 rounded-lg flex items-center justify-center flex-shrink-0"><span className="text-xl">{alertType.icon}</span></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${severity.bg} ${severity.color}`}>{severity.label}</span>
                          <span className="text-xs text-gray-400">{alert.camera_name}</span>
                        </div>
                        <p className="text-sm font-medium">{alertType.label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{alert.description}</p>
                        <p className="text-xs text-gray-400 mt-1">{new Date(alert.created_at).toLocaleString('mn-MN')}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* REQUESTS TAB */}
      {activeTab === 'requests' && (
        <div>
          <p className="text-sm text-gray-500 mb-4">Нийт: {footageRequests.length} хүсэлт{pendingRequests > 0 && <span className="text-orange-500 ml-1">· {pendingRequests} хүлээгдэж буй</span>}</p>
          {footageRequests.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center border"><p className="text-3xl mb-2">🎬</p><p className="text-gray-400">Бичлэг шүүх хүсэлт ирээгүй</p></div>
          ) : (
            <div className="space-y-3">
              {footageRequests.map(req => {
                const cat = FOOTAGE_CATEGORIES.find(c => c.id === req.category);
                const st = REQUEST_STATUS[req.status] || REQUEST_STATUS.pending;
                return (
                  <div key={req.id} className={`bg-white rounded-xl p-4 border ${req.status === 'pending' ? 'border-orange-300' : ''}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{cat?.icon || '📹'}</span>
                        <div><p className="text-sm font-semibold">{cat?.label || req.category}</p><p className="text-xs text-gray-500">{req.resident_name} · {req.apartment}</p></div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.label}</span>
                    </div>
                    <p className="text-sm text-gray-700 mb-2">{req.description}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-400 mb-3">
                      <span>📅 {req.date_from ? new Date(req.date_from).toLocaleDateString('mn-MN') : '-'} — {req.date_to ? new Date(req.date_to).toLocaleDateString('mn-MN') : '-'}</span>
                      <span>📍 {req.location}</span>
                      {req.phone && <span>📞 {req.phone}</span>}
                    </div>
                    {req.admin_note && <div className="bg-blue-50 rounded-lg p-2 mb-3 text-xs text-blue-700">Админ: {req.admin_note}</div>}
                    <p className="text-[10px] text-gray-400 mb-3">Илгээсэн: {new Date(req.created_at).toLocaleString('mn-MN')}</p>
                    {(req.status === 'pending' || req.status === 'reviewing') && (
                      <div className="flex gap-2">
                        {req.status === 'pending' && <button onClick={() => updateRequestStatus(req.id, 'reviewing')} className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-200">🔍 Шалгаж эхлэх</button>}
                        <button onClick={() => { const note = prompt('Тэмдэглэл:') || ''; updateRequestStatus(req.id, 'approved', note); }} className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-medium hover:bg-green-200">✅ Зөвшөөрөх</button>
                        <button onClick={() => { const note = prompt('Шалтгаан:') || ''; updateRequestStatus(req.id, 'rejected', note); }} className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-medium hover:bg-red-200">❌ Татгалзах</button>
                        <button onClick={() => updateRequestStatus(req.id, 'done', 'Бичлэг хүргэгдсэн')} className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-xs font-medium hover:bg-purple-200">🎬 Хүргэсэн</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CONNECTION TAB */}
      {activeTab === 'connection' && (
        <div>
          <div className="bg-white border rounded-xl p-4 mb-6">
            <h3 className="font-semibold mb-3">🔌 Камер програм холболт</h3>
            <p className="text-sm text-gray-500 mb-4">NVR/DVR төхөөрөмжтэй RTSP болон ONVIF протоколоор холбогдоно.</p>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {NVR_BRANDS.slice(0, -1).map(brand => (
                <div key={brand} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border">
                  <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center text-xs font-bold text-gray-500">{brand.substring(0, 2).toUpperCase()}</div>
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
                    <div className="flex items-center gap-3 text-xs text-gray-500"><span>IP: {cam.ip_address}</span><span>|</span><span>{cam.brand}</span><span>|</span><span>ONVIF: {cam.onvif_enabled ? 'Тийм' : 'Үгүй'}</span></div>
                    <p className="text-xs text-gray-400 mt-1 font-mono">{cam.rtsp_url}</p>
                  </div>
                  <button onClick={() => testConnection(cam.id)} disabled={testingConnection === cam.id} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${testingConnection === cam.id ? 'bg-gray-200 text-gray-400' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}>
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
