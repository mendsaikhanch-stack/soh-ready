'use client';

// СӨХ-ийн ажилчдын цалингийн тооцоо — /admin/payroll
//
// Яагаад тусдаа хуудас вэ: /admin/staff дээрх «Цалингийн тооцоо» таб нь
// зөвхөн дэлгэц дээрх урьдчилсан тооцоо байсан — сар бүрийн бүртгэл,
// олголтын түүх, санхүүтэй холбоо байхгүй. Энэ хуудас түүнийг гүйцээнэ:
//
//   1. Сар бүрийн цалинг ажилтан тус бүрээр БҮРТГЭНЭ (payroll_entries)
//   2. НДШ, ХХОАТ-ыг СӨХ-ийн өөрийн тохируулсан хувиар бодно
//   3. «Олгосон» гэж тэмдэглэхэд зардлын бүртгэлд автоматаар орно —
//      цалин нь СӨХ-ийн хамгийн том зардлын нэг, тайланд заавал байх ёстой
//   4. Цалингийн хүснэгтийг хэвлэж, гарын үсэг зуруулж болно
//
// ⚠️ Татвар, шимтгэлийн хувь нь тогтмол бичигдээгүй — СӨХ бүр өөрөө
//    тохируулна. Анхдагч утга нь 2025 оны байдлаарх нийтлэг хувь бөгөөд
//    хууль өөрчлөгдөх, ажил олгогчийн эрсдэлийн ангиллаас хамаарч
//    ялгаатай байдаг тул нягтлан бодогчоор баталгаажуулах ёстой.

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { adminFrom } from '@/app/lib/admin-db';
import { getAdminSokhId } from '@/app/lib/admin-config';

interface Staff { id: number; name: string; role: string; status: string; }
// Цалин нь staff-д БИШ, хаалттай staff_salaries-д хадгалагдана — staff-ыг
// оршин суугчийн апп anon түлхүүрээр уншдаг тул тэнд цалин байж болохгүй.
interface StaffSalary { id: number; staff_id: number; amount: number; }
interface Entry {
  id: number; staff_id: number | null; staff_name: string; role: string | null;
  year: number; month: number;
  base_salary: number; bonus: number; other_deduction: number;
  si_employee: number; si_employer: number; pit: number; net_pay: number;
  status: string; paid_at: string | null; note: string | null;
}
interface Org {
  name: string; address: string | null;
  si_employee_rate?: number | null; si_employer_rate?: number | null;
  pit_rate?: number | null; pit_credit?: number | null;
}

const roleLabels: Record<string, string> = {
  manager: 'Менежер', janitor: 'Цэвэрлэгч', security: 'Харуул',
  plumber: 'Сантехникч', electrician: 'Цахилгаанчин', other: 'Бусад',
};
const months = ['1-р сар','2-р сар','3-р сар','4-р сар','5-р сар','6-р сар','7-р сар','8-р сар','9-р сар','10-р сар','11-р сар','12-р сар'];
const money = (n: number) => `${Math.round(n).toLocaleString()}₮`;

interface Rates { siEmp: number; siOrg: number; pit: number; credit: number; }

// Цалингийн томъёо — хуудасны бүх газарт ЭНЭ нэг функц ажиллана
function calc(base: number, bonus: number, deduction: number, r: Rates) {
  const gross = base + bonus;
  const siEmployee = Math.round(gross * r.siEmp / 100);
  const siEmployer = Math.round(gross * r.siOrg / 100);
  // ХХОАТ нь НДШ хассаны дараах дүнгээс бодогдож, сарын хөнгөлөлт хасагдана
  const pit = Math.max(0, Math.round((gross - siEmployee) * r.pit / 100) - r.credit);
  const net = gross - siEmployee - pit - deduction;
  return { gross, siEmployee, siEmployer, pit, net };
}

