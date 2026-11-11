'use client';

import { useState, useEffect } from 'react';
import { adminFrom } from '@/app/lib/admin-db';
import { getAdminSokhId } from '@/app/lib/admin-config';
import * as XLSX from 'xlsx';
import { UNIT_SCHEMES } from '@/app/lib/bank-sms/unit-address';

interface Resident { id: number; name: string; apartment: string; debt: number; building: string | null; entrance: string | null; }
interface Payment { id: number; resident_id: number; amount: number; description: string; paid_at: string; }

/** Оршин суугчийн "Би шилжүүлсэн" мэдэгдэл — дарга банкны хуулгатай тулгаж баталгаажуулна */
interface PaymentNotice {
  id: number;
  resident_id: number;
  amount: number;
  description: string | null;
  status: string;
  created_at: string;
  resident_name?: string | null;
  unit?: string | null;
  has_invoices?: boolean;
  open_due?: number;
  same_resident_pending?: number;
}

/** Өр барагдуулах гэрээ. agreed_payment_plan-ыг CreateDebtAgreementModal бичдэг. */
interface DebtAgreement {
  id: string;
  resident_id: number;
  total_debt: number;
  status: string;
  agreed_payment_plan: {
    months?: number;
    monthly_amount?: number;
    start_date?: string;
    installments?: { no: number; due_date: string; amount: number }[];
    note?: string;
  } | null;
  signed_at: string | null;
  created_at: string;
}

/** Гэрээний төлөв — оршин суугчийн талын нэр томъёотой ижил ("Хүлээгдэж буй"/"Хүчинтэй") */
const AGREEMENT_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Хүлээгдэж буй', cls: 'bg-amber-100 text-amber-800' },
  signed: { label: 'Хүчинтэй', cls: 'bg-green-100 text-green-700' },
  completed: { label: 'Төлж дууссан', cls: 'bg-blue-100 text-blue-700' },
  cancelled: { label: 'Цуцалсан', cls: 'bg-gray-100 text-gray-500' },
  broken: { label: 'Зөрчсөн', cls: 'bg-red-100 text-red-600' },
};

/** /admin/bank-account дээр тохируулсан хураамж хүлээн авах данс */
interface BankRow {
  id: number;
  sort_order?: number | null;
  bank_name: string;
  account_number: string;
  account_holder: string;
  qr_image_url: string | null;
}

