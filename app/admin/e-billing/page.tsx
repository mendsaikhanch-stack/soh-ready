'use client';

import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { adminFrom } from '@/app/lib/admin-db';
import { getAdminSokhId } from '@/app/lib/admin-config';
import Field from '@/app/components/Field';

interface Resident {
  id: number;
  name: string;
  apartment: string;
  debt: number;
  monthly_fee: number | null;
  bank_customer_code: string | null;
  unit_kind: string | null;
  pending_claim: boolean;
}

/** Банкны файлаас уншсан нэг мөр, айлтай тулгасны дараах төлөв */
interface ParsedRow {
  rowNo: number;
  code: string;
  amount: number;
  paidAt: string | null;
  memo: string;
  payer: string;
  externalRef: string;
  resident: Resident | null;
  matchedBy: 'code' | 'apartment' | 'memo' | null;
  duplicate: boolean;
}

type ColumnKey = 'code' | 'amount' | 'date' | 'memo' | 'payer' | 'ref';

const COLUMN_LABELS: Record<ColumnKey, string> = {
  code: 'Хэрэглэгчийн код / тоот',
  amount: 'Орлого (дүн)',
  date: 'Огноо',
  memo: 'Гүйлгээний утга',
  payer: 'Мөнгө илгээгч',
  ref: 'Гүйлгээний дугаар',
};

// Толгой мөрийг таних түлхүүр үгс. Банк бүр өөр нэр хэрэглэдэг тул өргөн барина.
// Дараалал нь ЭРЭМБЭ — эхний тохирсон нь сонгогдоно. Тиймээс "орлого" нь
// ерөнхий "дүн"-ээс өмнө байна: орлого/зарлага 2 баганатай хуулгад зөвхөн
// ОРЛОГЫН баганыг авах ёстой, эс бөгөөс СӨХ-ийн зарлагыг төлбөр гэж үзнэ.
const HEADER_HINTS: Record<ColumnKey, string[]> = {
  code: ['хэрэглэгчийн код', 'харилцагчийн код', 'customer', 'код', 'code', 'тоот'],
  amount: ['орлого', 'credit', 'кредит', 'тушаасан', 'гүйлгээний дүн', 'дүн', 'дун', 'amount', 'мөнгөн дүн'],
  date: ['гүйлгээний огноо', 'огноо', 'date', 'он сар'],
  memo: ['гүйлгээний утга', 'утга', 'тайлбар', 'description', 'memo', 'narrative', 'гүйлгээний тайлбар'],
  payer: ['харилцагчийн нэр', 'илгээгч', 'эсрэг талын нэр', 'payer', 'нэр'],
  ref: ['гүйлгээний дугаар', 'баримтын дугаар', 'дансны хуулгын дугаар', 'ref', 'reference', 'txn'],
};

