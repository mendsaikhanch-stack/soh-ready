'use client';

// Хэрэглэгч болсон СӨХ бүрийн нэгдсэн карт.
//
// /mng-ctrl/organizations нь лавлахын 1200 СӨХ-г импортлох, идэвхжүүлэх
// зориулалттай — тэндээ л үлдэнэ. Энэ хуудас нь ЗӨВХӨН бидний хэрэглэгч
// болсон СӨХ-үүдийг: хэдэн айлтай, хэн эрхтэй, хэдийг төлсөн, дараа нь
// хэзээ хэдийг төлөхийг нэг дор харуулна.
//
// Нийлбэрийг сервер тооцоод өгнө (`totals`) — дэлгэц дээр дахин нэмбэл
// хоёр газар зөрөх эрсдэлтэй.

import { useState, useEffect } from 'react';

interface AdminAcct {
  id: number;
  username: string;
  role: string;
  status: string;
  display_name: string | null;
  last_login_at: string | null;
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

interface ContractState {
  number: string | null;
  unlocked_at: string | null;
  downloaded_at: string | null;
}

interface MonthRow {
  year: number;
  month: number;
  amount: number;
  status: 'paid' | 'pending' | 'missing';
  invoice_id: number | null;
  due_date: string | null;
  paid_at: string | null;
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
  is_demo: boolean;
  apartments: number;
  registered_units: number | null;
  debt_total: number;
  debtors: number;
  accounts: number;
  signed_in: number;
  active_7d: number;
  active_30d: number;
  last_login_at: string | null;
  admins: AdminAcct[];
  activation_token: { expires_at: string; used: boolean; expired: boolean } | null;
  setup_fee: number;
  monthly_fee: number;
  free_months: number;
  free_months_default: number;
  free_months_override: number | null;
  months: MonthRow[];
  unbilled_months: number;
  unpaid_months: number;
  settled_at: string | null;
  settled_note: string | null;
  settled_by: string | null;
  billing_note: string | null;
  billing_starts_at: string | null;
  billing_active: boolean;
  contract: ContractState | null;
  setup_invoice: Invoice | null;
  next_period: NextPeriod | null;
  invoices: Invoice[];
  unpaid_total: number;
  paid_total: number;
}

interface Totals {
  customers: number;
  active: number;
  apartments: number;
  monthly_billable: number;
  monthly_when_all_billing: number;
  setup_expected: number;
  paid_total: number;
  unpaid_total: number;
  resident_debt: number;
  residents: number;
  accounts: number;
  signed_in: number;
  active_7d: number;
  active_30d: number;
  admin_accounts: number;
  admins_signed_in: number;
  unbilled_months: number;
  orgs_unbilled: number;
  orgs_unsettled: number;
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
  const [totals, setTotals] = useState<Totals | null>(null);
  const [tariff, setTariff] = useState<Tariff | null>(null);
  const [migrated, setMigrated] = useState(true);
  const [contractMigrated, setContractMigrated] = useState(true);
  const [billingMigrated, setBillingMigrated] = useState(true);
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
      setTotals(data.totals || null);
      setTariff(data.tariff || null);
      setMigrated(data.migrated !== false);
      setContractMigrated(data.contract_migrated !== false);
      setBillingMigrated(data.billing_migrated !== false);
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

  // Гэрээ татах эрх — нээмэгц тухайн СӨХ-ийн дарга /admin/contract дээрээсээ
  // өөрийн дүнгээр бодогдсон гэрээгээ татна.
  const toggleContract = async (c: Customer) => {
    const unlocked = !!c.contract?.unlocked_at;
    const msg = unlocked
      ? `${c.name}\n\nГэрээ татах эрхийг хаах уу? Дарга гэрээгээ харахаа болино.`
      : `${c.name}\n\n${c.apartments} айл · суурилуулалт ${money(c.setup_fee)} · сарын ${money(c.monthly_fee)}\n\n` +
        'Гэрээ татах эрхийг нээх үү? Дарга энэ дүнгээр бодогдсон гэрээгээ татаж авна.';
    if (!confirm(msg)) return;

    setBusy(`contract-${c.id}`);
    const res = await fetch('/api/superadmin/customers/contract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sokh_id: c.id, action: unlocked ? 'lock' : 'unlock' }),
    });
    const data = await res.json();
    setBusy(null);
    if (data.error) { alert(data.error); return; }
    await load();
  };

