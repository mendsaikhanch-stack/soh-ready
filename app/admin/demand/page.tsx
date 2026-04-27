'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface DemandRow {
  kind: 'directory' | 'provisional';
  id: number;
  name: string;
  district: string | null;
  khoroo: string | null;
  city?: string | null;
  interest_count: number;
  building_count: number;
  latest_request_at: string | null;
  status: 'INTEREST' | 'WARM_LEAD' | 'ACTIVATION_READY' | 'ACTIVE';
  is_active_tenant?: boolean;
  matched_directory_id?: number | null;
  match_score?: number | null;
  claimed_count: number;
  unclaimed_count: number;
}

interface Totals {
  total: number;
  interest: number;
  warm: number;
  ready: number;
  active: number;
  totalInterest: number;
  totalClaimed: number;
  totalUnclaimed: number;
}

export default function DemandPage() {
  const [rows, setRows] = useState<DemandRow[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [district, setDistrict] = useState('');
  const [khoroo, setKhoroo] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (district) params.set('district', district);
    if (khoroo) params.set('khoroo', khoroo);
    if (statusFilter) params.set('status', statusFilter);
    const res = await fetch(`/api/admin/demand?${params}`);
    const data = await res.json();
    setRows(data.rows || []);
    setTotals(data.totals || null);
    setLoading(false);
  }, [district, khoroo, statusFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">📈 Эрэлтийн жагсаалт</h1>
          <p className="text-sm text-gray-500">Khotol-ийг хүсэж буй СӨХ-үүдийн дохио</p>
        </div>
        <Link href="/admin/directory/provisional" className="px-4 py-2 border rounded-xl text-sm hover:bg-gray-50">
          🔍 Гар оролтыг шалгах
        </Link>
      </div>

      {totals && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
            <Stat label="Нийт СӨХ" value={totals.total} cls="bg-gray-50 text-gray-700" />
            <Stat label="Сонирхолтой" value={totals.interest} cls="bg-blue-50 text-blue-700" />
            <Stat label="Дулаахан" value={totals.warm} cls="bg-yellow-50 text-yellow-700" />
            <Stat label="Идэвхжихэд бэлэн" value={totals.ready} cls="bg-orange-50 text-orange-700" />
            <Stat label="Идэвхтэй" value={totals.active} cls="bg-green-50 text-green-700" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            <Stat label="Бүртгэлтэй холбогдсон" value={totals.totalClaimed} cls="bg-green-50 text-green-700" />
            <Stat label="Холбогдоогүй (orphan)" value={totals.totalUnclaimed} cls="bg-gray-50 text-gray-700" />
            <Stat label="Нийт сонирхол" value={totals.totalInterest} cls="bg-purple-50 text-purple-700" />
          </div>
        </>
      )}

      <div className="bg-white border rounded-xl p-3 mb-4 grid grid-cols-1 md:grid-cols-4 gap-2">
        <input
          placeholder="Дүүрэг"
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
        />
        <input
          placeholder="Хороо"
          value={khoroo}
          onChange={(e) => setKhoroo(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Бүх төлөв</option>
          <option value="INTEREST">Сонирхолтой</option>
          <option value="WARM_LEAD">Дулаахан</option>
          <option value="ACTIVATION_READY">Идэвхжихэд бэлэн</option>
          <option value="ACTIVE">Идэвхтэй</option>
        </select>
        <button onClick={load} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm">
          Шинэчлэх
        </button>
      </div>

      <div className="bg-white border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-gray-500 text-xs">
              <th className="px-3 py-2">№</th>
              <th className="px-3 py-2">СӨХ</th>
              <th className="px-3 py-2">Байршил</th>
              <th className="px-3 py-2 text-right">Эрэлт</th>
              <th className="px-3 py-2 text-right">Барилга</th>
              <th className="px-3 py-2 text-right">Бүртгэлтэй</th>
              <th className="px-3 py-2">Сүүлчийн</th>
              <th className="px-3 py-2">Төлөв</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">Ачаалж байна...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-400">Эрэлтийн дохио хараахан байхгүй</td></tr>
            ) : rows.map((r, i) => (
              <tr key={`${r.kind}:${r.id}`} className="border-t hover:bg-gray-50">
                <td className="px-3 py-2 text-xs text-gray-400">{i + 1}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    {r.kind === 'provisional' && (
                      <span className="px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 text-[10px]">гар оролт</span>
                    )}
                    {r.kind === 'directory' && r.is_active_tenant && (
                      <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700 text-[10px]">tenant</span>
                    )}
                    <p className="font-medium">{r.name}</p>
                  </div>
                  {r.kind === 'provisional' && r.matched_directory_id && (
                    <p className="text-xs text-blue-500 mt-0.5">
                      → үндсэн жагсаалттай таарал #{r.matched_directory_id} ({r.match_score?.toFixed(2)})
                    </p>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-gray-500">
                  <p>{r.district || '—'}</p>
                  <p className="text-gray-400">{r.khoroo || ''}</p>
                </td>
                <td className="px-3 py-2 text-right font-semibold">{r.interest_count}</td>
                <td className="px-3 py-2 text-right text-gray-500">{r.building_count}</td>
                <td className="px-3 py-2 text-right">
                  <span className="text-green-600 font-medium">{r.claimed_count}</span>
                  {r.unclaimed_count > 0 && (
                    <span className="text-gray-400 text-xs"> / {r.claimed_count + r.unclaimed_count}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-gray-500">
                  {r.latest_request_at ? new Date(r.latest_request_at).toLocaleDateString('mn') : '—'}
                </td>
                <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
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

function StatusBadge({ status }: { status: DemandRow['status'] }) {
  const map = {
    INTEREST: { cls: 'bg-blue-100 text-blue-700', label: 'сонирхолтой' },
    WARM_LEAD: { cls: 'bg-yellow-100 text-yellow-700', label: 'дулаахан' },
    ACTIVATION_READY: { cls: 'bg-orange-100 text-orange-700', label: 'бэлэн' },
    ACTIVE: { cls: 'bg-green-100 text-green-700', label: 'идэвхтэй' },
  };
  const m = map[status];
  return <span className={`px-2 py-0.5 rounded-full text-xs ${m.cls}`}>{m.label}</span>;
}
