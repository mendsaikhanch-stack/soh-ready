'use client';

import { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/app/lib/supabase';
import { adminFrom } from '@/app/lib/admin-db';

interface ParsedRow {
  name: string;
  apartment: string;
  phone: string;
  debt: number;
  building: string;
  unpaidMonths: string;
  sokhDebt: number;
  trashDebt: number;
  otherDebt: number;
}

interface SheetResult {
  sheetName: string;
  building: string;
  rows: ParsedRow[];
}

type FileFormat = 'building-sheets' | 'flat-list';

export default function ImportPage() {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [fileName, setFileName] = useState('');
  const [sheets, setSheets] = useState<SheetResult[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [format, setFormat] = useState<FileFormat>('flat-list');
  const [importResult, setImportResult] = useState({ success: 0, failed: 0 });
  const [error, setError] = useState('');
  const [sokhId, setSokhId] = useState<number | null>(null);
  const [sokhList, setSokhList] = useState<{ id: number; name: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // СӨХ жагсаалт татах
  useEffect(() => {
    supabase.from('sokh_organizations').select('id, name').then(({ data }) => {
      if (data && data.length > 0) {
        setSokhList(data);
        setSokhId(data[0].id);
      }
    });
  }, []);

  const parseNum = (val: any): number => {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return val;
    const cleaned = String(val).replace(/[,\s₮%]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  };

  // ========== Format A: Байр бүр sheet (Тоот + өр) ==========

  const extractBuildingName = (data: any[][], sheetName: string): string => {
    for (let i = 0; i < Math.min(3, data.length); i++) {
      const cell = String(data[i]?.[0] || '').trim();
      const match = cell.match(/(\d+)\s*-?\s*р?\s*байр/i);
      if (match) return `${match[1]}-р байр`;
    }
    const m = sheetName.match(/(\d+)/);
    return m ? `${m[1]}-р байр` : sheetName;
  };

  const findHeaderRow = (data: any[][]): number => {
    for (let i = 0; i < Math.min(10, data.length); i++) {
      const row = data[i];
      if (!row) continue;
      const joined = row.map((c: any) => String(c).toLowerCase()).join('|');
      if (joined.includes('тоот')) return i;
    }
    return -1;
  };

  const parseBuildingSheet = (ws: XLSX.WorkSheet, sheetName: string): SheetResult | null => {
    const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
    if (data.length < 3) return null;

    const building = extractBuildingName(data, sheetName);
    const headerIdx = findHeaderRow(data);
    if (headerIdx === -1) return null;

    const headers = data[headerIdx].map((h: any) => String(h).toLowerCase().trim());

    // Баганууд олох
    let colApt = -1, colMonths = -1, colSokh = -1, colTrash = -1, colOther = -1, colTotal = -1;
    headers.forEach((h, i) => {
      if (h.includes('тоот') || h === '№') colApt = i;
      else if (h.includes('төлөгдөөгүй сар') || h.includes('сарууд')) colMonths = i;
      else if (h.includes('сөх') || h.includes('хураамж')) colSokh = i;
      else if (h.includes('хог')) colTrash = i;
      else if (h.includes('нийт') || h === 'total') colTotal = i;
      else if (h.includes('төлөх ёстой') || h.includes('төлбөр')) colOther = i;
    });
    if (colApt === -1) colApt = 0;

    const rows: ParsedRow[] = [];
    for (let i = headerIdx + 1; i < data.length; i++) {
      const row = data[i];
      if (!row || !row.some((c: any) => String(c).trim())) continue;
      const apt = String(row[colApt] ?? '').trim();
      if (!apt) continue;
      const aptLower = apt.toLowerCase();
      if (aptLower.includes('нийт') || aptLower.includes('дүн') || aptLower.includes('бүгд')) continue;

      const sokhDebt = colSokh >= 0 ? parseNum(row[colSokh]) : 0;
      const trashDebt = colTrash >= 0 ? parseNum(row[colTrash]) : 0;
      const otherDebt = colOther >= 0 ? parseNum(row[colOther]) : 0;
      const totalDebt = colTotal >= 0 ? parseNum(row[colTotal]) : (sokhDebt + trashDebt + otherDebt);
      const months = colMonths >= 0 ? String(row[colMonths] || '').trim() : '';

      rows.push({
        name: `${building}, ${apt} тоот`,
        apartment: `${building}, ${apt} тоот`,
        phone: '',
        debt: totalDebt,
        building,
        unpaidMonths: months,
        sokhDebt,
        trashDebt,
        otherDebt,
      });
    }
    return rows.length > 0 ? { sheetName, building, rows } : null;
  };

  // ========== Format B: Нэгдсэн жагсаалт (Нэр + утас + өр) ==========

  const parseFlatSheet = (ws: XLSX.WorkSheet, sheetName: string): SheetResult | null => {
    const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
    if (data.length < 2) return null;

    // Header олох
    let headerIdx = 0;
    for (let i = 0; i < Math.min(5, data.length); i++) {
      if (data[i] && data[i].filter((c: any) => String(c).trim()).length >= 2) {
        headerIdx = i;
        break;
      }
    }

    const headers = data[headerIdx].map((h: any) => String(h).toLowerCase().trim());
    let colName = -1, colApt = -1, colPhone = -1, colDebt = -1;

    headers.forEach((h, i) => {
      if (h.includes('нэр') || h.includes('name') || h.includes('овог')) colName = i;
      else if (h.includes('байр') || h.includes('тоот') || h.includes('хаяг') || h.includes('apartment')) colApt = i;
      else if (h.includes('утас') || h.includes('phone') || h.includes('дугаар')) colPhone = i;
      else if (h.includes('өр') || h.includes('debt') || h.includes('үлдэгдэл') || h.includes('нийт') || h.includes('төлбөр')) colDebt = i;
    });

    // Data pattern-аар нэмж таних
    if (colName === -1) {
      const sampleRows = data.slice(headerIdx + 1, headerIdx + 15);
      for (let col = 0; col < headers.length; col++) {
        if ([colApt, colPhone, colDebt].includes(col)) continue;
        const vals = sampleRows.map(r => String(r?.[col] || '').trim()).filter(Boolean);
        const nameScore = vals.filter(v => v.length >= 2 && /[А-Яа-яӨөҮүЁё]/.test(v) && (v.match(/\d/g) || []).length / v.length < 0.2).length / Math.max(vals.length, 1);
        if (nameScore > 0.4) { colName = col; break; }
      }
    }

    if (colName === -1) return null;

    const rows: ParsedRow[] = [];
    for (let i = headerIdx + 1; i < data.length; i++) {
      const row = data[i];
      if (!row) continue;
      const name = String(row[colName] ?? '').trim();
      if (!name || name.length < 2) continue;

      rows.push({
        name,
        apartment: colApt >= 0 ? String(row[colApt] ?? '').trim() : '',
        phone: colPhone >= 0 ? String(row[colPhone] ?? '').trim() : '',
        debt: colDebt >= 0 ? parseNum(row[colDebt]) : 0,
        building: '',
        unpaidMonths: '',
        sokhDebt: 0,
        trashDebt: 0,
        otherDebt: 0,
      });
    }
    return rows.length > 0 ? { sheetName, building: sheetName, rows } : null;
  };

  // ========== Формат автомат тодорхойлох ==========

  const detectFormat = (wb: XLSX.WorkBook): FileFormat => {
    // Олон sheet + "тоот" header = building-sheets формат
    if (wb.SheetNames.length >= 3) {
      let buildingCount = 0;
      for (const name of wb.SheetNames.slice(0, 5)) {
        const ws = wb.Sheets[name];
        const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
        if (findHeaderRow(data) >= 0) buildingCount++;
      }
      if (buildingCount >= 2) return 'building-sheets';
    }

    // Эхний sheet-д "нэр" header байвал flat-list
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
    for (let i = 0; i < Math.min(5, data.length); i++) {
      const joined = (data[i] || []).map((c: any) => String(c).toLowerCase()).join('|');
      if (joined.includes('нэр') || joined.includes('name') || joined.includes('овог')) return 'flat-list';
    }

    // Default: building-sheets гэж оролдох
    if (findHeaderRow(data) >= 0) return 'building-sheets';
    return 'flat-list';
  };

  // ========== Файл уншиж задлах ==========

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setFileName(file.name);
    setSheets([]);
    setActiveSheet(0);

    try {
      let results: SheetResult[] = [];

      if (file.name.match(/\.csv$|\.txt$/i)) {
        const text = await file.text();
        const lines = text.split('\n').filter(l => l.trim());
        const allRows = lines.map(line => {
          const result: string[] = [];
          let current = '', inQ = false;
          for (const ch of line) {
            if (ch === '"') inQ = !inQ;
            else if ((ch === ',' || ch === '\t' || ch === ';') && !inQ) { result.push(current.trim()); current = ''; }
            else current += ch;
          }
          result.push(current.trim());
          return result;
        });
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(allRows);
        XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
        const r = parseFlatSheet(ws, 'Sheet1');
        if (r) results.push(r);
      } else {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const fmt = detectFormat(wb);
        setFormat(fmt);

        for (const name of wb.SheetNames) {
          const ws = wb.Sheets[name];
          const r = fmt === 'building-sheets' ? parseBuildingSheet(ws, name) : parseFlatSheet(ws, name);
          if (r) results.push(r);
        }
      }

      if (results.length === 0) {
        setError('Файлаас өгөгдөл олдсонгүй. Файлын формат шалгана уу.');
        return;
      }

      setSheets(results);
      setStep('preview');
    } catch (err) {
      setError('Файл уншихад алдаа гарлаа.');
      console.error(err);
    }
  };

  // ========== Импорт ==========

  const doImport = async () => {
    setStep('importing');
    let success = 0, failed = 0;
    const allRows = sheets.flatMap(s => s.rows);

    for (const row of allRows) {
      const insertData: any = {
        name: row.name,
        apartment: row.apartment,
        debt: row.debt,
      };
      if (row.phone) insertData.phone = row.phone;
      if (sokhId) insertData.sokh_id = sokhId;

      const { error } = await adminFrom('residents').insert([insertData]);
      if (error) { failed++; console.error('Import error:', error, row); }
      else success++;
    }

    setImportResult({ success, failed });
    setStep('done');
  };

  const reset = () => {
    setStep('upload');
    setFileName('');
    setSheets([]);
    setActiveSheet(0);
    setError('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const currentSheet = sheets[activeSheet];
  const totalRows = sheets.reduce((s, sh) => s + sh.rows.length, 0);
  const totalDebt = sheets.reduce((s, sh) => s + sh.rows.reduce((ss, r) => ss + r.debt, 0), 0);
  const isBuildingFormat = format === 'building-sheets';

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">📤 Файл импорт</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm mb-4">{error}</div>
      )}

      {/* Upload */}
      {step === 'upload' && (
        <div>
          <div className="bg-white border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center hover:border-blue-400 transition">
            <div className="text-5xl mb-4">📁</div>
            <h2 className="text-lg font-semibold mb-2">Файл оруулах</h2>
            <p className="text-sm text-gray-500 mb-2">Excel (.xlsx, .xls), CSV файл дэмжинэ</p>
            <p className="text-xs text-gray-400 mb-6">Формат автоматаар таниж, шууд харуулна</p>
            <label className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold cursor-pointer hover:bg-blue-700 transition">
              Файл сонгох
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.txt" className="hidden" onChange={handleFile} />
            </label>
          </div>

          {/* СӨХ сонгох */}
          {sokhList.length > 0 && (
            <div className="mt-4 bg-white border rounded-xl p-4">
              <label className="text-sm font-medium text-gray-700 block mb-2">Аль СӨХ-д оруулах вэ?</label>
              <select
                value={sokhId ?? ''}
                onChange={(e) => setSokhId(Number(e.target.value))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                {sokhList.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="mt-4 bg-gray-50 rounded-xl p-4">
            <h3 className="font-semibold text-sm mb-3">Дэмжих формат</h3>
            <div className="space-y-2 text-xs text-gray-600">
              <div className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span><strong>Байр тус бүр sheet</strong> — Тоот, өрийн үлдэгдэл (СӨХ хураамж, хог г.м.)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span><strong>Нэгдсэн жагсаалт</strong> — Нэр, утас, байр/тоот, өр</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>Ямар ч СӨХ-ийн <strong>өөр өөр загвар</strong> автомат таньна</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview */}
      {step === 'preview' && currentSheet && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">📄 {fileName}</h2>
              <p className="text-sm text-gray-500">
                {isBuildingFormat
                  ? `${sheets.length} байр · ${totalRows} тоот`
                  : `${totalRows} оршин суугч`
                }
                {sokhList.find(s => s.id === sokhId) && (
                  <span> · {sokhList.find(s => s.id === sokhId)!.name}</span>
                )}
              </p>
            </div>
            <button onClick={reset} className="text-sm text-gray-500 hover:underline">Өөр файл</button>
          </div>

          {/* Формат тэмдэглэгээ */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4">
            <span className="text-blue-600 text-sm font-semibold">
              🔍 {isBuildingFormat ? 'Байр тус бүр sheet' : 'Нэгдсэн жагсаалт'} формат илэрлээ
            </span>
          </div>

          {/* Нийт статистик */}
          <div className={`grid ${isBuildingFormat ? 'grid-cols-4' : 'grid-cols-3'} gap-3 mb-4`}>
            {isBuildingFormat && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-blue-700">{sheets.length}</p>
                <p className="text-xs text-blue-500">Байр</p>
              </div>
            )}
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-purple-700">{totalRows}</p>
              <p className="text-xs text-purple-500">{isBuildingFormat ? 'Тоот' : 'Хүн'}</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-red-600">{totalDebt.toLocaleString()}₮</p>
              <p className="text-xs text-red-500">Нийт өр</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-green-600">
                {sheets.reduce((s, sh) => s + sh.rows.filter(r => r.debt === 0).length, 0)}
              </p>
              <p className="text-xs text-green-500">Өргүй</p>
            </div>
          </div>

          {/* Sheet tabs */}
          {sheets.length > 1 && (
            <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
              {sheets.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setActiveSheet(i)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                    activeSheet === i ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {s.building} ({s.rows.length})
                </button>
              ))}
            </div>
          )}

          {/* Table */}
          <div className="bg-white border rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-gray-500 text-xs">
                  <th className="px-3 py-2">№</th>
                  {isBuildingFormat ? (
                    <>
                      <th className="px-3 py-2">Тоот</th>
                      <th className="px-3 py-2">Төлөгдөөгүй</th>
                      <th className="px-3 py-2 text-right">СӨХ</th>
                      <th className="px-3 py-2 text-right">Хог</th>
                      <th className="px-3 py-2 text-right">Бусад</th>
                      <th className="px-3 py-2 text-right font-semibold">Нийт</th>
                    </>
                  ) : (
                    <>
                      <th className="px-3 py-2">Нэр</th>
                      <th className="px-3 py-2">Байр/Тоот</th>
                      <th className="px-3 py-2">Утас</th>
                      <th className="px-3 py-2 text-right font-semibold">Өр</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {currentSheet.rows.slice(0, 100).map((r, i) => (
                  <tr key={i} className="border-t hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-400 text-xs">{i + 1}</td>
                    {isBuildingFormat ? (
                      <>
                        <td className="px-3 py-2 font-semibold">{r.apartment.split(', ').pop()?.replace(' тоот', '') || r.apartment}</td>
                        <td className="px-3 py-2 text-gray-500 text-xs max-w-[180px] truncate" title={r.unpaidMonths}>
                          {r.unpaidMonths || '—'}
                        </td>
                        <td className={`px-3 py-2 text-right ${r.sokhDebt > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                          {r.sokhDebt > 0 ? `${r.sokhDebt.toLocaleString()}₮` : '0₮'}
                        </td>
                        <td className={`px-3 py-2 text-right ${r.trashDebt > 0 ? 'text-orange-500' : 'text-gray-400'}`}>
                          {r.trashDebt > 0 ? `${r.trashDebt.toLocaleString()}₮` : '0₮'}
                        </td>
                        <td className={`px-3 py-2 text-right ${r.otherDebt > 0 ? 'text-yellow-600' : 'text-gray-400'}`}>
                          {r.otherDebt > 0 ? `${r.otherDebt.toLocaleString()}₮` : '0₮'}
                        </td>
                        <td className={`px-3 py-2 text-right font-bold ${r.debt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {r.debt > 0 ? `${r.debt.toLocaleString()}₮` : '0₮'}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2 font-medium">{r.name}</td>
                        <td className="px-3 py-2">{r.apartment || '—'}</td>
                        <td className="px-3 py-2 text-gray-500">{r.phone || '—'}</td>
                        <td className={`px-3 py-2 text-right font-bold ${r.debt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {r.debt > 0 ? `${r.debt.toLocaleString()}₮` : '0₮'}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                {/* Дүн мөр */}
                <tr className="border-t-2 bg-gray-50 font-semibold">
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2">Дүн</td>
                  {isBuildingFormat ? (
                    <>
                      <td className="px-3 py-2"></td>
                      <td className="px-3 py-2 text-right text-red-600">
                        {currentSheet.rows.reduce((s, r) => s + r.sokhDebt, 0).toLocaleString()}₮
                      </td>
                      <td className="px-3 py-2 text-right text-orange-600">
                        {currentSheet.rows.reduce((s, r) => s + r.trashDebt, 0).toLocaleString()}₮
                      </td>
                      <td className="px-3 py-2 text-right text-yellow-600">
                        {currentSheet.rows.reduce((s, r) => s + r.otherDebt, 0).toLocaleString()}₮
                      </td>
                      <td className="px-3 py-2 text-right text-red-700">
                        {currentSheet.rows.reduce((s, r) => s + r.debt, 0).toLocaleString()}₮
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-2"></td>
                      <td className="px-3 py-2"></td>
                      <td className="px-3 py-2 text-right text-red-700">
                        {currentSheet.rows.reduce((s, r) => s + r.debt, 0).toLocaleString()}₮
                      </td>
                    </>
                  )}
                </tr>
              </tbody>
            </table>
            {currentSheet.rows.length > 100 && (
              <p className="text-center text-xs text-gray-400 py-2">...болон {currentSheet.rows.length - 100} бусад</p>
            )}
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={reset} className="flex-1 py-3 border rounded-xl text-sm font-medium hover:bg-gray-50 transition">
              Цуцлах
            </button>
            <button onClick={doImport} className="flex-1 py-3 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition">
              ✓ Импортлох ({totalRows} {isBuildingFormat ? 'тоот' : 'хүн'})
            </button>
          </div>
        </div>
      )}

      {/* Importing */}
      {step === 'importing' && (
        <div className="text-center py-16">
          <div className="text-5xl mb-4 animate-bounce">⏳</div>
          <h2 className="text-lg font-semibold mb-2">Импортлож байна...</h2>
          <p className="text-sm text-gray-500">{totalRows} мэдээллийг нэмж байна</p>
        </div>
      )}

      {/* Done */}
      {step === 'done' && (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-lg font-semibold mb-4">Импорт дууслаа!</h2>
          <div className="flex justify-center gap-6 mb-6">
            <div>
              <p className="text-2xl font-bold text-green-600">{importResult.success}</p>
              <p className="text-xs text-gray-500">Амжилттай</p>
            </div>
            {importResult.failed > 0 && (
              <div>
                <p className="text-2xl font-bold text-red-500">{importResult.failed}</p>
                <p className="text-xs text-gray-500">Алдаатай</p>
              </div>
            )}
          </div>
          <div className="flex gap-3 max-w-sm mx-auto">
            <button onClick={reset} className="flex-1 py-3 border rounded-xl text-sm font-medium hover:bg-gray-50">
              Дахин импорт
            </button>
            <button onClick={() => window.location.href = '/admin/residents'}
              className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold">
              Жагсаалт харах
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
