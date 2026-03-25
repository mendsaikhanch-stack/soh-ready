'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { adminFrom } from '@/app/lib/admin-db';
import { useInspector } from '../layout';

interface Resident { id: number; name: string; apartment: string; }
interface Org { id: number; name: string; }

const utilityTypes = [
  { value: 'water', label: 'Ус', icon: '💧', unit: 'м³' },
  { value: 'electricity', label: 'Цахилгаан', icon: '⚡', unit: 'кВт/ц' },
  { value: 'heating', label: 'Дулаан', icon: '🔥', unit: 'Гкал' },
];

export default function InspectorReadings() {
  const inspector = useInspector();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState('');

  const [selectedOrg, setSelectedOrg] = useState('');
  const [selectedType, setSelectedType] = useState('electricity');
  const [entries, setEntries] = useState<Record<number, string>>({});

  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();

  useEffect(() => {
    const fetch = async () => {
      // Байцаагчийн даалгаварт байгаа СӨХ-үүд
      if (!inspector?.id) { setLoading(false); return; }
      const today = new Date().toISOString().split('T')[0];
      const { data: assigns } = await supabase
        .from('inspector_assignments')
        .select('sokh_id')
        .eq('inspector_id', inspector.id)
        .eq('assigned_date', today);

      const sokhIds = (assigns || []).map(a => a.sokh_id);
      if (sokhIds.length > 0) {
        const { data: o } = await supabase.from('sokh_organizations').select('id, name').in('id', sokhIds);
        setOrgs(o || []);
        if (o && o.length > 0) setSelectedOrg(String(o[0].id));
      }
      setLoading(false);
    };
    fetch();
  }, [inspector]);

  useEffect(() => {
    if (selectedOrg) fetchResidents();
  }, [selectedOrg]);

  const fetchResidents = async () => {
    const { data } = await supabase.from('residents').select('id, name, apartment').eq('sokh_id', selectedOrg).order('apartment');
    setResidents(data || []);
    setEntries({});
  };

  const saveAll = async () => {
    const toSave = Object.entries(entries).filter(([, v]) => v !== '');
    if (toSave.length === 0) return;
    setSaving(true); setResult('');

    for (const [resIdStr, val] of toSave) {
      const residentId = Number(resIdStr);
      const res = residents.find(r => r.id === residentId);
      if (!res) continue;

      // Өмнөх заалт
      const { data: prev } = await supabase
        .from('meter_readings')
        .select('current_reading')
        .eq('resident_id', residentId)
        .eq('utility_type', selectedType)
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .limit(1);

      const prevVal = prev && prev.length > 0 ? Number(prev[0].current_reading) : 0;

      const { data: existing } = await supabase
        .from('meter_readings')
        .select('id')
        .eq('resident_id', residentId)
        .eq('utility_type', selectedType)
        .eq('year', year)
        .eq('month', month)
        .limit(1);

      if (existing && existing.length > 0) {
        await adminFrom('meter_readings').update({ previous_reading: prevVal, current_reading: Number(val) }).eq('id', existing[0].id);
      } else {
        await adminFrom('meter_readings').insert([{
          sokh_id: Number(selectedOrg),
          resident_id: residentId,
          apartment: res.apartment,
          utility_type: selectedType,
          previous_reading: prevVal,
          current_reading: Number(val),
          year, month,
        }]);
      }
    }

    setResult(`${toSave.length} заалт хадгалагдлаа!`);
    setSaving(false);
    setEntries({});
  };

  const ut = utilityTypes.find(u => u.value === selectedType)!;

  return (
    <div className="px-4 py-4">
      <h2 className="text-lg font-bold mb-4">📊 Заалт оруулах</h2>

      {/* Controls */}
      <div className="space-y-3 mb-4">
        {orgs.length > 0 && (
          <select value={selectedOrg} onChange={e => setSelectedOrg(e.target.value)}
            className="w-full border rounded-xl px-3 py-2.5 text-sm">
            {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}

        <div className="flex gap-2">
          {utilityTypes.map(t => (
            <button key={t.value} onClick={() => { setSelectedType(t.value); setEntries({}); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium ${
                selectedType === t.value ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-400' : 'bg-white border'
              }`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? <p className="text-gray-400 text-center py-8">Ачаалж байна...</p> : residents.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center border">
          <p className="text-gray-400">{orgs.length === 0 ? 'Даалгавар байхгүй' : 'Оршин суугч байхгүй'}</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border overflow-hidden mb-4">
            {residents.map(r => (
              <div key={r.id} className="flex items-center gap-2 px-3 py-2.5 border-b last:border-0">
                <span className="text-sm font-medium w-12">{r.apartment}</span>
                <span className="text-sm text-gray-500 flex-1 truncate">{r.name}</span>
                <input type="number" inputMode="decimal"
                  placeholder={ut.unit}
                  value={entries[r.id] || ''}
                  onChange={e => setEntries(prev => ({ ...prev, [r.id]: e.target.value }))}
                  className="w-24 border rounded-lg px-2 py-1.5 text-sm text-right" />
              </div>
            ))}
          </div>

          {Object.values(entries).some(v => v !== '') && (
            <button onClick={saveAll} disabled={saving}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium disabled:opacity-50">
              {saving ? 'Хадгалж байна...' : `Хадгалах (${Object.values(entries).filter(v => v !== '').length})`}
            </button>
          )}
        </>
      )}

      {result && (
        <div className="mt-3 bg-green-50 border border-green-200 text-green-700 p-3 rounded-xl text-sm text-center">{result}</div>
      )}
    </div>
  );
}
