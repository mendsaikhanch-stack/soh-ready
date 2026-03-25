'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { adminFrom } from '@/app/lib/admin-db';
import { getAdminSokhId } from '@/app/lib/admin-config';

interface BudgetItem { id: number; category: string; amount: number; month: number; year: number; description: string; }

const categoryOptions = [
  { value: 'cleaning', label: 'Цэвэрлэгээ', icon: '🧹' },
  { value: 'elevator', label: 'Лифт', icon: '🛗' },
  { value: 'security', label: 'Харуул', icon: '💂' },
  { value: 'repair', label: 'Засвар', icon: '🔧' },
  { value: 'electricity', label: 'Цахилгаан', icon: '⚡' },
  { value: 'water', label: 'Ус', icon: '💧' },
  { value: 'heating', label: 'Дулаан', icon: '🔥' },
  { value: 'garden', label: 'Тохижилт', icon: '🌳' },
  { value: 'reserve', label: 'Нөөц сан', icon: '🏦' },
  { value: 'insurance', label: 'Даатгал', icon: '🛡' },
  { value: 'other', label: 'Бусад', icon: '📋' },
];

const months = ['1-р сар','2-р сар','3-р сар','4-р сар','5-р сар','6-р сар','7-р сар','8-р сар','9-р сар','10-р сар','11-р сар','12-р сар'];

export default function AdminFinance() {
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  const [fCat, setFCat] = useState('cleaning');
  const [fAmount, setFAmount] = useState('');
  const [fDesc, setFDesc] = useState('');

  useEffect(() => { fetch(); }, [month, year]);
  const fetch = async () => {
    const { data } = await supabase.from('budget_items').select('*').eq('month', month).eq('year', year).order('amount', { ascending: false });
    setItems(data || []); setLoading(false);
  };

  const add = async () => {
    if (!fAmount) return;
    setSaving(true);
    const sokhId = await getAdminSokhId();
    await adminFrom('budget_items').insert([{ sokh_id: sokhId, category: fCat, amount: Number(fAmount), month, year, description: fDesc }]);
    setFAmount(''); setFDesc(''); setShowForm(false); setSaving(false);
    await fetch();
  };

  const del = async (id: number) => {
    if (!confirm('Устгах уу?')) return;
    await adminFrom('budget_items').delete().eq('id', id);
    await fetch();
  };

  const total = items.reduce((s, i) => s + i.amount, 0);
  const getCat = (c: string) => categoryOptions.find(o => o.value === c) || categoryOptions[10];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">💰 Санхүүгийн ил тод тайлан</h1>

      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); }}
          className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm">←</button>
        <span className="font-bold text-lg">{year} · {months[month - 1]}</span>
        <button onClick={() => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); }}
          className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm">→</button>
        <span className="ml-auto text-xl font-bold text-cyan-700">Нийт: {total.toLocaleString()}₮</span>
      </div>

      <button onClick={() => setShowForm(!showForm)}
        className="bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-cyan-800 mb-4">
        + Зардал нэмэх
      </button>

      {showForm && (
        <div className="bg-white border rounded-xl p-4 mb-4">
          <div className="grid grid-cols-4 gap-3">
            <select value={fCat} onChange={e => setFCat(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
              {categoryOptions.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
            </select>
            <input type="number" placeholder="Дүн (₮)" value={fAmount} onChange={e => setFAmount(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm" />
            <input placeholder="Тайлбар" value={fDesc} onChange={e => setFDesc(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm" />
            <div className="flex gap-2">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-lg border text-sm">Цуцлах</button>
              <button onClick={add} disabled={saving || !fAmount}
                className="flex-1 py-2 rounded-lg bg-cyan-700 text-white text-sm disabled:opacity-50">{saving ? '...' : 'Нэмэх'}</button>
            </div>
          </div>
        </div>
      )}

      {loading ? <p className="text-gray-400 text-center py-8">Ачаалж байна...</p> : (
        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs text-gray-500">Ангилал</th>
                <th className="px-4 py-3 text-right text-xs text-gray-500">Дүн</th>
                <th className="px-4 py-3 text-right text-xs text-gray-500">Хувь</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500">Тайлбар</th>
                <th className="px-4 py-3 text-right text-xs text-gray-500"></th>
              </tr>
            </thead>
            <tbody>
              {items.map(i => {
                const c = getCat(i.category);
                const pct = total > 0 ? (i.amount / total * 100).toFixed(1) : '0';
                return (
                  <tr key={i.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3">{c.icon} {c.label}</td>
                    <td className="px-4 py-3 text-right font-medium">{i.amount.toLocaleString()}₮</td>
                    <td className="px-4 py-3 text-right text-gray-500">{pct}%</td>
                    <td className="px-4 py-3 text-gray-500">{i.description}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => del(i.id)} className="text-xs text-red-400 hover:underline">Устгах</button>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Зардал байхгүй</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
