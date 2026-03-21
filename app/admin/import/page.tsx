'use client';

import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/app/lib/supabase';

interface ParsedRow {
  name: string;
  apartment: string;
  phone: string;
  debt: number;
  payments: number;
}

interface ColumnMapping {
  name: number | null;
  apartment: number | null;
  phone: number | null;
  debt: number | null;
  payments: number | null;
}

export default function ImportPage() {
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'importing' | 'done'>('upload');
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawData, setRawData] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({ name: null, apartment: null, phone: null, debt: null, payments: null });
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importResult, setImportResult] = useState({ success: 0, failed: 0 });
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Файл уншиж задлах
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setFileName(file.name);

    try {
      if (file.name.endsWith('.pdf')) {
        await parsePDF(file);
      } else if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
        await parseCSV(file);
      } else {
        await parseExcel(file);
      }
    } catch (err) {
      setError('Файл уншихад алдаа гарлаа. Формат шалгана уу.');
      console.error(err);
    }
  };

  // Excel задлах (.xlsx, .xls)
  const parseExcel = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' });

    if (data.length < 2) {
      setError('Файлд хангалттай өгөгдөл байхгүй');
      return;
    }

    const headerRow = data[0].map(h => String(h).trim());
    const rows = data.slice(1).filter(row => row.some(cell => String(cell).trim()));

    setHeaders(headerRow);
    setRawData(rows.map(row => row.map(cell => String(cell))));
    autoMapColumns(headerRow);
    setStep('mapping');
  };

  // CSV задлах
  const parseCSV = async (file: File) => {
    const text = await file.text();
    const lines = text.split('\n').filter(l => l.trim());
    const rows = lines.map(line => {
      // Handle quoted CSV
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (const char of line) {
        if (char === '"') { inQuotes = !inQuotes; }
        else if ((char === ',' || char === '\t') && !inQuotes) { result.push(current.trim()); current = ''; }
        else { current += char; }
      }
      result.push(current.trim());
      return result;
    });

    if (rows.length < 2) {
      setError('Файлд хангалттай өгөгдөл байхгүй');
      return;
    }

    setHeaders(rows[0]);
    setRawData(rows.slice(1));
    autoMapColumns(rows[0]);
    setStep('mapping');
  };

  // PDF задлах (хүснэгт хэлбэрийн текст)
  const parsePDF = async (file: File) => {
    const buffer = await file.arrayBuffer();
    // PDF-ийн текстийг pdjs ашиглан задлах
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const lines = content.items.map((item: any) => item.str).join(' ');
      fullText += lines + '\n';
    }

    // Мөр мөрөөр задлах - табуляц эсвэл олон зайгаар тусгаарлагдсан
    const lines = fullText.split('\n').filter(l => l.trim());
    const rows = lines.map(line => line.split(/\t|\s{2,}/).map(s => s.trim()).filter(Boolean));
    const validRows = rows.filter(r => r.length >= 2);

    if (validRows.length < 2) {
      setError('PDF-ээс хүснэгт олдсонгүй. Excel файл ашиглана уу.');
      return;
    }

    setHeaders(validRows[0]);
    setRawData(validRows.slice(1));
    autoMapColumns(validRows[0]);
    setStep('mapping');
  };

  // Баганыг автоматаар таних
  const autoMapColumns = (hdrs: string[]) => {
    const m: ColumnMapping = { name: null, apartment: null, phone: null, debt: null, payments: null };

    hdrs.forEach((h, i) => {
      const lower = h.toLowerCase();
      if (lower.includes('нэр') || lower.includes('name') || lower.includes('овог')) m.name = i;
      else if (lower.includes('байр') || lower.includes('тоот') || lower.includes('apartment') || lower.includes('хаяг') || lower.includes('орц') || lower.includes('room')) m.apartment = i;
      else if (lower.includes('утас') || lower.includes('phone') || lower.includes('дугаар')) m.phone = i;
      else if (lower.includes('өр') || lower.includes('debt') || lower.includes('үлдэгдэл') || lower.includes('balance') || lower.includes('төлөх')) m.debt = i;
      else if (lower.includes('төлсөн') || lower.includes('paid') || lower.includes('payment') || lower.includes('төлбөр')) m.payments = i;
    });

    setMapping(m);
  };

  // Preview үүсгэх
  const generatePreview = () => {
    if (mapping.name === null) {
      setError('Нэрийн багана заавал сонгоно уу');
      return;
    }

    const rows: ParsedRow[] = rawData.map(row => ({
      name: mapping.name !== null ? row[mapping.name] || '' : '',
      apartment: mapping.apartment !== null ? row[mapping.apartment] || '' : '',
      phone: mapping.phone !== null ? row[mapping.phone] || '' : '',
      debt: mapping.debt !== null ? parseNumber(row[mapping.debt]) : 0,
      payments: mapping.payments !== null ? parseNumber(row[mapping.payments]) : 0,
    })).filter(r => r.name.trim());

    setParsedRows(rows);
    setError('');
    setStep('preview');
  };

  // Тоо задлах (1,200,000 эсвэл 1200000 гэх мэт)
  const parseNumber = (val: string): number => {
    if (!val) return 0;
    const cleaned = String(val).replace(/[,\s₮%]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  };

  // Supabase руу импортлох
  const doImport = async () => {
    setStep('importing');
    let success = 0;
    let failed = 0;

    for (const row of parsedRows) {
      const { error } = await supabase.from('residents').insert([{
        name: row.name,
        apartment: row.apartment,
        phone: row.phone || null,
        debt: row.debt,
      }]);

      if (error) {
        failed++;
        console.error('Import error:', error.message, row);
      } else {
        success++;

        // Төлсөн мэдээлэл байвал payments хүснэгтэд нэмэх
        if (row.payments > 0) {
          await supabase.from('payments').insert([{
            amount: row.payments,
            description: 'Импортоор оруулсан',
          }]);
        }
      }
    }

    setImportResult({ success, failed });
    setStep('done');
  };

  const reset = () => {
    setStep('upload');
    setFileName('');
    setHeaders([]);
    setRawData([]);
    setParsedRows([]);
    setError('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const fieldLabels: Record<string, string> = {
    name: 'Нэр',
    apartment: 'Байр/Тоот',
    phone: 'Утас',
    debt: 'Өр',
    payments: 'Төлсөн',
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">📤 Файл импорт</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm mb-4">
          {error}
        </div>
      )}

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div>
          <div className="bg-white border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center hover:border-blue-400 transition">
            <div className="text-5xl mb-4">📁</div>
            <h2 className="text-lg font-semibold mb-2">Файл оруулах</h2>
            <p className="text-sm text-gray-500 mb-6">
              Excel (.xlsx, .xls), CSV (.csv), PDF (.pdf) файл дэмжинэ
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
            <h3 className="font-semibold text-sm mb-2">Файлын формат</h3>
            <p className="text-xs text-gray-500 mb-3">
              Файлд дараах баганууд байж болно (баганы нэр чөлөөтэй):
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white rounded-lg p-2 border">
                <span className="font-semibold">Нэр</span> — Оршин суугчийн нэр
              </div>
              <div className="bg-white rounded-lg p-2 border">
                <span className="font-semibold">Байр/Тоот</span> — Хаяг мэдээлэл
              </div>
              <div className="bg-white rounded-lg p-2 border">
                <span className="font-semibold">Утас</span> — Утасны дугаар
              </div>
              <div className="bg-white rounded-lg p-2 border">
                <span className="font-semibold">Өр</span> — Өрийн үлдэгдэл
              </div>
              <div className="bg-white rounded-lg p-2 border col-span-2">
                <span className="font-semibold">Төлсөн</span> — Одоог хүртэл төлсөн дүн
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Column Mapping */}
      {step === 'mapping' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Багана тохируулах</h2>
              <p className="text-sm text-gray-500">📄 {fileName} · {rawData.length} мөр</p>
            </div>
            <button onClick={reset} className="text-sm text-gray-500 hover:underline">Дахин сонгох</button>
          </div>

          {/* Файлын эхний мөрүүд */}
          <div className="bg-white border rounded-xl overflow-x-auto mb-6">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  {headers.map((h, i) => (
                    <th key={i} className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">
                      #{i + 1}: {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rawData.slice(0, 3).map((row, ri) => (
                  <tr key={ri} className="border-t">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-3 py-2 whitespace-nowrap text-gray-600">
                        {cell || <span className="text-gray-300">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mapping */}
          <div className="space-y-3">
            {(Object.keys(mapping) as Array<keyof ColumnMapping>).map((field) => (
              <div key={field} className="flex items-center gap-3 bg-white border rounded-xl p-3">
                <span className="text-sm font-medium w-24">{fieldLabels[field]} {field === 'name' && '*'}</span>
                <select
                  value={mapping[field] ?? ''}
                  onChange={(e) => setMapping({ ...mapping, [field]: e.target.value === '' ? null : Number(e.target.value) })}
                  className="flex-1 border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">— Сонгоогүй —</option>
                  {headers.map((h, i) => (
                    <option key={i} value={i}>#{i + 1}: {h}</option>
                  ))}
                </select>
                {mapping[field] !== null && (
                  <span className="text-green-500 text-sm">✓</span>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={generatePreview}
            className="w-full mt-6 bg-blue-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-blue-700 transition"
          >
            Урьдчилж харах →
          </button>
        </div>
      )}

      {/* Step 3: Preview */}
      {step === 'preview' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Урьдчилсан харагдац</h2>
              <p className="text-sm text-gray-500">{parsedRows.length} оршин суугч импортлогдоно</p>
            </div>
            <button onClick={() => setStep('mapping')} className="text-sm text-blue-600 hover:underline">← Буцах</button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-blue-700">{parsedRows.length}</p>
              <p className="text-xs text-blue-500">Нийт хүн</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-red-600">
                {parsedRows.reduce((s, r) => s + r.debt, 0).toLocaleString()}₮
              </p>
              <p className="text-xs text-red-500">Нийт өр</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-green-600">
                {parsedRows.reduce((s, r) => s + r.payments, 0).toLocaleString()}₮
              </p>
              <p className="text-xs text-green-500">Нийт төлсөн</p>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white border rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-gray-500 text-xs">
                  <th className="px-3 py-2">№</th>
                  <th className="px-3 py-2">Нэр</th>
                  <th className="px-3 py-2">Байр/Тоот</th>
                  <th className="px-3 py-2">Утас</th>
                  <th className="px-3 py-2 text-right">Өр</th>
                  <th className="px-3 py-2 text-right">Төлсөн</th>
                </tr>
              </thead>
              <tbody>
                {parsedRows.slice(0, 50).map((r, i) => (
                  <tr key={i} className="border-t hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-3 py-2 font-medium">{r.name}</td>
                    <td className="px-3 py-2">{r.apartment || '—'}</td>
                    <td className="px-3 py-2 text-gray-500">{r.phone || '—'}</td>
                    <td className={`px-3 py-2 text-right ${r.debt > 0 ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                      {r.debt > 0 ? `${r.debt.toLocaleString()}₮` : '0₮'}
                    </td>
                    <td className={`px-3 py-2 text-right ${r.payments > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                      {r.payments > 0 ? `${r.payments.toLocaleString()}₮` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {parsedRows.length > 50 && (
              <p className="text-center text-xs text-gray-400 py-2">...болон {parsedRows.length - 50} бусад</p>
            )}
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={reset}
              className="flex-1 py-3 border rounded-xl text-sm font-medium hover:bg-gray-50 transition">
              Цуцлах
            </button>
            <button onClick={doImport}
              className="flex-1 py-3 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition">
              ✓ Импортлох ({parsedRows.length} хүн)
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Importing */}
      {step === 'importing' && (
        <div className="text-center py-16">
          <div className="text-5xl mb-4 animate-bounce">⏳</div>
          <h2 className="text-lg font-semibold mb-2">Импортлож байна...</h2>
          <p className="text-sm text-gray-500">{parsedRows.length} оршин суугчийг нэмж байна</p>
        </div>
      )}

      {/* Step 5: Done */}
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
