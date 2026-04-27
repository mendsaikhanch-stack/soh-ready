'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface DirectoryRow {
  id: number;
  official_name: string;
  display_name: string | null;
  district: string | null;
  khoroo: string | null;
  address: string | null;
  phone: string | null;
  status: 'ACTIVE' | 'PENDING' | 'HIDDEN';
  linked_tenant_id: number | null;
  is_active_tenant?: boolean;
}

interface SokhTenant {
  id: number;
  name: string;
}

export default function AdminDirectoryPage() {
  const [rows, setRows] = useState<DirectoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [tenants, setTenants] = useState<SokhTenant[]>([]);
  const [linkingId, setLinkingId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (districtFilter) params.set('district', districtFilter);
    params.set('limit', '50');
    const res = await fetch(`/api/admin/directory/search?${params}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Жагсаалт татаж чадсангүй');
      setLoading(false);
      return;
    }
    setRows(data.results || []);
    setLoading(false);
  }, [query, districtFilter]);

  useEffect(() => { load(); }, [load]);

  // Tenant жагсаалт татах (link UI-д)
  useEffect(() => {
    fetch('/api/admin/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'sokh_organizations', action: 'select', params: { select: 'id, name', limit: 200 } }),
    })
      .then((r) => r.json())
      .then((d) => setTenants((d.data || []) as SokhTenant[]))
      .catch(() => {});
  }, []);

  const linkTenant = async (directoryId: number, tenantId: number | null) => {
    const res = await fetch('/api/admin/directory/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directoryId, tenantId }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Холбож чадсангүй');
      return;
    }
    setLinkingId(null);
    load();
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">📚 СӨХ-ийн нэгдсэн жагсаалт</h1>
          <p className="text-sm text-gray-500">Бүх СӨХ-ийн master directory</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/admin/directory/provisional" className="px-4 py-2 border rounded-xl text-sm hover:bg-gray-50">
            🪪 Гар оролт
          </Link>
          <Link href="/admin/directory/requests" className="px-4 py-2 border rounded-xl text-sm hover:bg-gray-50">
            📨 Олдоогүй СӨХ хүсэлт
          </Link>
          <Link href="/admin/directory/import" className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700">
            ⬆ Master файл импорт
          </Link>
        </div>
      </div>

      <div className="bg-white border rounded-xl p-4 mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <input
          placeholder="Нэр / хаяг / alias-аар хайх"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
        />
        <input
          placeholder="Дүүрэг (заавал биш)"
          value={districtFilter}
          onChange={(e) => setDistrictFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
        />
        <button onClick={load} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-700">
          Хайх
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm mb-3">{error}</div>}

      <div className="bg-white border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-gray-500 text-xs">
              <th className="px-3 py-2">№</th>
              <th className="px-3 py-2">Нэр</th>
              <th className="px-3 py-2">Дүүрэг / Хороо</th>
              <th className="px-3 py-2">Хаяг</th>
              <th className="px-3 py-2">Утас</th>
              <th className="px-3 py-2">Төлөв</th>
              <th className="px-3 py-2">Khotol tenant</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">Ачаалж байна...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">Бичлэг олдсонгүй</td></tr>
            ) : rows.map((r, i) => (
              <tr key={r.id} className="border-t hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-400 text-xs">{i + 1}</td>
                <td className="px-3 py-2">
                  <p className="font-medium">{r.official_name}</p>
                  {r.display_name && r.display_name !== r.official_name && (
                    <p className="text-xs text-gray-400">{r.display_name}</p>
                  )}
                </td>
                <td className="px-3 py-2 text-xs">
                  <p>{r.district || '—'}</p>
                  <p className="text-gray-400">{r.khoroo || '—'}</p>
                </td>
                <td className="px-3 py-2 text-xs text-gray-500">{r.address || '—'}</td>
                <td className="px-3 py-2 text-xs text-gray-500">{r.phone || '—'}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={r.status} />
                </td>
                <td className="px-3 py-2">
                  {linkingId === r.id ? (
                    <div className="flex gap-1">
                      <select
                        defaultValue={r.linked_tenant_id ?? ''}
                        onChange={(e) => linkTenant(r.id, e.target.value ? Number(e.target.value) : null)}
                        className="border rounded text-xs px-1 py-1"
                      >
                        <option value="">— холбохгүй —</option>
                        {tenants.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                      <button onClick={() => setLinkingId(null)} className="text-xs text-gray-400">Болих</button>
                    </div>
                  ) : r.linked_tenant_id ? (
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs">Идэвхтэй</span>
                      <button onClick={() => setLinkingId(r.id)} className="text-xs text-blue-600 hover:underline">Өөрчлөх</button>
                    </div>
                  ) : (
                    <button onClick={() => setLinkingId(r.id)} className="text-xs text-blue-600 hover:underline">Холбох</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: 'ACTIVE' | 'PENDING' | 'HIDDEN' }) {
  const map = {
    ACTIVE: { cls: 'bg-blue-100 text-blue-700', label: 'Идэвхтэй' },
    PENDING: { cls: 'bg-yellow-100 text-yellow-700', label: 'Хүлээгдэж байна' },
    HIDDEN: { cls: 'bg-gray-200 text-gray-500', label: 'Далд' },
  } as const;
  const m = map[status];
  return <span className={`px-2 py-0.5 rounded-full text-xs ${m.cls}`}>{m.label}</span>;
}
