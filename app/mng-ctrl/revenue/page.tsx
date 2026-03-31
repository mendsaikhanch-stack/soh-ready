'use client';

import { useState, useEffect } from 'react';
import type { PlatformInvoice, SokhSubscription, PlatformTransaction } from '@/app/lib/types/billing';
import { PLAN_TYPE_LABELS, INVOICE_STATUS_LABELS } from '@/app/lib/types/billing';

export default function RevenuePage() {
  const [invoices, setInvoices] = useState<PlatformInvoice[]>([]);
  const [subscriptions, setSubscriptions] = useState<SokhSubscription[]>([]);
  const [transactions, setTransactions] = useState<PlatformTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [tab, setTab] = useState<'overview' | 'invoices' | 'commissions'>('overview');

  useEffect(() => {
    Promise.all([
      fetch('/api/superadmin/invoices').then(r => r.json()),
      fetch('/api/superadmin/subscriptions').then(r => r.json()),
    ]).then(([inv, subs]) => {
      setInvoices(Array.isArray(inv) ? inv : []);
      setSubscriptions(Array.isArray(subs) ? subs : []);
      setLoading(false);
    });
  }, []);

  const now = new Date();
  const thisMonth = invoices.filter(i => i.period_year === now.getFullYear() && i.period_month === now.getMonth() + 1);
  const monthlyRevenue = thisMonth.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0);
  const monthlyPending = thisMonth.filter(i => i.status === 'pending').reduce((s, i) => s + i.amount, 0);
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0);
  const overdue = invoices.filter(i => i.status === 'overdue');
  const activeSubs = subscriptions.filter(s => s.status === 'active' || s.status === 'trial');
  const commissionTotal = transactions.reduce((s, t) => s + t.commission_amount, 0);

  const fmt = (n: number) => n.toLocaleString('mn-MN') + '₮';

  // Багц тус бүрийн задаргаа
  const planBreakdown = activeSubs.reduce<Record<string, { name: string; type: string; count: number; revenue: number }>>((acc, sub) => {
    const planName = sub.plan?.name || 'Тодорхойгүй';
    if (!acc[planName]) acc[planName] = { name: planName, type: sub.plan?.type || '', count: 0, revenue: 0 };
    acc[planName].count++;
    const monthInvoice = thisMonth.find(i => i.sokh_id === sub.sokh_id);
    if (monthInvoice) acc[planName].revenue += monthInvoice.amount;
    return acc;
  }, {});

  // Сүүлийн 6 сарын орлого
  const monthlyTrend = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const monthInvs = invoices.filter(inv => inv.period_year === y && inv.period_month === m && inv.status === 'paid');
    const total = monthInvs.reduce((s, inv) => s + inv.amount, 0);
    monthlyTrend.push({ label: `${y}.${String(m).padStart(2, '0')}`, amount: total });
  }
  const maxTrend = Math.max(...monthlyTrend.map(m => m.amount), 1);

  const handleGenerate = async () => {
    if (!confirm(`${now.getFullYear()}.${now.getMonth() + 1} сарын нэхэмжлэл үүсгэх үү?`)) return;
    setGenerating(true);
    const res = await fetch('/api/superadmin/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generate', year: now.getFullYear(), month: now.getMonth() + 1 }),
    });
    const data = await res.json();
    alert(`${data.generated || 0} нэхэмжлэл үүсгэлээ`);
    setGenerating(false);
    // Refresh
    const inv = await fetch('/api/superadmin/invoices').then(r => r.json());
    setInvoices(Array.isArray(inv) ? inv : []);
  };

  const markPaid = async (id: number, amount: number) => {
    await fetch('/api/superadmin/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_paid', id, paid_amount: amount }),
    });
    const inv = await fetch('/api/superadmin/invoices').then(r => r.json());
    setInvoices(Array.isArray(inv) ? inv : []);
  };

  if (loading) {
    return <div className="p-8"><p className="text-gray-400">Ачаалж байна...</p></div>;
  }

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Платформ орлого</h1>
          <p className="text-sm text-gray-500 mt-1">Багц, нэхэмжлэл, комиссын орлого</p>
        </div>
        <button onClick={handleGenerate} disabled={generating}
          className="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
          {generating ? 'Үүсгэж байна...' : 'Нэхэмжлэл үүсгэх'}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-2xl p-5 text-white">
          <p className="text-green-200 text-sm">Энэ сарын орлого</p>
          <p className="text-2xl font-bold mt-1">{fmt(monthlyRevenue)}</p>
        </div>
        <div className="bg-white border rounded-2xl p-5">
          <p className="text-gray-400 text-sm">Хүлээгдэж буй</p>
          <p className="text-2xl font-bold mt-1 text-orange-600">{fmt(monthlyPending)}</p>
        </div>
        <div className="bg-white border rounded-2xl p-5">
          <p className="text-gray-400 text-sm">Нийт орлого</p>
          <p className="text-2xl font-bold mt-1">{fmt(totalPaid)}</p>
        </div>
        <div className="bg-white border rounded-2xl p-5">
          <p className="text-gray-400 text-sm">Идэвхтэй захиалга</p>
          <p className="text-2xl font-bold mt-1">{activeSubs.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {(['overview', 'invoices', 'commissions'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {t === 'overview' ? 'Ерөнхий' : t === 'invoices' ? 'Нэхэмжлэлүүд' : 'Комисс'}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Багцын задаргаа */}
          <div className="bg-white border rounded-2xl p-5">
            <h2 className="font-semibold mb-4">Багцын задаргаа</h2>
            {Object.values(planBreakdown).length === 0 ? (
              <p className="text-gray-400 text-sm">Захиалга байхгүй</p>
            ) : (
              <div className="space-y-4">
                {Object.values(planBreakdown).map(p => (
                  <div key={p.name} className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-gray-500">
                        {p.count} СӨХ &middot; {PLAN_TYPE_LABELS[p.type as keyof typeof PLAN_TYPE_LABELS] || p.type}
                      </p>
                    </div>
                    <p className="font-semibold text-green-600">{fmt(p.revenue)}/сар</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Сарын динамик */}
          <div className="bg-white border rounded-2xl p-5">
            <h2 className="font-semibold mb-4">Сарын орлогын динамик</h2>
            <div className="space-y-3">
              {monthlyTrend.map(m => (
                <div key={m.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-500">{m.label}</span>
                    <span className="font-medium">{fmt(m.amount)}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3">
                    <div className="bg-green-500 h-3 rounded-full transition-all"
                      style={{ width: `${(m.amount / maxTrend) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Хугацаа хэтэрсэн */}
          {overdue.length > 0 && (
            <div className="bg-white border border-red-200 rounded-2xl p-5 md:col-span-2">
              <h2 className="font-semibold text-red-600 mb-3">Хугацаа хэтэрсэн ({overdue.length})</h2>
              <div className="space-y-2">
                {overdue.map(inv => (
                  <div key={inv.id} className="flex items-center justify-between bg-red-50 p-3 rounded-xl">
                    <div>
                      <p className="text-sm font-medium">{inv.sokh_name || `СӨХ #${inv.sokh_id}`}</p>
                      <p className="text-xs text-gray-500">{inv.period_year}.{String(inv.period_month).padStart(2, '0')} &middot; Хугацаа: {inv.due_date}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-bold text-red-600">{fmt(inv.amount)}</p>
                      <button onClick={() => markPaid(inv.id, inv.amount)}
                        className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700">
                        Төлсөн
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'invoices' && (
        <div className="bg-white border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">СӨХ</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Хугацаа</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Дүн</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Төлөв</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Үйлдэл</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {invoices.map(inv => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{inv.sokh_name || `СӨХ #${inv.sokh_id}`}</td>
                  <td className="px-4 py-3 text-gray-500">{inv.period_year}.{String(inv.period_month).padStart(2, '0')}</td>
                  <td className="px-4 py-3 text-right font-semibold">{fmt(inv.amount)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      inv.status === 'paid' ? 'bg-green-100 text-green-700' :
                      inv.status === 'overdue' ? 'bg-red-100 text-red-700' :
                      inv.status === 'cancelled' ? 'bg-gray-100 text-gray-500' :
                      'bg-orange-100 text-orange-700'
                    }`}>
                      {INVOICE_STATUS_LABELS[inv.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {inv.status === 'pending' || inv.status === 'overdue' ? (
                      <button onClick={() => markPaid(inv.id, inv.amount)}
                        className="text-xs text-green-600 hover:bg-green-50 px-2 py-1 rounded-lg">
                        Төлсөн
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Нэхэмжлэл байхгүй</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'commissions' && (
        <div className="bg-white border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Комиссын орлого</h2>
            <p className="text-lg font-bold text-green-600">{fmt(commissionTotal)}</p>
          </div>
          {transactions.length === 0 ? (
            <p className="text-gray-400 text-sm">QPay гүйлгээний комисс бүртгэгдээгүй байна. СӨХ-үүдэд комисс төрлийн багц оноосон үед энд харагдана.</p>
          ) : (
            <div className="space-y-2">
              {transactions.slice(0, 50).map(t => (
                <div key={t.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm">{t.description || `QPay #${t.qpay_order_id}`}</p>
                    <p className="text-xs text-gray-400">{new Date(t.created_at).toLocaleDateString('mn-MN')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{fmt(t.commission_amount)}</p>
                    <p className="text-xs text-gray-400">{t.commission_rate}% &times; {fmt(t.total_amount)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