  // Төлбөр орсныг бүртгэх. Мөнгө өчигдөр орсныг өнөөдөр тэмдэглэх нь элбэг
  // тул огноог асууна — хоосон орхивол өнөөдрөөр бичнэ.
  const markPaid = async (id: number, amount: number) => {
    const today = new Date().toISOString().slice(0, 10);
    const when = prompt(
      `${money(amount)} хэзээ орсон бэ?

Огноог ЖЖЖЖ-СС-ӨӨ хэлбэрээр бичнэ үү.`,
      today,
    );
    if (when === null) return;
    const paidAt = when.trim() || today;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paidAt)) {
      alert('Огноог 2026-08-28 хэлбэрээр бичнэ үү.');
      return;
    }

    setBusy(`inv-${id}`);
    const res = await fetch('/api/superadmin/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_paid', id, paid_amount: amount, paid_at: paidAt }),
    });
    const data = await res.json();
    setBusy(null);
    if (data.error) { alert(data.error); return; }
    await load();
  };

  // Андуурч тэмдэглэсэн, эсвэл мөнгө буцаагдсан үед
  const unmarkPaid = async (id: number, amount: number) => {
    if (!confirm(`${money(amount)} төлөгдсөн тэмдэглэгээг буцаах уу?`)) return;
    setBusy(`inv-${id}`);
    const res = await fetch('/api/superadmin/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'unmark_paid', id }),
    });
    const data = await res.json();
    setBusy(null);
    if (data.error) { alert(data.error); return; }
    await load();
  };

  // Нээсэн огноо, үнэгүй сар, тооцооны тэмдэглэгээ — бүгд нэг API-аар
  const saveBilling = async (
    sokhId: number,
    action: 'set_activated_at' | 'set_free_months' | 'set_note' | 'settle' | 'unsettle',
    payload: Record<string, unknown> = {},
  ) => {
    setBusy(`billing-${sokhId}`);
    const res = await fetch('/api/superadmin/customers/billing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sokh_id: sokhId, action, ...payload }),
    });
    const data = await res.json();
    setBusy(null);
    if (data.error) { alert(data.error); return; }
    await load();
  };

  if (loading) return <div className="p-6 text-gray-400">Ачаалж байна...</div>;

  const real = customers.filter(c => !c.is_demo);
  const demo = customers.filter(c => c.is_demo);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-1 text-white">🤝 Хэрэглэгч СӨХ</h1>
      <p className="text-sm text-gray-400 mb-6">
        Системд орсон СӨХ бүр — айлын тоо, Хотолд төлөх төлбөртэй нь.
        Лавлахын СӨХ-үүд{' '}
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

      {migrated && !billingMigrated && (
        <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-4 mb-6">
          <p className="text-sm font-semibold text-amber-300">⚠️ Төлбөрийн гар удирдлага асаагүй байна</p>
          <p className="text-xs text-amber-200/80 mt-1">
            Нээсэн огноог засах, үнэгүй сар сунгах, тооцоо хийсэн гэж тэмдэглэх боломж
            ажиллахгүй. <code className="bg-black/30 px-1 rounded">supabase-billing-control-migration.sql</code>-ийг
            Supabase → SQL Editor дээр ажиллуулна уу.
          </p>
        </div>
      )}

      {error && <p className="text-sm text-red-400 bg-red-500/10 rounded-lg p-3 mb-6">{error}</p>}

      {/* Нийт үзүүлэлт */}
      {totals && (
        <div className="grid grid-cols-6 gap-4 mb-6">
          <div className="bg-blue-600/15 border border-blue-500/30 rounded-2xl p-4">
            <p className="text-xs text-blue-300">Идэвхтэй СӨХ</p>
            <p className="text-2xl font-bold text-blue-200">{totals.active}</p>
          </div>
          <div className="bg-purple-600/15 border border-purple-500/30 rounded-2xl p-4">
            <p className="text-xs text-purple-300">Нийт айл</p>
            <p className="text-2xl font-bold text-purple-200">{totals.apartments.toLocaleString()}</p>
          </div>
          <div className="bg-green-600/15 border border-green-500/30 rounded-2xl p-4">
            <p className="text-xs text-green-300">Сард орох ёстой</p>
            <p className="text-2xl font-bold text-green-200">{money(totals.monthly_billable)}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              үнэгүй хугацаа дуусахад {money(totals.monthly_when_all_billing)}
            </p>
          </div>
          <div className="bg-cyan-600/15 border border-cyan-500/30 rounded-2xl p-4">
            <p className="text-xs text-cyan-300">Аппаа нээсэн айл</p>
            <p className="text-2xl font-bold text-cyan-200">{totals.signed_in.toLocaleString()}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              нэвтрэх эрхтэй {totals.accounts.toLocaleString()} · 30 хоногт {totals.active_30d.toLocaleString()}
            </p>
          </div>
          <div className="bg-amber-600/15 border border-amber-500/30 rounded-2xl p-4">
            <p className="text-xs text-amber-300">Төлөгдөөгүй</p>
            <p className="text-2xl font-bold text-amber-200">{money(totals.unpaid_total)}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">төлөгдсөн {money(totals.paid_total)}</p>
          </div>
          <div className={`rounded-2xl p-4 border ${
            totals.unbilled_months > 0
              ? 'bg-red-600/15 border-red-500/30'
              : 'bg-white/5 border-white/10'
          }`}>
            <p className={`text-xs ${totals.unbilled_months > 0 ? 'text-red-300' : 'text-gray-400'}`}>
              Тооцоо хийгээгүй
            </p>
            <p className={`text-2xl font-bold ${totals.unbilled_months > 0 ? 'text-red-200' : 'text-gray-300'}`}>
              {totals.unbilled_months} сар
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {totals.orgs_unbilled} СӨХ-д · тооцоо тэмдэглээгүй {totals.orgs_unsettled}
            </p>
          </div>
        </div>
      )}

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
      {customers.length === 0 ? (
        <p className="text-gray-500 text-sm">Хэрэглэгч СӨХ алга.</p>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-[1fr_7rem_9rem_9rem_10rem_1.5rem] gap-3 px-4 py-2.5 text-[11px] uppercase tracking-wide text-gray-500 border-b border-white/10">
            <span>СӨХ</span>
            <span className="text-right">Айл</span>
            <span className="text-right">Суурилуулалт</span>
            <span className="text-right">Сарын төлбөр</span>
            <span className="text-right">Төлөв</span>
            <span />
          </div>

          {real.map(c => (
            <CustomerRow
              key={c.id}
              c={c}
              isOpen={openId === c.id}
              onToggle={() => setOpenId(openId === c.id ? null : c.id)}
              busy={busy}
              createInvoice={createInvoice}
              markPaid={markPaid}
              unmarkPaid={unmarkPaid}
              saveBilling={saveBilling}
              toggleContract={toggleContract}
              contractMigrated={contractMigrated}
              billingMigrated={billingMigrated}
            />
          ))}

          {totals && real.length > 0 && (
            <div className="grid grid-cols-[1fr_7rem_9rem_9rem_10rem_1.5rem] gap-3 px-4 py-3 text-sm bg-white/5 border-t border-white/10">
              <span className="text-gray-400">Нийт ({totals.active} идэвхтэй)</span>
              <span className="text-right font-bold text-white">
                {totals.apartments.toLocaleString()}
                <span className="block text-[10px] font-normal text-cyan-300">
                  {totals.signed_in} нэвтэрсэн
                </span>
              </span>
              <span className="text-right font-bold text-white">{money(totals.setup_expected)}</span>
              <span className="text-right font-bold text-white">{money(totals.monthly_when_all_billing)}</span>
              <span className="text-right text-gray-400 text-xs">
                {totals.unpaid_total > 0 ? `${money(totals.unpaid_total)} авах` : 'бүгд төлөгдсөн'}
              </span>
              <span />
            </div>
          )}

          {demo.length > 0 && (
            <>
              <div className="px-4 py-2 text-[11px] text-gray-500 bg-black/20 border-t border-white/10">
                Туршилтын СӨХ — нийлбэрт ороогүй
              </div>
              {demo.map(c => (
                <CustomerRow
                  key={c.id}
                  c={c}
                  isOpen={openId === c.id}
                  onToggle={() => setOpenId(openId === c.id ? null : c.id)}
                  busy={busy}
                  createInvoice={createInvoice}
                  markPaid={markPaid}
                  unmarkPaid={unmarkPaid}
                  saveBilling={saveBilling}
                  toggleContract={toggleContract}
                  contractMigrated={contractMigrated}
                  billingMigrated={billingMigrated}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CustomerRow({
  c, isOpen, onToggle, busy, createInvoice, markPaid, unmarkPaid, saveBilling,
  toggleContract, contractMigrated, billingMigrated,
}: {
  c: Customer;
  isOpen: boolean;
  onToggle: () => void;
  busy: string | null;
  createInvoice: (c: Customer, kind: 'setup' | 'monthly', y: number, m: number, paid: boolean) => void;
  markPaid: (id: number, amount: number) => void;
  unmarkPaid: (id: number, amount: number) => void;
  saveBilling: (
    sokhId: number,
    action: 'set_activated_at' | 'set_free_months' | 'set_note' | 'settle' | 'unsettle',
    payload?: Record<string, unknown>,
  ) => void;
  toggleContract: (c: Customer) => void;
  contractMigrated: boolean;
  billingMigrated: boolean;
}) {
  const isActive = c.claim_status === 'active';

  return (
    <div className="border-t border-white/5 first:border-t-0">
      <button
        onClick={onToggle}
        className="w-full grid grid-cols-[1fr_7rem_9rem_9rem_10rem_1.5rem] gap-3 items-center px-4 py-3 text-left hover:bg-white/5 transition"
      >
        <div className="min-w-0">
          <p className="font-semibold text-white truncate">
            {c.name}
            {c.is_demo && <span className="ml-2 text-[10px] text-gray-500">туршилт</span>}
          </p>
          <p className="text-xs text-gray-500 truncate">
            {isActive ? `идэвхжсэн ${mnDate(c.activated_at)}` : 'идэвхжээгүй'}
            {c.address ? ` · ${c.address}` : ''}
          </p>
        </div>

        <div className="text-right">
          <p className="text-sm font-semibold text-white">{c.apartments || '—'}</p>
          {c.registered_units != null && c.registered_units !== c.apartments && (
            <p className="text-[10px] text-gray-500">лавлахад {c.registered_units}</p>
          )}
          <p className="text-[10px]">
            {c.accounts === 0 ? (
              <span className="text-gray-600">нэвтрэх эрх алга</span>
            ) : c.signed_in === 0 ? (
              <span className="text-amber-400">хэн ч нэвтрээгүй</span>
            ) : (
              <span className="text-cyan-300">{c.signed_in} нэвтэрсэн</span>
            )}
          </p>
        </div>

        <div className="text-right">
          <p className="text-sm text-white">{c.apartments ? money(c.setup_fee) : '—'}</p>
          <p className="text-[10px]">
            {!c.apartments ? (
              <span className="text-gray-600">айл ороогүй</span>
            ) : c.setup_invoice?.status === 'paid' ? (
              <span className="text-green-400">✓ төлсөн</span>
            ) : c.setup_invoice ? (
              <span className="text-amber-400">нэхэмжилсэн</span>
            ) : (
              <span className="text-red-400">бүртгээгүй</span>
            )}
          </p>
        </div>

        <div className="text-right">
          <p className="text-sm text-white">{c.apartments ? money(c.monthly_fee) : '—'}</p>
          <p className="text-[10px] text-gray-500">
            {c.billing_active
              ? `${mnDate(c.billing_starts_at)}-наас`
              : c.billing_starts_at
                ? `${mnDate(c.billing_starts_at)}-нд эхэлнэ`
                : 'эхлээгүй'}
          </p>
        </div>

        <div className="text-right">
          {!isActive ? (
            <span className="text-xs px-2 py-1 rounded-full bg-gray-500/20 text-gray-300">Идэвхжээгүй</span>
          ) : c.apartments === 0 ? (
            <span className="text-xs px-2 py-1 rounded-full bg-red-500/20 text-red-300">Өгөгдөл алга</span>
          ) : !c.billing_active ? (
            <span className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-300">
              Үнэгүй {c.free_months} сар
            </span>
          ) : c.unbilled_months > 0 ? (
            <span className="text-xs px-2 py-1 rounded-full bg-red-500/20 text-red-300">
              {c.unbilled_months} сар тооцоогүй
            </span>
          ) : c.unpaid_total > 0 ? (
            <span className="text-xs px-2 py-1 rounded-full bg-amber-500/20 text-amber-300">
              {money(c.unpaid_total)} авах
            </span>
          ) : (
            <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-300">Цэвэр</span>
          )}
        </div>

        <span className="text-gray-500 text-xs text-right">{isOpen ? '▲' : '▼'}</span>
      </button>

      {/* Карт */}
      {isOpen && (
        <div className="border-t border-white/10 px-4 py-4 grid grid-cols-3 gap-4 bg-black/20">
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

            <p className="text-[11px] uppercase tracking-wide text-gray-500 mt-4 mb-2">Апп ашиглалт</p>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-gray-400">Нэвтрэх эрхтэй</dt>
                <dd className="text-white">{c.accounts} / {c.apartments}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-400">Нэвтэрч үзсэн</dt>
                <dd className={c.signed_in ? 'text-cyan-300' : 'text-amber-300'}>{c.signed_in}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-400">30 хоногт нэвтэрсэн</dt>
                <dd className="text-white">{c.active_30d}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-400">Сүүлийн нэвтрэлт</dt>
                <dd className="text-white">{mnDate(c.last_login_at)}</dd>
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
                  <li key={a.id}>
                    <div className="flex justify-between gap-2">
                      <span className="text-white truncate">{a.username}</span>
                      <span className="text-gray-400 shrink-0">
                        {ROLE_LABEL[a.role] || a.role}
                        {a.status !== 'active' && ' · хаагдсан'}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500">
                      {a.last_login_at
                        ? `сүүлд нэвтэрсэн ${mnDate(a.last_login_at)}`
                        : 'нэвтэрсэн бүртгэл алга'}
                    </p>
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
            <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Хотолд төлөх төлбөр</p>
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

            {billingMigrated && (
              <BillingControls
                // Хадгалсны дараа шинэ утгаар дахин үүснэ
                key={`${c.activated_at}|${c.free_months_override}|${c.billing_note}`}
                c={c}
                busy={busy}
                saveBilling={saveBilling}
              />
            )}

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

            {/* Үйлчилгээний гэрээ — эрх нээснээр дарга өөрөө татна */}
            <div className="mt-4 pt-3 border-t border-white/10">
              <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Үйлчилгээний гэрээ</p>
              {!contractMigrated ? (
                <p className="text-xs text-amber-300">
                  ⚠ <code className="bg-black/30 px-1 rounded">supabase-service-contract-migration.sql</code> ажиллаагүй
                </p>
              ) : (
                <>
                  <p className="text-sm">
                    {c.contract?.unlocked_at ? (
                      <span className="text-green-400">
                        ✓ Нээгдсэн {mnDate(c.contract.unlocked_at)}
                        {c.contract.number ? ` · ${c.contract.number}` : ''}
                      </span>
                    ) : (
                      <span className="text-gray-400">Хаалттай — дарга гэрээгээ харахгүй</span>
                    )}
                  </p>
                  {c.contract?.downloaded_at && (
                    <p className="text-[11px] text-gray-500">
                      дарга сүүлд татсан {mnDate(c.contract.downloaded_at)}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-2">
                    <button
                      onClick={() => toggleContract(c)}
                      disabled={busy === `contract-${c.id}`}
                      className={`text-xs px-3 py-1.5 rounded-lg disabled:opacity-50 ${
                        c.contract?.unlocked_at
                          ? 'bg-white/10 text-white'
                          : 'bg-green-600 text-white'
                      }`}
                    >
                      {c.contract?.unlocked_at ? 'Эрхийг хаах' : 'Гэрээ татах эрх нээх'}
                    </button>
                    <a
                      href={`/api/superadmin/customers/contract?sokh_id=${c.id}&format=preview`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-gray-200 hover:bg-white/10"
                    >
                      Гэрээг харах
                    </a>
                  </div>
                </>
              )}
            </div>

            {/* Тооцооны хуанли — сар бүр тооцоо хийгдсэн үү */}
            {isActive && c.apartments > 0 && (
              <div className="mt-4 pt-3 border-t border-white/10">
                <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">
                  Сар бүрийн тооцоо
                  {c.unbilled_months > 0 && (
                    <span className="ml-2 text-red-400 normal-case tracking-normal">
                      {c.unbilled_months} сар хийгдээгүй
                    </span>
                  )}
                </p>
                {c.months.length === 0 ? (
                  <p className="text-xs text-gray-500">
                    Төлбөр хараахан эхлээгүй — {mnDate(c.billing_starts_at)}-наас тоологдоно.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {c.months.map(m => (
                      <div key={`${m.year}-${m.month}`} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-gray-400 w-16 shrink-0">
                          {m.year}/{String(m.month).padStart(2, '0')}
                        </span>
                        <span className="text-white">{money(m.amount)}</span>
                        {m.status === 'paid' ? (
                          <span className="shrink-0">
                            <span className="text-green-400">✓ төлсөн {mnDate(m.paid_at)}</span>
                            <button
                              onClick={() => unmarkPaid(m.invoice_id!, m.amount)}
                              disabled={busy === `inv-${m.invoice_id}`}
                              className="ml-2 text-gray-500 hover:text-gray-300 disabled:opacity-50"
                            >
                              буцаах
                            </button>
                          </span>
                        ) : m.status === 'pending' ? (
                          <span className="shrink-0">
                            <span className="text-amber-400">нэхэмжилсэн</span>
                            <button
                              onClick={() => markPaid(m.invoice_id!, m.amount)}
                              disabled={busy === `inv-${m.invoice_id}`}
                              className="ml-2 text-blue-400 hover:underline disabled:opacity-50"
                            >
                              төлсөн
                            </button>
                          </span>
                        ) : (
                          <span className="shrink-0">
                            <span className="text-red-400">тооцоо хийгээгүй</span>
                            <button
                              onClick={() => createInvoice(c, 'monthly', m.year, m.month, false)}
                              disabled={!!busy}
                              className="ml-2 text-blue-400 hover:underline disabled:opacity-50"
                            >
                              нэхэмжлэх
                            </button>
                            <button
                              onClick={() => createInvoice(c, 'monthly', m.year, m.month, true)}
                              disabled={!!busy}
                              className="ml-2 text-green-400 hover:underline disabled:opacity-50"
                            >
                              төлсөн
                            </button>
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
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
                      <span className="shrink-0">
                        <span className="text-green-400">✓ {mnDate(inv.paid_at)}</span>
                        <button
                          onClick={() => unmarkPaid(inv.id, inv.amount)}
                          disabled={busy === `inv-${inv.id}`}
                          className="ml-2 text-gray-500 hover:text-gray-300 disabled:opacity-50"
                          title="Төлсөн тэмдэглэгээг буцаах"
                        >
                          буцаах
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => markPaid(inv.id, inv.amount)}
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
}

// Супер админы гар удирдлага: нээсэн огноо, үнэгүй сарын сунгалт,
// «тооцоо хийсэн» тэмдэглэгээ, чөлөөт тэмдэглэл.
//
// Нээсэн огноо нь бүх тооцооны эх — үнэгүй хугацаа, төлбөр эхлэх өдөр,
// тооцоот сарууд бүгд түүнээс тоологдоно. Тиймээс засварыг баталгаажуулж
// авна.
function BillingControls({
  c, busy, saveBilling,
}: {
  c: Customer;
  busy: string | null;
  saveBilling: (
    sokhId: number,
    action: 'set_activated_at' | 'set_free_months' | 'set_note' | 'settle' | 'unsettle',
    payload?: Record<string, unknown>,
  ) => void;
}) {
  const dayValue = (iso: string | null) => (iso ? iso.slice(0, 10) : '');
  const [day, setDay] = useState(dayValue(c.activated_at));
  const [free, setFree] = useState(c.free_months_override == null ? '' : String(c.free_months_override));
  const [note, setNote] = useState(c.billing_note || '');
  const working = busy === `billing-${c.id}`;

  // Серверээс шинэ утга ирэхэд талбарууд шинэчлэгдэх ёстой. Үүнийг effect дотор
  // setState хийж биш, дуудаж буй тал нь `key`-г солиод бүрэлдэхүүнийг дахин
  // үүсгэснээр шийднэ (доорх BillingControls-ийн key-г үз).

  const saveDay = () => {
    if (day === dayValue(c.activated_at)) return;
    if (!confirm(
      `${c.name}

Нээсэн өдрийг ${day || '(хоосон)'} болгох уу?

` +
      'Үнэгүй хугацаа, төлбөр эхлэх өдөр, сар бүрийн тооцоо бүгд шинээр бодогдоно.'
    )) return;
    saveBilling(c.id, 'set_activated_at', { activated_at: day || null });
  };

  const saveFree = () => {
    const current = c.free_months_override == null ? '' : String(c.free_months_override);
    if (free === current) return;
    saveBilling(c.id, 'set_free_months', { free_months: free === '' ? null : Number(free) });
  };

  const settle = () => {
    const text = prompt(
      `${c.name} — тооцоо хийсэн гэж тэмдэглэх.

Тэмдэглэл (заавал биш):`,
      c.settled_note || '',
    );
    if (text === null) return;
    saveBilling(c.id, 'settle', { note: text });
  };

  return (
    <div className="mt-4 pt-3 border-t border-white/10 space-y-3">
      <p className="text-[11px] uppercase tracking-wide text-gray-500">Гар удирдлага</p>

      {/* Нээсэн өдөр */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 w-24 shrink-0">Нээсэн өдөр</span>
        <input
          type="date"
          value={day}
          onChange={e => setDay(e.target.value)}
          className="bg-black/30 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
        />
        <button
          onClick={saveDay}
          disabled={working || day === dayValue(c.activated_at)}
          className="text-xs px-2.5 py-1 rounded-lg bg-blue-600 text-white disabled:opacity-40"
        >
          Хадгалах
        </button>
      </div>

      {/* Үнэгүй сар */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 w-24 shrink-0">Үнэгүй сар</span>
        <input
          type="number"
          min={0}
          max={24}
          value={free}
          placeholder={String(c.free_months_default)}
          onChange={e => setFree(e.target.value)}
          className="bg-black/30 border border-white/10 rounded-lg px-2 py-1 text-xs text-white w-20"
        />
        <button
          onClick={saveFree}
          disabled={working || free === (c.free_months_override == null ? '' : String(c.free_months_override))}
          className="text-xs px-2.5 py-1 rounded-lg bg-blue-600 text-white disabled:opacity-40"
        >
          Хадгалах
        </button>
        {c.free_months_override != null && (
          <button
            onClick={() => saveBilling(c.id, 'set_free_months', { free_months: null })}
            disabled={working}
            className="text-xs text-gray-400 hover:text-white disabled:opacity-40"
          >
            ерөнхий дүрэм рүү буцаах ({c.free_months_default} сар)
          </button>
        )}
      </div>
      <p className="text-[11px] text-gray-500 -mt-1.5 ml-26">
        {c.free_months_override != null
          ? `Сунгасан: ${c.free_months} сар (ерөнхий дүрмээр ${c.free_months_default})`
          : `Ерөнхий дүрмээр ${c.free_months_default} сар. Сунгах бол тоо бичнэ.`}
      </p>

      {/* Тооцоо хийсэн эсэх */}
      <div className="flex items-start gap-2">
        <span className="text-xs text-gray-400 w-24 shrink-0 pt-1">Тооцоо</span>
        <div className="min-w-0">
          {c.settled_at ? (
            <p className="text-xs text-green-400">
              ✓ хийсэн {mnDate(c.settled_at)}
              {c.settled_note && <span className="text-gray-400"> · {c.settled_note}</span>}
            </p>
          ) : (
            <p className="text-xs text-amber-400">Хараахан тэмдэглээгүй</p>
          )}
          <div className="flex gap-2 mt-1">
            <button
              onClick={settle}
              disabled={working}
              className="text-xs px-2.5 py-1 rounded-lg bg-green-600 text-white disabled:opacity-40"
            >
              {c.settled_at ? 'Дахин тэмдэглэх' : 'Тооцоо хийсэн'}
            </button>
            {c.settled_at && (
              <button
                onClick={() => saveBilling(c.id, 'unsettle')}
                disabled={working}
                className="text-xs text-gray-400 hover:text-white disabled:opacity-40"
              >
                арилгах
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Тэмдэглэл */}
      <div className="flex items-start gap-2">
        <span className="text-xs text-gray-400 w-24 shrink-0 pt-1">Тэмдэглэл</span>
        <div className="flex-1 min-w-0">
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={2}
            placeholder="жнь: 9 сарын төлбөрийг 10 сард нийлүүлж төлнө гэсэн"
            className="w-full bg-black/30 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
          />
          <button
            onClick={() => saveBilling(c.id, 'set_note', { note })}
            disabled={working || note === (c.billing_note || '')}
            className="text-xs px-2.5 py-1 rounded-lg bg-white/10 text-white mt-1 disabled:opacity-40"
          >
            Тэмдэглэл хадгалах
          </button>
        </div>
      </div>
    </div>
  );
}
