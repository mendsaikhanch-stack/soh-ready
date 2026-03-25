'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { adminFrom } from '@/app/lib/admin-db';

interface Tariff {
  id: number;
  sokh_id: number;
  utility_type: string;
  rate_per_unit: number;
  unit: string;
  effective_from: string;
  effective_to: string | null;
}

interface Org { id: number; name: string; }

const utilityTypes = [
  { value: 'water', label: 'Ус', icon: '💧', unit: 'м³' },
  { value: 'heating', label: 'Дулаан', icon: '🔥', unit: 'Гкал' },
  { value: 'electricity', label: 'Цахилгаан', icon: '⚡', unit: 'кВт/ц' },
];

export default function OsnaaTariffs() {
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState('all');

  // Form
  const [fSokhId, setFSokhId] = useState('');
  const [fType, setFType] = useState('water');
  const [fRate, setFRate] = useState('');
  const [fFrom, setFFrom] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const [{ data: t }, { data: o }] = await Promise.all([
      supabase.from('utility_tariffs').select('*').order('effective_from', { ascending: false }),
      supabase.from('sokh_organizations').select('id, name').order('name'),
    ]);
    setTariffs(t || []);
    setOrgs(o || []);
    if (o && o.length > 0 && !fSokhId) setFSokhId(String(o[0].id));
    setLoading(false);
  };

  const addTariff = async () => {
    if (!fRate || !fSokhId) return;
    setSaving(true);
    const ut = utilityTypes.find(u => u.value === fType)!;
    await adminFrom('utility_tariffs').insert([{
      sokh_id: Number(fSokhId),
      utility_type: fType,
      rate_per_unit: Number(fRate),
      unit: ut.unit,
      effective_from: fFrom,
    }]);
    setFRate('');
    setShowForm(false);
    setSaving(false);
    await fetchData();
  };

  const deleteTariff = async (id: number) => {
    if (!confirm('Устгах уу?')) return;
    await adminFrom('utility_tariffs').delete().eq('id', id);
    await fetchData();
  };

  const filtered = filterType === 'all' ? tariffs : tariffs.filter(t => t.utility_type === filterType);
  const getOrg = (id: number) => orgs.find(o => o.id === id)?.name || `#${id}`;
  const getType = (t: string) => utilityTypes.find(u => u.value === t) || utilityTypes[0];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">💰 Тариф удирдлага</h1>

      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => setShowForm(!showForm)}
          className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700">
          + Тариф нэмэх
        </button>

        <div className="flex gap-2 ml-auto">
          <button onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg text-sm ${filterType === 'all' ? 'bg-amber-600 text-white' : 'bg-gray-100'}`}>
            Бүгд
          </button>
          {utilityTypes.map(t => (
            <button key={t.value} onClick={() => setFilterType(t.value)}
              className={`px-3 py-1.5 rounded-lg text-sm ${filterType === t.value ? 'bg-amber-600 text-white' : 'bg-gray-100'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {showForm && (
        <div className="bg-white border rounded-xl p-4 mb-4">
          <div className="grid grid-cols-5 gap-3">
            <select value={fSokhId} onChange={e => setFSokhId(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm">
              {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <select value={fType} onChange={e => setFType(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm">
              {utilityTypes.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
            </select>
            <input type="number" placeholder={`Нэгж үнэ (₮/${getType(fType).unit})`} value={fRate}
              onChange={e => setFRate(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
            <input type="date" value={fFrom} onChange={e => setFFrom(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm" />
            <div className="flex gap-2">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-lg border text-sm">Цуцлах</button>
              <button onClick={addTariff} disabled={saving || !fRate}
                className="flex-1 py-2 rounded-lg bg-amber-600 text-white text-sm disabled:opacity-50">
                {saving ? '...' : 'Нэмэх'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-gray-400 text-center py-8">Ачаалж байна...</p>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs text-gray-500">СӨХ</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500">Төрөл</th>
                <th className="px-4 py-3 text-right text-xs text-gray-500">Нэгж үнэ</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500">Эхлэх огноо</th>
                <th className="px-4 py-3 text-right text-xs text-gray-500"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => {
                const ut = getType(t.utility_type);
                return (
                  <tr key={t.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3">{getOrg(t.sokh_id)}</td>
                    <td className="px-4 py-3">{ut.icon} {ut.label}</td>
                    <td className="px-4 py-3 text-right font-medium">{Number(t.rate_per_unit).toLocaleString()}₮/{t.unit}</td>
                    <td className="px-4 py-3">{t.effective_from}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => deleteTariff(t.id)} className="text-red-400 text-xs hover:underline">Устгах</button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Тариф байхгүй</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
