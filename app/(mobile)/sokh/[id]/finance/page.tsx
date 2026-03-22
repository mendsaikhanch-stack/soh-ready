'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';

interface BudgetItem {
  id: number;
  category: string;
  amount: number;
  month: number;
  year: number;
  description: string;
}

const categoryMap: Record<string, { label: string; icon: string; color: string }> = {
  cleaning: { label: 'Цэвэрлэгээ', icon: '🧹', color: '#3B82F6' },
  elevator: { label: 'Лифт', icon: '🛗', color: '#8B5CF6' },
  security: { label: 'Харуул', icon: '💂', color: '#EF4444' },
  repair: { label: 'Засвар', icon: '🔧', color: '#F59E0B' },
  electricity: { label: 'Цахилгаан', icon: '⚡', color: '#10B981' },
  water: { label: 'Ус', icon: '💧', color: '#06B6D4' },
  heating: { label: 'Дулаан', icon: '🔥', color: '#F97316' },
  garden: { label: 'Тохижилт', icon: '🌳', color: '#22C55E' },
  reserve: { label: 'Нөөц сан', icon: '🏦', color: '#6366F1' },
  insurance: { label: 'Даатгал', icon: '🛡', color: '#EC4899' },
  other: { label: 'Бусад', icon: '📋', color: '#9CA3AF' },
};

const months = ['1-р сар','2-р сар','3-р сар','4-р сар','5-р сар','6-р сар','7-р сар','8-р сар','9-р сар','10-р сар','11-р сар','12-р сар'];

export default function FinancePage() {
  const params = useParams();
  const router = useRouter();
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [monthlyFee, setMonthlyFee] = useState(50000);

  useEffect(() => {
    fetchItems();
  }, [params.id, selectedMonth, selectedYear]);

  const fetchItems = async () => {
    const { data } = await supabase
      .from('budget_items')
      .select('*')
      .eq('sokh_id', params.id)
      .eq('month', selectedMonth)
      .eq('year', selectedYear)
      .order('amount', { ascending: false });
    setItems(data || []);

    const { data: org } = await supabase.from('sokh_organizations').select('monthly_fee').eq('id', params.id).single();
    if (org?.monthly_fee) setMonthlyFee(org.monthly_fee);
    setLoading(false);
  };

  const total = items.reduce((s, i) => s + i.amount, 0);
  const getCat = (c: string) => categoryMap[c] || categoryMap.other;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-cyan-700 text-white px-4 py-4">
        <button onClick={() => router.push(`/sokh/${params.id}`)} className="text-white/80 text-sm mb-1">← Буцах</button>
        <h1 className="text-lg font-bold">💰 Санхүүгийн ил тод тайлан</h1>
      </div>

      <div className="px-4 py-4">
        {/* Your fee breakdown */}
        <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
          <p className="text-xs text-gray-500 mb-1">Таны сарын төлбөр</p>
          <p className="text-2xl font-bold text-cyan-700">{monthlyFee.toLocaleString()}₮</p>
          {items.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {items.map(item => {
                const cat = getCat(item.category);
                const pct = total > 0 ? (item.amount / total * 100) : 0;
                return (
                  <div key={item.id}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span>{cat.icon} {cat.label}</span>
                      <span className="font-medium">{item.amount.toLocaleString()}₮ ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: cat.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Month selector */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => {
            if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(y => y - 1); }
            else setSelectedMonth(m => m - 1);
          }} className="px-3 py-1.5 bg-white rounded-lg border text-sm">←</button>
          <span className="font-bold">{selectedYear} · {months[selectedMonth - 1]}</span>
          <button onClick={() => {
            if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(y => y + 1); }
            else setSelectedMonth(m => m + 1);
          }} className="px-3 py-1.5 bg-white rounded-lg border text-sm">→</button>
        </div>

        {/* Pie-like summary */}
        <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold text-gray-500">ЗАРДЛЫН ЗАДАРГАА</h3>
            <span className="font-bold text-cyan-700">{total.toLocaleString()}₮</span>
          </div>
          {loading ? (
            <p className="text-gray-400 text-center py-4">Ачаалж байна...</p>
          ) : items.length === 0 ? (
            <p className="text-gray-400 text-center py-4">Мэдээлэл байхгүй</p>
          ) : (
            <div className="space-y-2">
              {items.map(item => {
                const cat = getCat(item.category);
                return (
                  <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-lg" style={{ backgroundColor: cat.color + '20' }}>
                      {cat.icon}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{cat.label}</p>
                      {item.description && <p className="text-xs text-gray-500">{item.description}</p>}
                    </div>
                    <span className="font-semibold text-sm">{item.amount.toLocaleString()}₮</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
