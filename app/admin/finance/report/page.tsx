'use client';

// Жилийн санхүүгийн тайлан — хэвлэх / PDF болгох хуудас.
//
// Яагаад тусдаа хуудас вэ: даргад хурал дээр тараах, самбарт наах цаас
// хэрэгтэй байдаг. Дэлгэцийн самбар (/admin/finance) нь интерактив, харин
// энэ нь A4-т багтсан, гарын үсгийн мөртэй бэлэн баримт.
//
// PDF болгох нь хөтчийн «Хэвлэх → PDF болгож хадгалах» замаар явна —
// монгол үсэг ямар ч фонт суулгахгүйгээр зөв гардаг (jsPDF-д кирилл
// фонт шаардагддаг тул зориуд сонгосон).
//
// docs/SPEC.md #6-ийн 4 заавал хэсэг бүгд энд орсон:
// орлого-зардал, авлага өглөг, сарын нэгтгэл, жилийн нэгтгэл.

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { adminFrom } from '@/app/lib/admin-db';
import { getAdminSokhId } from '@/app/lib/admin-config';

interface BudgetItem { id: number; category: string; amount: number; month: number; year: number; description: string; }
interface Payment { id: number; resident_id: number; amount: number; description: string; paid_at: string; }
interface Resident { id: number; name: string; apartment: string; debt: number; monthly_fee: number | null; pending_claim: boolean; }
interface ReserveEntry { id: number; type: string; amount: number; description: string; occurred_at: string; }
interface Payable { id: number; vendor: string; category: string; amount: number; paid_amount: number; due_date: string | null; status: string; description: string; }
interface Org { name: string; address: string | null; phone: string | null; monthly_fee: number | null; }

const categoryLabels: Record<string, string> = {
  cleaning: 'Цэвэрлэгээ', elevator: 'Лифт', security: 'Харуул', repair: 'Засвар',
  electricity: 'Цахилгаан', water: 'Ус', heating: 'Дулаан', garden: 'Тохижилт',
  reserve: 'Нөөц сан', insurance: 'Даатгал', salary: 'Цалин', other: 'Бусад',
};
const months = ['1-р сар','2-р сар','3-р сар','4-р сар','5-р сар','6-р сар','7-р сар','8-р сар','9-р сар','10-р сар','11-р сар','12-р сар'];
const money = (n: number) => `${Math.round(n).toLocaleString()}₮`;

// Өртэй айлыг бүгдийг нь хэвлэвэл зарим СӨХ-д 10 хуудас болно.
// Хурлын тайланд эхний 20 нь хангалттай — үлдсэнийг нийлбэрээр харуулна.
const DEBTOR_LIMIT = 20;

export default function FinanceReportPage() {
  return (
    <Suspense fallback={<p className="p-6 text-gray-400">Ачаалж байна...</p>}>
      <ReportContent />
    </Suspense>
  );
}

