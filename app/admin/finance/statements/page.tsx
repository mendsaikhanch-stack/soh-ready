'use client';

// Албан ёсны санхүү, татварын тайлан — /admin/finance/statements
//
// Дөрвөн тайланг НЭГ хуудсанд, нэг өгөгдлөөс гаргана:
//   1. Орлого, үр дүнгийн тайлан   (income statement)
//   2. Санхүүгийн байдлын тайлан   (баланс)
//   3. Мөнгөн гүйлгээний тайлан    (cash flow)
//   4. Татварын тооцоо             (ААНОАТ)
//
// Хэрэгжүүлэлт нь docs/future-coa-reports.md-ийн **B зам** — байгаа датаг
// адаптчилсан. Давхар бичилтийн ledger ХИЙГЭЭГҮЙ: 8 идэвхтэй СӨХ-д хэт том,
// мөн одоогийн дата (payments, budget_items, payables, residents.debt) нь
// эдгээр тайланг гаргахад хангалттай.
//
// ⚠️ Татварын хэсэг нь ТООЦОО, албан ёсны маягт БИШ. Гишүүдийн хураамж
// татвар ногдох эсэх нь нягтлан бодогчоор баталгаажуулах ёстой таамаг —
// хуудсан дээр тэр анхааруулгыг зориуд том бичсэн.

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { adminFrom } from '@/app/lib/admin-db';
import { getAdminSokhId } from '@/app/lib/admin-config';

interface BudgetItem { id: number; category: string; amount: number; month: number; year: number; description: string; type?: string; name?: string; }
interface Payment { id: number; resident_id: number; amount: number; paid_at: string; }
interface Resident { id: number; debt: number; monthly_fee: number | null; pending_claim: boolean; }
interface Payable { id: number; vendor: string; amount: number; paid_amount: number; status: string; }
interface ReserveEntry { id: number; type: string; amount: number; }
interface Org {
  name: string; address: string | null; phone: string | null; monthly_fee: number | null;
  tax_id?: string | null; opening_balance?: number | null;
  opening_balance_date?: string | null; is_vat_payer?: boolean | null;
}

const categoryLabels: Record<string, string> = {
  cleaning: 'Цэвэрлэгээ', elevator: 'Лифт', security: 'Харуул', repair: 'Засвар',
  electricity: 'Цахилгаан', water: 'Ус', heating: 'Дулаан', garden: 'Тохижилт',
  reserve: 'Нөөц сан', insurance: 'Даатгал', salary: 'Цалин', other: 'Бусад',
};
const months = ['1-р сар','2-р сар','3-р сар','4-р сар','5-р сар','6-р сар','7-р сар','8-р сар','9-р сар','10-р сар','11-р сар','12-р сар'];
const money = (n: number) => `${Math.round(n).toLocaleString()}₮`;

// ААНОАТ-ын хувь. Жилийн орлого 6 тэрбум хүртэлх ААН-д 10%.
// СӨХ энэ босгыг давахгүй тул нэг хувь хангалттай.
const CIT_RATE = 0.10;

export default function StatementsPage() {
  return (
    <Suspense fallback={<p className="p-6 text-gray-400">Ачаалж байна...</p>}>
      <StatementsContent />
    </Suspense>
  );
}

