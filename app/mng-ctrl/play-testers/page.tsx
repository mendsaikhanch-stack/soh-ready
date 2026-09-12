'use client';

// Play туршилтад оролцохоор Gmail хаягаа үлдээсэн оршин суугчдын жагсаалт.
// Эндээс хаягуудыг хуулж Play Console ▸ Closed testing ▸ Testers ▸ email list
// рүү тавина.

import { useCallback, useEffect, useState } from 'react';

interface Row {
  id: number;
  email: string;
  platform: string | null;
  status: string;
  note: string | null;
  created_at: string;
  sokh_id: number | null;
}

const STATUS_LABEL: Record<string, string> = {
  new: 'Шинэ',
  added: 'Console-д нэмсэн',
  opted_in: 'Нэгдсэн',
  installed: 'Суулгасан',
  declined: 'Татгалзсан',
};

const STATUS_CLS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  added: 'bg-amber-100 text-amber-700',
  opted_in: 'bg-indigo-100 text-indigo-700',
  installed: 'bg-green-100 text-green-700',
  declined: 'bg-gray-200 text-gray-600',
};

export default function PlayTestersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/play-testers');
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Татаж чадсангүй');
      } else {
        setRows(data.rows || []);
      }
    } catch {
      setError('Сервертэй холбогдож чадсангүй');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const pending = rows.filter(r => r.status === 'new');

  const copyPending = async () => {
    const list = pending.map(r => r.email).join(', ');
    try {
      await navigator.clipboard.writeText(list);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError('Хуулж чадсангүй — гараар сонгож хуулна уу');
    }
  };

  return (
    <div className="p-6 bg-white rounded-2xl">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📱 Play туршилтын хүсэлт</h1>
          <p className="text-sm text-gray-500 mt-1">
            Аппаа ашиглаж буй оршин суугчид Gmail хаягаа энд үлдээнэ. Хаягуудыг Play
            Console ▸ Closed testing ▸ Testers рүү тавина.
          </p>
        </div>
        <button onClick={load} className="px-4 py-2 border rounded-xl text-sm hover:bg-gray-50 flex-none">
          Шинэчлэх
        </button>
      </div>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
          {error}
          {error.includes('Татаж') && (
            <span className="block mt-1 text-xs">
              Хүснэгт үүсээгүй бол <code>supabase-play-testers-migration.sql</code>-ийг
              Supabase SQL Editor-т ажиллуулна уу.
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
        <Stat label="Нийт" value={rows.length} cls="bg-gray-50 text-gray-700" />
        <Stat label="Console-д нэмээгүй" value={pending.length} cls="bg-blue-50 text-blue-700" />
        <Stat label="Нэгдсэн" value={rows.filter(r => r.status === 'opted_in').length} cls="bg-indigo-50 text-indigo-700" />
        <Stat label="Суулгасан" value={rows.filter(r => r.status === 'installed').length} cls="bg-green-50 text-green-700" />
      </div>

      {pending.length > 0 && (
        <div className="mt-5 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm text-gray-800 mb-2">
            <b>{pending.length} шинэ хаяг</b> — Play Console-ийн email list рүү тавихад бэлэн:
          </p>
          <p className="text-xs text-gray-700 bg-white border rounded-lg p-3 break-all font-mono">
            {pending.map(r => r.email).join(', ')}
          </p>
          <button
            onClick={copyPending}
            className="mt-3 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold active:bg-blue-700"
          >
            {copied ? '✓ Хуулагдлаа' : 'Бүгдийг хуулах'}
          </button>
        </div>
      )}

      <div className="mt-5 bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Имэйл</th>
              <th className="text-left px-4 py-2 font-medium">Төхөөрөмж</th>
              <th className="text-left px-4 py-2 font-medium">СӨХ</th>
              <th className="text-left px-4 py-2 font-medium">Төлөв</th>
              <th className="text-left px-4 py-2 font-medium">Огноо</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Ачаалж байна...</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Одоогоор хүсэлт алга</td></tr>
            )}
            {rows.map(r => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-2.5 text-gray-800">{r.email}</td>
                <td className="px-4 py-2.5 text-gray-500">{r.platform || '—'}</td>
                <td className="px-4 py-2.5 text-gray-500">{r.sokh_id ?? '—'}</td>
                <td className="px-4 py-2.5">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_CLS[r.status] || 'bg-gray-100 text-gray-600'}`}>
                    {STATUS_LABEL[r.status] || r.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-gray-500">
                  {new Date(r.created_at).toLocaleDateString('mn-MN')}
                </td>
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
    <div className={`rounded-xl p-3 ${cls}`}>
      <p className="text-xs opacity-70">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
