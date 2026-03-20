'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';

interface Resident { id: number; name: string; apartment: string; debt: number; }
interface Payment { id: number; resident_id: number; amount: number; description: string; paid_at: string; }

export default function AdminPayments() {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedResident, setSelectedResident] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('Сарын төлбөр');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: res } = await supabase.from('residents').select('id,name,apartment,debt').order('apartment');
    setResidents(res || []);

    const { data: pay } = await supabase.from('payments').select('*').order('paid_at', { ascending: false }).limit(50);
    setPayments(pay || []);
    setLoading(false);
  };

  const recordPayment = async () => {
    if (!selectedResident || !amount) return;
    setSaving(true);

    const resId = Number(selectedResident);
    const amt = Number(amount);

    // Төлбөр бүртгэх
    await supabase.from('payments').insert([{
      resident_id: resId,
      amount: amt,
      description,
    }]);

    // Өр хасах
    const resident = residents.find(r => r.id === resId);
    if (resident) {
      const newDebt = Math.max(0, resident.debt - amt);
      await supabase.from('residents').update({ debt: newDebt }).eq('id', resId);
    }

    setShowForm(false);
    setAmount('');
    setSelectedResident('');
    setSaving(false);
    await fetchData();
  };

  const getResidentName = (id: number) => {
    const r = residents.find(r => r.id === id);
    return r ? `${r.name} (${r.apartment})` : 'Тодорхойгүй';
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">💰 Төлбөрийн удирдлага</h1>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
          + Төлбөр бүртгэх
        </button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">Нийт өртэй айл</p>
          <p className="text-2xl font-bold text-red-500">{residents.filter(r => r.debt > 0).length}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">Нийт өрийн дүн</p>
          <p className="text-2xl font-bold text-red-500">{residents.reduce((s, r) => s + r.debt, 0).toLocaleString()}₮</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">Энэ сарын цуглуулалт</p>
          <p className="text-2xl font-bold text-green-600">{payments.reduce((s, p) => s + Number(p.amount), 0).toLocaleString()}₮</p>
        </div>
      </div>

      {/* Payment form */}
      {showForm && (
        <div className="bg-white border rounded-xl p-4 mb-6">
          <h3 className="font-semibold mb-3">Төлбөр бүртгэх</h3>
          <div className="grid grid-cols-3 gap-3">
            <select
              value={selectedResident}
              onChange={e => setSelectedResident(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Оршин суугч сонгох...</option>
              {residents.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.apartment}) {r.debt > 0 ? `- Өр: ${r.debt.toLocaleString()}₮` : ''}
                </option>
              ))}
            </select>
            <input
              placeholder="Дүн (₮)"
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm"
            />
            <input
              placeholder="Тайлбар"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg text-sm">Цуцлах</button>
            <button onClick={recordPayment} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm disabled:opacity-50">
              {saving ? 'Бүртгэж байна...' : 'Бүртгэх'}
            </button>
          </div>
        </div>
      )}

      {/* Payments table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr className="text-left text-sm text-gray-500">
              <th className="px-4 py-3">Огноо</th>
              <th className="px-4 py-3">Оршин суугч</th>
              <th className="px-4 py-3">Тайлбар</th>
              <th className="px-4 py-3 text-right">Дүн</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Ачаалж байна...</td></tr>
            ) : payments.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Төлбөр бүртгэгдээгүй</td></tr>
            ) : payments.map(p => (
              <tr key={p.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3 text-sm">{new Date(p.paid_at).toLocaleDateString('mn-MN')}</td>
                <td className="px-4 py-3 text-sm">{getResidentName(p.resident_id)}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{p.description}</td>
                <td className="px-4 py-3 text-sm text-right font-semibold text-green-600">{Number(p.amount).toLocaleString()}₮</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