function ReportContent() {
  const searchParams = useSearchParams();
  const paramYear = parseInt(searchParams.get('year') || '', 10);
  const [year, setYear] = useState(Number.isFinite(paramYear) && paramYear > 2000 ? paramYear : new Date().getFullYear());

  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState<Org | null>(null);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [reserveEntries, setReserveEntries] = useState<ReserveEntry[]>([]);
  const [payables, setPayables] = useState<Payable[]>([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const sokhId = await getAdminSokhId();
    if (!sokhId) { setLoading(false); return; }

    const [{ data: orgRow }, { data: res }] = await Promise.all([
      adminFrom('sokh_organizations').select('name, address, phone, monthly_fee').eq('id', sokhId).single(),
      adminFrom('residents').select('id,name,apartment,debt,monthly_fee,pending_claim').eq('sokh_id', sokhId).order('apartment', { ascending: true }),
    ]);

    const residentList = ((res as unknown as Resident[]) || []).filter(r => !r.pending_claim);
    const residentIds = residentList.map(r => r.id);

    const [{ data: pay }, { data: items }, { data: rf }, { data: pyb }] = await Promise.all([
      residentIds.length
        ? adminFrom('payments').select('*').in('resident_id', residentIds).order('paid_at', { ascending: false })
        : Promise.resolve({ data: [] }),
      adminFrom('budget_items').select('*').eq('sokh_id', sokhId).eq('year', year),
      adminFrom('reserve_fund').select('*').eq('sokh_id', sokhId).order('occurred_at', { ascending: false }).limit(100),
      adminFrom('payables').select('*').eq('sokh_id', sokhId).order('due_date', { ascending: true }),
    ]);

    setOrg((orgRow as unknown as Org) || null);
    setResidents(residentList);
    setPayments((pay as unknown as Payment[]) || []);
    setBudgetItems((items as unknown as BudgetItem[]) || []);
    setReserveEntries((rf as unknown as ReserveEntry[]) || []);
    setPayables((pyb as unknown as Payable[]) || []);
    setLoading(false);
  }, [year]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ===== Тооцоо =====
  const feeOf = (r: Resident) => Number(r.monthly_fee ?? org?.monthly_fee ?? 0) || 0;
  const expectedMonthly = residents.reduce((s, r) => s + feeOf(r), 0);

  const rows = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const income = payments.filter(p => {
      const d = new Date(p.paid_at);
      return d.getFullYear() === year && d.getMonth() + 1 === m;
    }).reduce((s, p) => s + Number(p.amount), 0);
    const expense = budgetItems.filter(b => b.month === m).reduce((s, b) => s + Number(b.amount), 0);
    return { month: m, income, expense };
  });

  const yearIncome = rows.reduce((s, r) => s + r.income, 0);
  const yearExpense = rows.reduce((s, r) => s + r.expense, 0);
  const yearNet = yearIncome - yearExpense;
  const yearExpected = expectedMonthly * 12;
  const collectionRate = yearExpected > 0 ? (yearIncome / yearExpected * 100) : 0;

  const byCat = Object.entries(
    budgetItems.reduce<Record<string, number>>((acc, b) => {
      acc[b.category] = (acc[b.category] || 0) + Number(b.amount);
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  const debtors = residents.filter(r => Number(r.debt || 0) > 0).sort((a, b) => Number(b.debt) - Number(a.debt));
  const totalDebt = debtors.reduce((s, r) => s + Number(r.debt || 0), 0);
  const shownDebtors = debtors.slice(0, DEBTOR_LIMIT);
  const restDebt = debtors.slice(DEBTOR_LIMIT).reduce((s, r) => s + Number(r.debt || 0), 0);

  const openPayables = payables.filter(p => p.status !== 'paid');
  const totalPayable = openPayables.reduce((s, p) => s + (Number(p.amount) - Number(p.paid_amount)), 0);

  const reserveBalance = reserveEntries.reduce((s, e) => s + (e.type === 'deposit' ? Number(e.amount) : -Number(e.amount)), 0);

  const today = new Date().toLocaleDateString('mn-MN');
  const noData = yearIncome === 0 && yearExpense === 0;

  return (
    <div className="p-6">
      {/* ==== Хэвлэхэд харагдахгүй удирдлага ==== */}
      <div className="no-print flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Link href="/admin/finance" className="text-sm text-gray-500 hover:text-gray-700">← Санхүү</Link>
          <h1 className="text-xl font-bold">📄 Жилийн санхүүгийн тайлан</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setYear(y => y - 1)} className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm">←</button>
          <span className="font-bold text-sm min-w-[60px] text-center">{year}</span>
          <button onClick={() => setYear(y => y + 1)} className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm">→</button>
          <button onClick={() => window.print()} className="ml-2 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
            🖨 Хэвлэх / PDF болгох
          </button>
        </div>
      </div>

      {!loading && noData && (
        <div className="no-print bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 mb-5 text-sm">
          <b>{year} онд орлого, зардал бүртгэгдээгүй байна.</b> Тайлан хоосон гарна.
          «Санхүү → Зардал» цэснээс сар бүрийн зарлагаа, «Нэхэмжлэх»-ээс төлөлтөө бүртгэвэл энэ тайлан өөрөө бүрдэнэ.
        </div>
      )}

      {loading ? <p className="text-gray-400 text-center py-12">Ачаалж байна...</p> : (
        <div id="report" className="bg-white mx-auto text-[#111]" style={{ maxWidth: '210mm', padding: '10mm 12mm' }}>
          {/* ==== Толгой ==== */}
          <div className="flex items-start justify-between border-b-2 border-gray-800 pb-3">
            <div>
              <h2 className="text-xl font-extrabold">{org?.name || 'СӨХ'}</h2>
              {org?.address && <p className="text-xs text-gray-600 mt-0.5">{org.address}</p>}
              {org?.phone && <p className="text-xs text-gray-600">Утас: {org.phone}</p>}
            </div>
            <div className="text-right">
              <p className="text-lg font-extrabold">{year} оны санхүүгийн тайлан</p>
              <p className="text-xs text-gray-600 mt-0.5">Гаргасан огноо: {today}</p>
            </div>
          </div>

          {/* ==== 1. Хураангуй ==== */}
          <h3 className="font-bold text-sm mt-5 mb-2">1. Хураангуй</h3>
          <table className="w-full text-sm border border-gray-300">
            <tbody>
              <Row2 a="Нийт айл" b={`${residents.length}`} c="Сарын тогтсон хураамж" d={money(Number(org?.monthly_fee || 0))} />
              <Row2 a="Жилийн орлого" b={money(yearIncome)} c="Жилийн зардал" d={money(yearExpense)} />
              <Row2 a="Цэвэр дүн" b={money(yearNet)} c="Цуглуулалтын хувь" d={`${collectionRate.toFixed(1)}%`} />
              <Row2 a="Авлага (айл СӨХ-д өртэй)" b={money(totalDebt)} c="Өглөг (СӨХ өртэй)" d={money(totalPayable)} />
              <Row2 a="Нөөц сангийн үлдэгдэл" b={money(reserveBalance)} c="Хүлээгдэх жилийн хураамж" d={money(yearExpected)} />
            </tbody>
          </table>

          {/* ==== 2. Орлого-зардлын сарын нэгтгэл ==== */}
          <h3 className="font-bold text-sm mt-5 mb-2">2. Орлого, зардлын сарын нэгтгэл</h3>
          <table className="w-full text-sm border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <Th>Сар</Th><Th right>Орлого</Th><Th right>Зардал</Th><Th right>Зөрүү</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.month} className="border-t border-gray-200">
                  <Td>{months[r.month - 1]}</Td>
                  <Td right>{money(r.income)}</Td>
                  <Td right>{money(r.expense)}</Td>
                  <Td right>{money(r.income - r.expense)}</Td>
                </tr>
              ))}
              <tr className="border-t-2 border-gray-800 font-bold bg-gray-50">
                <Td>Жилийн дүн</Td>
                <Td right>{money(yearIncome)}</Td>
                <Td right>{money(yearExpense)}</Td>
                <Td right>{money(yearNet)}</Td>
              </tr>
            </tbody>
          </table>

          {/* ==== 3. Зардлын задаргаа ==== */}
          <h3 className="font-bold text-sm mt-5 mb-2">3. Зардлын задаргаа</h3>
          <table className="w-full text-sm border border-gray-300">
            <thead>
              <tr className="bg-gray-100"><Th>Ангилал</Th><Th right>Дүн</Th><Th right>Эзлэх хувь</Th></tr>
            </thead>
            <tbody>
              {byCat.length === 0 ? (
                <tr><Td>Зардал бүртгэгдээгүй</Td><Td right>—</Td><Td right>—</Td></tr>
              ) : byCat.map(([cat, total]) => (
                <tr key={cat} className="border-t border-gray-200">
                  <Td>{categoryLabels[cat] || cat}</Td>
                  <Td right>{money(total)}</Td>
                  <Td right>{yearExpense > 0 ? `${(total / yearExpense * 100).toFixed(1)}%` : '—'}</Td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ==== 4. Авлага ==== */}
          <h3 className="font-bold text-sm mt-5 mb-2">
            4. Авлага — айлын өр <span className="font-normal text-xs text-gray-600">(нийт {debtors.length} айл, {money(totalDebt)})</span>
          </h3>
          <table className="w-full text-sm border border-gray-300">
            <thead>
              <tr className="bg-gray-100"><Th>Тоот</Th><Th>Нэр</Th><Th right>Өрийн үлдэгдэл</Th></tr>
            </thead>
            <tbody>
              {shownDebtors.length === 0 ? (
                <tr><Td>Өртэй айл байхгүй</Td><Td>—</Td><Td right>—</Td></tr>
              ) : shownDebtors.map(r => (
                <tr key={r.id} className="border-t border-gray-200">
                  <Td>{r.apartment}</Td>
                  <Td>{r.name}</Td>
                  <Td right>{money(Number(r.debt))}</Td>
                </tr>
              ))}
              {debtors.length > DEBTOR_LIMIT && (
                <tr className="border-t border-gray-200">
                  <Td>Бусад {debtors.length - DEBTOR_LIMIT} айл</Td>
                  <Td>—</Td>
                  <Td right>{money(restDebt)}</Td>
                </tr>
              )}
            </tbody>
          </table>

          {/* ==== 5. Өглөг ==== */}
          <h3 className="font-bold text-sm mt-5 mb-2">
            5. Өглөг — СӨХ-ийн төлөх өр <span className="font-normal text-xs text-gray-600">(нийт {money(totalPayable)})</span>
          </h3>
          <table className="w-full text-sm border border-gray-300">
            <thead>
              <tr className="bg-gray-100"><Th>Хэнд</Th><Th>Ангилал</Th><Th>Хугацаа</Th><Th right>Дүн</Th></tr>
            </thead>
            <tbody>
              {openPayables.length === 0 ? (
                <tr><Td>Төлөгдөөгүй өглөг байхгүй</Td><Td>—</Td><Td>—</Td><Td right>—</Td></tr>
              ) : openPayables.map(p => (
                <tr key={p.id} className="border-t border-gray-200">
                  <Td>{p.vendor}</Td>
                  <Td>{categoryLabels[p.category] || p.category}</Td>
                  <Td>{p.due_date ? new Date(p.due_date).toLocaleDateString('mn-MN') : '—'}</Td>
                  <Td right>{money(Number(p.amount) - Number(p.paid_amount))}</Td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ==== 6. Нөөц сан ==== */}
          {reserveEntries.length > 0 && (
            <>
              <h3 className="font-bold text-sm mt-5 mb-2">
                6. Нөөц сангийн хөдөлгөөн <span className="font-normal text-xs text-gray-600">(үлдэгдэл {money(reserveBalance)})</span>
              </h3>
              <table className="w-full text-sm border border-gray-300">
                <thead>
                  <tr className="bg-gray-100"><Th>Огноо</Th><Th>Төрөл</Th><Th>Тайлбар</Th><Th right>Дүн</Th></tr>
                </thead>
                <tbody>
                  {reserveEntries.slice(0, 20).map(e => (
                    <tr key={e.id} className="border-t border-gray-200">
                      <Td>{new Date(e.occurred_at).toLocaleDateString('mn-MN')}</Td>
                      <Td>{e.type === 'deposit' ? 'Орлого' : 'Зарлага'}</Td>
                      <Td>{e.description}</Td>
                      <Td right>{e.type === 'deposit' ? '+' : '−'}{money(Number(e.amount))}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* ==== Гарын үсэг ==== */}
          <div className="grid grid-cols-3 gap-6 mt-10 text-sm">
            <SignLine role="СӨХ-ийн дарга" />
            <SignLine role="Нягтлан бодогч" />
            <SignLine role="Хяналтын зөвлөл" />
          </div>

          <p className="text-[10px] text-gray-500 mt-8 pt-3 border-t border-gray-300 leading-relaxed">
            Энэ тайланг Хотол системд бүртгэгдсэн орлого, зардлын мэдээллээс автоматаар гаргав.
            Татварын албанд тушаах маягт БИШ — татварын тайланг нягтлан бодогч эдгээр тоон дээр үндэслэн бэлтгэнэ.
            Тайлант хугацаа: {year} оны 1 дүгээр сарын 1-нээс 12 дугаар сарын 31 хүртэл.
          </p>
        </div>
      )}

      {/* Хэвлэхэд зөвхөн тайлангийн блокийг үлдээнэ — админ цэс, товчнууд хасагдана */}
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

function Row2({ a, b, c, d }: { a: string; b: string; c: string; d: string }) {
  return (
    <tr className="border-t border-gray-200 first:border-t-0">
      <td className="px-2 py-1.5 text-gray-600 border-r border-gray-200">{a}</td>
      <td className="px-2 py-1.5 font-semibold text-right border-r border-gray-300">{b}</td>
      <td className="px-2 py-1.5 text-gray-600 border-r border-gray-200">{c}</td>
      <td className="px-2 py-1.5 font-semibold text-right">{d}</td>
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
