'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';

export default function OsnaaDashboard() {
  const [stats, setStats] = useState({
    totalBills: 0,
    unpaidBills: 0,
    unpaidAmount: 0,
    paidAmount: 0,
    waterAmount: 0,
    heatingAmount: 0,
    electricityAmount: 0,
    totalReadings: 0,
  });
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  useEffect(() => {
    const fetchStats = async () => {
      // Энэ сарын нэхэмжлэхүүд
      const { data: bills } = await supabase
        .from('utility_bills')
        .select('*')
        .eq('year', currentYear)
        .eq('month', currentMonth);

      const allBills = bills || [];
      const unpaid = allBills.filter(b => b.status === 'unpaid');
      const paid = allBills.filter(b => b.status === 'paid');

      // Төрлөөр нийлбэр
      const byType = (type: string) => allBills.filter(b => b.utility_type === type).reduce((s, b) => s + Number(b.amount), 0);

      // Тоолуурын заалт тоо
      const { count: readingsCount } = await supabase
        .from('meter_readings')
        .select('*', { count: 'exact', head: true })
        .eq('year', currentYear)
        .eq('month', currentMonth);

      setStats({
        totalBills: allBills.length,
        unpaidBills: unpaid.length,
        unpaidAmount: unpaid.reduce((s, b) => s + Number(b.amount), 0),
        paidAmount: paid.reduce((s, b) => s + Number(b.amount), 0),
        waterAmount: byType('water'),
        heatingAmount: byType('heating'),
        electricityAmount: byType('electricity'),
        totalReadings: readingsCount || 0,
      });
      setLoading(false);
    };
    fetchStats();
  }, [currentMonth, currentYear]);

  if (loading) return <div className="p-8 text-gray-400">Ачаалж байна...</div>;

  const cards = [
    { label: 'Нийт нэхэмжлэх', value: stats.totalBills, icon: '🧾', color: 'bg-blue-50 border-blue-200 text-blue-700' },
    { label: 'Төлөгдөөгүй', value: stats.unpaidBills, icon: '⚠️', color: 'bg-red-50 border-red-200 text-red-700' },
    { label: 'Төлөгдөөгүй дүн', value: `${stats.unpaidAmount.toLocaleString()}₮`, icon: '💸', color: 'bg-red-50 border-red-200 text-red-700' },
    { label: 'Цуглуулсан', value: `${stats.paidAmount.toLocaleString()}₮`, icon: '💰', color: 'bg-green-50 border-green-200 text-green-700' },
    { label: 'Ус', value: `${stats.waterAmount.toLocaleString()}₮`, icon: '💧', color: 'bg-cyan-50 border-cyan-200 text-cyan-700' },
    { label: 'Дулаан', value: `${stats.heatingAmount.toLocaleString()}₮`, icon: '🔥', color: 'bg-orange-50 border-orange-200 text-orange-700' },
    { label: 'Цахилгаан', value: `${stats.electricityAmount.toLocaleString()}₮`, icon: '⚡', color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
    { label: 'Тоолуур заалт', value: stats.totalReadings, icon: '📊', color: 'bg-purple-50 border-purple-200 text-purple-700' },
  ];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-2">📊 ОСНААК Хянах самбар</h1>
      <p className="text-gray-500 text-sm mb-6">{currentYear} оны {currentMonth}-р сар</p>

      <div className="grid grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className={`rounded-xl border p-4 ${c.color}`}>
            <div className="flex items-center justify-between">
              <span className="text-2xl">{c.icon}</span>
              <span className="text-2xl font-bold">{c.value}</span>
            </div>
            <p className="text-sm mt-2 opacity-80">{c.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
