'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { adminFrom } from '@/app/lib/admin-db';

interface Alert {
  id: number;
  sokh_id: number;
  type: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  created_at: string;
}

const typeOptions = [
  { value: 'fire', label: 'Галын аюул', icon: '🔥' },
  { value: 'water_leak', label: 'Ус алдалт', icon: '💧' },
  { value: 'power_outage', label: 'Цахилгаан тасалт', icon: '⚡' },
  { value: 'gas_leak', label: 'Хий алдалт', icon: '💨' },
  { value: 'earthquake', label: 'Газар хөдлөлт', icon: '🌍' },
  { value: 'security', label: 'Аюулгүй байдал', icon: '🚨' },
  { value: 'other', label: 'Бусад', icon: '⚠️' },
];

const severityOptions = [
  { value: 'critical', label: 'ЯАРАЛТАЙ', color: 'bg-red-100 text-red-700 border-red-300' },
  { value: 'high', label: 'Өндөр', color: 'bg-orange-100 text-orange-700 border-orange-300' },
  { value: 'medium', label: 'Дунд', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  { value: 'low', label: 'Бага', color: 'bg-blue-100 text-blue-700 border-blue-300' },
];

export default function AdminEmergency() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form
  const [formType, setFormType] = useState('fire');
  const [formSeverity, setFormSeverity] = useState('high');
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');

  useEffect(() => { fetchAlerts(); }, []);

  const fetchAlerts = async () => {
    const { data } = await supabase
      .from('emergency_alerts')
      .select('*')
      .order('created_at', { ascending: false });

    setAlerts(data || []);
    setLoading(false);
  };

  const sendAlert = async () => {
    if (!formTitle) return;
    setSaving(true);

    await adminFrom('emergency_alerts').insert([{
      sokh_id: 1,
      type: formType,
      title: formTitle,
      description: formDesc,
      severity: formSeverity,
      status: 'active',
    }]);

    setFormTitle(''); setFormDesc('');
    setShowForm(false);
    setSaving(false);
    await fetchAlerts();
  };

  const resolveAlert = async (id: number) => {
    await adminFrom('emergency_alerts').update({ status: 'resolved' }).eq('id', id);
    await fetchAlerts();
  };

  const deleteAlert = async (id: number) => {
    if (!confirm('Устгах уу?')) return;
    await adminFrom('emergency_alerts').delete().eq('id', id);
    await fetchAlerts();
  };

  const getType = (t: string) => typeOptions.find(o => o.value === t) || typeOptions[6];
  const getSeverity = (s: string) => severityOptions.find(o => o.value === s) || severityOptions[2];

  const activeAlerts = alerts.filter(a => a.status === 'active');
  const resolvedAlerts = alerts.filter(a => a.status !== 'active');

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">🚨 Яаралтай мэдэгдэл</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className={`rounded-xl border-2 p-4 ${activeAlerts.length > 0 ? 'bg-red-50 border-red-300 animate-pulse' : 'bg-gray-50 border-gray-200'}`}>
          <p className="text-2xl font-bold text-red-600">{activeAlerts.length}</p>
          <p className="text-xs text-gray-500">Идэвхтэй анхааруулга</p>
        </div>
        <div className="rounded-xl border p-4 bg-green-50 border-green-200">
          <p className="text-2xl font-bold text-green-600">{resolvedAlerts.length}</p>
          <p className="text-xs text-gray-500">Шийдвэрлэсэн</p>
        </div>
      </div>

      <button onClick={() => setShowForm(!showForm)}
        className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 mb-4">
        🚨 Яаралтай мэдэгдэл илгээх
      </button>

      {/* Form */}
      {showForm && (
        <div className="bg-white border-2 border-red-200 rounded-xl p-4 mb-4">
          <h3 className="font-semibold text-sm mb-3 text-red-700">🚨 Шинэ яаралтай мэдэгдэл</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <select value={formType} onChange={e => setFormType(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm">
                {typeOptions.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
              </select>
              <div className="flex gap-1">
                {severityOptions.map(s => (
                  <button key={s.value} onClick={() => setFormSeverity(s.value)}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium border transition ${
                      formSeverity === s.value ? s.color + ' border-2' : 'bg-gray-50 text-gray-400'
                    }`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <input placeholder="Гарчиг (жнь: 5-р давхарт ус алдаж байна)" value={formTitle}
              onChange={e => setFormTitle(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
            <textarea placeholder="Дэлгэрэнгүй мэдээлэл..." value={formDesc}
              onChange={e => setFormDesc(e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" />
            <div className="flex gap-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border text-sm">Цуцлах</button>
              <button onClick={sendAlert} disabled={saving || !formTitle}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm disabled:opacity-50">
                {saving ? '...' : '🚨 Илгээх'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active alerts */}
      {activeAlerts.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-red-600 mb-2">🔴 ИДЭВХТЭЙ</h2>
          <div className="space-y-3 mb-6">
            {activeAlerts.map(a => {
              const t = getType(a.type);
              const s = getSeverity(a.severity);
              return (
                <div key={a.id} className={`border-2 rounded-xl p-4 ${s.color}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl">{t.icon}</span>
                        <h3 className="font-bold text-sm">{a.title}</h3>
                        <span className="text-xs font-bold">{s.label}</span>
                      </div>
                      {a.description && <p className="text-sm mt-1">{a.description}</p>}
                      <p className="text-xs mt-2 opacity-70">{new Date(a.created_at).toLocaleString('mn-MN')}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => resolveAlert(a.id)}
                        className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium">
                        ✅ Шийдвэрлэсэн
                      </button>
                      <button onClick={() => deleteAlert(a.id)} className="text-xs text-red-500 hover:underline">Устгах</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Resolved */}
      <h2 className="text-sm font-semibold text-gray-500 mb-2">ШИЙДВЭРЛЭСЭН</h2>
      {loading ? (
        <p className="text-gray-400 text-center py-8">Ачаалж байна...</p>
      ) : (
        <div className="space-y-2">
          {resolvedAlerts.map(a => {
            const t = getType(a.type);
            return (
              <div key={a.id} className="bg-white border rounded-xl p-3 opacity-70">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span>{t.icon}</span>
                    <span className="text-sm">{a.title}</span>
                    <span className="text-xs text-green-600">✅</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{new Date(a.created_at).toLocaleDateString('mn-MN')}</span>
                    <button onClick={() => deleteAlert(a.id)} className="text-xs text-red-400 hover:underline">Устгах</button>
                  </div>
                </div>
              </div>
            );
          })}
          {resolvedAlerts.length === 0 && !activeAlerts.length && (
            <p className="text-gray-400 text-center py-8">Мэдэгдэл байхгүй</p>
          )}
        </div>
      )}
    </div>
  );
}
