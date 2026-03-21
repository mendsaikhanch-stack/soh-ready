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
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [fileName, setFileName] = useState('');
  const [rawData, setRawData] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({ name: null, apartment: null, phone: null, debt: null, payments: null });
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importResult, setImportResult] = useState({ success: 0, failed: 0 });
  const [error, setError] = useState('');
  const [detectedFormat, setDetectedFormat] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Тоо эсэхийг шалгах
  const looksLikeNumber = (val: string): boolean => {
    if (!val) return false;
    const cleaned = String(val).replace(/[,\s₮%.]/g, '').replace(/[-]/g, '');
    return /^\d+(\.\d+)?$/.test(cleaned) && parseFloat(cleaned) > 0;
  };

  // Утасны дугаар эсэхийг шалгах
  const looksLikePhone = (val: string): boolean => {
    if (!val) return false;
    const cleaned = String(val).replace(/[\s\-()+ ]/g, '');
    return /^\d{7,11}$/.test(cleaned);
  };

  // Байр/тоот эсэхийг шалгах
  const looksLikeApartment = (val: string): boolean => {
    if (!val) return false;
    const s = String(val).trim();
    // "101", "12-34", "А-101", "1а", "3/45" гэх мэт
    return /^[\dА-Яа-яA-Za-z\-\/\.]{1,10}$/.test(s) && /\d/.test(s) && s.length <= 10;
  };

  // Нэр эсэхийг шалгах
  const looksLikeName = (val: string): boolean => {
    if (!val) return false;
    const s = String(val).trim();
    // Кирилл үсэг, зай, цэг байх, тоо бараг байхгүй
    if (s.length < 2 || s.length > 60) return false;
    const hasLetters = /[А-Яа-яӨөҮүЁё]/.test(s) || /[A-Za-z]/.test(s);
    const digitRatio = (s.match(/\d/g) || []).length / s.length;
    return hasLetters && digitRatio < 0.2;
  };

  // Баганыг header + data pattern-аар автомат таних
  const smartAutoMap = (hdrs: string[], rows: string[][]): ColumnMapping => {
    const m: ColumnMapping = { name: null, apartment: null, phone: null, debt: null, payments: null };
    const sampleRows = rows.slice(0, Math.min(20, rows.length));
    const colCount = hdrs.length;

    // Header-ээр таних (keyword matching)
    const headerKeywords: Record<keyof ColumnMapping, string[]> = {
      name: ['нэр', 'name', 'овог', 'оршин суугч', 'эзэн', 'өрхийн тэргүүн', 'иргэн', 'ажилтан'],
      apartment: ['байр', 'тоот', 'apartment', 'хаяг', 'орц', 'room', 'давхар', 'өрөө', 'гэр', 'хаалга'],
      phone: ['утас', 'phone', 'дугаар', 'холбоо', 'tel', 'mobile'],
      debt: ['өр', 'debt', 'үлдэгдэл', 'balance', 'төлөх', 'авлага', 'нийт өр', 'өглөг'],
      payments: ['төлсөн', 'paid', 'payment', 'төлбөр', 'орлого', 'төлөлт'],
    };

    // 1-р шат: Header keyword-аар таних
    hdrs.forEach((h, i) => {
      const lower = h.toLowerCase();
      for (const [field, keywords] of Object.entries(headerKeywords)) {
        if (m[field as keyof ColumnMapping] === null && keywords.some(kw => lower.includes(kw))) {
          m[field as keyof ColumnMapping] = i;
          break;
        }
      }
    });

    // 2-р шат: Тодорхойлогдоогүй баганыг data pattern-аар таних
    if (sampleRows.length > 0) {
      for (let col = 0; col < colCount; col++) {
        // Аль хэдийн хуваарилагдсан баганыг алгасах
        if (Object.values(m).includes(col)) continue;

        const colValues = sampleRows.map(r => String(r[col] || '').trim()).filter(Boolean);
        if (colValues.length === 0) continue;

        const nameScore = colValues.filter(v => looksLikeName(v)).length / colValues.length;
        const phoneScore = colValues.filter(v => looksLikePhone(v)).length / colValues.length;
        const aptScore = colValues.filter(v => looksLikeApartment(v)).length / colValues.length;
        const numScore = colValues.filter(v => looksLikeNumber(v)).length / colValues.length;

        // Утас (70%+ утас шиг)
        if (m.phone === null && phoneScore > 0.5) {
          m.phone = col;
        }
        // Нэр (60%+ нэр шиг)
        else if (m.name === null && nameScore > 0.5 && numScore < 0.3) {
          m.name = col;
        }
        // Байр/Тоот
        else if (m.apartment === null && aptScore > 0.4 && nameScore < 0.5) {
          m.apartment = col;
        }
      }

      // Тоон баганууд (өр, төлсөн) - хамгийн том дүнтэй нь өр, бага нь төлсөн
      const numericCols: { col: number; avg: number }[] = [];
      for (let col = 0; col < colCount; col++) {
        if (Object.values(m).includes(col)) continue;
        const colValues = sampleRows.map(r => String(r[col] || '').trim()).filter(Boolean);
        const numScore = colValues.filter(v => looksLikeNumber(v)).length / Math.max(colValues.length, 1);
        if (numScore > 0.4) {
          const avg = colValues.reduce((s, v) => {
            const cleaned = String(v).replace(/[,\s₮%]/g, '');
            return s + (parseFloat(cleaned) || 0);
          }, 0) / Math.max(colValues.length, 1);
          numericCols.push({ col, avg });
        }
      }

      numericCols.sort((a, b) => b.avg - a.avg);
      if (numericCols.length >= 2) {
        if (m.debt === null) m.debt = numericCols[0].col;
        if (m.payments === null) m.payments = numericCols[1].col;
      } else if (numericCols.length === 1) {
        if (m.debt === null) m.debt = numericCols[0].col;
      }
    }

    // №, #, Д/д зэрэг дугаарлалт баганыг хасах
    hdrs.forEach((h, i) => {
      const lower = h.toLowerCase().trim();
      if (['№', '#', 'д/д', 'no', 'index', 'row'].includes(lower) || lower === '№') {
        for (const [field, val] of Object.entries(m)) {
          if (val === i) {
            (m as any)[field] = null;
          }
        }
      }
    });

    return m;
  };

  // Файл уншиж задлах → шууд preview рүү
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setFileName(file.name);

    try {
      let hdrs: string[] = [];
      let rows: string[][] = [];

      if (file.name.endsWith('.pdf')) {
        ({ hdrs, rows } = await parsePDF(file));
      } else if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
        ({ hdrs, rows } = await parseCSV(file));
      } else {
        ({ hdrs, rows } = await parseExcel(file));
      }

      if (rows.length === 0) {
        setError('Файлд өгөгдөл байхгүй');
        return;
      }

      // Автомат таних
      const autoMapping = smartAutoMap(hdrs, rows);
      setMapping(autoMapping);
      setRawData(rows);

      // Шууд preview үүсгэх
      const mapped = applyMapping(autoMapping, rows);
      if (mapped.length === 0) {
        setError('Нэрийн багана тодорхойлогдсонгүй. Файлын формат шалгана уу.');
        return;
      }

      setParsedRows(mapped);

      // Ямар формат илрүүлснийг тэмдэглэх
      const detected: string[] = [];
      if (autoMapping.name !== null) detected.push(`Нэр: "${hdrs[autoMapping.name] || `Багана ${autoMapping.name + 1}`}"`);
      if (autoMapping.apartment !== null) detected.push(`Байр: "${hdrs[autoMapping.apartment] || `Багана ${autoMapping.apartment + 1}`}"`);
      if (autoMapping.phone !== null) detected.push(`Утас: "${hdrs[autoMapping.phone] || `Багана ${autoMapping.phone + 1}`}"`);
      if (autoMapping.debt !== null) detected.push(`Өр: "${hdrs[autoMapping.debt] || `Багана ${autoMapping.debt + 1}`}"`);
      if (autoMapping.payments !== null) detected.push(`Төлсөн: "${hdrs[autoMapping.payments] || `Багана ${autoMapping.payments + 1}`}"`);
      setDetectedFormat(detected.join(' · '));

      setStep('preview');
    } catch (err) {
      setError('Файл уншихад алдаа гарлаа. Формат шалгана уу.');
      console.error(err);
    }
  };

  // Mapping ашиглаж мөрүүдийг бэлдэх
  const applyMapping = (m: ColumnMapping, rows: string[][]): ParsedRow[] => {
    if (m.name === null) return [];
    return rows.map(row => ({
      name: m.name !== null ? String(row[m.name] || '').trim() : '',
      apartment: m.apartment !== null ? String(row[m.apartment] || '').trim() : '',
      phone: m.phone !== null ? String(row[m.phone] || '').trim() : '',
      debt: m.debt !== null ? parseNum(row[m.debt]) : 0,
      payments: m.payments !== null ? parseNum(row[m.payments]) : 0,
    })).filter(r => r.name.trim() && r.name.length > 1);
  };

  // Excel задлах
  const parseExcel = async (file: File): Promise<{ hdrs: string[]; rows: string[][] }> => {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' });

    if (data.length < 2) throw new Error('Хангалттай өгөгдөл байхгүй');

    // Header мөрийг олох — эхний хоосон биш мөр
    let headerIdx = 0;
    for (let i = 0; i < Math.min(5, data.length); i++) {
      const row = data[i];
      const nonEmpty = row.filter(c => String(c).trim()).length;
      if (nonEmpty >= 2) {
        headerIdx = i;
        break;
      }
    }

    const hdrs = data[headerIdx].map(h => String(h).trim());
    const rows = data.slice(headerIdx + 1)
      .filter(row => row.some(cell => String(cell).trim()))
      .map(row => row.map(cell => String(cell)));

    return { hdrs, rows };
  };

  // CSV задлах
  const parseCSV = async (file: File): Promise<{ hdrs: string[]; rows: string[][] }> => {
    const text = await file.text();
    const lines = text.split('\n').filter(l => l.trim());
    const allRows = lines.map(line => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (const char of line) {
        if (char === '"') { inQuotes = !inQuotes; }
        else if ((char === ',' || char === '\t' || char === ';') && !inQuotes) { result.push(current.trim()); current = ''; }
        else { current += char; }
      }
      result.push(current.trim());
      return result;
    });

    if (allRows.length < 2) throw new Error('Хангалттай өгөгдөл байхгүй');
    return { hdrs: allRows[0], rows: allRows.slice(1) };
  };

  // PDF задлах
  const parsePDF = async (file: File): Promise<{ hdrs: string[]; rows: string[][] }> => {
    const buffer = await file.arrayBuffer();
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

    const lines = fullText.split('\n').filter(l => l.trim());
    const allRows = lines.map(line => line.split(/\t|\s{2,}/).map(s => s.trim()).filter(Boolean));
    const validRows = allRows.filter(r => r.length >= 2);

    if (validRows.length < 2) throw new Error('PDF-ээс хүснэгт олдсонгүй');
    return { hdrs: validRows[0], rows: validRows.slice(1) };
  };

  // Тоо задлах
  const parseNum = (val: string): number => {
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
    setRawData([]);
    setParsedRows([]);
    setError('');
    setDetectedFormat('');
    if (fileRef.current) fileRef.current.value = '';
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
            <p className="text-sm text-gray-500 mb-2">
              Excel, CSV, PDF файл дэмжинэ
            </p>
            <p className="text-xs text-gray-400 mb-6">
              Баганыг автоматаар таниж, шууд харуулна
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
                <span>Нэр, утас, байр/тоот, өр, төлсөн зэрэг баганыг <strong>автоматаар таньна</strong></span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>Header нэр өөр байсан ч <strong>мэдээллийн төрлөөр</strong> нь илрүүлнэ</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>СӨХ болгоны <strong>өөр өөр загвар</strong> дэмжинэ</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Preview (auto-detected) */}
      {step === 'preview' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">📄 {fileName}</h2>
              <p className="text-sm text-gray-500">{parsedRows.length} оршин суугч илэрлээ</p>
            </div>
            <button onClick={reset} className="text-sm text-gray-500 hover:underline">Өөр файл</button>
          </div>

          {/* Илрүүлсэн формат */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-blue-600 text-sm font-semibold">🔍 Автомат илрүүлсэн</span>
            </div>
            <p className="text-xs text-blue-700">{detectedFormat}</p>
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

      {/* Importing */}
      {step === 'importing' && (
        <div className="text-center py-16">
          <div className="text-5xl mb-4 animate-bounce">⏳</div>
          <h2 className="text-lg font-semibold mb-2">Импортлож байна...</h2>
          <p className="text-sm text-gray-500">{parsedRows.length} оршин суугчийг нэмж байна</p>
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