function StatementsContent() {
  const searchParams = useSearchParams();
  const paramYear = parseInt(searchParams.get('year') || '', 10);
  const [year, setYear] = useState(Number.isFinite(paramYear) && paramYear > 2000 ? paramYear : new Date().getFullYear());

  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState<Org | null>(null);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [payables, setPayables] = useState<Payable[]>([]);
  const [reserve, setReserve] = useState<ReserveEntry[]>([]);

  // Тохиргооны талбарууд (миграцын дараа л бий болно)
  const [editing, setEditing] = useState(false);
  const [taxId, setTaxId] = useState('');
  const [openBal, setOpenBal] = useState('');
  const [openDate, setOpenDate] = useState('');
  const [vatPayer, setVatPayer] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const sokhId = await getAdminSokhId();
    if (!sokhId) { setLoading(false); return; }

    // '*' -ээр татна: шинэ багана (tax_id, opening_balance...) миграц
    // ажиллаагүй байхад нэрээр нь асуувал бүх хүсэлт унана.
    const [{ data: orgRow }, { data: res }] = await Promise.all([
      adminFrom('sokh_organizations').select('*').eq('id', sokhId).single(),
      adminFrom('residents').select('id,debt,monthly_fee,pending_claim').eq('sokh_id', sokhId),
    ]);

    const residentList = ((res as unknown as Resident[]) || []).filter(r => !r.pending_claim);
    const residentIds = residentList.map(r => r.id);

    const [{ data: pay }, { data: bi }, { data: pyb }, { data: rf }] = await Promise.all([
      residentIds.length
        ? adminFrom('payments').select('*').in('resident_id', residentIds)
        : Promise.resolve({ data: [] }),
      adminFrom('budget_items').select('*').eq('sokh_id', sokhId).eq('year', year),
      adminFrom('payables').select('*').eq('sokh_id', sokhId),
      adminFrom('reserve_fund').select('*').eq('sokh_id', sokhId).limit(500),
    ]);

    const o = (orgRow as unknown as Org) || null;
    setOrg(o);
    setTaxId(o?.tax_id || '');
    setOpenBal(String(o?.opening_balance ?? ''));
    setOpenDate(o?.opening_balance_date || '');
    setVatPayer(Boolean(o?.is_vat_payer));
    setResidents(residentList);
    setPayments((pay as unknown as Payment[]) || []);
    setItems((bi as unknown as BudgetItem[]) || []);
    setPayables((pyb as unknown as Payable[]) || []);
    setReserve((rf as unknown as ReserveEntry[]) || []);
    setLoading(false);
  }, [year]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const saveSettings = async () => {
    setSaving(true);
    const sokhId = await getAdminSokhId();
    const res = await adminFrom('sokh_organizations').update({
      tax_id: taxId.trim() || null,
      opening_balance: Number(openBal) || 0,
      opening_balance_date: openDate || null,
      is_vat_payer: vatPayer,
    }).eq('id', sokhId);
    setSaving(false);
    if (res.error) { alert(`Хадгалагдсангүй: ${res.error}\n\nsupabase-finance-statements-migration.sql ажиллуулсан эсэхээ шалгана уу.`); return; }
    setEditing(false);
    await fetchAll();
  };

  // ===== Тооцоо =====
  const expenseItems = items.filter(i => i.type !== 'income');
  const incomeItems = items.filter(i => i.type === 'income');

  const feeIncome = payments
    .filter(p => new Date(p.paid_at).getFullYear() === year)
    .reduce((s, p) => s + Number(p.amount), 0);
  const otherIncome = incomeItems.reduce((s, i) => s + Number(i.amount), 0);
  const totalIncome = feeIncome + otherIncome;
  const totalExpense = expenseItems.reduce((s, i) => s + Number(i.amount), 0);
  const netResult = totalIncome - totalExpense;

  const expenseByCat = Object.entries(
    expenseItems.reduce<Record<string, number>>((acc, b) => {
      acc[b.category] = (acc[b.category] || 0) + Number(b.amount);
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  const openingBalance = Number(org?.opening_balance ?? 0);
  const cashBalance = openingBalance + totalIncome - totalExpense;
  const receivables = residents.reduce((s, r) => s + Number(r.debt || 0), 0);
  const openPayables = payables.filter(p => p.status !== 'paid');
  const payablesTotal = openPayables.reduce((s, p) => s + (Number(p.amount) - Number(p.paid_amount)), 0);
  const totalAssets = cashBalance + receivables;
  const netAssets = totalAssets - payablesTotal;
  const reserveBalance = reserve.reduce((s, e) => s + (e.type === 'deposit' ? Number(e.amount) : -Number(e.amount)), 0);

  // Мөнгөн гүйлгээ сараар
  const cashRows = (() => {
    let running = openingBalance;
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const inc = payments.filter(p => {
        const d = new Date(p.paid_at);
        return d.getFullYear() === year && d.getMonth() + 1 === m;
      }).reduce((s, p) => s + Number(p.amount), 0)
        + incomeItems.filter(x => x.month === m).reduce((s, x) => s + Number(x.amount), 0);
      const exp = expenseItems.filter(x => x.month === m).reduce((s, x) => s + Number(x.amount), 0);
      const start = running;
      running = start + inc - exp;
      return { month: m, start, inc, exp, end: running };
    });
  })();

  const taxableIncome = otherIncome;
  const citTax = taxableIncome * CIT_RATE;

  const migrationMissing = org !== null && org.opening_balance === undefined;
  const today = new Date().toLocaleDateString('mn-MN');

  return (
    <div className="p-6">
      {/* ==== Хэвлэхэд харагдахгүй удирдлага ==== */}
      <div className="no-print flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Link href="/admin/finance" className="text-sm text-gray-500 hover:text-gray-700">← Санхүү</Link>
          <h1 className="text-xl font-bold">🏛 Албан ёсны санхүү, татварын тайлан</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setYear(y => y - 1)} className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm">←</button>
          <span className="font-bold text-sm min-w-[60px] text-center">{year}</span>
          <button onClick={() => setYear(y => y + 1)} className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm">→</button>
          <button onClick={() => window.print()} className="ml-2 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">🖨 Хэвлэх / PDF</button>
        </div>
      </div>

      {migrationMissing && (
        <div className="no-print bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 mb-5 text-sm">
          <b>Тайлангийн нэмэлт талбарууд бэлэн болоогүй байна.</b> Supabase → SQL Editor дээр
          <b> supabase-finance-statements-migration.sql</b> файлыг нэг удаа ажиллуулна уу.
          Түүнийг хийх хүртэл регистрийн дугаар, эхний үлдэгдэл хадгалагдахгүй, баланс дээр эхний үлдэгдэл 0 гэж тооцогдоно.
        </div>
      )}

      {/* ==== Тохиргоо ==== */}
      <div className="no-print bg-white border rounded-xl p-4 mb-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-sm">Байгууллагын мэдээлэл</h2>
          {!editing
            ? <button onClick={() => setEditing(true)} className="text-xs px-3 py-1.5 border rounded-lg hover:bg-gray-50">✏️ Засах</button>
            : <div className="flex gap-2">
                <button onClick={() => setEditing(false)} className="text-xs px-3 py-1.5 border rounded-lg">Цуцлах</button>
                <button onClick={saveSettings} disabled={saving} className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg disabled:opacity-50">{saving ? '...' : 'Хадгалах'}</button>
              </div>}
        </div>
        {editing ? (
          <div className="grid grid-cols-4 gap-3 text-sm">
            <label className="block">
              <span className="text-xs text-gray-500">Регистр / ТТД</span>
              <input value={taxId} onChange={e => setTaxId(e.target.value)} className="border rounded-lg px-3 py-2 text-sm w-full mt-1" placeholder="жнь: 1234567" />
            </label>
            <label className="block">
              <span className="text-xs text-gray-500">Эхний мөнгөн үлдэгдэл (₮)</span>
              <input type="number" value={openBal} onChange={e => setOpenBal(e.target.value)} className="border rounded-lg px-3 py-2 text-sm w-full mt-1" placeholder="0" />
            </label>
            <label className="block">
              <span className="text-xs text-gray-500">Ямар өдрийн байдлаар</span>
              <input type="date" value={openDate} onChange={e => setOpenDate(e.target.value)} className="border rounded-lg px-3 py-2 text-sm w-full mt-1" />
            </label>
            <label className="flex items-center gap-2 mt-5">
              <input type="checkbox" checked={vatPayer} onChange={e => setVatPayer(e.target.checked)} className="w-4 h-4" />
              <span className="text-sm">НӨАТ суутган төлөгч</span>
            </label>
          </div>
        ) : (
          <p className="text-sm text-gray-600">
            Регистр: <b>{org?.tax_id || '— оруулаагүй'}</b> ·
            Эхний үлдэгдэл: <b>{money(openingBalance)}</b>
            {org?.opening_balance_date ? ` (${new Date(org.opening_balance_date).toLocaleDateString('mn-MN')})` : ''} ·
            НӨАТ: <b>{org?.is_vat_payer ? 'төлөгч' : 'төлөгч биш'}</b>
          </p>
        )}
      </div>

      {loading ? <p className="text-gray-400 text-center py-12">Ачаалж байна...</p> : (
        <div id="report" className="bg-white mx-auto text-[#111]" style={{ maxWidth: '210mm', padding: '10mm 12mm' }}>
          {/* ==== Толгой ==== */}
          <div className="flex items-start justify-between border-b-2 border-gray-800 pb-3">
            <div>
              <h2 className="text-xl font-extrabold">{org?.name || 'СӨХ'}</h2>
              {org?.tax_id && <p className="text-xs text-gray-600 mt-0.5">Регистрийн дугаар: {org.tax_id}</p>}
              {org?.address && <p className="text-xs text-gray-600">{org.address}</p>}
            </div>
            <div className="text-right">
              <p className="text-lg font-extrabold">{year} оны санхүүгийн тайлан</p>
              <p className="text-xs text-gray-600 mt-0.5">Тайлант хугацаа: {year}.01.01 – {year}.12.31</p>
              <p className="text-xs text-gray-600">Гаргасан огноо: {today}</p>
            </div>
          </div>

          {/* ==== 1. Орлого, үр дүнгийн тайлан ==== */}
          <h3 className="font-bold text-sm mt-5 mb-2">1. Орлого, үр дүнгийн тайлан</h3>
          <table className="w-full text-sm border border-gray-300">
            <tbody>
              <SectionRow label="ОРЛОГО" />
              <Line label="Гишүүдийн сарын хураамж" value={feeIncome} indent />
              {incomeItems.length > 0 && <Line label="Бусад орлого:" value={otherIncome} indent />}
              {incomeItems.map(i => (
                <Line key={i.id} label={`— ${i.name || i.description} (${months[i.month - 1]})`} value={Number(i.amount)} indent2 muted />
              ))}
              <Line label="Нийт орлого" value={totalIncome} bold />

              <SectionRow label="ЗАРДАЛ" />
              {expenseByCat.length === 0
                ? <Line label="Зардал бүртгэгдээгүй" value={0} indent muted />
                : expenseByCat.map(([cat, total]) => (
                    <Line key={cat} label={categoryLabels[cat] || cat} value={total} indent />
                  ))}
              <Line label="Нийт зардал" value={totalExpense} bold />

              <tr className="border-t-2 border-gray-800 bg-gray-50">
                <td className="px-2 py-2 font-bold">Тайлант үеийн үр дүн ({netResult >= 0 ? 'ашиг' : 'алдагдал'})</td>
                <td className="px-2 py-2 text-right font-bold">{money(netResult)}</td>
              </tr>
            </tbody>
          </table>

          {/* ==== 2. Баланс ==== */}
          <h3 className="font-bold text-sm mt-5 mb-2">2. Санхүүгийн байдлын тайлан (баланс) — {year}.12.31</h3>
          <table className="w-full text-sm border border-gray-300">
            <tbody>
              <SectionRow label="АКТИВ" />
              <Line label="Мөнгөн хөрөнгө (касс, харилцах)" value={cashBalance} indent />
              <Line label="Авлага — айлын төлөгдөөгүй хураамж" value={receivables} indent />
              <Line label="Нийт актив" value={totalAssets} bold />

              <SectionRow label="ЭХ ҮҮСВЭР" />
              <Line label="Өглөг — нийлүүлэгч, цалин" value={payablesTotal} indent />
              <Line label="Цэвэр хөрөнгө (хуримтлагдсан үлдэгдэл)" value={netAssets} indent />
              <Line label="Нийт эх үүсвэр" value={totalAssets} bold />
              {reserveBalance !== 0 && (
                <Line label="Тайлбар: цэвэр хөрөнгөөс нөөц санд төвлөрүүлсэн" value={reserveBalance} indent muted />
              )}
            </tbody>
          </table>
          <p className="text-[10px] text-gray-500 mt-1">
            Мөнгөн хөрөнгө = эхний үлдэгдэл ({money(openingBalance)}) + жилийн орлого − жилийн зардал.
            Эхний үлдэгдлийг оруулаагүй бол энэ мөр бодит дансны үлдэгдлээс зөрнө.
          </p>

          {/* ==== 3. Мөнгөн гүйлгээ ==== */}
          <h3 className="font-bold text-sm mt-5 mb-2">3. Мөнгөн гүйлгээний тайлан</h3>
          <table className="w-full text-sm border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <Th>Сар</Th><Th right>Эхний үлдэгдэл</Th><Th right>Орлого</Th><Th right>Зарлага</Th><Th right>Эцсийн үлдэгдэл</Th>
              </tr>
            </thead>
            <tbody>
              {cashRows.map(r => (
                <tr key={r.month} className="border-t border-gray-200">
                  <Td>{months[r.month - 1]}</Td>
                  <Td right>{money(r.start)}</Td>
                  <Td right>{money(r.inc)}</Td>
                  <Td right>{money(r.exp)}</Td>
                  <Td right>{money(r.end)}</Td>
                </tr>
              ))}
              <tr className="border-t-2 border-gray-800 font-bold bg-gray-50">
                <Td>Жилийн дүн</Td>
                <Td right>{money(openingBalance)}</Td>
                <Td right>{money(totalIncome)}</Td>
                <Td right>{money(totalExpense)}</Td>
                <Td right>{money(cashBalance)}</Td>
              </tr>
            </tbody>
          </table>

          {/* ==== 4. Татварын тооцоо ==== */}
          <h3 className="font-bold text-sm mt-5 mb-2">4. Татварын тооцоо — аж ахуйн нэгжийн орлогын албан татвар</h3>
          <table className="w-full text-sm border border-gray-300">
            <tbody>
              <Line label="Гишүүдийн сарын хураамж" value={feeIncome} indent muted note="татвар ногдуулаагүй — доорх тайлбарыг үз" />
              <Line label="Татвар ногдох орлого (бусад орлого)" value={taxableIncome} indent />
              <Line label={`Албан татварын хувь хэмжээ`} value={0} indent muted note={`${(CIT_RATE * 100).toFixed(0)}%`} hideValue />
              <tr className="border-t-2 border-gray-800 bg-gray-50">
                <td className="px-2 py-2 font-bold">Төлбөл зохих татвар (тооцоолсон)</td>
                <td className="px-2 py-2 text-right font-bold">{money(citTax)}</td>
              </tr>
              <Line label="НӨАТ-ын статус" value={0} indent muted note={org?.is_vat_payer ? 'НӨАТ суутган төлөгч — НӨАТ-ын тайланг тусад нь гаргана' : 'НӨАТ суутган төлөгч биш'} hideValue />
            </tbody>
          </table>

          <div className="border border-gray-800 rounded p-3 mt-3 text-xs leading-relaxed">
            <p className="font-bold mb-1">⚠️ Заавал уншина уу</p>
            <p>
              Энэ хэсэг нь <b>тооцоо</b> бөгөөд татварын албанд тушаах маягт (ТТ-02) БИШ.
              Гишүүдийн сарын хураамжийг гишүүдийн хуримтлал гэж үзэн татвар ногдуулаагүй
              болно — энэ нь <b>баталгаажаагүй таамаг</b>. Түрээс, зар сурталчилгаа, алданги
              зэрэг бусад орлогод {(CIT_RATE * 100).toFixed(0)}% татвар тооцов.
            </p>
            <p className="mt-1.5">
              Эцсийн тайланг <b>нягтлан бодогч</b> эдгээр тоон дээр үндэслэн бэлтгэж,
              татварын албанд өөрөө тушаана. Цалингийн ХХОАТ, нийгмийн даатгалын шимтгэлийг
              энэ тайлан тооцдоггүй.
            </p>
          </div>

          {/* ==== Гарын үсэг ==== */}
          <div className="grid grid-cols-3 gap-6 mt-8 text-sm">
            <SignLine role="СӨХ-ийн дарга" />
            <SignLine role="Нягтлан бодогч" />
            <SignLine role="Хяналтын зөвлөл" />
          </div>

          <p className="text-[10px] text-gray-500 mt-6 pt-3 border-t border-gray-300 leading-relaxed">
            Хотол системд бүртгэгдсэн орлого, зардлын мэдээллээс автоматаар гаргав.
            Тайлангийн үнэн зөв байдал нь оруулсан өгөгдлөөс хамаарна — орлого, зардлаа
            бүрэн бүртгээгүй бол тайлан дутуу гарна.
          </p>
        </div>
      )}

      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          body * { visibility: hidden; }
          #report, #report * { visibility: visible; }
          #report { position: absolute; left: 0; top: 0; width: 100%; max-width: none !important; padding: 0 !important; }
          .no-print { display: none !important; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
          h3 { page-break-after: avoid; }
        }
      `}</style>
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`px-2 py-1.5 text-xs font-semibold border-r border-gray-300 last:border-r-0 ${right ? 'text-right' : 'text-left'}`}>{children}</th>;
}

function Td({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <td className={`px-2 py-1.5 border-r border-gray-200 last:border-r-0 ${right ? 'text-right' : 'text-left'}`}>{children}</td>;
}

function SectionRow({ label }: { label: string }) {
  return (
    <tr className="bg-gray-100 border-t border-gray-300">
      <td className="px-2 py-1.5 font-bold text-xs tracking-wide" colSpan={2}>{label}</td>
    </tr>
  );
}

function Line({ label, value, indent, indent2, bold, muted, note, hideValue }: {
  label: string; value: number; indent?: boolean; indent2?: boolean;
  bold?: boolean; muted?: boolean; note?: string; hideValue?: boolean;
}) {
  return (
    <tr className={`border-t border-gray-200 ${bold ? 'font-bold bg-gray-50' : ''}`}>
      <td className={`px-2 py-1.5 ${indent2 ? 'pl-10' : indent ? 'pl-6' : ''} ${muted ? 'text-gray-500' : ''}`}>
        {label}
        {note && <span className="text-[11px] text-gray-500"> — {note}</span>}
      </td>
      <td className={`px-2 py-1.5 text-right ${muted && !bold ? 'text-gray-500' : ''}`}>
        {hideValue ? '' : money(value)}
      </td>
    </tr>
  );
}

function SignLine({ role }: { role: string }) {
  return (
    <div>
      <div className="border-b border-gray-500 h-8" />
      <p className="text-xs text-gray-600 mt-1">{role}</p>
      <p className="text-[10px] text-gray-400">/ гарын үсэг, нэр /</p>
    </div>
  );
}
