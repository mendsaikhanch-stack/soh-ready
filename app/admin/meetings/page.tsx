'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import MeetingForm, { emptyMeeting, toPayload, type MeetingFormValue } from './MeetingForm';
import MeetingStatusBadge from './MeetingStatusBadge';
import { MEETING_KIND_LABEL, type MeetingKind, type MeetingStatus } from '@/app/lib/meetings/labels';

interface MeetingRow {
  id: number;
  kind: MeetingKind;
  title: string;
  scheduled_at: string;
  location: string | null;
  status: MeetingStatus;
  agenda_count: number;
  unit_count: number;
}

export default function AdminMeetingsPage() {
  const router = useRouter();
  const [meetings, setMeetings] = useState<MeetingRow[]>([]);
  const [migrated, setMigrated] = useState(true);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<MeetingFormValue>(emptyMeeting);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/meetings', { cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    setMigrated(json.migrated !== false);
    setMeetings(json.meetings || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const run = async () => { await load(); };
    run();
  }, [load]);

  const create = async () => {
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/admin/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toPayload(form)),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || 'Хадгалж чадсангүй');
        return;
      }
      router.push(`/admin/meetings/${json.id}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold">🏛 Гишүүдийн хурал</h1>
        {migrated && !showForm && (
          <button onClick={() => { setForm(emptyMeeting()); setShowForm(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700">
            + Шинэ хурал
          </button>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-6 max-w-3xl">
        Сууц өмчлөгчдийн бүх гишүүдийн хурлыг зарлах, хэлэлцэх асуудал бэлтгэх. Хурал зарлахад санал өгөх
        эрхтэй сууцны жагсаалт тухайн өдрийн байдлаар хадгалагдана.
      </p>

      {!migrated && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm p-4 rounded-xl max-w-3xl">
          Хурлын модуль хараахан идэвхжээгүй байна. Хотолын багт хандана уу.
        </div>
      )}

      {showForm && (
        <div className="max-w-3xl mb-8 space-y-4">
          <MeetingForm value={form} onChange={setForm} />
          {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-xl">{error}</div>}
          <div className="flex gap-2">
            <button onClick={create} disabled={busy} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50">
              {busy ? 'Хадгалж байна...' : 'Ноорог хадгалах'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-5 py-3 rounded-xl border text-gray-600 hover:bg-gray-50">
              Болих
            </button>
          </div>
        </div>
      )}

      {migrated && (loading ? (
        <p className="text-gray-400">Ачаалж байна...</p>
      ) : meetings.length === 0 ? (
        !showForm && (
          <div className="bg-white rounded-2xl border p-10 text-center text-gray-400 max-w-3xl">
            Одоогоор хурал алга. «+ Шинэ хурал» дарж эхлүүлээрэй.
          </div>
        )
      ) : (
        <div className="grid gap-3 max-w-3xl">
          {meetings.map((m) => (
            <Link key={m.id} href={`/admin/meetings/${m.id}`} className="bg-white rounded-xl border p-4 flex items-center justify-between gap-4 hover:border-blue-300">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900 truncate">{m.title}</h3>
                  <MeetingStatusBadge status={m.status} />
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {MEETING_KIND_LABEL[m.kind]} · {new Date(m.scheduled_at).toLocaleString('mn-MN', { dateStyle: 'medium', timeStyle: 'short' })}
                  {m.location ? ` · ${m.location}` : ''} · {m.agenda_count} асуудал
                  {m.unit_count ? ` · ${m.unit_count} сууц` : ''}
                </p>
              </div>
              <span className="text-gray-300 shrink-0">›</span>
            </Link>
          ))}
        </div>
      ))}
    </div>
  );
}
