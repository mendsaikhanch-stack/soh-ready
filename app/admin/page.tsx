'use client';

import { useState, useEffect } from 'react';
import { adminFrom } from '@/app/lib/admin-db';
import { getAdminSokhId } from '@/app/lib/admin-config';
import AppUsagePanel, { fetchAppUsage, type AppUsage } from '@/app/components/admin/AppUsagePanel';

// Хотолд төлөх ёстой нэхэмжлэх — SMS/имэйл хүрээгүй ч самбар нээхэд харагдана
interface PlatformInvoice {
  id: number;
  kind: string;
  amount: number;
  due_on: string;
  days_left: number;
  level: 'soon' | 'overdue' | 'critical' | null;
}
interface PlatformBilling {
  invoices: PlatformInvoice[];
  bank?: { name: string; account: string; holder: string };
  contact?: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    residents: 0,
    debtResidents: 0,
    totalDebt: 0,
    totalPaid: 0,
    announcements: 0,
    pendingMaintenance: 0,
    pendingComplaints: 0,
    activePolls: 0,
    unreadMessages: 0,
  });
  const [loading, setLoading] = useState(true);
  // Апп татаж нэвтэрсэн айлууд — auth-ийн өгөгдөл тул тусдаа API-аар ирнэ
  const [usage, setUsage] = useState<AppUsage | null>(null);
  const [billing, setBilling] = useState<PlatformBilling | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      const sokhId = await getAdminSokhId();

      // adminFrom proxy (service_role + tenant-scope) ашиглана — admin нь Supabase auth биш тул
      // anon client RLS-д бүх мөр блоклогдож, хянах самбар 0 харуулдаг байв.
      const { data: resRows } = await adminFrom('residents').select('id, debt').eq('sokh_id', sokhId);
      const residents = (resRows as unknown as { id: number; debt: number }[]) || [];
      const debtResidents = residents.filter(r => Number(r.debt) > 0).length;
      const totalDebt = residents.reduce((sum, r) => sum + Number(r.debt), 0);

      // payments нь sokh_id шууд байхгүй — proxy resident_id-ээр scope хийдэг тул айлуудын id-аар уншина
      const residentIds = residents.map(r => Number(r.id));

      const [payRes, annRows, maintRows, compRows, pollRows, msgRows] = await Promise.all([
        residentIds.length
          ? adminFrom('payments').select('amount').in('resident_id', residentIds)
          : Promise.resolve({ data: [] as { amount: number }[] }),
        adminFrom('announcements').select('id').eq('sokh_id', sokhId),
        adminFrom('maintenance_requests').select('id').eq('sokh_id', sokhId).eq('status', 'pending'),
        adminFrom('complaints').select('id').eq('sokh_id', sokhId).eq('status', 'pending'),
        adminFrom('polls').select('id').eq('sokh_id', sokhId).eq('status', 'active'),
        adminFrom('scheduled_notifications').select('id').eq('sokh_id', sokhId),
      ]);

      const totalPaid = ((payRes.data as unknown as { amount: number }[]) || []).reduce((sum, p) => sum + Number(p.amount), 0);
      const len = (r: { data: unknown }) => ((r.data as unknown[]) || []).length;

      setStats({
        residents: residents.length,
        debtResidents,
        totalDebt,
        totalPaid,
        announcements: len(annRows),
        pendingMaintenance: len(maintRows),
        pendingComplaints: len(compRows),
        activePolls: len(pollRows),
        unreadMessages: len(msgRows),
      });
      setLoading(false);
    };
    fetchStats();
  }, []);

  // Апп ашиглалт нь Supabase-ийн auth хүснэгтээс уншигддаг тул бусад тооноос
  // удаан ирдэг. Тусад нь ачаалж, самбарын үлдсэн хэсгийг хүлээлгэхгүй.
  useEffect(() => {
    fetchAppUsage().then(setUsage);
    fetch('/api/admin/platform-billing')
      .then(r => (r.ok ? r.json() : null))
      .then(d => setBilling(d))
      .catch(() => setBilling(null));
  }, []);

  if (loading) return <div className="p-8 text-gray-400">Ачаалж байна...</div>;

  const cards = [
    { label: 'Нийт айл өрх', value: stats.residents, icon: '👥', color: 'bg-blue-50 border-blue-200 text-blue-700' },
    // Апп татаж нэвтэрсэн айл — бүртгэсэн айл БҮГД аппаа ашиглаж эхэлдэггүй
    {
      label: 'Апп татаж нэвтэрсэн айл',
      value: usage ? `${usage.summary.signed_in}/${usage.summary.total}` : '—',
      icon: '📱',
      color: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    },
    { label: 'Өртэй айл', value: stats.debtResidents, icon: '⚠️', color: 'bg-red-50 border-red-200 text-red-700' },
    { label: 'Нийт өр', value: `${stats.totalDebt.toLocaleString()}₮`, icon: '💸', color: 'bg-red-50 border-red-200 text-red-700' },
    { label: 'Нийт төлбөр цуглуулсан', value: `${stats.totalPaid.toLocaleString()}₮`, icon: '💰', color: 'bg-green-50 border-green-200 text-green-700' },
    { label: 'Зарлал', value: stats.announcements, icon: '📢', color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
    { label: 'Хүлээгдэж буй засвар', value: stats.pendingMaintenance, icon: '🔧', color: 'bg-orange-50 border-orange-200 text-orange-700' },
    { label: 'Шинэ гомдол/санал', value: stats.pendingComplaints, icon: '📝', color: 'bg-violet-50 border-violet-200 text-violet-700' },
    { label: 'Идэвхтэй санал хураалт', value: stats.activePolls, icon: '🗳', color: 'bg-pink-50 border-pink-200 text-pink-700' },
    { label: 'Мессеж', value: stats.unreadMessages, icon: '💬', color: 'bg-teal-50 border-teal-200 text-teal-700' },
  ];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">📊 Хянах самбар</h1>

      {/* Хотолын нэхэмжлэх — төлөгдөөгүй бол хугацааныхаа хамт энд харагдана */}
      {billing && billing.invoices.length > 0 && (() => {
        const worst = billing.invoices.reduce((m, i) => Math.min(m, i.days_left), Infinity);
        const late = worst < 0;
        return (
          <div className={`mb-6 rounded-xl border p-4 ${late ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
            <p className={`font-semibold ${late ? 'text-red-700' : 'text-amber-800'}`}>
              💸 Хотол платформын төлбөр {late ? '— хугацаа хэтэрсэн' : ''}
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              {billing.invoices.map(i => (
                <li key={i.id} className="flex justify-between gap-3">
                  <span>
                    {i.kind === 'setup' ? 'Суурилуулалт' : 'Сарын хураамж'} · {i.due_on.replace(/-/g, '.')} хүртэл
                  </span>
                  <span className={`font-medium ${i.days_left < 0 ? 'text-red-700' : 'text-gray-800'}`}>
                    {i.amount.toLocaleString()}₮ ·{' '}
                    {i.days_left < 0
                      ? `${-i.days_left} хоног хэтэрсэн`
                      : i.days_left === 0
                        ? 'өнөөдөр'
                        : `${i.days_left} хоногийн дараа`}
                  </span>
                </li>
              ))}
            </ul>
            {billing.bank && (
              <p className="mt-2 text-xs text-gray-600">
                Данс: {billing.bank.name} банк {billing.bank.account} ({billing.bank.holder}) · Гүйлгээний утга: СӨХ-ийн нэр
                {billing.contact ? ` · Асуулт: ${billing.contact}` : ''}
              </p>
            )}
          </div>
        );
      })()}

      <div className="grid grid-cols-4 gap-4 mb-8">
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

      {usage
        ? <AppUsagePanel usage={usage} />
        : <div className="bg-white border rounded-xl p-5 text-sm text-gray-400">
            📱 Апп татаж нэвтэрсэн айлуудыг ачаалж байна...
          </div>}
    </div>
  );
}
