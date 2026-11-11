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
  salary: { label: 'Ажилчдын цалин', icon: '👷', color: '#6366F1' },
  cleaning: { label: 'Нийтийн цэвэрлэгээ', icon: '🧹', color: '#3B82F6' },
  electricity: { label: 'Тог цахилгаан', icon: '⚡', color: '#F59E0B' },
  water: { label: 'Ус', icon: '💧', color: '#06B6D4' },
  heating: { label: 'Дулаан', icon: '🔥', color: '#F97316' },
  repair: { label: 'Засварын зардал', icon: '🔧', color: '#EF4444' },
  elevator: { label: 'Лифт засвар', icon: '🛗', color: '#8B5CF6' },
  garbage: { label: 'Хог ачуулалт', icon: '🗑️', color: '#22C55E' },
  supplies: { label: 'Материал, хэрэгсэл', icon: '🧰', color: '#A16207' },
  bank_fee: { label: 'Банкны шимтгэл', icon: '🏧', color: '#64748B' },
  sms: { label: 'Мсж / мэдэгдэл', icon: '💬', color: '#0D9488' },
  software: { label: 'Програм хангамж', icon: '💻', color: '#7C3AED' },
  security: { label: 'Хаалтны зардал', icon: '🚪', color: '#EC4899' },
  parking_income: { label: 'Зогсоолын орлого', icon: '🚗', color: '#10B981' },
  garden: { label: 'Тохижилт', icon: '🌳', color: '#22C55E' },
  reserve: { label: 'Нөөц сан', icon: '🏦', color: '#6366F1' },
  insurance: { label: 'Даатгал', icon: '🛡', color: '#EC4899' },
  other: { label: 'Бусад', icon: '📋', color: '#9CA3AF' },
};

const MONTHS = ['1-р сар','2-р сар','3-р сар','4-р сар','5-р сар','6-р сар','7-р сар','8-р сар','9-р сар','10-р сар','11-р сар','12-р сар'];

