'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface UploadSummary {
  total: number;
  newCount: number;
  matchedCount: number;
  duplicateCount: number;
  errorCount: number;
}

export default function DirectoryImportPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [jobId, setJobId] = useState<number | null>(null);
  const [summary, setSummary] = useState<UploadSummary | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setSummary(null);
    setJobId(null);
    setUploading(true);

    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/admin/directory/import', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Хуулахад алдаа гарлаа');
      } else {
        setJobId(data.jobId);
        setSummary(data.summary);
      }
    } catch {
      setError('Сервертэй холбогдож чадсангүй');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/admin/directory" className="text-sm text-blue-600 hover:underline">← Буцах</Link>
          <h1 className="text-2xl font-bold mt-1">⬆ Master СӨХ файл импорт</h1>
          <p className="text-sm text-gray-500">Excel/CSV файлаас СӨХ-ийн жагсаалт оруулах</p>
        </div>
        <a
          href="/templates/soh-directory-template.csv"
          download
          className="px-4 py-2 border rounded-xl text-sm hover:bg-gray-50"
        >
          📄 Загвар татах
        </a>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm mb-3">{error}</div>}

      {!summary && (
        <div className="bg-white border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center hover:border-blue-400 transition">
          <div className="text-5xl mb-4">📁</div>
          <h2 className="text-lg font-semibold mb-2">Файл оруулах</h2>
          <p className="text-sm text-gray-500 mb-6">.xlsx / .xls / .csv (5MB-аас бага)</p>
          <label className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold cursor-pointer hover:bg-blue-700 transition">
            {uploading ? 'Шалгаж байна...' : 'Файл сонгох'}
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv,.txt"
              className="hidden"
              onChange={handleFile}
              disabled={uploading}
            />
          </label>
        </div>
      )}

      {summary && jobId && (
        <div className="bg-white border rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4">Файл шалгагдлаа</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <Stat label="Нийт" value={summary.total} cls="bg-gray-50 text-gray-700" />
            <Stat label="Шинэ" value={summary.newCount} cls="bg-blue-50 text-blue-700" />
            <Stat label="Таарсан" value={summary.matchedCount} cls="bg-green-50 text-green-700" />
            <Stat label="Давхардаж магадгүй" value={summary.duplicateCount} cls="bg-yellow-50 text-yellow-700" />
            <Stat label="Алдаатай" value={summary.errorCount} cls="bg-red-50 text-red-700" />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => { setSummary(null); setJobId(null); }}
              className="flex-1 py-3 border rounded-xl text-sm font-medium hover:bg-gray-50"
            >
              Өөр файл
            </button>
            <button
              onClick={() => router.push(`/admin/directory/review/${jobId}`)}
              className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700"
            >
              Шалгалтын хуудас руу →
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 bg-gray-50 border rounded-xl p-4">
        <h3 className="font-semibold text-sm mb-3">Дэмжих баганы нэрс</h3>
        <p className="text-xs text-gray-500 mb-2">Header row дотор дараах нэрс орвол автоматаар таних:</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-1 text-xs text-gray-600">
          <code>official_name / нэр</code>
          <code>display_name</code>
          <code>district / дүүрэг</code>
          <code>khoroo / хороо</code>
          <code>address / хаяг</code>
          <code>phone / утас</code>
          <code>soh_code</code>
          <code>building_count</code>
          <code>unit_count</code>
          <code>alias_1 .. alias_5</code>
          <code>status (active/pending/hidden)</code>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className={`rounded-xl p-3 text-center ${cls}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs">{label}</p>
    </div>
  );
}
