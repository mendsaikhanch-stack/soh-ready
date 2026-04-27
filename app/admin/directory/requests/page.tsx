'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface SignupRequest {
  id: number;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  requested_name: string;
  district: string | null;
  khoroo: string | null;
  address: string | null;
  note: string | null;
  status: 'PENDING' | 'MATCHED' | 'APPROVED' | 'REJECTED';
  matched_directory_id: number | null;
  claimed_user_id: number | null;
  created_at: string;
}

export default function RequestsPage() {
  const [requests, setRequests] = useState<SignupRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'' | 'PENDING' | 'MATCHED' | 'APPROVED' | 'REJECTED'>('PENDING');

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    const res = await fetch(`/api/admin/directory/requests?${params}`);
    const data = await res.json();
    setRequests(data.requests || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [statusFilter]);

  const updateStatus = async (id: number, status: SignupRequest['status']) => {
    await fetch('/api/admin/directory/requests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    load();
  };

  return (
    <div className="p-6">
      <div className="mb-4">
        <Link href="/admin/directory" className="text-sm text-blue-600 hover:underline">← СӨХ Directory</Link>
        <h1 className="text-2xl font-bold mt-1">📨 Хэрэглэгчийн хүсэлтүүд</h1>
        <p className="text-sm text-gray-500">"СӨХ олдсонгүй" хүсэлтүүдийг шалгах</p>
      </div>

      <div className="flex gap-2 mb-4">
        {(['PENDING', 'MATCHED', 'APPROVED', 'REJECTED', ''] as const).map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium ${statusFilter === s ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            {s || 'Бүгд'}
          </button>
        ))}
      </div>

      <div className="bg-white border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-gray-500 text-xs">
              <th className="px-3 py-2">Хүсэлт</th>
              <th className="px-3 py-2">Хүн</th>
              <th className="px-3 py-2">Байршил</th>
              <th className="px-3 py-2">Огноо</th>
              <th className="px-3 py-2">Төлөв</th>
              <th className="px-3 py-2">Үйлдэл</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">Ачаалж байна...</td></tr>
            ) : requests.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">Хүсэлт байхгүй</td></tr>
            ) : requests.map((r) => (
              <tr key={r.id} className="border-t align-top">
                <td className="px-3 py-2">
                  <p className="font-medium">{r.requested_name}</p>
                  {r.address && <p className="text-xs text-gray-500">{r.address}</p>}
                  {r.note && <p className="text-xs text-gray-400 italic mt-1">"{r.note}"</p>}
                </td>
                <td className="px-3 py-2 text-xs">
                  <p>{r.full_name || '—'}</p>
                  {r.phone && <p className="text-gray-500">📞 {r.phone}</p>}
                  {r.email && <p className="text-gray-500">✉ {r.email}</p>}
                </td>
                <td className="px-3 py-2 text-xs">
                  <p>{r.district || '—'}</p>
                  <p className="text-gray-400">{r.khoroo || ''}</p>
                </td>
                <td className="px-3 py-2 text-xs text-gray-500">{new Date(r.created_at).toLocaleDateString('mn')}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={r.status} />
                  {r.claimed_user_id && (
                    <p className="text-[10px] text-green-700 mt-1">✓ user #{r.claimed_user_id}</p>
                  )}
                </td>
                <td className="px-3 py-2">
                  <select
                    value={r.status}
                    onChange={(e) => updateStatus(r.id, e.target.value as SignupRequest['status'])}
                    className="border rounded text-xs px-2 py-1"
                  >
                    <option value="PENDING">Хүлээгдэж</option>
                    <option value="MATCHED">Таарсан</option>
                    <option value="APPROVED">Зөвшөөрсөн</option>
                    <option value="REJECTED">Татгалзсан</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: SignupRequest['status'] }) {
  const map = {
    PENDING: { cls: 'bg-yellow-100 text-yellow-700', label: 'хүлээгдэж' },
    MATCHED: { cls: 'bg-blue-100 text-blue-700', label: 'таарсан' },
    APPROVED: { cls: 'bg-green-100 text-green-700', label: 'зөвшөөрсөн' },
    REJECTED: { cls: 'bg-gray-200 text-gray-500', label: 'татгалзсан' },
  };
  const m = map[status];
  return <span className={`px-2 py-0.5 rounded-full text-xs ${m.cls}`}>{m.label}</span>;
}
