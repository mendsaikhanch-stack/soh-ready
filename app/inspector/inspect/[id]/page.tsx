'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';
import { adminFrom } from '@/app/lib/admin-db';

interface Inspection { id: number; apartment: string; resident_id: number; sokh_id: number; status: string; notes: string; gps_lat: number; gps_lng: number; }
interface Resident { id: number; name: string; phone: string; apartment: string; debt: number; }

const utilityTypes = [
  { value: 'electricity', label: 'Цахилгаан', icon: '⚡', unit: 'кВт/ц' },
  { value: 'water', label: 'Ус', icon: '💧', unit: 'м³' },
  { value: 'heating', label: 'Дулаан', icon: '🔥', unit: 'Гкал' },
];

const violationTypes = [
  { value: 'illegal_connection', label: 'Хууль бус холболт', icon: '🔌' },
  { value: 'meter_tamper', label: 'Тоолуур эвдрэл', icon: '🔧' },
  { value: 'seal_broken', label: 'Лац задарсан', icon: '🔓' },
  { value: 'other', label: 'Бусад', icon: '⚠️' },
];

export default function InspectPage() {
  const params = useParams();
  const router = useRouter();
  const inspectionId = Number(params.id);

  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [resident, setResident] = useState<Resident | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'reading' | 'violation' | 'notes'>('reading');

  // Заалт
  const [readings, setReadings] = useState<Record<string, { prev: number; current: string; photo: string }>>({
    electricity: { prev: 0, current: '', photo: '' },
    water: { prev: 0, current: '', photo: '' },
    heating: { prev: 0, current: '', photo: '' },
  });

  // Зөрчил
  const [vType, setVType] = useState('meter_tamper');
  const [vDesc, setVDesc] = useState('');
  const [vSeverity, setVSeverity] = useState('medium');
  const [violations, setViolations] = useState<any[]>([]);

  // Тэмдэглэл
  const [notes, setNotes] = useState('');
  const [result, setResult] = useState('');

  useEffect(() => {
    fetchData();
    captureGPS();
  }, [inspectionId]);

  const fetchData = async () => {
    const { data: insp } = await supabase
      .from('inspections')
      .select('*')
      .eq('id', inspectionId)
      .single();

    if (!insp) { setLoading(false); return; }
    setInspection(insp);
    setNotes(insp.notes || '');

    // Оршин суугч
    if (insp.resident_id) {
      const { data: res } = await supabase.from('residents').select('*').eq('id', insp.resident_id).single();
      if (res) setResident(res);
    }

    // Өмнөх заалтууд
    if (insp.resident_id) {
      const prevReadings = { ...readings };
      for (const ut of utilityTypes) {
        const { data: prev } = await supabase
          .from('meter_readings')
          .select('current_reading')
          .eq('resident_id', insp.resident_id)
          .eq('utility_type', ut.value)
          .order('year', { ascending: false })
          .order('month', { ascending: false })
          .limit(1);
        if (prev && prev.length > 0) {
          prevReadings[ut.value] = { ...prevReadings[ut.value], prev: Number(prev[0].current_reading) };
        }
      }
      setReadings(prevReadings);
    }

    // Зөрчлүүд
    const { data: viols } = await supabase
      .from('inspection_violations')
      .select('*')
      .eq('inspection_id', inspectionId);
    setViolations(viols || []);

    // Эхлэх
    if (insp.status === 'pending') {
      await adminFrom('inspections').update({ status: 'in_progress', started_at: new Date().toISOString() }).eq('id', inspectionId);
    }

    setLoading(false);
  };

  const captureGPS = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        await adminFrom('inspections').update({
          gps_lat: pos.coords.latitude,
          gps_lng: pos.coords.longitude,
        }).eq('id', inspectionId);
      }, () => {});
    }
  };

  const saveReadings = async () => {
    if (!inspection) return;
    setSaving(true);

    const month = new Date().getMonth() + 1;
    const year = new Date().getFullYear();

    for (const ut of utilityTypes) {
      const r = readings[ut.value];
      if (!r.current) continue;

      // meter_readings руу бичнэ (оршин суугчийн нэр дээр)
      const { data: existing } = await supabase
        .from('meter_readings')
        .select('id')
        .eq('resident_id', inspection.resident_id)
        .eq('utility_type', ut.value)
        .eq('year', year)
        .eq('month', month)
        .limit(1);

      const record = {
        sokh_id: inspection.sokh_id,
        resident_id: inspection.resident_id,
        apartment: inspection.apartment,
        utility_type: ut.value,
        previous_reading: r.prev,
        current_reading: Number(r.current),
        year, month,
      };

      if (existing && existing.length > 0) {
        await adminFrom('meter_readings').update({ previous_reading: r.prev, current_reading: Number(r.current) }).eq('id', existing[0].id);
      } else {
        await adminFrom('meter_readings').insert([record]);
      }

      // inspection_readings руу бас бичнэ
      await adminFrom('inspection_readings').insert([{
        inspection_id: inspectionId,
        resident_id: inspection.resident_id,
        utility_type: ut.value,
        previous_reading: r.prev,
        current_reading: Number(r.current),
        photo_url: r.photo || null,
      }]);
    }

    setResult('Заалт хадгалагдлаа!');
    setSaving(false);
  };

  const addViolation = async () => {
    if (!vDesc) return;
    setSaving(true);
    await adminFrom('inspection_violations').insert([{
      inspection_id: inspectionId,
      violation_type: vType,
      description: vDesc,
      severity: vSeverity,
    }]);
    setVDesc('');
    const { data } = await supabase.from('inspection_violations').select('*').eq('inspection_id', inspectionId);
    setViolations(data || []);
    setSaving(false);
  };

  const completeInspection = async () => {
    await adminFrom('inspections').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      notes,
    }).eq('id', inspectionId);
    setResult('Шалгалт дуусгалаа!');
    setTimeout(() => router.push('/inspector/route'), 1000);
  };

  if (loading) return <div className="p-4 text-center text-gray-400">Ачаалж байна...</div>;
  if (!inspection) return <div className="p-4 text-center text-gray-400">Шалгалт олдсонгүй</div>;

  return (
    <div className="px-4 py-4">
      {/* Header */}
      <button onClick={() => router.push('/inspector/route')} className="text-indigo-600 text-sm mb-2">← Маршрут</button>

      <div className="bg-white rounded-xl border p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-bold">Тоот {inspection.apartment}</p>
            {resident && <p className="text-sm text-gray-500">{resident.name} • {resident.phone}</p>}
          </div>
          <span className={`px-2 py-1 rounded-full text-xs ${
            inspection.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
          }`}>
            {inspection.status === 'completed' ? 'Дууссан' : 'Явагдаж байна'}
          </span>
        </div>
        {resident && resident.debt > 0 && (
          <div className="mt-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <p className="text-xs text-red-600">Өр: <span className="font-bold">{resident.debt.toLocaleString()}₮</span></p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4">
        {[
          { key: 'reading' as const, label: '📊 Заалт' },
          { key: 'violation' as const, label: '⚠️ Зөрчил' },
          { key: 'notes' as const, label: '📝 Тэмдэглэл' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium ${tab === t.key ? 'bg-white shadow-sm' : 'text-gray-500'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Заалт tab */}
      {tab === 'reading' && (
        <div className="space-y-3">
          {utilityTypes.map(ut => {
            const r = readings[ut.value];
            return (
              <div key={ut.value} className="bg-white rounded-xl border p-3">
                <p className="text-sm font-semibold mb-2">{ut.icon} {ut.label}</p>
                <div className="flex items-center gap-2 text-sm mb-1">
                  <span className="text-gray-500">Өмнөх:</span>
                  <span className="font-medium">{r.prev} {ut.unit}</span>
                </div>
                <div className="flex gap-2">
                  <input type="number" placeholder={`Одоогийн (${ut.unit})`} inputMode="decimal"
                    value={r.current}
                    onChange={e => setReadings(prev => ({ ...prev, [ut.value]: { ...prev[ut.value], current: e.target.value } }))}
                    className="flex-1 border rounded-xl px-3 py-2.5 text-sm" />
                  <label className="flex items-center justify-center w-11 h-11 bg-gray-100 rounded-xl cursor-pointer active:bg-gray-200">
                    <span>📷</span>
                    <input type="file" accept="image/*" capture="environment" className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const url = URL.createObjectURL(file);
                          setReadings(prev => ({ ...prev, [ut.value]: { ...prev[ut.value], photo: url } }));
                        }
                      }} />
                  </label>
                </div>
                {r.current && Number(r.current) > r.prev && (
                  <p className="text-xs text-gray-500 mt-1">Хэрэглээ: <span className="font-bold">{(Number(r.current) - r.prev).toFixed(1)} {ut.unit}</span></p>
                )}
                {r.photo && <img src={r.photo} alt="meter" className="w-full h-32 object-cover rounded-lg mt-2" />}
              </div>
            );
          })}
          <button onClick={saveReadings} disabled={saving}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium active:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Хадгалж байна...' : 'Заалт хадгалах'}
          </button>
        </div>
      )}

      {/* Зөрчил tab */}
      {tab === 'violation' && (
        <div>
          {/* Бүртгэгдсэн */}
          {violations.length > 0 && (
            <div className="mb-4 space-y-2">
              {violations.map(v => (
                <div key={v.id} className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <div className="flex items-center gap-2">
                    <span>{violationTypes.find(t => t.value === v.violation_type)?.icon || '⚠️'}</span>
                    <p className="text-sm font-medium">{violationTypes.find(t => t.value === v.violation_type)?.label}</p>
                    <span className={`ml-auto px-2 py-0.5 rounded-full text-[10px] ${
                      v.severity === 'high' ? 'bg-red-200 text-red-800' :
                      v.severity === 'critical' ? 'bg-red-300 text-red-900' :
                      'bg-yellow-200 text-yellow-800'
                    }`}>{v.severity}</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{v.description}</p>
                </div>
              ))}
            </div>
          )}

          {/* Шинэ зөрчил */}
          <div className="bg-white rounded-xl border p-4 space-y-3">
            <p className="text-sm font-semibold">Шинэ зөрчил</p>
            <div className="grid grid-cols-2 gap-2">
              {violationTypes.map(t => (
                <button key={t.value} onClick={() => setVType(t.value)}
                  className={`p-2 rounded-lg text-xs text-left ${vType === t.value ? 'bg-indigo-100 border-2 border-indigo-400' : 'bg-gray-50 border'}`}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
            <select value={vSeverity} onChange={e => setVSeverity(e.target.value)}
              className="w-full border rounded-xl px-3 py-2 text-sm">
              <option value="low">Бага</option>
              <option value="medium">Дунд</option>
              <option value="high">Өндөр</option>
              <option value="critical">Яаралтай</option>
            </select>
            <textarea placeholder="Тайлбар..." value={vDesc} onChange={e => setVDesc(e.target.value)}
              className="w-full border rounded-xl px-3 py-2 text-sm h-20 resize-none" />
            <button onClick={addViolation} disabled={saving || !vDesc}
              className="w-full py-3 bg-red-600 text-white rounded-xl font-medium disabled:opacity-50">
              {saving ? '...' : 'Зөрчил бүртгэх'}
            </button>
          </div>
        </div>
      )}

      {/* Тэмдэглэл tab */}
      {tab === 'notes' && (
        <div className="space-y-3">
          <textarea placeholder="Шалгалтын тэмдэглэл..." value={notes} onChange={e => setNotes(e.target.value)}
            className="w-full bg-white border rounded-xl px-4 py-3 text-sm h-40 resize-none" />
          <button onClick={completeInspection}
            className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold active:bg-green-700">
            ✅ Шалгалт дуусгах
          </button>
        </div>
      )}

      {result && (
        <div className="mt-4 bg-green-50 border border-green-200 text-green-700 p-3 rounded-xl text-sm text-center">
          {result}
        </div>
      )}
    </div>
  );
}