export default function PayrollPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [org, setOrg] = useState<Org | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [salaries, setSalaries] = useState<Record<number, number>>({});
  const [entries, setEntries] = useState<Entry[]>([]);
  const [tableMissing, setTableMissing] = useState(false);

  // Мөр дотор засаж буй утгууд (хадгалагдах хүртэл)
  const [edits, setEdits] = useState<Record<number, { bonus: string; ded: string }>>({});

  // Хувь хэмжээний тохиргоо
  const [editRates, setEditRates] = useState(false);
  const [rSiEmp, setRSiEmp] = useState('');
  const [rSiOrg, setRSiOrg] = useState('');
  const [rPit, setRPit] = useState('');
  const [rCredit, setRCredit] = useState('');

  const rates: Rates = {
    siEmp: Number(org?.si_employee_rate ?? 11.5),
    siOrg: Number(org?.si_employer_rate ?? 12.5),
    pit: Number(org?.pit_rate ?? 10),
    credit: Number(org?.pit_credit ?? 20000),
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const sokhId = await getAdminSokhId();
    if (!sokhId) { setLoading(false); return; }

    const [{ data: o }, { data: st }, { data: en, error: enErr }, { data: sal }] = await Promise.all([
      adminFrom('sokh_organizations').select('*').eq('id', sokhId).single(),
      adminFrom('staff').select('*').eq('sokh_id', sokhId).order('name', { ascending: true }),
      adminFrom('payroll_entries').select('*').eq('sokh_id', sokhId).eq('year', year).eq('month', month),
      adminFrom('staff_salaries').select('*').eq('sokh_id', sokhId),
    ]);

    const orgRow = (o as unknown as Org) || null;
    setOrg(orgRow);
    setRSiEmp(String(orgRow?.si_employee_rate ?? 11.5));
    setRSiOrg(String(orgRow?.si_employer_rate ?? 12.5));
    setRPit(String(orgRow?.pit_rate ?? 10));
    setRCredit(String(orgRow?.pit_credit ?? 20000));
    setStaff((st as unknown as Staff[]) || []);
    const salMap: Record<number, number> = {};
    for (const row of ((sal as unknown as StaffSalary[]) || [])) salMap[row.staff_id] = Number(row.amount);
    setSalaries(salMap);
    setEntries((en as unknown as Entry[]) || []);
    setTableMissing(Boolean(enErr));
    setEdits({});
    setLoading(false);
  }, [month, year]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const saveRates = async () => {
    setBusy(true);
    const sokhId = await getAdminSokhId();
    const res = await adminFrom('sokh_organizations').update({
      si_employee_rate: Number(rSiEmp) || 0,
      si_employer_rate: Number(rSiOrg) || 0,
      pit_rate: Number(rPit) || 0,
      pit_credit: Number(rCredit) || 0,
    }).eq('id', sokhId);
    setBusy(false);
    if (res.error) { alert(`Хадгалагдсангүй: ${res.error}\n\nsupabase-payroll-migration.sql ажиллуулсан эсэхээ шалгана уу.`); return; }
    setEditRates(false);
    await fetchAll();
  };

  // Идэвхтэй ажилтан бүрд тухайн сарын мөр үүсгэнэ.
  // Аль хэдийн мөртэй ажилтныг АЛГАСНА — дахин дарахад давхар мөр үүсэхгүй,
  // гараар оруулсан урамшуулал ч арчигдахгүй.
  const generate = async () => {
    const active = staff.filter(s => s.status !== 'inactive');
    const have = new Set(entries.map(e => e.staff_id));
    const missing = active.filter(s => !have.has(s.id));
    if (missing.length === 0) {
      alert('Бүх идэвхтэй ажилтны мөр аль хэдийн үүссэн байна.');
      return;
    }
    const noSalary = missing.filter(s => !Number(salaries[s.id]));
    if (noSalary.length === missing.length) {
      alert('Ажилтнуудад цалин тогтоогоогүй байна. «Ажилчид» цэснээс цалингийн дүнг оруулна уу.');
      return;
    }
    if (!confirm(`${months[month - 1]} сарын ${missing.length - noSalary.length} ажилтны цалинг бодох уу?`)) return;

    setBusy(true);
    const sokhId = await getAdminSokhId();
    const rows = missing.filter(s => Number(salaries[s.id]) > 0).map(s => {
      const base = Number(salaries[s.id]);
      const c = calc(base, 0, 0, rates);
      return {
        sokh_id: sokhId, staff_id: s.id, staff_name: s.name, role: s.role,
        year, month,
        base_salary: base, bonus: 0, other_deduction: 0,
        si_employee: c.siEmployee, si_employer: c.siEmployer, pit: c.pit, net_pay: c.net,
        status: 'draft',
      };
    });
    const res = await adminFrom('payroll_entries').insert(rows);
    setBusy(false);
    if (res.error) { alert(`Цалин бодогдсонгүй: ${res.error}`); return; }
    await fetchAll();
  };

  const saveRow = async (e: Entry) => {
    const ed = edits[e.id];
    if (!ed) return;
    const bonus = Number(ed.bonus) || 0;
    const ded = Number(ed.ded) || 0;
    if (bonus === Number(e.bonus) && ded === Number(e.other_deduction)) return;
    const c = calc(Number(e.base_salary), bonus, ded, rates);
    const res = await adminFrom('payroll_entries').update({
      bonus, other_deduction: ded,
      si_employee: c.siEmployee, si_employer: c.siEmployer, pit: c.pit, net_pay: c.net,
      updated_at: new Date().toISOString(),
    }).eq('id', e.id);
    if (res.error) { alert(`Хадгалагдсангүй: ${res.error}`); return; }
    await fetchAll();
  };

  // Олгосон гэж тэмдэглэхэд СӨХ-ийн НИЙТ зардал (цалин + ажил олгогчийн НДШ)
  // зардлын бүртгэлд орно. Гарт олгосон дүн биш — татвар, шимтгэлийг ч СӨХ
  // төлж байгаа тул нийт өртөг нь тайланд харагдах ёстой.
  const markPaid = async (e: Entry) => {
    const cost = Number(e.base_salary) + Number(e.bonus) + Number(e.si_employer);
    if (!confirm(`${e.staff_name} — ${money(Number(e.net_pay))} гарт олгосон гэж тэмдэглэх үү?\n\nЗардлын бүртгэлд ${money(cost)} (цалин + ажил олгогчийн НДШ) орно.`)) return;
    setBusy(true);
    const sokhId = await getAdminSokhId();
    await adminFrom('payroll_entries').update({
      status: 'paid', paid_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', e.id);
    await adminFrom('budget_items').insert([{
      sokh_id: sokhId, type: 'expense', name: `Цалин — ${e.staff_name}`,
      category: 'salary', amount: cost, month, year,
      description: `${months[month - 1]} ${year} цалин, НДШ`,
    }]);
    setBusy(false);
    await fetchAll();
  };

  const delEntry = async (id: number) => {
    if (!confirm('Энэ мөрийг устгах уу?')) return;
    await adminFrom('payroll_entries').delete().eq('id', id);
    await fetchAll();
  };

  // ===== Дүнгүүд =====
  const sum = (f: (e: Entry) => number) => entries.reduce((s, e) => s + f(e), 0);
  const totalBase = sum(e => Number(e.base_salary));
  const totalBonus = sum(e => Number(e.bonus));
  const totalGross = totalBase + totalBonus;
  const totalSiEmp = sum(e => Number(e.si_employee));
  const totalSiOrg = sum(e => Number(e.si_employer));
  const totalPit = sum(e => Number(e.pit));
  const totalDed = sum(e => Number(e.other_deduction));
  const totalNet = sum(e => Number(e.net_pay));
  const totalCost = totalGross + totalSiOrg;
  const paidCount = entries.filter(e => e.status === 'paid').length;

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      entries.map(e => ({
        'Ажилтан': e.staff_name,
        'Албан тушаал': roleLabels[e.role || 'other'] || e.role,
        'Үндсэн цалин': Number(e.base_salary),
        'Урамшуулал': Number(e.bonus),
        'НДШ (ажилтан)': Number(e.si_employee),
        'ХХОАТ': Number(e.pit),
        'Бусад суутгал': Number(e.other_deduction),
        'Гарт олгох': Number(e.net_pay),
        'НДШ (ажил олгогч)': Number(e.si_employer),
        'Төлөв': e.status === 'paid' ? 'Олгосон' : 'Бодсон',
      }))
    ), `${year}-${month} Цалин`);
    XLSX.writeFile(wb, `цалин-${year}-${String(month).padStart(2, '0')}.xlsx`);
  };

  return (
    <div className="p-6">
      <div className="no-print flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Link href="/admin/staff" className="text-sm text-gray-500 hover:text-gray-700">← Ажилчид</Link>
          <h1 className="text-xl font-bold">💵 Цалингийн тооцоо</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); }} className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm">←</button>
          <span className="font-bold text-sm min-w-[110px] text-center">{year} · {months[month - 1]}</span>
          <button onClick={() => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); }} className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm">→</button>
          <button onClick={() => window.print()} className="ml-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">🖨 Хэвлэх</button>
          <button onClick={exportExcel} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">📥 Excel</button>
        </div>
      </div>

      {tableMissing && (
        <div className="no-print bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 mb-5 text-sm">
          <b>Цалингийн хүснэгт бэлэн болоогүй байна.</b> Supabase → SQL Editor дээр
          <b> supabase-payroll-migration.sql</b> файлыг нэг удаа ажиллуулна уу.
        </div>
      )}

      {/* ==== Хувь хэмжээ ==== */}
      <div className="no-print bg-white border rounded-xl p-4 mb-5">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="font-semibold text-sm">Татвар, шимтгэлийн хувь</h2>
            <p className="text-xs text-gray-500">Хууль өөрчлөгдөх, эрсдэлийн ангиллаас хамаарч ялгаатай — нягтлангаараа шалгуулна уу.</p>
          </div>
          {!editRates
            ? <button onClick={() => setEditRates(true)} className="text-xs px-3 py-1.5 border rounded-lg hover:bg-gray-50">✏️ Засах</button>
            : <div className="flex gap-2">
                <button onClick={() => setEditRates(false)} className="text-xs px-3 py-1.5 border rounded-lg">Цуцлах</button>
                <button onClick={saveRates} disabled={busy} className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg disabled:opacity-50">Хадгалах</button>
              </div>}
        </div>
        {editRates ? (
          <div className="grid grid-cols-4 gap-3">
            <RateInput label="НДШ — ажилтнаас (%)" value={rSiEmp} onChange={setRSiEmp} />
            <RateInput label="НДШ — ажил олгогч (%)" value={rSiOrg} onChange={setRSiOrg} />
            <RateInput label="ХХОАТ (%)" value={rPit} onChange={setRPit} />
            <RateInput label="ХХОАТ-ын сарын хөнгөлөлт (₮)" value={rCredit} onChange={setRCredit} />
          </div>
        ) : (
          <p className="text-sm text-gray-600">
            НДШ ажилтан <b>{rates.siEmp}%</b> · НДШ ажил олгогч <b>{rates.siOrg}%</b> ·
            ХХОАТ <b>{rates.pit}%</b> · хөнгөлөлт <b>{money(rates.credit)}</b>
          </p>
        )}
      </div>

      {/* ==== KPI ==== */}
      <div className="no-print grid grid-cols-5 gap-3 mb-5">
        <Kpi label="Нийт цалин" value={money(totalGross)} sub={`${entries.length} ажилтан`} color="blue" />
        <Kpi label="НДШ (ажилтан)" value={money(totalSiEmp)} sub="суутгасан" color="orange" />
        <Kpi label="ХХОАТ" value={money(totalPit)} sub="суутгасан" color="orange" />
        <Kpi label="Гарт олгох" value={money(totalNet)} sub={`${paidCount} олгосон`} color="green" />
        <Kpi label="СӨХ-ийн зардал" value={money(totalCost)} sub="цалин + НДШ" color="red" />
      </div>

      <div className="no-print flex items-center justify-between mb-4">
        <p className="text-xs text-gray-500">
          «Олгосон» дарахад тухайн ажилтны нийт өртөг зардлын бүртгэлд автоматаар орно.
          Урамшуулал, суутгалыг мөрөн дотор нь бичээд хулганаа авахад хадгалагдана.
        </p>
        <button onClick={generate} disabled={busy || loading} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap ml-4">
          🧮 {months[month - 1]} сарын цалин бодох
        </button>
      </div>

      {loading ? <p className="text-gray-400 text-center py-12">Ачаалж байна...</p> : (
        <div id="report" className="bg-white">
          {/* Хэвлэхэд гарах толгой */}
          <div className="hidden print:block mb-3">
            <h2 className="text-lg font-extrabold">{org?.name || 'СӨХ'}</h2>
            <p className="text-sm">{year} оны {months[month - 1]} — цалингийн тооцоо</p>
          </div>

          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs text-gray-500">Ажилтан</th>
                  <th className="px-3 py-2.5 text-right text-xs text-gray-500">Үндсэн цалин</th>
                  <th className="px-3 py-2.5 text-right text-xs text-gray-500">Урамшуулал</th>
                  <th className="px-3 py-2.5 text-right text-xs text-gray-500">НДШ</th>
                  <th className="px-3 py-2.5 text-right text-xs text-gray-500">ХХОАТ</th>
                  <th className="px-3 py-2.5 text-right text-xs text-gray-500">Бусад суутгал</th>
                  <th className="px-3 py-2.5 text-right text-xs text-gray-500">Гарт олгох</th>
                  <th className="px-3 py-2.5 text-left text-xs text-gray-500">Төлөв</th>
                  <th className="px-3 py-2.5 text-right text-xs text-gray-500 no-print"></th>
                </tr>
              </thead>
              <tbody>
                {entries.map(e => {
                  const paid = e.status === 'paid';
                  const ed = edits[e.id];
                  return (
                    <tr key={e.id} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-2.5">
                        {e.staff_name}
                        <span className="block text-xs text-gray-400">{roleLabels[e.role || 'other'] || e.role}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right">{money(Number(e.base_salary))}</td>
                      <td className="px-3 py-2.5 text-right">
                        {paid ? money(Number(e.bonus)) : (
                          <input
                            type="number"
                            value={ed ? ed.bonus : String(Number(e.bonus) || '')}
                            onChange={ev => setEdits(p => ({ ...p, [e.id]: { bonus: ev.target.value, ded: p[e.id]?.ded ?? String(Number(e.other_deduction) || '') } }))}
                            onBlur={() => saveRow(e)}
                            className="border rounded px-2 py-1 text-sm w-24 text-right"
                            placeholder="0"
                          />
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right text-red-500">−{money(Number(e.si_employee))}</td>
                      <td className="px-3 py-2.5 text-right text-red-500">−{money(Number(e.pit))}</td>
                      <td className="px-3 py-2.5 text-right">
                        {paid ? money(Number(e.other_deduction)) : (
                          <input
                            type="number"
                            value={ed ? ed.ded : String(Number(e.other_deduction) || '')}
                            onChange={ev => setEdits(p => ({ ...p, [e.id]: { ded: ev.target.value, bonus: p[e.id]?.bonus ?? String(Number(e.bonus) || '') } }))}
                            onBlur={() => saveRow(e)}
                            className="border rounded px-2 py-1 text-sm w-24 text-right"
                            placeholder="0"
                          />
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-green-600">{money(Number(e.net_pay))}</td>
                      <td className="px-3 py-2.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${paid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {paid ? 'Олгосон' : 'Бодсон'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right no-print">
                        {!paid && <button onClick={() => markPaid(e)} disabled={busy} className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded mr-1 disabled:opacity-50">✓ Олгосон</button>}
                        <button onClick={() => delEntry(e.id)} className="text-xs text-red-400 hover:underline">Устгах</button>
                      </td>
                    </tr>
                  );
                })}
                {entries.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">
                    {months[month - 1]} сарын цалин бодоогүй байна. Дээрх «Цалин бодох» товчийг дарна уу.
                  </td></tr>
                )}
              </tbody>
              {entries.length > 0 && (
                <tfoot className="bg-gray-50 font-bold border-t-2 border-gray-800">
                  <tr>
                    <td className="px-3 py-3">НИЙТ</td>
                    <td className="px-3 py-3 text-right">{money(totalBase)}</td>
                    <td className="px-3 py-3 text-right">{money(totalBonus)}</td>
                    <td className="px-3 py-3 text-right text-red-600">−{money(totalSiEmp)}</td>
                    <td className="px-3 py-3 text-right text-red-600">−{money(totalPit)}</td>
                    <td className="px-3 py-3 text-right">−{money(totalDed)}</td>
                    <td className="px-3 py-3 text-right text-green-700">{money(totalNet)}</td>
                    <td className="px-3 py-3" colSpan={2}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {entries.length > 0 && (
            <>
              <div className="mt-4 border rounded-xl p-4 text-sm bg-gray-50">
                <p className="font-semibold mb-1">СӨХ-ийн нийт зардал: {money(totalCost)}</p>
                <p className="text-gray-600 text-xs leading-relaxed">
                  Нийт цалин {money(totalGross)} + ажил олгогчийн НДШ {money(totalSiOrg)} ({rates.siOrg}%).
                  Ажилтнаас суутгасан НДШ {money(totalSiEmp)} ба ХХОАТ {money(totalPit)}-ыг СӨХ нь холбогдох
                  байгууллагад тушаана. Гарт олгох нийт дүн {money(totalNet)}.
                </p>
              </div>

              <div className="hidden print:grid grid-cols-3 gap-6 mt-10 text-sm">
                <SignLine role="СӨХ-ийн дарга" />
                <SignLine role="Нягтлан бодогч" />
                <SignLine role="Цалин олгосон" />
              </div>
            </>
          )}
        </div>
      )}

      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 12mm; }
          body * { visibility: hidden; }
          #report, #report * { visibility: visible; }
          #report { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          input { border: none !important; }
          tr { page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}

function RateInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs text-gray-500">{label}</span>
      <input type="number" step="0.1" value={value} onChange={e => onChange(e.target.value)} className="border rounded-lg px-3 py-2 text-sm w-full mt-1" />
    </label>
  );
}

function Kpi({ label, value, sub, color }: { label: string; value: string; sub: string; color: 'blue' | 'green' | 'orange' | 'red' }) {
  const map: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    red: 'bg-red-50 border-red-200 text-red-700',
  };
  return (
    <div className={`border rounded-xl p-3 ${map[color]}`}>
      <p className="text-xs text-gray-600">{label}</p>
      <p className="text-lg font-bold mt-0.5">{value}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
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
