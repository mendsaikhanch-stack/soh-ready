'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface PreviewRow {
  id: number;
  row_number: number;
  status: 'PENDING' | 'MATCHED' | 'NEW_RECORD' | 'DUPLICATE' | 'ERROR' | 'SKIPPED';
  match_score: number | null;
  suggested_directory_id: number | null;
  error_message: string | null;
  mapped_json: {
    officialName: string;
    displayName: string | null;
    district: string | null;
    khoroo: string | null;
    address: string | null;
    aliases: string[];
  } | null;
  raw_json: Record<string, unknown>;
  suggested_directory: {
    id: number;
    official_name: string;
    district: string | null;
    khoroo: string | null;
  } | null;
}

interface ImportJob {
  id: number;
  file_name: string;
  status: string;
  total_rows: number | null;
  imported_rows: number | null;
  duplicate_rows: number | null;
  error_rows: number | null;
  summary_json: Record<string, unknown> | null;
}

type Override = 'apply_new' | 'merge_existing' | 'skip';

export default function ReviewPage() {
  const params = useParams<{ jobId: string }>();
  const router = useRouter();
  const jobId = params.jobId;

  const [job, setJob] = useState<ImportJob | null>(null);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'NEW_RECORD' | 'MATCHED' | 'DUPLICATE' | 'ERROR'>('all');

  const load = async () => {
    setLoading(true);
    setError('');
    const res = await fetch(`/api/admin/directory/jobs/${jobId}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Татаж чадсангүй');
      setLoading(false);
      return;
    }
    setJob(data.job);
    setRows(data.rows || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [jobId]);

  const setOverride = (rowId: number, value: Override | null) => {
    setOverrides((prev) => {
      const next = { ...prev };
      if (value === null) delete next[String(rowId)];
      else next[String(rowId)] = value;
      return next;
    });
  };

  const bulkApply = (status: PreviewRow['status'], action: Override) => {
    const next = { ...overrides };
    rows.filter((r) => r.status === status).forEach((r) => {
      next[String(r.id)] = action;
    });
    setOverrides(next);
  };

  const confirm = async () => {
    if (!confirm_window()) return;
    setConfirming(true);
    setError('');
    const res = await fetch('/api/admin/directory/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: Number(jobId), overrides }),
    });
    const data = await res.json();
    setConfirming(false);
    if (!res.ok) {
      setError(data.error || 'Импорт амжилтгүй');
      return;
    }
    alert(`✅ Шинэ: ${data.imported} · Merge: ${data.merged} · Алгассан: ${data.skipped} · Алдаа: ${data.errors}`);
    router.push('/admin/directory');
  };

  function confirm_window(): boolean {
    if (typeof window === 'undefined') return true;
    return window.confirm('Импорт батлах уу? Энэ үйлдэл бичлэг рүү хадгална.');
  }

  const visibleRows = filter === 'all' ? rows : rows.filter((r) => r.status === filter);

  const counts = {
    all: rows.length,
    NEW_RECORD: rows.filter((r) => r.status === 'NEW_RECORD').length,
    MATCHED: rows.filter((r) => r.status === 'MATCHED').length,
    DUPLICATE: rows.filter((r) => r.status === 'DUPLICATE').length,
    ERROR: rows.filter((r) => r.status === 'ERROR').length,
  };

  return (
    <div className="p-6">
      <div className="mb-4">
        <Link href="/admin/directory" className="text-sm text-blue-600 hover:underline">← СӨХ Directory</Link>
        <h1 className="text-2xl font-bold mt-1">📋 Импорт шалгах</h1>
        {job && <p className="text-sm text-gray-500">{job.file_name} · {job.total_rows} мөр</p>}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm mb-3">{error}</div>}

      <div className="flex flex-wrap gap-2 mb-4">
        <FilterPill active={filter === 'all'} onClick={() => setFilter('all')} label={`Бүгд (${counts.all})`} />
        <FilterPill active={filter === 'NEW_RECORD'} onClick={() => setFilter('NEW_RECORD')} label={`Шинэ (${counts.NEW_RECORD})`} cls="bg-blue-100 text-blue-700" />
        <FilterPill active={filter === 'MATCHED'} onClick={() => setFilter('MATCHED')} label={`Таарсан (${counts.MATCHED})`} cls="bg-green-100 text-green-700" />
        <FilterPill active={filter === 'DUPLICATE'} onClick={() => setFilter('DUPLICATE')} label={`Давхардаж магадгүй (${counts.DUPLICATE})`} cls="bg-yellow-100 text-yellow-700" />
        <FilterPill active={filter === 'ERROR'} onClick={() => setFilter('ERROR')} label={`Алдаатай (${counts.ERROR})`} cls="bg-red-100 text-red-700" />
      </div>

      <div className="flex flex-wrap gap-2 mb-4 text-xs">
        <button onClick={() => bulkApply('NEW_RECORD', 'apply_new')} className="px-3 py-1 border rounded hover:bg-gray-50">
          Шинэ бичлэгүүдийг бүгдийг батлах
        </button>
        <button onClick={() => bulkApply('MATCHED', 'merge_existing')} className="px-3 py-1 border rounded hover:bg-gray-50">
          Таарсан бүгдийг merge
        </button>
        <button onClick={() => bulkApply('DUPLICATE', 'skip')} className="px-3 py-1 border rounded hover:bg-gray-50">
          Давхардлуудыг алгасах
        </button>
        <button onClick={() => bulkApply('ERROR', 'skip')} className="px-3 py-1 border rounded hover:bg-gray-50">
          Алдаатайг алгасах
        </button>
      </div>

      <div className="bg-white border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-gray-500 text-xs">
              <th className="px-3 py-2">№</th>
              <th className="px-3 py-2">Нэр</th>
              <th className="px-3 py-2">Дүүрэг / Хороо</th>
              <th className="px-3 py-2">Төлөв</th>
              <th className="px-3 py-2">Санал болгож буй таарал</th>
              <th className="px-3 py-2">Үйлдэл</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">Ачаалж байна...</td></tr>
            ) : visibleRows.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">Бичлэг байхгүй</td></tr>
            ) : visibleRows.map((r) => {
              const ov = overrides[String(r.id)];
              return (
                <tr key={r.id} className="border-t align-top">
                  <td className="px-3 py-2 text-xs text-gray-400">{r.row_number}</td>
                  <td className="px-3 py-2">
                    <p className="font-medium">{r.mapped_json?.officialName || '—'}</p>
                    {r.mapped_json?.displayName && <p className="text-xs text-gray-400">{r.mapped_json.displayName}</p>}
                    {r.error_message && <p className="text-xs text-red-500 mt-1">⚠ {r.error_message}</p>}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <p>{r.mapped_json?.district || '—'}</p>
                    <p className="text-gray-400">{r.mapped_json?.khoroo || ''}</p>
                  </td>
                  <td className="px-3 py-2"><RowBadge status={r.status} /></td>
                  <td className="px-3 py-2 text-xs">
                    {r.suggested_directory ? (
                      <div>
                        <p className="font-medium">{r.suggested_directory.official_name}</p>
                        <p className="text-gray-400">
                          {r.suggested_directory.district || '—'}
                          {r.suggested_directory.khoroo ? ` / ${r.suggested_directory.khoroo}` : ''}
                        </p>
                        {r.match_score != null && (
                          <p className="text-gray-400 mt-0.5">оноо: {r.match_score.toFixed(2)}</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={ov || ''}
                      onChange={(e) => setOverride(r.id, e.target.value ? (e.target.value as Override) : null)}
                      className="border rounded text-xs px-2 py-1"
                    >
                      <option value="">Анхдагч</option>
                      <option value="apply_new">Шинэ болгож хадгал</option>
                      <option value="merge_existing">Одоо байгаатай нэгтгэх</option>
                      <option value="skip">Алгасах</option>
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex gap-3 mt-6 sticky bottom-4 bg-white p-3 border rounded-xl shadow">
        <button onClick={() => router.push('/admin/directory')} className="flex-1 py-3 border rounded-xl text-sm font-medium hover:bg-gray-50">
          Хаах
        </button>
        <button
          onClick={confirm}
          disabled={confirming || (job?.status === 'COMPLETED')}
          className="flex-1 py-3 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
        >
          {confirming ? 'Импортлож байна...' : '✓ Импорт батлах'}
        </button>
      </div>
    </div>
  );
}

function FilterPill({ active, onClick, label, cls }: { active: boolean; onClick: () => void; label: string; cls?: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium ${active ? 'bg-gray-900 text-white' : (cls || 'bg-gray-100 text-gray-700')}`}
    >
      {label}
    </button>
  );
}

function RowBadge({ status }: { status: PreviewRow['status'] }) {
  const map = {
    NEW_RECORD: { cls: 'bg-blue-100 text-blue-700', label: 'шинэ' },
    MATCHED: { cls: 'bg-green-100 text-green-700', label: 'таарсан' },
    DUPLICATE: { cls: 'bg-yellow-100 text-yellow-700', label: 'давхардал?' },
    ERROR: { cls: 'bg-red-100 text-red-700', label: 'алдаатай' },
    SKIPPED: { cls: 'bg-gray-200 text-gray-500', label: 'алгассан' },
    PENDING: { cls: 'bg-gray-100 text-gray-600', label: 'хүлээгдэж' },
  } as const;
  const m = map[status];
  return <span className={`px-2 py-0.5 rounded-full text-xs ${m.cls}`}>{m.label}</span>;
}
