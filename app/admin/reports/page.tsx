'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';

export default function AdminReports() {
  const [residents, setResidents] = useState<{ name: string; apartment: string; debt: number }[]>([]);
  const [payments, setPayments] = useState<{ amount: number; paid_at: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data: res } = await supabase.from('residents').select('name,apartment,debt').order('debt', { ascending: false });
      setResidents(res || []);

      const { data: pay } = await supabase.from('payments').select('amount,paid_at').order('paid_at', { ascending: false });
      setPayments(pay || []);
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) return <div className="p-8 text-gray-400">Ачаалж байна...</div>;

  const totalDebt = residents.reduce((s, r) => s + Number(r.debt), 0);
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
  const collectionRate = totalDebt + totalPaid > 0 ? Math.round((totalPaid / (totalDebt + totalPaid)) * 100) : 0;
  const debtors = residents.filter(r => r.debt > 0).sort((a, b) => b.debt - a.debt);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">📋 Санхүүгийн тайлан</h1>

      {/* Overview */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">Нийт цуглуулсан</p>
          <p className="text-2xl font-bold text-green-600">{totalPaid.toLocaleString()}₮</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">Нийт өр</p>
          <p className="text-2xl font-bold text-red-500">{totalDebt.toLocaleString()}₮</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">Цуглуулалтын хувь</p>
          <p className="text-2xl font-bold text-blue-600">{collectionRate}%</p>
          <div className="w-full bg-gray-100 rounded-full h-2 mt-2">
            <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${collectionRate}%` }} />
          </div>
        </div>
      </div>

      {/* Debtors list */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-4 py-3 bg-red-50 border-b">
          <h2 className="font-semibold text-sm text-red-700">⚠️ Өртэй айлуудын жагсаалт ({debtors.length})</h2>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr className="text-left text-sm text-gray-500">
              <th className="px-4 py-2">№</th>
              <th className="px-4 py-2">Нэр</th>
              <th className="px-4 py-2">Тоот</th>
              <th className="px-4 py-2 text-right">Өр</th>
            </tr>
          </thead>
          <tbody>
            {debtors.map((r, i) => (
              <tr key={i} className="border-t">
                <td className="px-4 py-2 text-sm text-gray-400">{i + 1}</td>
                <td className="px-4 py-2 text-sm font-medium">{r.name}</td>
                <td className="px-4 py-2 text-sm">{r.apartment}</td>
                <td className="px-4 py-2 text-sm text-right text-red-500 font-semibold">{Number(r.debt).toLocaleString()}₮</td>
              </tr>
            ))}
            {debtors.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Өртэй айл байхгүй 🎉</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