const num = (v: unknown) => {
  const n = Number(String(v ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

// Төрийн банкны и-биллингийн 16 оронт «Хэрэглэгчийн №»-г задална.
// Бүтэц: угтвар(4) + хороо(2) + байр(4) + корпус(1) + хаалга/тоот(4) + өрх(1)
// Жишээ: 2005180067301010 = 18-р хороо, 67-р байр, 3-р корпус, 101 тоот.
// Банкны нэхэмжлэхийн файлд эдгээрийг тус тусад нь багана болгож өгдөг тул
// айл бүрд нь тусад нь хадгалахын оронд кодоос нь буцааж задалж авна.
const decodeBankCode = (code: string | null) => {
  const c = String(code ?? '').trim();
  if (!/^\d{16}$/.test(c)) return null;
  return {
    horoo: String(+c.slice(4, 6)),
    bair: String(+c.slice(6, 10)),
    korpus: String(+c.slice(10, 11)),
    haalga: String(+c.slice(11, 15)),
    orh: String(+c.slice(15, 16)),
  };
};

export default function AdminEBilling() {
  const [tab, setTab] = useState<'export' | 'import'>('export');
  const [residents, setResidents] = useState<Resident[]>([]);
  const [orgFee, setOrgFee] = useState(0);
  const [loading, setLoading] = useState(true);

  // Экспорт
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [includeDebt, setIncludeDebt] = useState(true);
  const [skipZero, setSkipZero] = useState(true);

  // Импорт
  const [rawRows, setRawRows] = useState<unknown[][]>([]);
  const [headerRow, setHeaderRow] = useState(0);
  const [mapping, setMapping] = useState<Record<ColumnKey, number>>({ code: -1, amount: -1, date: -1, memo: -1, payer: -1, ref: -1 });
  const [existingRefs, setExistingRefs] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const sokhId = await getAdminSokhId();
    const [{ data: res }, { data: org }] = await Promise.all([
      adminFrom('residents').select('*').eq('sokh_id', sokhId),
      adminFrom('sokh_organizations').select('monthly_fee').eq('id', sokhId).single(),
    ]);
    const rows = ((res as unknown as Resident[]) || [])
      .slice()
      .sort((a, b) => (a.apartment || '').localeCompare(b.apartment || '', undefined, { numeric: true }));
    setResidents(rows);
    const o = org as unknown as { monthly_fee?: number } | null;
    setOrgFee(Number(o?.monthly_fee) || 0);

    // Импортод давхардал шалгахад ашиглана
    const ids = rows.map(r => r.id);
    if (ids.length) {
      const { data: pays } = await adminFrom('payments').select('external_ref').in('resident_id', ids);
      const refs = new Set<string>();
      for (const p of (pays as unknown as { external_ref: string | null }[]) || []) {
        if (p.external_ref) refs.add(p.external_ref);
      }
      setExistingRefs(refs);
    }
    setLoading(false);
  };

  // ---------- ЭКСПОРТ ----------

  const feeOf = (r: Resident) => Number(r.monthly_fee ?? orgFee) || 0;
  const billOf = (r: Resident) => feeOf(r) + (includeDebt ? Number(r.debt) || 0 : 0);

  const exportRows = residents
    .filter(r => !r.pending_claim)
    .filter(r => !skipZero || billOf(r) > 0);

  const exportTotal = exportRows.reduce((s, r) => s + billOf(r), 0);

  // Кодгүй айл — банк таних боломжгүй тул анхааруулна
  const missingCode = exportRows.filter(r => !decodeBankCode(r.bank_customer_code)).length;

  // Багана нь Төрийн банкны и-биллингийн файлын бүтэцтэй яг ижил байна
  // (нэр, дараалал, хуудасны нэр «invoices» хүртэл).
  const downloadInvoices = () => {
    const period = `${year}.${String(month).padStart(2, '0')}`;
    const data = exportRows.map(r => {
      const d = decodeBankCode(r.bank_customer_code);
      return {
        'Хэрэглэгчийн №': r.bank_customer_code || r.apartment,
        'Хороо': d?.horoo ?? '',
        'Байр': d?.bair ?? '',
        'Корпус': d?.korpus ?? '',
        'Хаалга': d?.haalga ?? r.apartment,
        'Өрх': d?.orh ?? '',
        'Нэх/Он': year,
        'Нэх/Сар': month,
        'Харилцагчийн нэр': r.name,
        'Нэхэмжилсэн дүн': billOf(r),
      };
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'invoices');
    XLSX.writeFile(wb, `нэхэмжлэх-${period}.xlsx`);
  };

  // ---------- ИМПОРТ ----------

  // Толгойн нэрсийг түлхүүр үгтэй тааруулна. Түлхүүр үгийн ДАРААЛАЛ нь эрэмбэ —
  // жагсаалтын эхэнд байгаа үг тохирвол түүнийг сонгоно (жнь "Зарлага" биш "Орлого").
  const guessMapping = (header: unknown[]): Record<ColumnKey, number> => {
    const cells = header.map(c => String(c ?? '').toLowerCase().trim());
    const found: Record<ColumnKey, number> = { code: -1, amount: -1, date: -1, memo: -1, payer: -1, ref: -1 };
    for (const key of Object.keys(HEADER_HINTS) as ColumnKey[]) {
      for (const hint of HEADER_HINTS[key]) {
        const idx = cells.findIndex(h => h && h.includes(hint));
        if (idx >= 0) { found[key] = idx; break; }
      }
    }
    // Нэг багана 2 үүрэгт орохоос сэргийлнэ (жнь "нэр" нь "хэрэглэгчийн нэр"-т 2 удаа таарах)
    const used = new Set<number>();
    for (const key of ['amount', 'date', 'code', 'ref', 'memo', 'payer'] as ColumnKey[]) {
      if (found[key] >= 0 && used.has(found[key])) found[key] = -1;
      else if (found[key] >= 0) used.add(found[key]);
    }
    return found;
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setResult('');
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
      if (!rows.length) { setError('Файл хоосон байна'); return; }

      // Толгой мөрийг олох — эхний 10 мөрөөс хамгийн олон багана таньсныг сонгоно
      let bestRow = 0, bestScore = -1;
      for (let i = 0; i < Math.min(10, rows.length); i++) {
        const m = guessMapping(rows[i]);
        const score = Object.values(m).filter(v => v >= 0).length;
        if (score > bestScore) { bestScore = score; bestRow = i; }
      }
      setRawRows(rows);
      setHeaderRow(bestRow);
      setMapping(guessMapping(rows[bestRow]));
    } catch {
      setError('Файлыг уншиж чадсангүй. Excel (.xlsx) эсвэл CSV байх ёстой.');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  // Файлын мөрүүдийг айлтай тулгана
  const parsed: ParsedRow[] = (() => {
    if (!rawRows.length || mapping.amount < 0) return [];
    const byCode = new Map<string, Resident>();
    const byApt = new Map<string, Resident>();
    for (const r of residents) {
      if (r.bank_customer_code) byCode.set(String(r.bank_customer_code).trim(), r);
      byApt.set(String(r.apartment).trim(), r);
    }

    const out: ParsedRow[] = [];
    for (let i = headerRow + 1; i < rawRows.length; i++) {
      const row = rawRows[i];
      const amount = num(row[mapping.amount]);
      if (amount <= 0) continue;

      const code = mapping.code >= 0 ? String(row[mapping.code] ?? '').trim() : '';
      const memo = mapping.memo >= 0 ? String(row[mapping.memo] ?? '').trim() : '';
      const payer = mapping.payer >= 0 ? String(row[mapping.payer] ?? '').trim() : '';
      const dateRaw = mapping.date >= 0 ? row[mapping.date] : null;
      let paidAt: string | null = null;
      if (dateRaw) {
        // Excel огноог тоогоор хадгалдаг (1899-12-30-аас хойших хоног)
        const d = typeof dateRaw === 'number'
          ? new Date(Date.UTC(1899, 11, 30) + dateRaw * 86400000)
          : new Date(String(dateRaw));
        if (!isNaN(d.getTime())) paidAt = d.toISOString();
      }

      // Тулгах дараалал: хэрэглэгчийн код → тоот → гүйлгээний утган дахь тоо
      let resident: Resident | null = null;
      let matchedBy: ParsedRow['matchedBy'] = null;
      if (code) {
        if (byCode.has(code)) { resident = byCode.get(code)!; matchedBy = 'code'; }
        else if (byApt.has(code)) { resident = byApt.get(code)!; matchedBy = 'apartment'; }
      }
      // Гүйлгээний утга (шаардлагатай бол илгээгчийн нэр) дотроос тоот хайна
      if (!resident) {
        for (const m of `${memo} ${payer}`.match(/\d{1,5}/g) || []) {
          const hit = byCode.get(m) || byApt.get(m);
          if (hit) { resident = hit; matchedBy = 'memo'; break; }
        }
      }

      const refCell = mapping.ref >= 0 ? String(row[mapping.ref] ?? '').trim() : '';
      const externalRef = refCell
        ? `bank:${refCell}`
        : `bank:${(paidAt || '').slice(0, 10)}:${amount}:${code || memo.slice(0, 20) || i}`;

      out.push({
        rowNo: i + 1, code, amount, paidAt, memo, payer, externalRef,
        resident, matchedBy, duplicate: existingRefs.has(externalRef),
      });
    }
    return out;
  })();

  const matched = parsed.filter(p => p.resident && !p.duplicate);
  const unmatched = parsed.filter(p => !p.resident);
  const duplicates = parsed.filter(p => p.duplicate);
  const matchedTotal = matched.reduce((s, p) => s + p.amount, 0);

  const applyImport = async () => {
    if (!matched.length) return;
    if (!confirm(
      `${matched.length} гүйлгээ, нийт ${matchedTotal.toLocaleString()}₮ бүртгэгдэнэ.\n\n` +
      `Тухайн айлуудын өр энэ дүнгээр хасагдана. Үргэлжлүүлэх үү?`
    )) return;

    setApplying(true);
    setError('');

    const { error: payErr } = await adminFrom('payments').insert(
      matched.map(p => ({
        resident_id: p.resident!.id,
        amount: p.amount,
        description: p.memo || 'Банкны и-биллинг',
        paid_at: p.paidAt || new Date().toISOString(),
        external_ref: p.externalRef,
        source: 'ebilling',
      }))
    );
    if (payErr) {
      setApplying(false);
      setError(`Төлбөр бүртгэж чадсангүй: ${payErr}`);
      return;
    }

    // Айл бүрийн өрийг нийлбэрээр нь нэг удаа хасна
    const byResident = new Map<number, number>();
    for (const p of matched) {
      byResident.set(p.resident!.id, (byResident.get(p.resident!.id) || 0) + p.amount);
    }
    let debtFailed = 0;
    for (const [id, total] of byResident) {
      const r = residents.find(x => x.id === id);
      if (!r) continue;
      const { error } = await adminFrom('residents')
        .update({ debt: Math.max(0, Number(r.debt) - total) }).eq('id', id);
      if (error) debtFailed++;
    }

    setApplying(false);
    setRawRows([]);
    setResult(
      `${matched.length} гүйлгээ бүртгэгдэж, ${byResident.size} айлын өр шинэчлэгдлээ (${matchedTotal.toLocaleString()}₮).` +
      (debtFailed ? ` ⚠️ ${debtFailed} айлын өр шинэчлэгдсэнгүй — Оршин суугчид хэсгээс шалгана уу.` : '')
    );
    await load();
  };

  if (loading) return <div className="p-6 text-gray-400">Ачаалж байна...</div>;

  const headerCells = rawRows[headerRow] || [];

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-2xl font-bold mb-1">📄 И-биллинг</h1>
      <p className="text-sm text-gray-500 mb-6">
        Сар бүрийн нэхэмжлэхийг банк руу өгөх файл болгон гаргаж, банкнаас ирсэн төлөлтийн
        тайланг оруулахад төлбөр автоматаар бүртгэгдэж, өр хасагдана.
      </p>

      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 max-w-md">
        {([['export', '📤 Нэхэмжлэх гаргах'], ['import', '📥 Төлөлт оруулах']] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition ${tab === k ? 'bg-white shadow' : 'text-gray-500'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ========== ЭКСПОРТ ========== */}
      {tab === 'export' && (
        <div className="bg-white border rounded-xl p-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <Field label="Он">
              <input type="number" value={year} onChange={e => setYear(Number(e.target.value))}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </Field>
            <Field label="Сар">
              <select value={month} onChange={e => setMonth(Number(e.target.value))}
                className="w-full border rounded-lg px-3 py-2 text-sm">
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}-р сар</option>)}
              </select>
            </Field>
          </div>

          <div className="space-y-2 mb-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={includeDebt} onChange={e => setIncludeDebt(e.target.checked)} className="w-4 h-4" />
              Өмнөх өрийг нэхэмжлэх дүнд нэмэх
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={skipZero} onChange={e => setSkipZero(e.target.checked)} className="w-4 h-4" />
              Дүн нь 0 байгаа айлыг оруулахгүй
            </label>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 mb-4 flex items-center gap-6">
            <div>
              <p className="text-xs text-gray-500">Нэхэмжлэх айл</p>
              <p className="text-xl font-bold">{exportRows.length}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Нийт дүн</p>
              <p className="text-xl font-bold">{exportTotal.toLocaleString()}₮</p>
            </div>
          </div>

          <button
            onClick={downloadInvoices}
            disabled={exportRows.length === 0}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            📥 Excel татах
          </button>

          {missingCode > 0 && (
            <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              ⚠️ {missingCode} айлд банкны хэрэглэгчийн дугаар алга. Тэднийг банк таних
              боломжгүй тул төлбөр нь бүртгэгдэхгүй. Оршин суугчид хэсгээс дугаарыг нь оруулна уу.
            </p>
          )}

          <div className="mt-5 pt-4 border-t text-xs text-gray-500 leading-relaxed space-y-1">
            <p className="font-medium text-gray-600">Файлын багана</p>
            <p>Хэрэглэгчийн № · Хороо · Байр · Корпус · Хаалга · Өрх · Нэх/Он · Нэх/Сар · Харилцагчийн нэр · Нэхэмжилсэн дүн</p>
            <p>
              Энэ нь <b>Төрийн банкны и-биллингийн файлтай яг ижил</b> бүтэц — багананы нэр,
              дараалал хүртэл адилхан. Татаад шууд банк руу өгнө.
            </p>
            <p>
              Хороо, байр, корпус, тоот нь хэрэглэгчийн дугаараас автоматаар гарна
              (жишээ нь <b>2005180067301010</b> = 18-р хороо, 67-р байр, 3-р корпус, 101 тоот).
            </p>
          </div>
        </div>
      )}

      {/* ========== ИМПОРТ ========== */}
      {tab === 'import' && (
        <div className="space-y-4">
          <div className="bg-white border rounded-xl p-5">
            <p className="text-sm text-gray-600 mb-3">
              Банкнаас ирсэн төлөлтийн тайлан эсвэл дансны хуулгыг оруулна уу (.xlsx / .csv).
              Гүйлгээ бүрийг хэрэглэгчийн код, тоот, эсвэл гүйлгээний утган дахь тоотоор нь айлтай тулгана.
            </p>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
            <button onClick={() => fileRef.current?.click()} className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium">
              Файл сонгох
            </button>
            {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
            {result && <p className="text-sm text-green-600 mt-3">{result}</p>}
          </div>

          {rawRows.length > 0 && (
            <>
              {/* Багана тааруулах */}
              <div className="bg-white border rounded-xl p-5">
                <h3 className="font-semibold text-sm mb-1">Багана тааруулах</h3>
                <p className="text-xs text-gray-500 mb-4">
                  Автоматаар таньсан байдал. Буруу бол өөрчилнө үү — «Дүн» заавал сонгогдсон байх ёстой.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                  <Field label="Толгой мөр">
                    <select
                      value={headerRow}
                      onChange={e => { const h = Number(e.target.value); setHeaderRow(h); setMapping(guessMapping(rawRows[h] || [])); }}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    >
                      {rawRows.slice(0, 10).map((r, i) => (
                        <option key={i} value={i}>{i + 1}-р мөр: {r.slice(0, 4).map(c => String(c ?? '')).join(' | ').slice(0, 40)}</option>
                      ))}
                    </select>
                  </Field>
                  {(Object.keys(COLUMN_LABELS) as ColumnKey[]).map(key => (
                    <Field key={key} label={COLUMN_LABELS[key]} required={key === 'amount'}>
                      <select
                        value={mapping[key]}
                        onChange={e => setMapping({ ...mapping, [key]: Number(e.target.value) })}
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                      >
                        <option value={-1}>— байхгүй —</option>
                        {headerCells.map((c, i) => (
                          <option key={i} value={i}>{String(c ?? '') || `${i + 1}-р багана`}</option>
                        ))}
                      </select>
                    </Field>
                  ))}
                </div>
              </div>

              {/* Урьдчилан харах */}
              <div className="bg-white border rounded-xl p-5">
                <div className="flex flex-wrap gap-6 mb-4">
                  <div>
                    <p className="text-xs text-gray-500">Тулгасан</p>
                    <p className="text-xl font-bold text-green-600">{matched.length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Нийт дүн</p>
                    <p className="text-xl font-bold">{matchedTotal.toLocaleString()}₮</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Айл олдоогүй</p>
                    <p className="text-xl font-bold text-amber-600">{unmatched.length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Өмнө оруулсан</p>
                    <p className="text-xl font-bold text-gray-400">{duplicates.length}</p>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-96 overflow-y-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr className="text-left text-xs text-gray-500">
                        <th className="px-3 py-2">Мөр</th>
                        <th className="px-3 py-2">Код</th>
                        <th className="px-3 py-2">Гүйлгээний утга</th>
                        <th className="px-3 py-2">Илгээгч</th>
                        <th className="px-3 py-2 text-right">Дүн</th>
                        <th className="px-3 py-2">Айл</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.slice(0, 300).map(p => (
                        <tr key={p.rowNo} className={`border-t ${p.duplicate ? 'bg-gray-50 text-gray-400' : !p.resident ? 'bg-amber-50' : ''}`}>
                          <td className="px-3 py-2 text-xs text-gray-400">{p.rowNo}</td>
                          <td className="px-3 py-2">{p.code || '-'}</td>
                          <td className="px-3 py-2 text-xs text-gray-500 max-w-xs truncate">{p.memo || '-'}</td>
                          <td className="px-3 py-2 text-xs text-gray-500 max-w-[10rem] truncate">{p.payer || '-'}</td>
                          <td className="px-3 py-2 text-right font-medium">{p.amount.toLocaleString()}₮</td>
                          <td className="px-3 py-2">
                            {p.duplicate ? (
                              <span className="text-xs">өмнө оруулсан</span>
                            ) : p.resident ? (
                              <span>
                                {p.resident.name} <span className="text-gray-400">({p.resident.apartment})</span>
                                {p.matchedBy === 'memo' && <span className="ml-1 text-[10px] text-blue-500">утгаас</span>}
                              </span>
                            ) : (
                              <span className="text-amber-700 text-xs">олдсонгүй — гараар бүртгэнэ</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {parsed.length > 300 && (
                  <p className="text-xs text-gray-400 mt-2">Эхний 300 мөрийг харуулав. Бүгд бүртгэгдэнэ.</p>
                )}

                <div className="flex gap-2 mt-4">
                  <button onClick={() => setRawRows([])} className="px-4 py-2 border rounded-lg text-sm">Цуцлах</button>
                  <button
                    onClick={applyImport}
                    disabled={applying || matched.length === 0}
                    className="px-5 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                  >
                    {applying ? 'Бүртгэж байна...' : `${matched.length} гүйлгээг бүртгэх`}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