export default function ReportsPage() {
  const params = useParams();
  const router = useRouter();
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [orgName, setOrgName] = useState('');
  const [monthlyFee, setMonthlyFee] = useState(0);
  // Нийлбэрийг сервер бодно (/api/sokh-report): айлын тоо зөвхөн баталгаажсан
  // мөрөөр, орлого нь ТААМАГ биш — тухайн сард бодитоор орсон төлбөр.
  // (Өмнө нь «бүх мөр × хураамж» гэж тооцдог байсан тул давхар бүртгэлтэй
  // СӨХ-д айлын тоо, орлого, үлдэгдэл бодитоос их харагдаж байв.)
  const [sum, setSum] = useState<{
    households: number; billed: number; invoiceCount: number; paidCount: number;
    collected: number; otherIncome: number; expense: number; cashEnd: number | null;
  } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [{ data: budgetData }, { data: org }, report] = await Promise.all([
        supabase
          .from('budget_items')
          .select('*')
          .eq('sokh_id', params.id)
          .eq('type', 'expense')
          .eq('month', month)
          .eq('year', year)
          .order('amount', { ascending: false }),
        supabase.from('sokh_organizations').select('name, monthly_fee').eq('id', params.id).single(),
        fetch(`/api/sokh-report?sokhId=${params.id}&year=${year}&month=${month}`)
          .then(r => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      setItems(budgetData || []);
      setOrgName(org?.name || '');
      setMonthlyFee(org?.monthly_fee || 0);
      setSum(report && typeof report.households === 'number' ? report : null);
      setLoading(false);
    };
    fetchData();
  }, [params.id, month, year]);

  const totalExpense = items.filter(i => !i.category.includes('income')).reduce((s, i) => s + i.amount, 0);
  const totalIncome = items.filter(i => i.category.includes('income')).reduce((s, i) => s + i.amount, 0);
  const collected = sum?.collected ?? 0;
  // type='income' мөр (жишээ нь тоот тодорхойгүй орлого) энэ хуудасны запросоор ирэхгүй тул серверийн дүнг авна
  const otherIncome = sum ? sum.otherIncome : totalIncome;
  const net = collected + otherIncome - totalExpense;
  const getCat = (c: string) => categoryMap[c] || categoryMap.other;
  const fmt = (n: number) => n.toLocaleString('mn-MN') + '₮';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-cyan-700 text-white px-4 py-4">
        <button onClick={() => router.push(`/sokh/${params.id}`)} className="text-white/80 text-sm mb-1">← Буцах</button>
        <h1 className="text-lg font-bold">📋 Зарцуулалтын тайлан</h1>
        <p className="text-xs text-white/60 mt-0.5">{orgName} — ил тод санхүү</p>
      </div>

      <div className="px-4 py-4">
        {/* Сар сонгох */}
        <div className="flex gap-2 mb-4">
          <select value={month} onChange={e => setMonth(+e.target.value)}
            className="flex-1 border rounded-xl px-3 py-2.5 text-sm bg-white">
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(+e.target.value)}
            className="border rounded-xl px-3 py-2.5 text-sm bg-white">
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Ерөнхий мэдээлэл */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-500">Орсон орлого</p>
            <p className="text-xl font-bold text-green-600">{fmt(collected + otherIncome)}</p>
            <p className="text-[10px] text-gray-400 mt-1">
              {sum ? <>{sum.households} айл · нэхэмжилсэн {fmt(sum.billed)}</> : `сарын хураамж ${fmt(monthlyFee)}`}
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-500">Нийт зардал</p>
            <p className="text-xl font-bold text-red-500">{fmt(totalExpense)}</p>
            <p className="text-[10px] text-gray-400 mt-1">{items.filter(i => !i.category.includes('income')).length} зүйл</p>
          </div>
        </div>

        {loading ? (
          <p className="text-gray-400 text-center py-8">Ачаалж байна...</p>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center shadow-sm">
            <p className="text-3xl mb-2">📋</p>
            <p className="text-gray-500 text-sm">Энэ сарын тайлан оруулагдаагүй</p>
            <p className="text-xs text-gray-400 mt-1">СӨХ-ийн удирдлага сар бүр оруулна</p>
          </div>
        ) : (
          <>
            {/* Зардлын задаргаа */}
            <h2 className="text-sm font-bold text-gray-700 mb-2">Зардлын задаргаа</h2>
            <div className="space-y-2 mb-4">
              {items.filter(i => !i.category.includes('income')).map(item => {
                const cat = getCat(item.category);
                const pct = totalExpense > 0 ? (item.amount / totalExpense * 100) : 0;
                return (
                  <div key={item.id} className="bg-white rounded-xl p-3 shadow-sm">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{cat.icon}</span>
                        <div>
                          <p className="text-sm font-medium">{cat.label}</p>
                          {item.description && <p className="text-[10px] text-gray-400">{item.description}</p>}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">{fmt(item.amount)}</p>
                        <p className="text-[10px] text-gray-400">{pct.toFixed(1)}%</p>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: cat.color }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Орлого (зогсоол гэх мэт) */}
            {items.filter(i => i.category.includes('income')).length > 0 && (
              <>
                <h2 className="text-sm font-bold text-gray-700 mb-2">Нэмэлт орлого</h2>
                <div className="space-y-2 mb-4">
                  {items.filter(i => i.category.includes('income')).map(item => {
                    const cat = getCat(item.category);
                    return (
                      <div key={item.id} className="bg-green-50 border border-green-200 rounded-xl p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{cat.icon}</span>
                            <div>
                              <p className="text-sm font-medium text-green-800">{cat.label}</p>
                              {item.description && <p className="text-[10px] text-green-600">{item.description}</p>}
                            </div>
                          </div>
                          <p className="text-sm font-bold text-green-700">+{fmt(item.amount)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Дүгнэлт */}
            <div className="bg-gray-800 text-white rounded-xl p-4 shadow-sm">
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm text-gray-300">Энэ сард орсон орлого</p>
                <p className="text-sm font-bold text-green-400">{fmt(collected + otherIncome)}</p>
              </div>
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm text-gray-300">Зардал</p>
                <p className="text-sm font-bold text-red-400">-{fmt(totalExpense)}</p>
              </div>
              <div className="border-t border-gray-700 pt-2 mt-2">
                <div className="flex justify-between items-center">
                  <p className="text-sm font-medium">Сарын зөрүү</p>
                  <p className={`text-lg font-bold ${net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {net >= 0 ? '+' : ''}{fmt(net)}
                  </p>
                </div>
                {sum?.cashEnd != null && (
                  <div className="flex justify-between items-center mt-2">
                    <p className="text-sm text-gray-300">Дансны үлдэгдэл (сарын эцэст)</p>
                    <p className="text-sm font-bold">{fmt(Math.round(sum.cashEnd))}</p>
                  </div>
                )}
              </div>
            </div>

            <p className="text-center text-[10px] text-gray-400 mt-4">
              Орлого нь тухайн сард СӨХ-ийн дансанд бодитоор орсон төлбөр.
              {sum && sum.invoiceCount > 0 && <> {sum.invoiceCount} нэхэмжлэхээс {sum.paidCount} нь бүрэн төлөгдсөн.</>}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
