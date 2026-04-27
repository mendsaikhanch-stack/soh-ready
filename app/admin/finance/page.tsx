'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/app/lib/supabase';
import { adminFrom } from '@/app/lib/admin-db';
import { getAdminSokhId } from '@/app/lib/admin-config';
import * as XLSX from 'xlsx';

type Tab = 'overview' | 'income' | 'expenses' | 'budget' | 'invoices' | 'reserve' | 'debts';

interface BudgetItem { id: number; category: string; amount: number; month: number; year: number; description: string; }
interface BudgetPlan { id: number; category: string; planned_amount: number; month: number; year: number; notes: string; }
interface Payment { id: number; resident_id: number; amount: number; description: string; paid_at: string; }
interface Invoice { id: number; resident_id: number; year: number; month: number; amount: number; status: string; paid_amount: number; due_date: string; paid_at: string | null; description: string; }
interface Resident { id: number; name: string; apartment: string; debt: number; entrance: number | null; }
interface ReserveEntry { id: number; type: string; amount: number; description: string; occurred_at: string; }

const categoryOptions = [
  { value: 'cleaning', label: 'Цэвэрлэгээ', icon: '🧹', color: '#3B82F6' },
  { value: 'elevator', label: 'Лифт', icon: '🛗', color: '#8B5CF6' },
  { value: 'security', label: 'Харуул', icon: '💂', color: '#EF4444' },
  { value: 'repair', label: 'Засвар', icon: '🔧', color: '#F59E0B' },
  { value: 'electricity', label: 'Цахилгаан', icon: '⚡', color: '#10B981' },
  { value: 'water', label: 'Ус', icon: '💧', color: '#06B6D4' },
  { value: 'heating', label: 'Дулаан', icon: '🔥', color: '#F97316' },
  { value: 'garden', label: 'Тохижилт', icon: '🌳', color: '#22C55E' },
  { value: 'reserve', label: 'Нөөц сан', icon: '🏦', color: '#6366F1' },
  { value: 'insurance', label: 'Даатгал', icon: '🛡', color: '#EC4899' },
  { value: 'salary', label: 'Цалин', icon: '👷', color: '#0EA5E9' },
  { value: 'other', label: 'Бусад', icon: '📋', color: '#9CA3AF' },
];

const months = ['1-р сар','2-р сар','3-р сар','4-р сар','5-р сар','6-р сар','7-р сар','8-р сар','9-р сар','10-р сар','11-р сар','12-р сар'];
const getCat = (c: string) => categoryOptions.find(o => o.value === c) || categoryOptions[categoryOptions.length - 1];

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending: { label: 'Хүлээгдэж буй', color: 'bg-amber-100 text-amber-700' },
  paid: { label: 'Төлөгдсөн', color: 'bg-green-100 text-green-700' },
  overdue: { label: 'Хугацаа хэтэрсэн', color: 'bg-red-100 text-red-700' },
  partial: { label: 'Хэсэгчилсэн', color: 'bg-blue-100 text-blue-700' },
};