export default function AdminPayments() {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  // Айл бүрийн нээлттэй нэхэмжлэхийн үлдэгдэл. residents.debt талбар нь нэхэмжлэх
  // үүсгэхэд нэмэгддэггүй тул (ICTown-д 432 нээлттэй нэхэмжлэхтэй атлаа бүгд 0) өрийг
  // нэхэмжлэхээс тооцно.
  const [openDue, setOpenDue] = useState<Record<number, number>>({});
  const [notices, setNotices] = useState<PaymentNotice[]>([]);
  const [resolving, setResolving] = useState<number | null>(null);
  const [bankRow, setBankRow] = useState<BankRow | null>(null);
  const [bankCount, setBankCount] = useState(0);
  const [agreements, setAgreements] = useState<DebtAgreement[]>([]);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'record' | 'agreements' | 'bank'>('overview');
  const [showForm, setShowForm] = useState(false);
  const [selectedResident, setSelectedResident] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('Сарын төлбөр');
  const [saving, setSaving] = useState(false);
  const [sokhId, setSokhId] = useState(0);
  const [openEntrance, setOpenEntrance] = useState<string | null>(null);   // задалсан орц

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const sokhId = await getAdminSokhId();
    setSokhId(sokhId);
    // adminFrom proxy ашиглана — admin нь Supabase auth биш тул anon client RLS-д блоклогддог.
    const { data: res } = await adminFrom('residents').select('id,name,apartment,debt,building,entrance').eq('sokh_id', sokhId).order('apartment', { ascending: true });
    const residentList = (res as unknown as Resident[]) || [];
    setResidents(residentList);
    // payments нь sokh_id шууд байхгүй — proxy resident_id-ээр scope хийдэг тул айлуудын id-аар уншина.
    const residentIds = residentList.map(r => r.id);
    const { data: pay } = residentIds.length
      ? await adminFrom('payments').select('*').in('resident_id', residentIds).order('paid_at', { ascending: false })
      : { data: [] };
    // Өмнө нь .limit(50) байсан тул «Нийт цуглуулсан», «Энэ сарын орлого», Excel татах нь
    // зөвхөн сүүлийн 50 төлбөрийг (ихэвчлэн өнөөдрийнхийг) тоолж, хянах самбартай зөрдөг байв.
    setPayments((pay as unknown as Payment[]) || []);

    const { data: openInv } = await adminFrom('invoices')
      .select('resident_id,amount,paid_amount').eq('sokh_id', sokhId).in('status', ['pending', 'overdue', 'partial']);
    const due: Record<number, number> = {};
    for (const i of (openInv as unknown as { resident_id: number; amount: number; paid_amount: number | null }[]) || []) {
      const left = Number(i.amount) - Number(i.paid_amount || 0);
      if (left > 0) due[i.resident_id] = (due[i.resident_id] || 0) + left;
    }
    setOpenDue(due);

    // Баталгаажуулахыг хүлээж буй "Би шилжүүлсэн" мэдэгдлүүд
    // Сервер айлын нэхэмжлэхийн төлөв, давхар мэдэгдлийн тоог хамт буцаана
    const nt = await fetch('/api/admin/payment-notices')
      .then(r => (r.ok ? r.json() : { notices: [] }))
      .catch(() => ({ notices: [] }));
    setNotices((nt.notices as PaymentNotice[]) || []);

    // Хураамж хүлээн авах данс (/admin/bank-account дээр тохируулдаг)
    // СӨХ олон данстай байж болно — энд үндсэн (эхний) дансыг харуулна
    const { data: bank } = await adminFrom('sokh_bank_accounts').select('*').eq('sokh_id', sokhId);
    const bankList = ((bank as unknown as BankRow[]) || [])
      .slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id - b.id);
    setBankRow(bankList[0] || null);
    setBankCount(bankList.length);

    // Өр барагдуулах гэрээнүүд (/admin/residents дээр байгуулдаг)
    const { data: agr } = await adminFrom('debt_agreements')
      .select('*').eq('sokh_id', sokhId).order('created_at', { ascending: false });
    setAgreements((agr as unknown as DebtAgreement[]) || []);

    setLoading(false);
  };

  // Баталгаажуулах/татгалзах — /api/admin/payment-notices нэхэмжлэхтэй холбож НЭГ удаа бүртгэнэ.
  // Нэхэмжлэх нь аль хэдийн (банкны хуулгаар) төлөгдсөн бол төлбөр бичихгүй, мэдэгдлийг давхар гэж хаана.
  // Өмнө нь энд клиентээс payments-д шууд мөр нэмдэг байсан нь давхар төлбөр үүсгэж байсан (2026-11-04).
  const resolveNotice = async (n: PaymentNotice, action: 'confirm' | 'reject') => {
    const who = n.resident_name ? `${n.resident_name} (${n.unit || ''})` : getResidentName(n.resident_id);
    const msg = action === 'confirm'
      ? `${who} — ${Number(n.amount).toLocaleString()}₮\n\nБанкны хуулгаас энэ гүйлгээг ОЛСОН эсэхээ шалгасан уу?\nБаталгаажуулбал айлын нэхэмжлэх хаагдана.`
      : 'Банкны хуулгад энэ гүйлгээ ОЛДООГҮЙ бол татгалзана. Үргэлжлүүлэх үү?';
    if (!confirm(msg)) return;
    setResolving(n.id);
    try {
      const r = await fetch('/api/admin/payment-notices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: n.id, action }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) alert(d.error || 'Алдаа гарлаа');
      else if (d.status === 'duplicate') alert(d.message);
      else if (d.closed_others > 0) alert(`Бүртгэлээ. Мөн энэ айлын давхар ${d.closed_others} мэдэгдлийг хаалаа.`);
    } finally {
      setResolving(null);
      await fetchData();
    }
  };

  // Гэрээг хаах. Зөвхөн төлвийг солино — өрийг ХӨНДӨХГҮЙ. Өр нь жинхэнэ төлбөр
  // бүртгэгдэхэд буурна, эс бөгөөс "дууссан" гэж дарахад л өр арилчихсан мэт болно.
  // Хаагдмагц тухайн айлд шинэ гэрээ байгуулах боломж нээгдэнэ (pending/signed дээр
  // ганцхан гэрээ зөвшөөрдөг unique индекстэй).
  const closeAgreement = async (a: DebtAgreement, next: 'completed' | 'cancelled') => {
    const who = getResidentName(a.resident_id);
    if (!confirm(
      next === 'completed'
        ? `${who} — гэрээгээ бүрэн төлж дууссан гэж тэмдэглэх үү?\n\n` +
          `Энэ нь өрийг хасахгүй. Төлбөрүүдийг «Төлбөр бүртгэх» хэсэгт бүртгэсэн эсэхээ шалгана уу.`
        : `${who} — энэ гэрээг цуцлах уу?\n\n` +
          `Цуцалсны дараа тухайн айлд шинэ гэрээ байгуулах боломжтой болно.`
    )) return;

    setClosingId(a.id);
    const { error } = await adminFrom('debt_agreements')
      .update({ status: next, updated_at: new Date().toISOString() }).eq('id', a.id);
    setClosingId(null);
    if (error) {
      alert(`Хадгалж чадсангүй: ${error}`);
      return;
    }
    await fetchData();
  };

  const recordPayment = async () => {
    if (!selectedResident || !amount) return;
    setSaving(true);
    // Сервер нээлттэй нэхэмжлэхийг хуучнаас нь эхлэн хаана. Өмнө нь энд нэхэмжлэхгүй
    // төлбөр бичдэг байсан тул айл төлсөн атлаа өртэй харагдаж, давхардал үүсдэг байв.
    const send = (force: boolean) => fetch('/api/admin/payments/record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resident_id: Number(selectedResident), amount: Number(amount), description, force }),
    }).then(async r => ({ status: r.status, data: await r.json().catch(() => ({})) }));

    try {
      let res = await send(false);
      if (res.status === 409 && res.data?.message) {
        if (!confirm(`${res.data.message}\n\nТэгсэн ч бүртгэх үү?`)) { setSaving(false); return; }
        res = await send(true);
      }
      if (res.status !== 200) {
        alert(res.data?.error || 'Төлбөр бүртгэж чадсангүй');
        setSaving(false);
        await fetchData();
        return;
      }
      const applied = (res.data.applied || []) as { month: string | null; amount: number }[];
      const closed = applied.filter(x => x.month).map(x => `${x.month}: ${x.amount.toLocaleString()}₮`);
      if (closed.length > 1 || res.data.advance > 0) {
        alert(
          'Бүртгэлээ.\n\n' +
          (closed.length ? `Хаагдсан нэхэмжлэх:\n${closed.join('\n')}\n` : '') +
          (res.data.advance > 0 ? `\nУрьдчилгаа (нэхэмжлэхгүй): ${Number(res.data.advance).toLocaleString()}₮` : '')
        );
      }
    } catch {
      alert('Сервертэй холбогдож чадсангүй');
      setSaving(false);
      return;
    }

    setShowForm(false);
    setAmount('');
    setSelectedResident('');
    setSaving(false);
    await fetchData();
  };

  const getResidentName = (id: number) => {
    const r = residents.find(r => r.id === id);
    return r ? `${r.name} (${r.apartment})` : 'Тодорхойгүй';
  };

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    // Төлбөрийн түүх sheet
    const payData = payments.map(p => ({
      'Огноо': new Date(p.paid_at).toLocaleDateString('mn-MN'),
      'Оршин суугч': getResidentName(p.resident_id),
      'Тайлбар': p.description,
      'Дүн (₮)': Number(p.amount),
    }));
    const paySheet = XLSX.utils.json_to_sheet(payData);
    XLSX.utils.book_append_sheet(wb, paySheet, 'Төлбөрийн түүх');

    // Өртэй айлууд sheet
    const debtData = residents.filter(r => debtOf(r) > 0).sort((a, b) => debtOf(b) - debtOf(a)).map(r => ({
      'Нэр': r.name,
      'Тоот': r.apartment,
      'Өр (₮)': debtOf(r),
    }));
    const debtSheet = XLSX.utils.json_to_sheet(debtData);
    XLSX.utils.book_append_sheet(wb, debtSheet, 'Өртэй айлууд');

    if (entranceGroups.length >= 2) {
      const entSheet = XLSX.utils.json_to_sheet(entranceGroups.map(g => ({
        'Орц': g.label,
        'Айл': g.units,
        'Өргүй': g.paid,
        'Өртэй': g.debtors,
        'Төлөлт (%)': g.units ? Math.round((g.paid / g.units) * 100) : 0,
        'Нийт өр (₮)': g.debt,
        'Энэ сарын орлого (₮)': g.month,
      })));
      XLSX.utils.book_append_sheet(wb, entSheet, 'Орц орцоор');

      // Орц бүр тусдаа хуудас — тухайн орцны айл бүрийн төлөв (дэлгэц дээр задлахтай ижил)
      const used = new Set<string>(['Төлбөрийн түүх', 'Өртэй айлууд', 'Орц орцоор']);
      for (const g of entranceGroups) {
        // Excel: хуудасны нэр ≤31 тэмдэгт, : \ / ? * [ ] хориотой, давхцахгүй
        const base = g.label.replace(' байр', '').replace(/[:\\/?*[\]]/g, '-').slice(0, 28);
        let name = base;
        for (let n = 2; used.has(name); n++) name = `${base} ${n}`;
        used.add(name);
        const rows = g.list.slice()
          .sort((a, b) => a.apartment.localeCompare(b.apartment, undefined, { numeric: true }))
          .map(r => ({
            'Тоот': r.apartment,
            'Нэр': r.name,
            'Төлөв': debtOf(r) > 0 ? 'Өртэй' : 'Өргүй',
            'Өр (₮)': debtOf(r),
            'Энэ сарын орлого (₮)': monthPaidBy[r.id] || 0,
          }));
        rows.push({
          'Тоот': 'Нийт', 'Нэр': `${g.units} айл · өргүй ${g.paid} · өртэй ${g.debtors}`,
          'Төлөв': `${g.units ? Math.round((g.paid / g.units) * 100) : 0}%`,
          'Өр (₮)': g.debt, 'Энэ сарын орлого (₮)': g.month,
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name);
      }
    }

    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `төлбөр-${today}.xlsx`);
  };

  // Нээлттэй гэрээ = хүчин төгөлдөр эсвэл айлын зөвшөөрөл хүлээж буй нь
  const openAgreements = agreements.filter(a => a.status === 'pending' || a.status === 'signed');
  const awaitingAgreements = agreements.filter(a => a.status === 'pending');
  const agreementTotal = openAgreements.reduce((s, a) => s + Number(a.total_debt), 0);

  // Өр = max(residents.debt, нээлттэй нэхэмжлэхийн үлдэгдэл)
  const debtOf = (r: Resident) => Math.max(Number(r.debt || 0), openDue[r.id] || 0);
  const totalDebt = residents.reduce((s, r) => s + debtOf(r), 0);
  const totalCollected = payments.reduce((s, p) => s + Number(p.amount), 0);
  const debtors = residents.filter(r => debtOf(r) > 0).length;

  // Сарын орлого тооцоо
  const now = new Date();
  const thisMonthPayments = payments.filter(p => {
    const d = new Date(p.paid_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const thisMonthTotal = thisMonthPayments.reduce((s, p) => s + Number(p.amount), 0);

  // ---- Орц орцоор ----------------------------------------------------------
  // Схемтэй СӨХ (ICTown): residents.building = «блок-орц» («2-2») → «498-2 · 2-р орц».
  // Схемгүй СӨХ: building + entrance баганаар бүлэглэнэ.
  const scheme = UNIT_SCHEMES[sokhId] || null;
  const entranceOf = (r: Resident): { key: string; label: string } => {
    const b = (r.building || '').trim();
    const e = (r.entrance || '').trim();
    if (scheme) {
      const [internal, ent] = b.split('-');
      const sb = scheme.buildings.find(x => x.internal === internal);
      if (sb && sb.entrances.some(x => x.entrance === ent)) {
        return { key: b, label: `${sb.official} байр · ${ent}-р орц` };
      }
      return { key: `?${b}`, label: b ? `«${b}» (схемд үл таарах)` : 'Байр тодорхойгүй' };
    }
    if (!b && !e) return { key: '?', label: 'Байр тодорхойгүй' };
    return { key: `${b}|${e}`, label: [b && `${b} байр`, e && `${e}-р орц`].filter(Boolean).join(' · ') };
  };
  const monthPaidBy: Record<number, number> = {};
  for (const p of thisMonthPayments) monthPaidBy[p.resident_id] = (monthPaidBy[p.resident_id] || 0) + Number(p.amount);
  const entranceGroups = (() => {
    const m = new Map<string, { key: string; label: string; list: Resident[] }>();
    for (const r of residents) {
      const { key, label } = entranceOf(r);
      if (!m.has(key)) m.set(key, { key, label, list: [] });
      m.get(key)!.list.push(r);
    }
    return [...m.values()]
      .map(g => {
        const debtors = g.list.filter(r => debtOf(r) > 0);
        return {
          ...g,
          units: g.list.length,
          debtors: debtors.length,
          paid: g.list.length - debtors.length,
          debt: debtors.reduce((s, r) => s + debtOf(r), 0),
          month: g.list.reduce((s, r) => s + (monthPaidBy[r.id] || 0), 0),
        };
      })
      // Тодорхойгүй бүлгийг хамгийн ард
      .sort((a, b) => Number(a.key.startsWith('?')) - Number(b.key.startsWith('?'))
        || a.key.localeCompare(b.key, undefined, { numeric: true }));
  })();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">💰 Төлбөр & Орлого</h1>
        <button
          onClick={exportToExcel}
          disabled={loading || payments.length === 0}
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition disabled:opacity-50 flex items-center gap-2"
        >
          📥 Excel татах
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1">
        {[
          { key: 'overview' as const, label: '📊 Орлого', },
          { key: 'record' as const, label: '💳 Төлбөр бүртгэх' },
          { key: 'agreements' as const, label: `🤝 Гэрээнүүд${openAgreements.length ? ` (${openAgreements.length})` : ''}` },
          { key: 'bank' as const, label: '🏦 Данс холболт' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition ${
              activeTab === t.key ? 'bg-white shadow' : 'text-gray-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ========== БАТАЛГААЖУУЛАХ ХҮЛЭЭЖ БУЙ ========== */}
      {activeTab === 'overview' && notices.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 mb-6">
          <h3 className="font-semibold text-amber-900 mb-1">
            🔔 {notices.length} оршин суугч «шилжүүлсэн» гэж мэдэгдсэн
          </h3>
          <p className="text-xs text-amber-800 mb-3">
            Банкны хуулгаа шалгаад тухайн гүйлгээг олсон бол баталгаажуулна уу.
            Баталгаажуулбал айлын нэхэмжлэх хаагдана. Нэхэмжлэх нь аль хэдийн төлөгдсөн айлд давхар төлбөр бичигдэхгүй.
          </p>
          <div className="space-y-2">
            {notices.map(n => (
              <div key={n.id} className="bg-white rounded-lg p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {n.resident_name ? `${n.resident_name} (${n.unit || ''})` : getResidentName(n.resident_id)}
                    {(n.same_resident_pending || 1) > 1 && (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 align-middle">
                        давхар ×{n.same_resident_pending}
                      </span>
                    )}
                  </p>
                  {n.has_invoices && !n.open_due && (
                    <p className="text-[11px] text-green-700">✓ Нэхэмжлэх аль хэдийн төлөгдсөн — давхар мэдэгдэл байх магадлалтай</p>
                  )}
                  <p className="text-xs text-gray-500 truncate">
                    {n.description || 'Банкаар шилжүүлсэн'} · {new Date(n.created_at).toLocaleString('mn-MN')}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-bold text-sm">{Number(n.amount).toLocaleString()}₮</span>
                  <button
                    onClick={() => resolveNotice(n, 'confirm')}
                    disabled={resolving === n.id}
                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium disabled:opacity-50"
                  >
                    {resolving === n.id ? '...' : '✓ Баталгаажуулах'}
                  </button>
                  <button
                    onClick={() => resolveNotice(n, 'reject')}
                    disabled={resolving === n.id}
                    className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs disabled:opacity-50"
                  >
                    Олдсонгүй
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========== OVERVIEW ========== */}
      {activeTab === 'overview' && (
        <div>
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-sm text-green-600">Энэ сарын орлого</p>
              <p className="text-2xl font-bold text-green-700">{thisMonthTotal.toLocaleString()}₮</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-sm text-blue-600">Нийт цуглуулсан</p>
              <p className="text-2xl font-bold text-blue-700">{totalCollected.toLocaleString()}₮</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm text-red-600">Нийт өр</p>
              <p className="text-2xl font-bold text-red-700">{totalDebt.toLocaleString()}₮</p>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <p className="text-sm text-orange-600">Өртэй айл</p>
              <p className="text-2xl font-bold text-orange-700">{debtors} / {residents.length}</p>
            </div>
          </div>

          {/* Хураамж хүлээн авах данс — /admin/bank-account дээр тохируулсан бодит мөр */}
          {bankRow ? (
            <div className="bg-white border rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                    <span className="text-lg">🏦</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      {bankRow.bank_name}
                      {bankCount > 1 && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 align-middle">
                          +{bankCount - 1} данс
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">{bankRow.account_number} · {bankRow.account_holder}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-green-600 font-medium">
                    {bankRow.qr_image_url ? 'QR-тай ✓' : 'QR оруулаагүй'}
                  </span>
                  <a href="/admin/bank-account" className="text-xs text-blue-600 hover:underline">Засах</a>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t">
                <div>
                  <p className="text-[10px] text-gray-500">Өнөөдрийн орлого</p>
                  <p className="text-sm font-bold text-green-600">
                    {payments.filter(p => new Date(p.paid_at).toDateString() === now.toDateString()).reduce((s, p) => s + Number(p.amount), 0).toLocaleString()}₮
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">7 хоногийн</p>
                  <p className="text-sm font-bold">
                    {payments.filter(p => now.getTime() - new Date(p.paid_at).getTime() < 7 * 86400000).reduce((s, p) => s + Number(p.amount), 0).toLocaleString()}₮
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">Энэ сарын</p>
                  <p className="text-sm font-bold">{thisMonthTotal.toLocaleString()}₮</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <p className="text-sm font-semibold text-yellow-700">Хураамж хүлээн авах данс оруулаагүй</p>
                  <p className="text-xs text-yellow-600">Данс оруулмагц оршин суугчид апп дээрээ QR-аар төлж эхэлнэ</p>
                </div>
              </div>
              <a href="/admin/bank-account" className="px-3 py-1.5 bg-yellow-600 text-white rounded-lg text-xs font-medium">
                Данс тохируулах
              </a>
            </div>
          )}
          {/* Орц орцоор төлбөрийн байдал — мөр дээр дарж тухайн орцны айлуудыг харна */}
          {entranceGroups.length >= 2 && (
            <>
              <h3 className="font-semibold text-sm text-gray-500 mb-3">ОРЦ ОРЦООР ТӨЛБӨРИЙН БАЙДАЛ</h3>
              <div className="bg-white rounded-xl border overflow-hidden mb-6">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-sm text-gray-500">
                      <th className="px-4 py-3">Орц</th>
                      <th className="px-4 py-3 text-right">Айл</th>
                      <th className="px-4 py-3 text-right">Өргүй</th>
                      <th className="px-4 py-3 text-right">Өртэй</th>
                      <th className="px-4 py-3">Төлөлт</th>
                      <th className="px-4 py-3 text-right">Нийт өр</th>
                      <th className="px-4 py-3 text-right">Энэ сарын орлого</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entranceGroups.map(g => {
                      const pct = g.units ? Math.round((g.paid / g.units) * 100) : 0;
                      const isOpen = openEntrance === g.key;
                      return [
                        <tr key={g.key} onClick={() => setOpenEntrance(isOpen ? null : g.key)}
                            className={`border-t cursor-pointer ${isOpen ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                          <td className="px-4 py-3 text-sm font-medium">{isOpen ? '▾' : '▸'} {g.label}</td>
                          <td className="px-4 py-3 text-sm text-right">{g.units}</td>
                          <td className="px-4 py-3 text-sm text-right text-green-600">{g.paid}</td>
                          <td className="px-4 py-3 text-sm text-right text-red-500">{g.debtors}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className={`h-full ${pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                                     style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs text-gray-500">{pct}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-red-500">{g.debt.toLocaleString()}₮</td>
                          <td className="px-4 py-3 text-sm text-right text-green-600">{g.month.toLocaleString()}₮</td>
                        </tr>,
                        isOpen && (
                          <tr key={`${g.key}-list`} className="bg-blue-50/40">
                            <td colSpan={7} className="px-4 py-3">
                              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-1.5">
                                {g.list.slice()
                                  .sort((a, b) => a.apartment.localeCompare(b.apartment, undefined, { numeric: true }))
                                  .map(r => (
                                    <div key={r.id} title={r.name}
                                         className={`text-xs rounded px-2 py-1 border ${debtOf(r) > 0
                                           ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
                                      <b>{r.apartment}</b> · {debtOf(r) > 0 ? `${debtOf(r).toLocaleString()}₮` : 'өргүй'}
                                    </div>
                                  ))}
                              </div>
                            </td>
                          </tr>
                        ),
                      ];
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t">
                    <tr className="text-sm font-semibold">
                      <td className="px-4 py-3">Нийт</td>
                      <td className="px-4 py-3 text-right">{residents.length}</td>
                      <td className="px-4 py-3 text-right text-green-600">{residents.length - debtors}</td>
                      <td className="px-4 py-3 text-right text-red-500">{debtors}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {residents.length ? Math.round(((residents.length - debtors) / residents.length) * 100) : 0}%
                      </td>
                      <td className="px-4 py-3 text-right text-red-500">{totalDebt.toLocaleString()}₮</td>
                      <td className="px-4 py-3 text-right text-green-600">{thisMonthTotal.toLocaleString()}₮</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}

          {/* Сүүлийн төлбөрүүд */}
          <h3 className="font-semibold text-sm text-gray-500 mb-3">СҮҮЛИЙН ОРЛОГУУД</h3>
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr className="text-left text-sm text-gray-500">
                  <th className="px-4 py-3">Огноо</th>
                  <th className="px-4 py-3">Оршин суугч</th>
                  <th className="px-4 py-3">Тайлбар</th>
                  <th className="px-4 py-3 text-right">Дүн</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Төлбөр бүртгэгдээгүй</td></tr>
                ) : payments.slice(0, 20).map(p => (
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

      {/* ========== RECORD ========== */}
      {activeTab === 'record' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">Оршин суугчийн төлбөр бүртгэх</p>
            <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
              + Төлбөр бүртгэх
            </button>
          </div>

          {showForm && (
            <div className="bg-white border rounded-xl p-4 mb-6">
              <h3 className="font-semibold mb-3">Төлбөр бүртгэх</h3>
              <div className="grid grid-cols-3 gap-3">
                <select value={selectedResident} onChange={e => setSelectedResident(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
                  <option value="">Оршин суугч сонгох...</option>
                  {residents.map(r => (
                    <option key={r.id} value={r.id}>{r.name} ({r.apartment}) {debtOf(r) > 0 ? `- Өр: ${debtOf(r).toLocaleString()}₮` : ''}</option>
                  ))}
                </select>
                <input placeholder="Дүн (₮)" type="number" value={amount} onChange={e => setAmount(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
                <input placeholder="Тайлбар" value={description} onChange={e => setDescription(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg text-sm">Цуцлах</button>
                <button onClick={recordPayment} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm disabled:opacity-50">
                  {saving ? 'Бүртгэж байна...' : 'Бүртгэх'}
                </button>
              </div>
            </div>
          )}

          {/* Өртэй айлуудын жагсаалт */}
          <h3 className="font-semibold text-sm text-gray-500 mb-3">ӨРТЭЙ АЙЛУУД ({debtors})</h3>
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr className="text-left text-sm text-gray-500">
                  <th className="px-4 py-3">Нэр</th>
                  <th className="px-4 py-3">Тоот</th>
                  <th className="px-4 py-3 text-right">Өр</th>
                </tr>
              </thead>
              <tbody>
                {residents.filter(r => debtOf(r) > 0).sort((a, b) => debtOf(b) - debtOf(a)).map(r => (
                  <tr key={r.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium">{r.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{r.apartment}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-red-500">{debtOf(r).toLocaleString()}₮</td>
                  </tr>
                ))}
                {debtors === 0 && (
                  <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-400">Өртэй айл байхгүй ✓</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========== ГЭРЭЭНҮҮД ========== */}
      {activeTab === 'agreements' && (
        <div>
          <div className="flex items-start justify-between gap-4 mb-4">
            <p className="text-sm text-gray-500">
              Өрөө хуваан төлөхөөр тохирсон айлууд. Шинэ гэрээг{' '}
              <a href="/admin/residents" className="text-blue-600 hover:underline">Оршин суугчид</a>{' '}
              хуудаснаас байгуулна.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-sm text-green-600">Нээлттэй гэрээ</p>
              <p className="text-2xl font-bold text-green-700">{openAgreements.length}</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm text-amber-600">Айлын зөвшөөрөл хүлээж буй</p>
              <p className="text-2xl font-bold text-amber-700">{awaitingAgreements.length}</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-sm text-blue-600">Гэрээнд хамрагдсан дүн</p>
              <p className="text-2xl font-bold text-blue-700">{agreementTotal.toLocaleString()}₮</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr className="text-left text-sm text-gray-500">
                  <th className="px-4 py-3">Оршин суугч</th>
                  <th className="px-4 py-3 text-right">Гэрээний дүн</th>
                  <th className="px-4 py-3">Хуваарь</th>
                  <th className="px-4 py-3">Төлөв</th>
                  <th className="px-4 py-3 text-right">Үйлдэл</th>
                </tr>
              </thead>
              <tbody>
                {agreements.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                      Гэрээ байгуулаагүй байна
                    </td>
                  </tr>
                ) : agreements.map(a => {
                  const st = AGREEMENT_STATUS[a.status] || { label: a.status, cls: 'bg-gray-100 text-gray-500' };
                  const plan = a.agreed_payment_plan;
                  const isOpen = a.status === 'pending' || a.status === 'signed';
                  return (
                    <tr key={a.id} className="border-t hover:bg-gray-50 align-top">
                      <td className="px-4 py-3 text-sm">
                        <p className="font-medium">{getResidentName(a.resident_id)}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(a.created_at).toLocaleDateString('mn-MN')}-нд байгуулсан
                        </p>
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold">
                        {Number(a.total_debt).toLocaleString()}₮
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {plan?.months ? (
                          <>
                            <p>{plan.months} сар × {Number(plan.monthly_amount || 0).toLocaleString()}₮</p>
                            {plan.start_date && (
                              <p className="text-xs text-gray-400">
                                {new Date(plan.start_date).toLocaleDateString('mn-MN', { year: 'numeric', month: 'long' })}-аас
                              </p>
                            )}
                          </>
                        ) : <span className="text-gray-400">—</span>}
                        {plan?.note && <p className="text-xs text-gray-500 mt-1 max-w-xs">{plan.note}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${st.cls}`}>
                          {st.label}
                        </span>
                        {a.signed_at && (
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(a.signed_at).toLocaleDateString('mn-MN')}-нд зөвшөөрсөн
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isOpen ? (
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => closeAgreement(a, 'completed')}
                              disabled={closingId === a.id}
                              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium disabled:opacity-50"
                            >
                              {closingId === a.id ? '...' : 'Төлж дууссан'}
                            </button>
                            <button
                              onClick={() => closeAgreement(a, 'cancelled')}
                              disabled={closingId === a.id}
                              className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs disabled:opacity-50"
                            >
                              Цуцлах
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Хаагдсан</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3 mt-4">
            ⚠️ Гэрээ нь өрийг хасахгүй — зөвхөн тохиролцсон хуваарийг бүртгэнэ. Айл
            төлбөрөө хийхэд «Төлбөр бүртгэх» хэсэгт бүртгэснээр л өр буурна.
          </p>
        </div>
      )}

      {/* ========== BANK ========== */}
      {activeTab === 'bank' && (
        <div className="bg-white border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <span className="text-2xl">🏦</span>
            </div>
            <div>
              <h2 className="font-bold text-lg">Хураамж хүлээн авах данс</h2>
              <p className="text-sm text-gray-500">Оршин суугчийн апп дээр харагдах данс, QR код</p>
            </div>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            Дансаа тусдаа хуудаснаас удирдана. Тэнд оруулсан данс, QR зураг нь оршин
            суугчийн апп дээр «Төлбөр» хэсэгт шууд харагдаж, банкны аппаараа уншуулж
            төлөх боломжтой болно.
          </p>
          <a
            href="/admin/bank-account"
            className="inline-block px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Данс тохируулах →
          </a>
        </div>
      )}
    </div>
  );
}
