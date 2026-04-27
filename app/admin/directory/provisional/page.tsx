'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface ProvisionalSuggestion {
  best: {
    directory: {
      id: number;
      official_name: string;
      district: string | null;
      khoroo: string | null;
    };
    score: number;
    reasons: string[];
  } | null;
  action: 'AUTO_MERGE' | 'REVIEW_NEEDED' | 'KEEP_SEPARATE';
}

interface ProvisionalRow {
  id: number;
  entered_name: string;
  city: string | null;
  district: string | null;
  khoroo: string | null;
  town_name: string | null;
  building: string | null;
  status: 'PENDING' | 'HAS_DEMAND' | 'MATCH_CANDIDATE' | 'MERGED' | 'REJECTED';
  matched_directory_id: number | null;
  match_score: number | null;
  created_at: string;
  summary: { interest_count: number; building_count: number; status: string };
  suggestion: ProvisionalSuggestion | null;
}

export default function ProvisionalPage() {
  const [rows, setRows] = useState<ProvisionalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'' | 'PENDING' | 'HAS_DEMAND' | 'MATCH_CANDIDATE'>('');
  const [busy, setBusy] = useState<number | null>(null);
  const [autoBusy, setAutoBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    params.set('suggest', '1');
    if (statusFilter) params.set('status', statusFilter);
    const res = await fetch(`/api/admin/directory/provisional?${params}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Татаж чадсангүй');
      setLoading(false);
      return;
    }
    setRows(data.rows || []);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const merge = async (provisionalId: number, directoryId: number) => {
    if (!window.confirm('Энэ provisional СӨХ-ийг үндсэн жагсаалттай нэгтгэх үү?')) return;
    setBusy(provisionalId);
    try {
      const res = await fetch('/api/admin/directory/provisional/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provisionalId, directoryId, reason: 'admin-manual' }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Merge амжилтгүй');
      } else {
        alert(`✅ Нэгтгэлээ. ${data.merge.movedMemberships} membership, ${data.merge.movedActivationRequests} request шилжсэн.`);
        load();
      }
    } finally {
      setBusy(null);
    }
  };

  const reject = async (provisionalId: number) => {
    if (!window.confirm('Энэ provisional СӨХ-ийг татгалзах уу?')) return;
    setBusy(provisionalId);
    try {
      const res = await fetch('/api/admin/directory/provisional/merge', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provisionalId, status: 'REJECTED' }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Болсонгүй');
      } else {
        load();
      }
    } finally {
      setBusy(null);
    }
  };

  const runAuto = async () => {
    if (!window.confirm('Бүх боломжит provisional-уудыг авто-merge хийх үү?')) return;
    setAutoBusy(true);
    try {
      const res = await fetch('/api/admin/directory/provisional/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auto: true }),
      });
      const data = await res.json();
      if (!res.ok) alert(data.error || 'Алдаа');
      else alert(`Скан: ${data.auto.scanned} · Авто merge: ${data.auto.autoMerged} · Шалгуулах: ${data.auto.flaggedForReview} · Тусгаар: ${data.auto.keptSeparate}`);
      load();
    } finally {
      setAutoBusy(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <Link href="/admin/directory" className="text-sm text-blue-600 hover:underline">← СӨХ Directory</Link>
          <h1 className="text-2xl font-bold mt-1">🪪 Гар оролтыг шалгах</h1>
          <p className="text-sm text-gray-500">Хэрэглэгчийн гар оролтоор үүссэн provisional СӨХ-уудыг үндсэн жагсаалттай нэгтгэх</p>
        </div>
        <button onClick={runAuto} disabled={autoBusy} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
          {autoBusy ? 'Хийж байна...' : '⚙ Авто-merge ажиллуулах'}
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        {([['', 'Бүгд'], ['PENDING', 'PENDING'], ['HAS_DEMAND', 'HAS_DEMAND'], ['MATCH_CANDIDATE', 'MATCH_CANDIDATE']] as const).map(([v, l]) => (
          <button
            key={v || 'all'}
            onClick={() => setStatusFilter(v as typeof statusFilter)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium ${statusFilter === v ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            {l}
          </button>
        ))}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm mb-3">{error}</div>}

      <div className="bg-white border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-gray-500 text-xs">
              <th className="px-3 py-2">Provisional СӨХ</th>
              <th className="px-3 py-2">Байршил</th>
              <th className="px-3 py-2 text-right">Эрэлт</th>
              <th className="px-3 py-2">Санал болгож буй таарал</th>
              <th className="px-3 py-2">Үйлдэл</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-400">Ачаалж байна...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-400">Provisional бичлэг байхгүй</td></tr>
            ) : rows.map((r) => {
              const best = r.suggestion?.best;
              return (
                <tr key={r.id} className="border-t align-top">
                  <td className="px-3 py-2">
                    <p className="font-medium">{r.entered_name}</p>
                    <p className="text-xs text-gray-400">
                      {[r.town_name, r.building].filter(Boolean).join(' · ') || '—'}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{new Date(r.created_at).toLocaleDateString('mn')}</p>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <p>{r.district || '—'}</p>
                    <p className="text-gray-400">{r.khoroo || ''}</p>
                    {r.city && <p className="text-gray-400">{r.city}</p>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <p className="font-semibold">{r.summary.interest_count}</p>
                    <p className="text-[10px] text-gray-400">{r.summary.building_count} барилга</p>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {best ? (
                      <div>
                        <p className="font-medium">{best.directory.official_name}</p>
                        <p className="text-gray-400">
                          {best.directory.district || '—'}
                          {best.directory.khoroo ? ` / ${best.directory.khoroo}` : ''}
                        </p>
                        <p className="text-gray-400 mt-0.5">оноо: {best.score.toFixed(2)} ({r.suggestion?.action})</p>
                        {best.reasons.length > 0 && (
                          <p className="text-gray-400 text-[10px]">{best.reasons.join(' · ')}</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">— таарал олдоогүй —</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-1">
                      {best && (
                        <button
                          onClick={() => merge(r.id, best.directory.id)}
                          disabled={busy === r.id}
                          className="px-3 py-1 bg-green-600 text-white rounded text-xs font-semibold hover:bg-green-700 disabled:opacity-50"
                        >
                          Нэгтгэх
                        </button>
                      )}
                      <button
                        onClick={() => reject(r.id)}
                        disabled={busy === r.id}
                        className="px-3 py-1 border rounded text-xs hover:bg-gray-50 disabled:opacity-50"
                      >
                        Татгалзах
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
