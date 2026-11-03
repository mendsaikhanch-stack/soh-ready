'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/app/lib/supabase';
import { compressImage } from '@/app/lib/compress-image';
import BoardReportFiles, { fmtSize, type ReportFile } from '@/app/components/BoardReportFiles';

interface Report {
  id: number;
  title: string;
  body: string | null;
  created_at: string;
  read_count: number;
  files: ReportFile[];
}

const BUCKET = 'board-reports';
const ACCEPT = 'image/*,.pdf,.xlsx,.xls,.docx,.doc';

// Зургийг шахаж .jpg болгоно; бусад файлыг тэр чигээр нь
async function prepare(file: File): Promise<{ blob: Blob; name: string; type: string }> {
  if (/^image\/(jpeg|png|webp)$/.test(file.type)) {
    const blob = await compressImage(file);
    if (blob !== file) {
      return { blob, name: file.name.replace(/\.[^.]+$/, '') + '.jpg', type: 'image/jpeg' };
    }
  }
  return { blob: file, name: file.name, type: file.type || 'application/octet-stream' };
}

export default function AdminBoardReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [memberCount, setMemberCount] = useState<number | null>(null);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [res, mRes] = await Promise.all([
        fetch('/api/admin/board-reports'),
        fetch('/api/admin/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ table: 'board_members', action: 'select', params: { select: 'id', count: true } }),
        }),
      ]);
      const data = await res.json();
      if (res.ok) { setReports(data.reports || []); setLoadError(''); }
      else setLoadError(data.error || 'Ачаалж чадсангүй');
      const m = await mRes.json().catch(() => ({}));
      setMemberCount(mRes.ok ? (m.count ?? null) : null);
    } catch {
      setLoadError('Сервертэй холбогдож чадсангүй');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const run = async () => { await load(); };
    run();
  }, [load]);

  const submit = async () => {
    setError('');
    if (title.trim().length < 3) return setError('Гарчиг оруулна уу');
    setBusy(true);
    try {
      // 1. Файл бэлтгэх (зураг шахах)
      setProgress(files.length ? 'Зураг бэлтгэж байна...' : '');
      const prepared = await Promise.all(files.map(prepare));

      // 2. Upload URL авах → шууд хувийн bucket руу хуулах
      let uploaded: { path: string; file_name: string; size_bytes: number }[] = [];
      if (prepared.length > 0) {
        const signRes = await fetch('/api/admin/board-reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'sign_upload', files: prepared.map((p) => ({ name: p.name, size: p.blob.size })) }),
        });
        const sign = await signRes.json();
        if (!signRes.ok) throw new Error(sign.error || 'Upload бэлтгэхэд алдаа');

        uploaded = [];
        for (let i = 0; i < prepared.length; i++) {
          setProgress(`Файл хуулж байна ${i + 1}/${prepared.length}...`);
          const { path, token } = sign.uploads[i];
          const { error: upErr } = await supabase.storage
            .from(BUCKET)
            .uploadToSignedUrl(path, token, prepared[i].blob, { contentType: prepared[i].type });
          if (upErr) throw new Error(`«${prepared[i].name}» хуулахад алдаа: ${upErr.message}`);
          uploaded.push({ path, file_name: prepared[i].name, size_bytes: prepared[i].blob.size });
        }
      }

      // 3. Тайлан бүртгэх
      setProgress('Хадгалж байна...');
      const res = await fetch('/api/admin/board-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', title, body, files: uploaded }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Хадгалахад алдаа');

      setTitle(''); setBody(''); setFiles([]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Алдаа гарлаа');
    }
    setProgress('');
    setBusy(false);
  };

  const remove = async (r: Report) => {
    if (!window.confirm(`«${r.title}» тайланг устгах уу? Хавсралтууд мөн устна.`)) return;
    await fetch(`/api/admin/board-reports?id=${r.id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="p-6 max-w-3xl">
      <Link href="/admin/board" className="text-sm text-blue-600">← Цахим ТУЗ</Link>
      <h1 className="text-2xl font-bold mt-2">📑 Зөвлөлийн тайлан</h1>
      <p className="text-sm text-gray-500 mb-6">
        Санхүүгийн баримт, зураг бүхий тайланг <b>зөвхөн ТУЗ болон Хяналтын зөвлөлийн гишүүд</b> апп дээрээ харна.
        Гишүүнийг оршин суугчийн бүртгэлийн утасны дугаараар нь таньдаг.
      </p>

      {memberCount === 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm p-3 rounded-xl mb-4">
          Зөвлөлийн гишүүн бүртгэгдээгүй байна. Эхлээд <Link href="/admin/board" className="underline">Цахим ТУЗ</Link> хуудаснаас гишүүдээ нэмнэ үү.
        </div>
      )}

      <div className="bg-white rounded-2xl border p-5 space-y-3 mb-6">
        <input
          className={inputCls}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Гарчиг * (жишээ: 10-р сарын санхүүгийн тайлан)"
        />
        <textarea
          className={inputCls}
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Тайлбар (орлого, зарлага, хийсэн ажил...)"
        />
        <div>
          <label className="inline-flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-xl text-sm text-gray-600 cursor-pointer hover:bg-gray-50">
            📎 Баримт / зураг нэмэх
            <input
              type="file"
              multiple
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                const picked = Array.from(e.target.files || []);
                setFiles((prev) => [...prev, ...picked].slice(0, 15));
                e.target.value = '';
              }}
            />
          </label>
          <span className="text-xs text-gray-400 ml-2">Зураг, PDF, Excel, Word · 15 хүртэл файл · тус бүр 20MB</span>
          {files.length > 0 && (
            <ul className="mt-2 space-y-1">
              {files.map((f, i) => (
                <li key={i} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-1.5">
                  <span className="truncate">{f.name} <span className="text-xs text-gray-400">{fmtSize(f.size)}</span></span>
                  <button onClick={() => setFiles((p) => p.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-500 px-2">✕</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-xl">{error}</div>}

        <button
          onClick={submit}
          disabled={busy}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? progress || 'Илгээж байна...' : 'Зөвлөлд илгээх'}
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400">Ачаалж байна...</p>
      ) : loadError ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm p-3 rounded-xl">
          {loadError} — <code>supabase-board-members-migration.sql</code>-ийг ажиллуулсан эсэхийг шалгана уу.
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-white rounded-2xl border p-10 text-center text-gray-400">Илгээсэн тайлан алга.</div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <div key={r.id} className="bg-white rounded-xl border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-900">{r.title}</h3>
                  <p className="text-xs text-gray-400">
                    {new Date(r.created_at).toLocaleString('mn-MN')} · {r.read_count} гишүүн уншсан
                  </p>
                </div>
                <button onClick={() => remove(r)} className="text-xs text-gray-400 hover:text-red-500 shrink-0">Устгах</button>
              </div>
              {r.body && <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{r.body}</p>}
              {r.files.length > 0 && <BoardReportFiles files={r.files} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