export default function AdminFinanceHub() {
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  // data
  const [residents, setResidents] = useState<Resident[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [budgetPlans, setBudgetPlans] = useState<BudgetPlan[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [reserveEntries, setReserveEntries] = useState<ReserveEntry[]>([]);
  const [monthlyFee, setMonthlyFee] = useState(0);
  const [feeInput, setFeeInput] = useState('');
  const [feeEditing, setFeeEditing] = useState(false);
  const [savingFee, setSavingFee] = useState(false);

  // forms
  const [showExpForm, setShowExpForm] = useState(false);
  const [expCat, setExpCat] = useState('cleaning');
  const [expAmount, setExpAmount] = useState('');
  const [expDesc, setExpDesc] = useState('');

  const [showPlanForm, setShowPlanForm] = useState(false);
  const [planCat, setPlanCat] = useState('cleaning');
  const [planAmount, setPlanAmount] = useState('');
  const [planNotes, setPlanNotes] = useState('');

  const [showReserveForm, setShowReserveForm] = useState(false);
  const [resType, setResType] = useState<'deposit' | 'withdrawal'>('deposit');
  const [resAmount, setResAmount] = useState('');
  const [resDesc, setResDesc] = useState('');

  const [generating, setGenerating] = useState(false);
  const [genMessage, setGenMessage] = useState('');

  const [printInvoice, setPrintInvoice] = useState<Invoice | null>(null);
  const [orgInfo, setOrgInfo] = useState<{ name: string; address: string; phone: string }>({ name: '', address: '', phone: '' });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const sokhId = await getAdminSokhId();
    if (!sokhId) { setLoading(false); return; }

    const [
      { data: org },
      { data: res },
      { data: pay },
      { data: allPay },
      { data: items },
      { data: plans },
      { data: inv },
      { data: rf },
    ] = await Promise.all([
      supabase.from('sokh_organizations').select('monthly_fee, name, address, phone').eq('id', sokhId).single(),
      supabase.from('residents').select('id,name,apartment,debt,entrance').eq('sokh_id', sokhId).order('apartment'),
      supabase.from('payments').select('*, residents!inner(sokh_id)').eq('residents.sokh_id', sokhId).gte('paid_at', `${year}-${String(month).padStart(2, '0')}-01`).lt('paid_at', month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`).order('paid_at', { ascending: false }),
      supabase.from('payments').select('amount,paid_at,resident_id, residents!inner(sokh_id)').eq('residents.sokh_id', sokhId).order('paid_at', { ascending: false }),
      supabase.from('budget_items').select('*').eq('sokh_id', sokhId).eq('month', month).eq('year', year).order('amount', { ascending: false }),
      supabase.from('budget_plans').select('*').eq('sokh_id', sokhId).eq('month', month).eq('year', year),
      supabase.from('invoices').select('*').eq('sokh_id', sokhId).eq('year', year).eq('month', month).order('id'),
      supabase.from('reserve_fund').select('*').eq('sokh_id', sokhId).order('occurred_at', { ascending: false }).limit(100),
    ]);

    setMonthlyFee(org?.monthly_fee || 0);
    setFeeInput(String(org?.monthly_fee || ''));
    setOrgInfo({ name: org?.name || '', address: org?.address || '', phone: org?.phone || '' });
    setResidents(res || []);
    setPayments((pay || []) as unknown as Payment[]);
    setAllPayments((allPay || []) as unknown as Payment[]);
    setBudgetItems(items || []);
    setBudgetPlans(plans || []);
    setInvoices(inv || []);
    setReserveEntries(rf || []);
    setLoading(false);
  }, [month, year]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const saveFee = async () => {
    setSavingFee(true);
    const sokhId = await getAdminSokhId();
    await adminFrom('sokh_organizations').update({ monthly_fee: Number(feeInput) }).eq('id', sokhId);
    setMonthlyFee(Number(feeInput));
    setFeeEditing(false);
    setSavingFee(false);
  };

  const addExpense = async () => {
    if (!expAmount) return;
    const sokhId = await getAdminSokhId();
    await adminFrom('budget_items').insert([{ sokh_id: sokhId, category: expCat, amount: Number(expAmount), month, year, description: expDesc }]);
    setExpAmount(''); setExpDesc(''); setShowExpForm(false);
    await fetchAll();
  };

  const delExpense = async (id: number) => {
    if (!confirm('Зардал устгах уу?')) return;
    await adminFrom('budget_items').delete().eq('id', id);
    await fetchAll();
  };

  const addPlan = async () => {
    if (!planAmount) return;
    const sokhId = await getAdminSokhId();
    await adminFrom('budget_plans').upsert([{ sokh_id: sokhId, category: planCat, planned_amount: Number(planAmount), month, year, notes: planNotes }]);
    setPlanAmount(''); setPlanNotes(''); setShowPlanForm(false);
    await fetchAll();
  };

  const delPlan = async (id: number) => {
    if (!confirm('План устгах уу?')) return;
    await adminFrom('budget_plans').delete().eq('id', id);
    await fetchAll();
  };

  const addReserve = async () => {
    if (!resAmount) return;
    const sokhId = await getAdminSokhId();
    await adminFrom('reserve_fund').insert([{ sokh_id: sokhId, type: resType, amount: Number(resAmount), description: resDesc, occurred_at: new Date().toISOString().slice(0, 10) }]);
    setResAmount(''); setResDesc(''); setShowReserveForm(false);
    await fetchAll();
  };

  const delReserve = async (id: number) => {
    if (!confirm('Бүртгэл устгах уу?')) return;
    await adminFrom('reserve_fund').delete().eq('id', id);
    await fetchAll();
  };

  const generateInvoices = async () => {
    if (!monthlyFee) { alert('Эхлээд сарын хураамжаа тохируулна уу.'); return; }
    if (!residents.length) { alert('Оршин суугч бүртгэгдээгүй байна.'); return; }
    if (!confirm(`${months[month - 1]} сарын ${residents.length} нэхэмжлэх (${monthlyFee.toLocaleString()}₮ × ${residents.length}) үүсгэх үү?`)) return;
    setGenerating(true);
    setGenMessage('');
    const sokhId = await getAdminSokhId();
    const dueDate = new Date(year, month - 1, 25).toISOString().slice(0, 10);
    const rows = residents.map(r => ({
      sokh_id: sokhId,
      resident_id: r.id,
      year, month,
      amount: monthlyFee,
      due_date: dueDate,
      status: 'pending',
      description: `${months[month - 1]} ${year} - сарын хураамж`,
    }));
    const result = await adminFrom('invoices').upsert(rows);
    setGenerating(false);
    if (result.error) {
      setGenMessage(`Алдаа: ${result.error}`);
    } else {
      setGenMessage(`✅ ${rows.length} нэхэмжлэх амжилттай үүслээ.`);
      await fetchAll();
    }
    setTimeout(() => setGenMessage(''), 4000);
  };

  const markInvoicePaid = async (inv: Invoice) => {
    await adminFrom('invoices').update({ status: 'paid', paid_amount: inv.amount, paid_at: new Date().toISOString() }).eq('id', inv.id);
    await adminFrom('payments').insert([{ resident_id: inv.resident_id, amount: inv.amount, description: `Нэхэмжлэх: ${inv.description}` }]);
    const r = residents.find(x => x.id === inv.resident_id);
    if (r) await adminFrom('residents').update({ debt: Math.max(0, (r.debt || 0) - inv.amount) }).eq('id', inv.resident_id);
    await fetchAll();
  };

  const delInvoice = async (id: number) => {
    if (!confirm('Нэхэмжлэх устгах уу?')) return;
    await adminFrom('invoices').delete().eq('id', id);
    await fetchAll();
  };

  const getResidentName = (id: number) => {
    const r = residents.find(x => x.id === id);
    return r ? `${r.apartment} - ${r.name}` : 'Тодорхойгүй';
  };

  // ===== Тооцоо =====
  const monthIncome = payments.reduce((s, p) => s + Number(p.amount), 0);
  const monthExpense = budgetItems.reduce((s, i) => s + i.amount, 0);
  const monthNet = monthIncome - monthExpense;
  const totalDebt = residents.reduce((s, r) => s + Number(r.debt || 0), 0);
  const debtors = residents.filter(r => Number(r.debt || 0) > 0).length;
  const expectedMonthly = monthlyFee * residents.length;
  const collectionRate = expectedMonthly > 0 ? (monthIncome / expectedMonthly * 100) : 0;
  const reserveBalance = reserveEntries.reduce((s, e) => s + (e.type === 'deposit' ? e.amount : -e.amount), 0);
  const yearIncome = allPayments.filter(p => new Date(p.paid_at).getFullYear() === year).reduce((s, p) => s + Number(p.amount), 0);
  const pendingInvoices = invoices.filter(i => i.status === 'pending' || i.status === 'overdue').length;

  // 12 сарын chart дата
  const monthlyHistory = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const inc = allPayments.filter(p => {
      const d = new Date(p.paid_at);
      return d.getFullYear() === year && d.getMonth() + 1 === m;
    }).reduce((s, p) => s + Number(p.amount), 0);
    return { month: m, income: inc };
  });
  const maxMonthlyInc = Math.max(...monthlyHistory.map(h => h.income), 1);

  const exportYearReport = () => {
    const wb = XLSX.utils.book_new();
    const incomeSheet = XLSX.utils.json_to_sheet(
      allPayments.filter(p => new Date(p.paid_at).getFullYear() === year).map(p => ({
        'Огноо': new Date(p.paid_at).toLocaleDateString('mn-MN'),
        'Айл': getResidentName(p.resident_id),
        'Тайлбар': p.description,
        'Дүн': Number(p.amount),
      }))
    );
    XLSX.utils.book_append_sheet(wb, incomeSheet, `${year} - Орлого`);

    const expensesByMonth: Record<number, BudgetItem[]> = {};
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      budgetItems.map(i => ({
        'Сар': months[i.month - 1],
        'Ангилал': getCat(i.category).label,
        'Дүн': i.amount,
        'Тайлбар': i.description,
      }))
    ), `${year}-${month} Зардал`);

    const summaryRows = monthlyHistory.map(h => ({
      'Сар': months[h.month - 1],
      'Орлого': h.income,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), `${year} - Сараар`);

    XLSX.writeFile(wb, `санхүү-${year}-${month}.xlsx`);
  };

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'overview', label: 'Хяналт', icon: '📊' },
    { key: 'income', label: 'Орлого', icon: '💵' },
    { key: 'expenses', label: 'Зардал', icon: '📋' },
    { key: 'budget', label: 'Төсөв', icon: '🎯' },
    { key: 'invoices', label: `Нэхэмжлэх${pendingInvoices ? ` (${pendingInvoices})` : ''}`, icon: '🧾' },
    { key: 'reserve', label: 'Нөөц сан', icon: '🏦' },
    { key: 'debts', label: `Өрүүд${debtors ? ` (${debtors})` : ''}`, icon: '👥' },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">💰 Санхүүгийн систем</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); }} className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm">←</button>
          <span className="font-bold text-sm min-w-[120px] text-center">{year} · {months[month - 1]}</span>
          <button onClick={() => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); }} className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm">→</button>
          <button onClick={exportYearReport} className="ml-2 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">📥 Excel</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex-1 min-w-fit flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-sm font-medium transition whitespace-nowrap ${tab === t.key ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>
            <span>{t.icon}</span><span>{t.label}</span>
          </button>
        ))}
      </div>

      {loading ? <p className="text-gray-400 text-center py-12">Ачаалж байна...</p> : (
        <>
          {/* ============ OVERVIEW ============ */}
          {tab === 'overview' && (
            <div className="space-y-6">
              {/* Сарын хураамжийн тохиргоо */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-blue-600 mb-0.5">СӨХ-ийн сарын тогтсон хураамж</p>
                  {feeEditing ? (
                    <div className="flex items-center gap-2">
                      <input type="number" value={feeInput} onChange={e => setFeeInput(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm w-40" placeholder="Дүн" />
                      <button onClick={saveFee} disabled={savingFee} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">{savingFee ? '...' : 'Хадгалах'}</button>
                      <button onClick={() => { setFeeEditing(false); setFeeInput(String(monthlyFee)); }} className="px-3 py-1.5 border rounded-lg text-sm">Цуцлах</button>
                    </div>
                  ) : (
                    <p className="text-2xl font-bold text-blue-700">{monthlyFee.toLocaleString()}₮</p>
                  )}
                </div>
                {!feeEditing && (
                  <button onClick={() => setFeeEditing(true)} className="px-3 py-1.5 bg-white border border-blue-300 rounded-lg text-sm hover:bg-blue-50">✏️ Засах</button>
                )}
              </div>

              {/* KPI */}
              <div className="grid grid-cols-4 gap-4">
                <KpiCard label="Энэ сарын орлого" value={`${monthIncome.toLocaleString()}₮`} sub={`${months[month - 1]}`} color="green" />
                <KpiCard label="Энэ сарын зардал" value={`${monthExpense.toLocaleString()}₮`} sub={`${budgetItems.length} ангилал`} color="orange" />
                <KpiCard label="Цэвэр" value={`${monthNet.toLocaleString()}₮`} sub={monthNet >= 0 ? 'Ашигтай' : 'Алдагдалтай'} color={monthNet >= 0 ? 'blue' : 'red'} />
                <KpiCard label="Цуглуулалт" value={`${collectionRate.toFixed(1)}%`} sub={`${monthIncome.toLocaleString()} / ${expectedMonthly.toLocaleString()}`} color="cyan" />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <KpiCard label="Нийт өр" value={`${totalDebt.toLocaleString()}₮`} sub={`${debtors} / ${residents.length} айл`} color="red" />
                <KpiCard label="Нөөц сан" value={`${reserveBalance.toLocaleString()}₮`} sub={`${reserveEntries.length} бүртгэл`} color="indigo" />
                <KpiCard label={`${year} оны нийт орлого`} value={`${yearIncome.toLocaleString()}₮`} sub="" color="purple" />
              </div>

              {/* 12 сарын chart */}
              <div className="bg-white border rounded-xl p-4">
                <h3 className="font-semibold text-sm mb-3">{year} оны сарын орлого</h3>
                <div className="flex items-end gap-2 h-40">
                  {monthlyHistory.map(h => (
                    <div key={h.month} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex items-end h-32">
                        <div className={`w-full rounded-t ${h.month === month ? 'bg-blue-600' : 'bg-blue-200'}`} style={{ height: `${(h.income / maxMonthlyInc * 100).toFixed(1)}%`, minHeight: h.income > 0 ? '3px' : '0' }} title={`${h.income.toLocaleString()}₮`} />
                      </div>
                      <span className="text-[10px] text-gray-500">{h.month}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Зардлын ангилалын dynagiv */}
              {budgetItems.length > 0 && (
                <div className="bg-white border rounded-xl p-4">
                  <h3 className="font-semibold text-sm mb-3">Энэ сарын зардлын задаргаа</h3>
                  <div className="space-y-2">
                    {budgetItems.map(i => {
                      const c = getCat(i.category);
                      const pct = monthExpense > 0 ? (i.amount / monthExpense * 100) : 0;
                      return (
                        <div key={i.id}>
                          <div className="flex justify-between text-xs mb-0.5">
                            <span>{c.icon} {c.label}</span>
                            <span className="font-medium">{i.amount.toLocaleString()}₮ ({pct.toFixed(0)}%)</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: c.color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============ INCOME ============ */}
          {tab === 'income' && (
            <div>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <KpiCard label="Энэ сарын орлого" value={`${monthIncome.toLocaleString()}₮`} sub={`${payments.length} төлөлт`} color="green" />
                <KpiCard label="Хүлээгдсэн" value={`${expectedMonthly.toLocaleString()}₮`} sub={`${residents.length} айл × ${monthlyFee.toLocaleString()}₮`} color="blue" />
                <KpiCard label="Үлдэгдэл" value={`${Math.max(0, expectedMonthly - monthIncome).toLocaleString()}₮`} sub={`${(100 - collectionRate).toFixed(1)}%`} color="red" />
              </div>

              <h3 className="font-semibold text-sm text-gray-500 mb-3">{months[month - 1]} {year} - ОРЛОГЫН ТҮҮХ</h3>
              <div className="bg-white rounded-xl border overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-sm text-gray-500">
                      <th className="px-4 py-3">Огноо</th>
                      <th className="px-4 py-3">Айл</th>
                      <th className="px-4 py-3">Тайлбар</th>
                      <th className="px-4 py-3 text-right">Дүн</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.length === 0 ? (
                      <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Орлого бүртгэгдээгүй</td></tr>
                    ) : payments.map(p => (
                      <tr key={p.id} className="border-t hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">{new Date(p.paid_at).toLocaleDateString('mn-MN')}</td>
                        <td className="px-4 py-3 text-sm">{getResidentName(p.resident_id)}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{p.description}</td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-green-600">+{Number(p.amount).toLocaleString()}₮</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ============ EXPENSES ============ */}
          {tab === 'expenses' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-500">Нийт зардал: <span className="font-bold text-orange-600">{monthExpense.toLocaleString()}₮</span></p>
                <button onClick={() => setShowExpForm(!showExpForm)} className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700">+ Зардал нэмэх</button>
              </div>

              {showExpForm && (
                <div className="bg-white border rounded-xl p-4 mb-4">
                  <div className="grid grid-cols-4 gap-3">
                    <select value={expCat} onChange={e => setExpCat(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
                      {categoryOptions.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
                    </select>
                    <input type="number" placeholder="Дүн (₮)" value={expAmount} onChange={e => setExpAmount(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
                    <input placeholder="Тайлбар" value={expDesc} onChange={e => setExpDesc(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
                    <div className="flex gap-2">
                      <button onClick={() => setShowExpForm(false)} className="flex-1 py-2 rounded-lg border text-sm">Цуцлах</button>
                      <button onClick={addExpense} disabled={!expAmount} className="flex-1 py-2 rounded-lg bg-orange-600 text-white text-sm disabled:opacity-50">Нэмэх</button>
                    </div>
                  </div>
                </div>
              )}

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
                    {budgetItems.map(i => {
                      const c = getCat(i.category);
                      const pct = monthExpense > 0 ? (i.amount / monthExpense * 100).toFixed(1) : '0';
                      return (
                        <tr key={i.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3">{c.icon} {c.label}</td>
                          <td className="px-4 py-3 text-right font-medium">{i.amount.toLocaleString()}₮</td>
                          <td className="px-4 py-3 text-right text-gray-500">{pct}%</td>
                          <td className="px-4 py-3 text-gray-500">{i.description}</td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => delExpense(i.id)} className="text-xs text-red-400 hover:underline">Устгах</button>
                          </td>
                        </tr>
                      );
                    })}
                    {budgetItems.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Зардал байхгүй</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ============ BUDGET (PLAN vs ACTUAL) ============ */}
          {tab === 'budget' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-500">Төсөв vs Бодит зардлын харьцуулалт</p>
                <button onClick={() => setShowPlanForm(!showPlanForm)} className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-700">+ Төсөв нэмэх</button>
              </div>

              {showPlanForm && (
                <div className="bg-white border rounded-xl p-4 mb-4">
                  <div className="grid grid-cols-4 gap-3">
                    <select value={planCat} onChange={e => setPlanCat(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
                      {categoryOptions.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
                    </select>
                    <input type="number" placeholder="Төлөвлөсөн дүн (₮)" value={planAmount} onChange={e => setPlanAmount(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
                    <input placeholder="Тайлбар" value={planNotes} onChange={e => setPlanNotes(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
                    <div className="flex gap-2">
                      <button onClick={() => setShowPlanForm(false)} className="flex-1 py-2 rounded-lg border text-sm">Цуцлах</button>
                      <button onClick={addPlan} disabled={!planAmount} className="flex-1 py-2 rounded-lg bg-purple-600 text-white text-sm disabled:opacity-50">Нэмэх</button>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-white border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs text-gray-500">Ангилал</th>
                      <th className="px-4 py-3 text-right text-xs text-gray-500">Төлөвлөгөө</th>
                      <th className="px-4 py-3 text-right text-xs text-gray-500">Бодит</th>
                      <th className="px-4 py-3 text-right text-xs text-gray-500">Зөрүү</th>
                      <th className="px-4 py-3 text-left text-xs text-gray-500">Гүйцэтгэл</th>
                      <th className="px-4 py-3 text-right text-xs text-gray-500"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {budgetPlans.map(p => {
                      const c = getCat(p.category);
                      const actual = budgetItems.filter(i => i.category === p.category).reduce((s, i) => s + i.amount, 0);
                      const diff = p.planned_amount - actual;
                      const pct = p.planned_amount > 0 ? (actual / p.planned_amount * 100) : 0;
                      const over = pct > 100;
                      return (
                        <tr key={p.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3">{c.icon} {c.label}</td>
                          <td className="px-4 py-3 text-right font-medium">{p.planned_amount.toLocaleString()}₮</td>
                          <td className="px-4 py-3 text-right">{actual.toLocaleString()}₮</td>
                          <td className={`px-4 py-3 text-right font-medium ${diff < 0 ? 'text-red-600' : 'text-green-600'}`}>{diff >= 0 ? '+' : ''}{diff.toLocaleString()}₮</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-100 rounded-full h-2 max-w-[120px]">
                                <div className={`h-2 rounded-full ${over ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                              </div>
                              <span className={`text-xs font-medium ${over ? 'text-red-600' : 'text-gray-500'}`}>{pct.toFixed(0)}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => delPlan(p.id)} className="text-xs text-red-400 hover:underline">Устгах</button>
                          </td>
                        </tr>
                      );
                    })}
                    {budgetPlans.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Төсвийн төлөвлөгөө оруулаагүй</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ============ INVOICES ============ */}
          {tab === 'invoices' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-gray-500">{months[month - 1]} {year} нэхэмжлэх</p>
                  <p className="text-xs text-gray-400">Нэг хураамж: {monthlyFee.toLocaleString()}₮ × {residents.length} айл = {expectedMonthly.toLocaleString()}₮</p>
                </div>
                <button onClick={generateInvoices} disabled={generating} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                  {generating ? 'Үүсгэж байна...' : `🧾 ${months[month - 1]} сарын нэхэмжлэх үүсгэх`}
                </button>
              </div>

              {genMessage && <div className={`p-3 rounded-lg text-sm mb-4 ${genMessage.startsWith('✅') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{genMessage}</div>}

              {!monthlyFee && (
                <div className="bg-amber-50 border border-amber-200 text-amber-700 p-3 rounded-lg text-sm mb-4">
                  ⚠️ Сарын тогтсон хураамжаа Хяналт цэснээс эхлээд тохируулна уу.
                </div>
              )}

              <div className="grid grid-cols-4 gap-3 mb-4">
                <KpiCard label="Нийт нэхэмжлэх" value={String(invoices.length)} sub="" color="blue" />
                <KpiCard label="Төлөгдсөн" value={String(invoices.filter(i => i.status === 'paid').length)} sub="" color="green" />
                <KpiCard label="Хүлээгдэж буй" value={String(invoices.filter(i => i.status === 'pending').length)} sub="" color="amber" />
                <KpiCard label="Хугацаа хэтэрсэн" value={String(invoices.filter(i => i.status === 'overdue').length)} sub="" color="red" />
              </div>

              <div className="bg-white border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs text-gray-500">Тоот</th>
                      <th className="px-4 py-3 text-left text-xs text-gray-500">Айл</th>
                      <th className="px-4 py-3 text-right text-xs text-gray-500">Дүн</th>
                      <th className="px-4 py-3 text-left text-xs text-gray-500">Төлөв</th>
                      <th className="px-4 py-3 text-left text-xs text-gray-500">Хугацаа</th>
                      <th className="px-4 py-3 text-right text-xs text-gray-500"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map(inv => {
                      const r = residents.find(x => x.id === inv.resident_id);
                      const st = STATUS_LABEL[inv.status] || STATUS_LABEL.pending;
                      const overdue = inv.status === 'pending' && inv.due_date && new Date(inv.due_date) < new Date();
                      return (
                        <tr key={inv.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-xs">{r?.apartment || '—'}</td>
                          <td className="px-4 py-3">{r?.name || 'Тодорхойгүй'}</td>
                          <td className="px-4 py-3 text-right font-medium">{inv.amount.toLocaleString()}₮</td>
                          <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${overdue ? STATUS_LABEL.overdue.color : st.color}`}>{overdue ? 'Хугацаа хэтэрсэн' : st.label}</span></td>
                          <td className="px-4 py-3 text-gray-500">{inv.due_date ? new Date(inv.due_date).toLocaleDateString('mn-MN') : '—'}</td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => setPrintInvoice(inv)} className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded mr-1">🖨 PDF</button>
                            {inv.status !== 'paid' && (
                              <button onClick={() => markInvoicePaid(inv)} className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded mr-1">✓ Төлсөн</button>
                            )}
                            <button onClick={() => delInvoice(inv.id)} className="text-xs text-red-400 hover:underline">Устгах</button>
                          </td>
                        </tr>
                      );
                    })}
                    {invoices.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Энэ сарын нэхэмжлэх үүсгээгүй байна</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ============ RESERVE FUND ============ */}
          {tab === 'reserve' && (
            <div>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <KpiCard label="Үлдэгдэл" value={`${reserveBalance.toLocaleString()}₮`} sub="одоогийн" color="indigo" />
                <KpiCard label="Орлого" value={`${reserveEntries.filter(e => e.type === 'deposit').reduce((s, e) => s + e.amount, 0).toLocaleString()}₮`} sub={`${reserveEntries.filter(e => e.type === 'deposit').length} бүртгэл`} color="green" />
                <KpiCard label="Зарцуулалт" value={`${reserveEntries.filter(e => e.type === 'withdrawal').reduce((s, e) => s + e.amount, 0).toLocaleString()}₮`} sub={`${reserveEntries.filter(e => e.type === 'withdrawal').length} бүртгэл`} color="red" />
              </div>

              <div className="flex justify-end mb-4">
                <button onClick={() => setShowReserveForm(!showReserveForm)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">+ Нөөц сангийн бүртгэл</button>
              </div>

              {showReserveForm && (
                <div className="bg-white border rounded-xl p-4 mb-4">
                  <div className="grid grid-cols-4 gap-3">
                    <select value={resType} onChange={e => setResType(e.target.value as 'deposit' | 'withdrawal')} className="border rounded-lg px-3 py-2 text-sm">
                      <option value="deposit">📥 Орлого</option>
                      <option value="withdrawal">📤 Зарлага</option>
                    </select>
                    <input type="number" placeholder="Дүн (₮)" value={resAmount} onChange={e => setResAmount(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
                    <input placeholder="Тайлбар" value={resDesc} onChange={e => setResDesc(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
                    <div className="flex gap-2">
                      <button onClick={() => setShowReserveForm(false)} className="flex-1 py-2 rounded-lg border text-sm">Цуцлах</button>
                      <button onClick={addReserve} disabled={!resAmount} className="flex-1 py-2 rounded-lg bg-indigo-600 text-white text-sm disabled:opacity-50">Нэмэх</button>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-white border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs text-gray-500">Огноо</th>
                      <th className="px-4 py-3 text-left text-xs text-gray-500">Төрөл</th>
                      <th className="px-4 py-3 text-left text-xs text-gray-500">Тайлбар</th>
                      <th className="px-4 py-3 text-right text-xs text-gray-500">Дүн</th>
                      <th className="px-4 py-3 text-right text-xs text-gray-500"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {reserveEntries.map(e => (
                      <tr key={e.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-500">{new Date(e.occurred_at).toLocaleDateString('mn-MN')}</td>
                        <td className="px-4 py-3">{e.type === 'deposit' ? '📥 Орлого' : '📤 Зарлага'}</td>
                        <td className="px-4 py-3 text-gray-500">{e.description}</td>
                        <td className={`px-4 py-3 text-right font-semibold ${e.type === 'deposit' ? 'text-green-600' : 'text-red-600'}`}>{e.type === 'deposit' ? '+' : '-'}{e.amount.toLocaleString()}₮</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => delReserve(e.id)} className="text-xs text-red-400 hover:underline">Устгах</button>
                        </td>
                      </tr>
                    ))}
                    {reserveEntries.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Бүртгэл байхгүй</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ============ DEBTS ============ */}
          {/* PDF MODAL */}
          {printInvoice && (
            <InvoicePrintModal
              invoice={printInvoice}
              resident={residents.find(r => r.id === printInvoice.resident_id)}
              org={orgInfo}
              onClose={() => setPrintInvoice(null)}
            />
          )}

          {tab === 'debts' && (
            <div>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <KpiCard label="Нийт өр" value={`${totalDebt.toLocaleString()}₮`} sub="" color="red" />
                <KpiCard label="Өртэй айл" value={`${debtors}`} sub={`${residents.length}-аас`} color="orange" />
                <KpiCard label="Дундаж өр" value={`${(debtors > 0 ? totalDebt / debtors : 0).toLocaleString()}₮`} sub="айл бүрд" color="amber" />
              </div>

              <div className="bg-white border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs text-gray-500">Тоот</th>
                      <th className="px-4 py-3 text-left text-xs text-gray-500">Нэр</th>
                      <th className="px-4 py-3 text-left text-xs text-gray-500">Орц</th>
                      <th className="px-4 py-3 text-right text-xs text-gray-500">Өр</th>
                    </tr>
                  </thead>
                  <tbody>
                    {residents.filter(r => Number(r.debt || 0) > 0).sort((a, b) => Number(b.debt) - Number(a.debt)).map(r => (
                      <tr key={r.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono">{r.apartment}</td>
                        <td className="px-4 py-3">{r.name}</td>
                        <td className="px-4 py-3 text-gray-500">{r.entrance ? `${r.entrance}-р` : '—'}</td>
                        <td className="px-4 py-3 text-right font-semibold text-red-600">{Number(r.debt).toLocaleString()}₮</td>
                      </tr>
                    ))}
                    {debtors === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Өртэй айл байхгүй ✓</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: 'green' | 'blue' | 'red' | 'orange' | 'amber' | 'purple' | 'cyan' | 'indigo' }) {
  const colorMap: Record<string, { bg: string; border: string; text: string }> = {
    green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700' },
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
    red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
    orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
    cyan: { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700' },
    indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700' },
  };
  const c = colorMap[color];
  return (
    <div className={`${c.bg} border ${c.border} rounded-xl p-4`}>
      <p className="text-xs text-gray-600">{label}</p>
      <p className={`text-2xl font-bold ${c.text} mt-0.5`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}
