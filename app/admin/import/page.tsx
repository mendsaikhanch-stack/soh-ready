'use client';

import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/app/lib/supabase';

interface ParsedRow {
  building: string;
  apartment: string;
  unpaidMonths: string;
  sokhDebt: number;
  trashDebt: number;
  otherDebt: number;
  totalDebt: number;
}

interface SheetResult {
  sheetName: string;
  building: string;
  rows: ParsedRow[];
  headerRow: string[];
}

export default function ImportPage() {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [fileName, setFileName] = useState('');
  const [allSheets, setAllSheets] = useState<SheetResult[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [importResult, setImportResult] = useState({ success: 0, failed: 0 });
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Тоо задлах
  const parseNum = (val: any): number => {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return val;
    const cleaned = String(val).replace(/[,\s₮%]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  };

  // Байрны нэрийг sheet-ийн эхний мөрөөс олох
  const extractBuildingName = (data: any[][], sheetName: string): string => {
    for (let i = 0; i < Math.min(3, data.length); i++) {
      const firstCell = String(data[i]?.[0] || '').trim();
      // "1-р байр", "2-р байр", "..3-р байр.." гэх мэт
      const match = firstCell.match(/(\d+)\s*-?\s*р?\s*байр/i);
      if (match) return `${match[1]}-р байр`;
    }
    // Sheet нэрнээс олох
    const sheetMatch = sheetName.match(/(\d+)/);
    if (sheetMatch) return `${sheetMatch[1]}-р байр`;
    return sheetName;
  };

  // Header мөрийг олох — "Тоот" гэсэн утга агуулсан мөр
  const findHeaderRow = (data: any[][]): number => {
    for (let i = 0; i < Math.min(10, data.length); i++) {
      const row = data[i];
      if (!row) continue;
      const joined = row.map((c: any) => String(c).toLowerCase()).join(' ');
      if (joined.includes('тоот') || joined.includes('нийт')) {
        return i;
      }
    }
    return -1;
  };

  // Баганыг таних
  const detectColumns = (headers: string[]): {
    apartment: number;
    unpaidMonths: number;
    sokhDebt: number;
    trashDebt: number;
    otherDebt: number;
    totalDebt: number;
  } => {
    const result = { apartment: -1, unpaidMonths: -1, sokhDebt: -1, trashDebt: -1, otherDebt: -1, totalDebt: -1 };

    headers.forEach((h, i) => {
      const lower = String(h).toLowerCase().trim();

      if (lower.includes('тоот') || lower === '№') {
        result.apartment = i;
      } else if (lower.includes('төлөгдөөгүй сар') || lower.includes('сарууд')) {
        result.unpaidMonths = i;
      } else if (lower.includes('сөх') || lower.includes('хураамж')) {
        result.sokhDebt = i;
      } else if (lower.includes('хог') || lower.includes('хогны')) {
        result.trashDebt = i;
      } else if (lower.includes('нийт') || lower === 'total') {
        result.totalDebt = i;
      } else if (lower.includes('төлөх ёстой') || lower.includes('төлбөр')) {
        result.otherDebt = i;
      }
    });

    // Fallback: Хэрэв тоот олдоогүй бол эхний баганыг тоот гэж үзнэ
    if (result.apartment === -1) result.apartment = 0;

    return result;
  };

  // Нэг sheet задлах
  const parseOneSheet = (ws: XLSX.WorkSheet, sheetName: string): SheetResult | null => {
    const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
    if (data.length < 3) return null;

    const building = extractBuildingName(data, sheetName);
    const headerIdx = findHeaderRow(data);
    if (headerIdx === -1) return null;

    const headers = data[headerIdx].map((h: any) => String(h).trim());
    const cols = detectColumns(headers);

    const rows: ParsedRow[] = [];
    for (let i = headerIdx + 1; i < data.length; i++) {
      const row = data[i];
      if (!row || !row.some((c: any) => String(c).trim())) continue;

      const apt = String(row[cols.apartment] ?? '').trim();
      if (!apt) continue;

      // Нийт мөр (summary row) алгасах
      const aptLower = apt.toLowerCase();
      if (aptLower.includes('нийт') || aptLower.includes('дүн') || aptLower.includes('бүгд')) continue;

      const sokhDebt = cols.sokhDebt >= 0 ? parseNum(row[cols.sokhDebt]) : 0;
      const trashDebt = cols.trashDebt >= 0 ? parseNum(row[cols.trashDebt]) : 0;
      const otherDebt = cols.otherDebt >= 0 ? parseNum(row[cols.otherDebt]) : 0;
      const totalDebt = cols.totalDebt >= 0 ? parseNum(row[cols.totalDebt]) : (sokhDebt + trashDebt + otherDebt);
      const unpaidMonths = cols.unpaidMonths >= 0 ? String(row[cols.unpaidMonths] || '').trim() : '';

      rows.push({
        building,
        apartment: apt,
        unpaidMonths,
        sokhDebt,
        trashDebt,
        otherDebt,
        totalDebt,
      });
    }

    if (rows.length === 0) return null;
    return { sheetName, building, rows, headerRow: headers };
  };

  // Файл уншиж задлах
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setFileName(file.name);
    setAllSheets([]);
    setActiveSheet(0);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });

      const sheets: SheetResult[] = [];
      for (const name of wb.SheetNames) {
        const ws = wb.Sheets[name];
        const result = parseOneSheet(ws, name);
        if (result) sheets.push(result);
      }

      if (sheets.length === 0) {
        setError('Файлаас өгөгдөл олдсонгүй. "Тоот" баганатай хүснэгт байх ёстой.');
        return;
      }

      setAllSheets(sheets);
      setStep('preview');
    } catch (err) {
      setError('Файл уншихад алдаа гарлаа.');
      console.error(err);
    }
  };

  // Supabase руу импортлох
  const doImport = async () => {
    setStep('importing');
    let success = 0;
    let failed = 0;

    const allRows = allSheets.flatMap(s => s.rows);

    for (const row of allRows) {
      const { error } = await supabase.from('residents').insert([{
        name: `${row.building} - ${row.apartment} тоот`,
        apartment: `${row.building}, ${row.apartment} тоот`,
        debt: row.totalDebt,
      }]);

      if (error) {
        failed++;
        console.error('Import error:', error.message, row);
      } else {
        success++;
      }
    }

    setImportResult({ success, failed });
    setStep('done');
  };

  const reset = () => {
    setStep('upload');
    setFileName('');
    setAllSheets([]);
    setActiveSheet(0);
    setError('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const currentSheet = allSheets[activeSheet];
  const totalRows = allSheets.reduce((s, sh) => s + sh.rows.length, 0);
  const totalDebt = allSheets.reduce((s, sh) => s + sh.rows.reduce((ss, r) => ss + r.totalDebt, 0), 0);
  const totalSokh = allSheets.reduce((s, sh) => s + sh.rows.reduce((ss, r) => ss + r.sokhDebt, 0), 0);
  const totalTrash = allSheets.reduce((s, sh) => s + sh.rows.reduce((ss, r) => ss + r.trashDebt, 0), 0);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">📤 Файл импорт</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm mb-4">
          {error}
        </div>
      )}

      {/* Upload */}
      {step === 'upload' && (
        <div>
          <div className="bg-white border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center hover:border-blue-400 transition">
            <div className="text-5xl mb-4">📁</div>
            <h2 className="text-lg font-semibold mb-2">Файл оруулах</h2>
            <p className="text-sm text-gray-500 mb-2">
              Excel (.xlsx, .xls) файл дэмжинэ
            </p>
            <p className="text-xs text-gray-400 mb-6">
              Байр, тоот, өрийн мэдээллийг автоматаар таньна
            </p>
            <label className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold cursor-pointer hover:bg-blue-700 transition">
              Файл сонгох
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv,.txt,.pdf"
                className="hidden"
                onChange={handleFile}
              />
            </label>
          </div>

          <div className="mt-6 bg-gray-50 rounded-xl p-4">
            <h3 className="font-semibold text-sm mb-3">Ямар ч загвар ажиллана</h3>
            <div className="space-y-2 text-xs text-gray-600">
              <div className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>Sheet бүрийг <strong>байр</strong> гэж таниж, тоот бүрийг оруулна</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>СӨХ хураамж, хогны төлбөр, нийт өрийг <strong>автоматаар</strong> ялгана</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>СӨХ болгоны <strong>өөр өөр загвар</strong> дэмжинэ</span>
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
                {allSheets.length} байр · {totalRows} тоот
              </p>
            </div>
            <button onClick={reset} className="text-sm text-gray-500 hover:underline">Өөр файл</button>
          </div>

          {/* Нийт статистик */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-blue-700">{allSheets.length}</p>
              <p className="text-xs text-blue-500">Байр</p>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-purple-700">{totalRows}</p>
              <p className="text-xs text-purple-500">Нийт тоот</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-red-600">{totalDebt.toLocaleString()}₮</p>
              <p className="text-xs text-red-500">Нийт өр</p>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-orange-600">{totalSokh.toLocaleString()}₮</p>
              <p className="text-xs text-orange-500">СӨХ хураамж</p>
            </div>
          </div>

          {/* Sheet tabs */}
          <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
            {allSheets.map((s, i) => (
              <button
                key={i}
                onClick={() => setActiveSheet(i)}
                className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                  activeSheet === i
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {s.building} ({s.rows.length})
              </button>
            ))}
          </div>

          {/* Сонгосон байрны мэдээлэл */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4">
            <span className="text-blue-700 text-sm font-semibold">🏢 {currentSheet.building}</span>
            <span className="text-blue-600 text-xs ml-2">
              · {currentSheet.rows.length} тоот
              · Нийт өр: {currentSheet.rows.reduce((s, r) => s + r.totalDebt, 0).toLocaleString()}₮
            </span>
          </div>

          {/* Table */}
          <div className="bg-white border rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-gray-500 text-xs">
                  <th className="px-3 py-2">Тоот</th>
                  <th className="px-3 py-2">Төлөгдөөгүй сарууд</th>
                  <th className="px-3 py-2 text-right">СӨХ хураамж</th>
                  <th className="px-3 py-2 text-right">Хог</th>
                  <th className="px-3 py-2 text-right">Бусад</th>
                  <th className="px-3 py-2 text-right font-semibold">Нийт</th>
                </tr>
              </thead>
              <tbody>
                {currentSheet.rows.map((r, i) => (
                  <tr key={i} className="border-t hover:bg-gray-50">
                    <td className="px-3 py-2 font-semibold">{r.apartment}</td>
                    <td className="px-3 py-2 text-gray-500 text-xs max-w-[200px] truncate" title={r.unpaidMonths}>
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
                    <td className={`px-3 py-2 text-right font-bold ${r.totalDebt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {r.totalDebt > 0 ? `${r.totalDebt.toLocaleString()}₮` : '0₮'}
                    </td>
                  </tr>
                ))}
                {/* Sheet нийт дүн */}
                <tr className="border-t-2 bg-gray-50 font-semibold">
                  <td className="px-3 py-2">Дүн</td>
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
                    {currentSheet.rows.reduce((s, r) => s + r.totalDebt, 0).toLocaleString()}₮
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={reset}
              className="flex-1 py-3 border rounded-xl text-sm font-medium hover:bg-gray-50 transition">
              Цуцлах
            </button>
            <button onClick={doImport}
              className="flex-1 py-3 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition">
              ✓ Импортлох ({allSheets.length} байр · {totalRows} тоот)
            </button>
          </div>
        </div>
      )}

      {/* Importing */}
      {step === 'importing' && (
        <div className="text-center py-16">
          <div className="text-5xl mb-4 animate-bounce">⏳</div>
          <h2 className="text-lg font-semibold mb-2">Импортлож байна...</h2>
          <p className="text-sm text-gray-500">{totalRows} тоотын мэдээллийг нэмж байна</p>
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
            <button onClick={reset}
              className="flex-1 py-3 border rounded-xl text-sm font-medium hover:bg-gray-50">
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
