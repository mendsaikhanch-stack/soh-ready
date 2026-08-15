'use client';

// Хэрэглэгч болсон СӨХ бүрийн нэгдсэн карт.
//
// /mng-ctrl/organizations нь лавлахын 1000+ СӨХ-г импортлох, идэвхжүүлэх
// зориулалттай — тэндээ л үлдэнэ. Энэ хуудас нь ЗӨВХӨН бидний хэрэглэгч
// болсон СӨХ-үүдийг: хэдэн айлтай, хэн эрхтэй, хэдийг төлсөн, дараа нь
// хэзээ хэдийг төлөхийг нэг дор харуулна.

import { useState, useEffect } from 'react';

interface AdminAcct {
  id: number;
  username: string;
  role: string;
  status: string;
  display_name: string | null;
}

interface Invoice {
  id: number;
  kind: string;
  period_year: number;
  period_month: number;
  amount: number;
  status: string;
  due_date: string;
  paid_at: string | null;
  paid_amount: number | null;
}

interface NextPeriod {
  year: number;
  month: number;
  amount: number;
  startsOn: string;
}

interface Customer {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  claim_status: string;
  activated_at: string | null;
  apartments: number;
  registered_units: number | null;
  debt_total: number;
  debtors: number;
  admins: AdminAcct[];
  activation_token: { expires_at: string; used: boolean; expired: boolean } | null;
  setup_fee: number;
  monthly_fee: number;
  free_months: number;
  billing_starts_at: string | null;
  billing_active: boolean;
  setup_invoice: Invoice | null;
  next_period: NextPeriod | null;
  invoices: Invoice[];
  unpaid_total: number;
  paid_total: number;
}

interface Tariff {
  setup_per_unit: number;
  monthly_per_unit: number;
  free_months_threshold: number;
  free_months_below: number;
  free_months_above: number;
}

const mnDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString('mn-MN', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '—';

const money = (n: number) => `${Math.round(n).toLocaleString()}₮`;

const ROLE_LABEL: Record<string, string> = {
  admin: 'Дарга',
  osnaa: 'ОСНАА',
  inspector: 'Байцаагч',
  superadmin: 'Супер админ',
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tariff, setTariff] = useState<Tariff | null>(null);
  const [migrated, setMigrated] = useState(true);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = async () => {
    const res = await fetch('/api/superadmin/customers');
    const data = await res.json();
    if (data.error) {
      setError(data.error);
    } else {
      setCustomers(data.customers || []);
      setTariff(data.tariff || null);
      setMigrated(data.migrated !== false);
    }
    setLoading(false);
  };

  useEffect(() => {
    const init = async () => { await load(); };
    init();
  }, []);

  // Нэхэмжлэл үүсгэх. Дүнг сервер өөрөө тарифаар тооцно.
  const createInvoice = async (
    c: Customer,
    kind: 'setup' | 'monthly',
    year: number,
    month: number,
    markPaid: boolean,
  ) => {
    const label = kind === 'setup' ? 'Суурилуулалтын төлбөр' : `${year} оны ${month} сарын хураамж`;
    if (!confirm(
      `${c.name}\n\n${label} — ${money(kind === 'setup' ? c.setup_fee : c.monthly_fee)}\n\n` +
      (markPaid ? 'Төлөгдсөн гэж бүртгэх үү?' : 'Нэхэмжлэл үүсгэх үү?')
    )) return;

    setBusy(`${c.id}-${kind}-${year}-${month}`);
    const res = await fetch('/api/superadmin/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        sokh_id: c.id,
        kind,
        period_year: year,
        period_month: month,
        mark_paid: markPaid,
      }),
    });
    const data = await res.json();
    setBusy(null);
    if (data.error) { alert(data.error); return; }
    await load();
  };

  const markPaid = async (inv: Invoice) => {
    if (!confirm(`${money(inv.amount)} төлөгдсөн гэж тэмдэглэх үү?`)) return;
    setBusy(`inv-${inv.id}`);
    const res = await fetch('/api/superadmin/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_paid', id: inv.id, paid_amount: inv.amount }),
    });
    const data = await res.json();
    setBusy(null);
    if (data.error) { alert(data.error); return; }
    await load();
  };

  if (loading) return <div className="p-6 text-gray-400">Ачаалж байна...</div>;

  const active = customers.filter(c => c.claim_status === 'active');
  const totalApartments = active.reduce((s, c) => s + c.apartments, 0);
  const monthlyTotal = active.filter(c => c.billing_active).reduce((s, c) => s + c.monthly_fee, 0);
  const unpaidTotal = customers.reduce((s, c) => s + c.unpaid_total, 0);
  const paidTotal = customers.reduce((s, c) => s + c.paid_total, 0);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-1 text-white">🤝 Хэрэглэгч СӨХ</h1>
      <p className="text-sm text-gray-400 mb-6">
        Идэвхжсэн болон бүртгэл хийгдэж буй СӨХ-үүд. Лавлахын СӨХ-үүд{' '}
        <a href="/mng-ctrl/organizations" className="text-blue-400 hover:underline">СӨХ-үүд</a> хуудсанд.
      </p>

      {!migrated && (
        <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-4 mb-6">
          <p className="text-sm font-semibold text-amber-300">⚠️ Тарифын хүснэгт үүсээгүй байна</p>
          <p className="text-xs text-amber-200/80 mt-1">
            Дүнг үндсэн тарифаар (1,500₮ / 1,000₮) тооцож харуулж байна. Тарифыг засах,
            төлбөр бүртгэхийн тулд <code className="bg-black/30 px-1 rounded">supabase-platform-tariff-migration.sql</code>-ийг
            Supabase → SQL Editor дээр ажиллуулна уу.
          </p>
        </div>
      )}

      {error && <p className="text-sm text-red-400 bg-red-500/10 rounded-lg p-3 mb-6">{error}</p>}

      {/* Нийт үзүүлэлт */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-600/15 border border-blue-500/30 rounded-2xl p-4">
          <p className="text-xs text-blue-300">Идэвхтэй СӨХ</p>
          <p className="text-2xl font-bold text-blue-200">{active.length}</p>
        </div>
        <div className="bg-purple-600/15 border border-purple-500/30 rounded-2xl p-4">
          <p className="text-xs text-purple-300">Нийт айл</p>
          <p className="text-2xl font-bold text-purple-200">{totalApartments.toLocaleString()}</p>
        </div>
        <div className="bg-green-600/15 border border-green-500/30 rounded-2xl p-4">
          <p className="text-xs text-green-300">Сард орох ёстой</p>
          <p className="text-2xl font-bold text-green-200">{money(monthlyTotal)}</p>
        </div>
        <div className="bg-amber-600/15 border border-amber-500/30 rounded-2xl p-4">
          <p className="text-xs text-amber-300">Төлөгдөөгүй</p>
          <p className="text-2xl font-bold text-amber-200">{money(unpaidTotal)}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">төлөгдсөн {money(paidTotal)}</p>
        </div>
      </div>

      {tariff && (
        <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 mb-6 flex items-center justify-between">
          <p className="text-xs text-gray-300">
            Тариф: суурилуулалт <b className="text-white">{money(tariff.setup_per_unit)}</b>/айл ·
            сар бүр <b className="text-white">{money(tariff.monthly_per_unit)}</b>/айл ·
            үнэгүй {tariff.free_months_threshold} айлаас доош <b className="text-white">{tariff.free_months_below}</b> сар,
            их бол <b className="text-white">{tariff.free_months_above}</b> сар
          </p>
          <a href="/mng-ctrl/plans" className="text-xs text-blue-400 hover:underline shrink-0 ml-4">Тариф засах</a>
        </div>
      )}

      {/* Жагсаалт */}
      <div className="space-y-3">
        {customers.length === 0 && (
          <p className="text-gray-500 text-sm">Хэрэглэгч СӨХ алга.</p>
        )}

        {customers.map(c => {
          const isOpen = openId === c.id;
          const isActive = c.claim_status === 'active';
          return (
            <div key={c.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              {/* Мөр */}
              <button
                onClick={() => setOpenId(isOpen ? null : c.id)}
                className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-white/5 transition"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-white truncate">{c.name}</p>
                  <p className="text-xs text-gray-400">
                    {c.apartments} айл · {isActive ? `идэвхжсэн ${mnDate(c.activated_at)}` : 'идэвхжээгүй'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-white">{money(c.monthly_fee)}</p>
                  <p className="text-[11px] text-gray-400">сарын хураамж</p>
                </div>
                <div className="text-right shrink-0 w-40">
                  {!isActive ? (
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-500/20 text-gray-300">Идэвхжээгүй</span>
                  ) : !c.billing_active ? (
                    <span className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-300">
                      Үнэгүй {c.free_months} сар
                    </span>
                  ) : c.unpaid_total > 0 ? (
                    <span className="text-xs px-2 py-1 rounded-full bg-amber-500/20 text-amber-300">
                      {money(c.unpaid_total)} төлөгдөөгүй
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-300">Цэвэр</span>
                  )}
                </div>
                <span className="text-gray-500 text-xs shrink-0">{isOpen ? '▲' : '▼'}</span>
              </button>

              {/* Карт */}
              {isOpen && (
                <div className="border-t border-white/10 px-4 py-4 grid grid-cols-3 gap-4">
                  {/* Байгууллага */}
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Байгууллага</p>
                    <dl className="space-y-1.5 text-sm">
                      <div className="flex justify-between gap-2">
                        <dt className="text-gray-400">Утас</dt>
                        <dd className="text-white">{c.phone || '—'}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-gray-400">Айл</dt>
                        <dd className="text-white">{c.apartments}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-gray-400">Өртэй айл</dt>
                        <dd className="text-white">{c.debtors}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-gray-400">Оршин суугчийн өр</dt>
                        <dd className="text-white">{money(c.debt_total)}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-gray-400">Идэвхжсэн</dt>
                        <dd className="text-white">{mnDate(c.activated_at)}</dd>
                      </div>
                    </dl>
                  </div>

                  {/* Нэвтрэх эрх */}
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Нэвтрэх эрх</p>
                    {c.admins.length === 0 ? (
                      <p className="text-sm text-amber-300">⚠ Бүртгэл байхгүй — дарга нэвтэрч чадахгүй</p>
                    ) : (
                      <ul className="space-y-1.5 text-sm">
                        {c.admins.map(a => (
                          <li key={a.id} className="flex justify-between gap-2">
                            <span className="text-white truncate">{a.username}</span>
                            <span className="text-gray-400 shrink-0">
                              {ROLE_LABEL[a.role] || a.role}
                              {a.status !== 'active' && ' · хаагдсан'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
                      Нууц үг хашлагдсан тул харагдахгүй.{' '}
                      <a href="/mng-ctrl/admins" className="text-blue-400 hover:underline">Админ эрх</a>{' '}
                      хуудаснаас шинэчилнэ.
                    </p>
                    {c.activation_token && (
                      <p className="text-[11px] text-gray-400 mt-2">
                        Идэвхжүүлэх код:{' '}
                        {c.activation_token.used
                          ? 'ашигласан'
                          : c.activation_token.expired
                            ? 'хугацаа дууссан'
                            : `хүчинтэй — ${mnDate(c.activation_token.expires_at)} хүртэл`}
                      </p>
                    )}
                  </div>

                  {/* Төлбөр */}
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Төлбөр</p>
                    <dl className="space-y-1.5 text-sm">
                      <div className="flex justify-between gap-2">
                        <dt className="text-gray-400">Суурилуулалт</dt>
                        <dd className="text-white">
                          {money(c.setup_fee)}
                          {c.setup_invoice
                            ? c.setup_invoice.status === 'paid'
                              ? <span className="text-green-400"> ✓ төлсөн</span>
                              : <span className="text-amber-400"> · төлөгдөөгүй</span>
                            : <span className="text-gray-500"> · бүртгээгүй</span>}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-gray-400">Сарын хураамж</dt>
                        <dd className="text-white">{money(c.monthly_fee)}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-gray-400">Үнэгүй хугацаа</dt>
                        <dd className="text-white">{c.free_months} сар</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-gray-400">Төлбөр эхлэх</dt>
                        <dd className="text-white">{mnDate(c.billing_starts_at)}</dd>
                      </div>
                      {c.next_period && (
                        <div className="flex justify-between gap-2">
                          <dt className="text-gray-400">Дараагийн төлбөр</dt>
                          <dd className="text-white">
                            {c.next_period.year} оны {c.next_period.month} сар · {money(c.next_period.amount)}
                          </dd>
                        </div>
                      )}
                    </dl>

                    {isActive && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {!c.setup_invoice && c.apartments > 0 && (
                          <button
                            onClick={() => {
                              const d = c.activated_at ? new Date(c.activated_at) : new Date();
                              createInvoice(c, 'setup', d.getFullYear(), d.getMonth() + 1, true);
                            }}
                            disabled={!!busy}
                            className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white disabled:opacity-50"
                          >
                            Суурилуулалт төлсөн гэж бүртгэх
                          </button>
                        )}
                        {c.next_period && c.billing_active && (
                          <button
                            onClick={() => createInvoice(c, 'monthly', c.next_period!.year, c.next_period!.month, false)}
                            disabled={!!busy}
                            className="text-xs px-3 py-1.5 rounded-lg bg-white/10 text-white disabled:opacity-50"
                          >
                            {c.next_period.month} сарын нэхэмжлэх үүсгэх
                          </button>
                        )}
                      </div>
                    )}

                    {/* Нэхэмжлэлийн түүх */}
                    {c.invoices.length > 0 && (
                      <div className="mt-3 space-y-1">
                        {c.invoices.map(inv => (
                          <div key={inv.id} className="flex items-center justify-between gap-2 text-xs">
                            <span className="text-gray-400">
                              {inv.kind === 'setup'
                                ? 'Суурилуулалт'
                                : `${inv.period_year}/${String(inv.period_month).padStart(2, '0')}`}
                            </span>
                            <span className="text-white">{money(inv.amount)}</span>
                            {inv.status === 'paid' ? (
                              <span className="text-green-400 shrink-0">✓ {mnDate(inv.paid_at)}</span>
                            ) : (
                              <button
                                onClick={() => markPaid(inv)}
                                disabled={busy === `inv-${inv.id}`}
                                className="text-blue-400 hover:underline shrink-0 disabled:opacity-50"
                              >
                                Төлсөн гэж тэмдэглэх
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
