'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { getAdminSokhId } from '@/app/lib/admin-config';

interface Usage {
  id: number;
  sokh_id: number;
  type: string;
  amount: number;
  cost: number;
  month: number;
  year: number;
}

const typeOptions = [
  { value: 'electricity', label: 'Цахилгаан', icon: '⚡', unit: 'кВт/ц' },
  { value: 'water', label: 'Ус', icon: '💧', unit: 'м³' },
  { value: 'heating', label: 'Дулаан', icon: '🔥', unit: 'Гкал' },
];

const months = ['1-р сар','2-р сар','3-р сар','4-р сар','5-р сар','6-р сар','7-р сар','8-р сар','9-р сар','10-р сар','11-р сар','12-р сар'];

export default function AdminUtilities() {
  const [usages, setUsages] = useState<Usage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());

  // Form
  const [formType, setFormType] = useState('electricity');
  const [formMonth, setFormMonth] = useState(new Date().getMonth() + 1);
  const [formYear, setFormYear] = useState(new Date().getFullYear());
  const [formAmount, setFormAmount] = useState('');
  const [formCost, setFormCost] = useState('');

  useEffect(() => { fetchUsages(); }, [filterYear]);

  const fetchUsages = async () => {
    const { data } = await supabase
      .from('utility_usage')
      .select('*')
      .eq('year', filterYear)
      .order('month', { ascending: false });

    setUsages(data || []);
    setLoading(false);
  };

  const addUsage = async () => {
    if (!formAmount || !formCost) return;
    setSaving(true);

    const sokhId = await getAdminSokhId();
    await supabase.from('utility_usage').insert([{
      sokh_id: sokhId,
      type: formType,
      amount: Number(formAmount),
      cost: Number(formCost),
      month: formMonth,
      year: formYear,
    }]);

    setFormAmount('');
    setFormCost('');
    setShowForm(false);
    setSaving(false);
    await fetchUsages();
  };

  const deleteUsage = async (id: number) => {
    if (!confirm('Устгах уу?')) return;
    await supabase.from('utility_usage').delete().eq('id', id);
    await fetchUsages();
  };

  const filtered = filterType === 'all' ? usages : usages.filter(u => u.type === filterType);
  const getType = (t: string) => typeOptions.find(o => o.value === t) || typeOptions[0];

  // Summary stats
  const totalCost = usages.reduce((s, u) => s + u.cost, 0);
  const typeTotals = typeOptions.map(t => ({
    ...t,
    total: usages.filter(u => u.type === t.value).reduce((s, u) => s + u.cost, 0),
  }));

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">📊 Ашиглалтын түүх</h1>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="rounded-xl border p-4 bg-gray-50">
          <p className="text-xl font-bold">{totalCost.toLocaleString()}₮</p>
          <p className="text-xs text-gray-500">Нийт зардал ({filterYear})</p>
        </div>
        {typeTotals.map(t => (
          <div key={t.value} className="rounded-xl border p-4 bg-gray-50">
            <p className="text-xl font-bold">{t.icon} {t.total.toLocaleString()}₮</p>
            <p className="text-xs text-gray-500">{t.label}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => setShowForm(!showForm)}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700">
          + Мэдээлэл нэмэх
        </button>

        <div className="flex gap-2 ml-auto">
          <button onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg text-sm ${filterType === 'all' ? 'bg-emerald-600 text-white' : 'bg-gray-100'}`}>
            Бүгд
          </button>
          {typeOptions.map(t => (
            <button key={t.value} onClick={() => setFilterType(t.value)}
              className={`px-3 py-1.5 rounded-lg text-sm ${filterType === t.value ? 'bg-emerald-600 text-white' : 'bg-gray-100'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setFilterYear(y => y - 1)} className="px-2 py-1 bg-gray-100 rounded text-sm">←</button>
          <span className="font-medium">{filterYear}</span>
          <button onClick={() => setFilterYear(y => y + 1)} className="px-2 py-1 bg-gray-100 rounded text-sm">→</button>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-white border rounded-xl p-4 mb-4">
          <div className="grid grid-cols-5 gap-3">
            <select value={formType} onChange={e => setFormType(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm">
              {typeOptions.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
            </select>
            <select value={formMonth} onChange={e => setFormMonth(Number(e.target.value))}
              className="border rounded-lg px-3 py-2 text-sm">
              {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <input type="number" placeholder={`Хэмжээ (${getType(formType).unit})`} value={formAmount}
              onChange={e => setFormAmount(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
            <input type="number" placeholder="Зардал (₮)" value={formCost}
              onChange={e => setFormCost(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
            <div className="flex gap-2">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-lg border text-sm">Цуцлах</button>
              <button onClick={addUsage} disabled={saving || !formAmount || !formCost}
                className="flex-1 py-2 rounded-lg bg-emerald-600 text-white text-sm disabled:opacity-50">
                {saving ? '...' : 'Нэмэх'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <p className="text-gray-400 text-center py-8">Ачаалж байна...</p>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs text-gray-500">Төрөл</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500">Сар</th>
                <th className="px-4 py-3 text-right text-xs text-gray-500">Хэмжээ</th>
                <th className="px-4 py-3 text-right text-xs text-gray-500">Зардал</th>
                <th className="px-4 py-3 text-right text-xs text-gray-500"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => {
                const t = getType(u.type);
                return (
                  <tr key={u.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3">{t.icon} {t.label}</td>
                    <td className="px-4 py-3">{months[u.month - 1]}</td>
                    <td className="px-4 py-3 text-right">{u.amount} {t.unit}</td>
                    <td className="px-4 py-3 text-right font-medium">{u.cost.toLocaleString()}₮</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => deleteUsage(u.id)} className="text-red-400 text-xs hover:underline">Устгах</button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Мэдээлэл байхгүй</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
