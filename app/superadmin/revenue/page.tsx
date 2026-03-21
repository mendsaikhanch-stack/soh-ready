'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';

export default function RevenuePage() {
  const [sokhs, setSokhs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('sokh_organizations').select('*');
      setSokhs(data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const plans = [
    { name: 'Үнэгүй', count: 2, price: 0 },
    { name: 'Стандарт', count: 4, price: 50000 },
    { name: 'Премиум', count: 0, price: 150000 },
  ];

  const monthlyTotal = plans.reduce((s, p) => s + p.count * p.price, 0);
  const months = [
    { month: '2026.01', amount: 150000 },
    { month: '2026.02', amount: 200000 },
    { month: '2026.03', amount: monthlyTotal },
  ];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-2">💵 Орлого</h1>
      <p className="text-gray-400 text-sm mb-6">Платформын орлогын мэдээлэл</p>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-2xl p-5">
          <p className="text-green-200 text-sm">Энэ сарын орлого</p>
          <p className="text-2xl font-bold mt-1">{monthlyTotal.toLocaleString()}₮</p>
        </div>
        <div className="bg-gray-800/50 border border-gray-800 rounded-2xl p-5">
          <p className="text-gray-400 text-sm">Жилийн төсөөлөл</p>
          <p className="text-2xl font-bold mt-1">{(monthlyTotal * 12).toLocaleString()}₮</p>
        </div>
        <div className="bg-gray-800/50 border border-gray-800 rounded-2xl p-5">
          <p className="text-gray-400 text-sm">Нэг СӨХ-ийн дундаж</p>
          <p className="text-2xl font-bold mt-1">{sokhs.length > 0 ? Math.round(monthlyTotal / sokhs.length).toLocaleString() : 0}₮</p>
        </div>
        <div className="bg-gray-800/50 border border-gray-800 rounded-2xl p-5">
          <p className="text-gray-400 text-sm">Төлбөртэй СӨХ</p>
          <p className="text-2xl font-bold mt-1">{plans[1].count + plans[2].count}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Багцын задаргаа */}
        <div className="bg-gray-800/50 border border-gray-800 rounded-2xl p-5">
          <h2 className="font-semibold mb-4">Багцын задаргаа</h2>
          <div className="space-y-4">
            {plans.map(p => (
              <div key={p.name} className="flex justify-between items-center">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-gray-500">{p.count} СӨХ × {p.price.toLocaleString()}₮</p>
                </div>
                <p className="font-semibold text-green-400">{(p.count * p.price).toLocaleString()}₮/сар</p>
              </div>
            ))}
          </div>
        </div>

        {/* Сарын орлого */}
        <div className="bg-gray-800/50 border border-gray-800 rounded-2xl p-5">
          <h2 className="font-semibold mb-4">Сарын орлогын динамик</h2>
          <div className="space-y-3">
            {months.map(m => (
              <div key={m.month}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">{m.month}</span>
                  <span>{m.amount.toLocaleString()}₮</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-3">
                  <div className="bg-green-500 h-3 rounded-full transition-all" style={{ width: `${(m.amount / monthlyTotal) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
