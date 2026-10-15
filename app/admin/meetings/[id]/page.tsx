'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import MeetingForm, { emptyAgendaRow, toLocalInput, toPayload, inputCls, type MeetingFormValue } from '../MeetingForm';
import MeetingStatusBadge from '../MeetingStatusBadge';
import {
  MEETING_KIND_LABEL,
  VOTE_WEIGHT_LABEL,
  thresholdText,
  type MeetingKind,
  type MeetingStatus,
  type VoteWeightMode,
} from '@/app/lib/meetings/labels';

interface Meeting {
  id: number;
  kind: MeetingKind;
  title: string;
  description: string | null;
  scheduled_at: string;
  location: string | null;
  online_url: string | null;
  convened_by_name: string | null;
  convened_basis: string | null;
  status: MeetingStatus;
  vote_weight_mode: VoteWeightMode | null;
  quorum_required_pct: number | null;
  quorum_strict: boolean;
  min_notice_days: number | null;
  prevote_counts_as_attendance: boolean | null;
  rules_frozen_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
}

interface Agenda {
  id: number;
  position: number;
  title: string;
  description: string | null;
  decision_draft: string | null;
  pass_threshold_pct: number | null;
  pass_threshold_strict: boolean;
  prevote_enabled: boolean;
}

interface Unit {
  id: number;
  building: string | null;
  apartment: string;
  owner_name: string | null;
  phone_snapshot: string | null;
  area_sqm_snapshot: number | null;
  weight: number;
  owner_confirmed: boolean;
  owner_count: number;
}

interface EventRow {
  id: number;
  action: string;
  payload: Record<string, unknown> | null;
  created_at: string;
}

const EVENT_LABEL: Record<string, string> = {
  'meeting.created': 'Ноорог үүсгэв',
  'meeting.updated': 'Ноорог засав',
  'meeting.frozen': 'Хурал зарлав (сууцны жагсаалт хадгалагдав)',
  'meeting.cancelled': 'Хурлыг цуцлав',
};

const fmt = (iso: string) => new Date(iso).toLocaleString('mn-MN', { dateStyle: 'medium', timeStyle: 'short' });

function toForm(m: Meeting, agenda: Agenda[]): MeetingFormValue {
  return {
    kind: m.kind,
    title: m.title,
    description: m.description || '',
    scheduled_at: toLocalInput(m.scheduled_at),
    location: m.location || '',
    online_url: m.online_url || '',
    convened_by_name: m.convened_by_name || '',
    convened_basis: m.convened_basis || '',
    vote_weight_mode: m.vote_weight_mode || '',
    quorum_required_pct: m.quorum_required_pct != null ? String(Number(m.quorum_required_pct)) : '',
    quorum_strict: m.quorum_strict,
    min_notice_days: m.min_notice_days != null ? String(m.min_notice_days) : '',
    prevote_counts_as_attendance: m.prevote_counts_as_attendance == null ? '' : m.prevote_counts_as_attendance ? 'yes' : 'no',
    agenda: agenda.length
      ? agenda.map((a) => ({
          title: a.title,
          description: a.description || '',
          decision_draft: a.decision_draft || '',
          pass_threshold_pct: a.pass_threshold_pct != null ? String(Number(a.pass_threshold_pct)) : '',
          pass_threshold_strict: a.pass_threshold_strict,
          prevote_enabled: a.prevote_enabled,
        }))
      : [emptyAgendaRow()],
  };
}

export default function AdminMeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [agenda, setAgenda] = useState<Agenda[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [form, setForm] = useState<MeetingFormValue | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [confirmFreeze, setConfirmFreeze] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [unitFilter, setUnitFilter] = useState<'all' | 'review'>('all');

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/meetings/${id}`, { cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setNotFound(json.error || 'Хурал олдсонгүй');
      setLoading(false);
      return;
    }
    setMeeting(json.meeting);
    setAgenda(json.agenda);
    setUnits(json.units);
    setEvents(json.events);
    setForm(toForm(json.meeting, json.agenda));
    setLoading(false);
  }, [id]);

  useEffect(() => {
    const run = async () => { await load(); };
    run();
  }, [load]);

  const call = async (method: string, url: string, body?: unknown) => {
    setError('');
    setInfo('');
    setBusy(true);
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || 'Алдаа гарлаа');
        return null;
      }
      return json;
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!form) return;
    const ok = await call('PATCH', `/api/admin/meetings/${id}`, toPayload(form));
    if (ok) { setInfo('Хадгаллаа'); await load(); }
  };

  const freeze = async () => {
    if (!form) return;
    // Сүүлийн засварыг эхлээд хадгална — хадгалаагүй өөрчлөлт алдагдахгүй
    const saved = await call('PATCH', `/api/admin/meetings/${id}`, toPayload(form));
    if (!saved) { setConfirmFreeze(false); return; }
    const ok = await call('POST', `/api/admin/meetings/${id}/freeze`);
    setConfirmFreeze(false);
    if (ok) await load();
  };

  const cancel = async () => {
    const ok = await call('PATCH', `/api/admin/meetings/${id}`, { action: 'cancel', reason: cancelReason });
    if (ok) { setConfirmCancel(false); await load(); }
  };

  const removeDraft = async () => {
    const ok = await call('DELETE', `/api/admin/meetings/${id}`);
    if (ok) router.push('/admin/meetings');
  };

  const stats = useMemo(() => {
    const totalWeight = units.reduce((s, u) => s + Number(u.weight), 0);
    return {
      total: units.length,
      totalWeight,
      unconfirmed: units.filter((u) => !u.owner_confirmed).length,
      multi: units.filter((u) => u.owner_count > 1).length,
    };
  }, [units]);

  const shownUnits = unitFilter === 'review' ? units.filter((u) => !u.owner_confirmed || u.owner_count > 1) : units;

  if (loading) return <p className="text-gray-400">Ачаалж байна...</p>;
  if (!meeting || !form) {
    return (
      <div>
        <Link href="/admin/meetings" className="text-sm text-blue-600">‹ Хурлууд</Link>
        <p className="mt-4 text-gray-500">{notFound}</p>
      </div>
    );
  }

  const isDraft = meeting.status === 'draft';
  const canCancel = !['cancelled', 'archived', 'closed'].includes(meeting.status);

  return (
    <div className="max-w-3xl">
      <Link href="/admin/meetings" className="text-sm text-blue-600">‹ Хурлууд</Link>
      <div className="flex items-center gap-2 mt-2 mb-1">
        <h1 className="text-2xl font-bold truncate">{meeting.title}</h1>
        <MeetingStatusBadge status={meeting.status} />
      </div>
      <p className="text-sm text-gray-500 mb-6">
        {MEETING_KIND_LABEL[meeting.kind]} хурал · {fmt(meeting.scheduled_at)}
        {meeting.location ? ` · ${meeting.location}` : ''}
      </p>

      {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-xl mb-4">{error}</div>}
      {info && <div className="bg-green-50 border border-green-200 text-green-700 text-sm p-3 rounded-xl mb-4">{info}</div>}

      {meeting.status === 'cancelled' && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-4 rounded-xl mb-4">
          Энэ хурал {meeting.cancelled_at ? fmt(meeting.cancelled_at) : ''}-д цуцлагдсан.
          {meeting.cancel_reason ? ` Шалтгаан: ${meeting.cancel_reason}` : ''}
        </div>
      )}

      {isDraft ? (
        <>
          <MeetingForm value={form} onChange={setForm} />
          <div className="flex flex-wrap gap-2 mt-4">
            <button onClick={save} disabled={busy} className="flex-1 min-w-40 bg-white border border-blue-600 text-blue-700 py-3 rounded-xl font-semibold hover:bg-blue-50 disabled:opacity-50">
              Ноорог хадгалах
            </button>
            <button onClick={() => setConfirmFreeze(true)} disabled={busy} className="flex-1 min-w-40 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50">
              Хурал зарлах
            </button>
          </div>
          <button onClick={removeDraft} disabled={busy} className="mt-3 text-xs text-red-600">
            Ноорог устгах
          </button>

          {confirmFreeze && (
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-2xl p-5 space-y-3">
              <p className="font-semibold text-blue-900">Хурал зарлах уу?</p>
              <ul className="text-sm text-blue-900 list-disc pl-5 space-y-1">
                <li>Оршин суугчийн бүртгэлээс санал өгөх эрхтэй сууцны жагсаалт өнөөдрийн байдлаар хадгалагдана.</li>
                <li>Үүний дараа огноо, дүрэм, хэлэлцэх асуудлыг өөрчлөх боломжгүй. Өөрчлөх бол хурлыг цуцалж шинээр зарлана.</li>
                <li>Оршин суугчдад урилга хүргэх нь дараагийн алхам.</li>
              </ul>
              <div className="flex gap-2">
                <button onClick={freeze} disabled={busy} className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl font-semibold disabled:opacity-50">
                  {busy ? 'Зарлаж байна...' : 'Тийм, зарлах'}
                </button>
                <button onClick={() => setConfirmFreeze(false)} className="px-5 py-2.5 rounded-xl border bg-white text-gray-600">Болих</button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-5">
          {/* ===== Мэдээлэл, дүрэм ===== */}
          <section className="bg-white rounded-2xl border p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Хурлын мэдээлэл ба дүрэм</h2>
            <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Row k="Зарлан хуралдуулагч" v={meeting.convened_by_name} />
              <Row k="Санаачилга" v={meeting.convened_basis} />
              <Row k="Цахим холбоос" v={meeting.online_url} />
              <Row k="Зарласан" v={meeting.rules_frozen_at ? fmt(meeting.rules_frozen_at) : null} />
              <Row k="Санал тоолох" v={meeting.vote_weight_mode ? VOTE_WEIGHT_LABEL[meeting.vote_weight_mode] : null} />
              <Row k="Ирцийн шаардлага" v={thresholdText(meeting.quorum_required_pct, meeting.quorum_strict)} />
              <Row k="Зар хүргэх хугацаа" v={meeting.min_notice_days != null ? `Хурлаас ${meeting.min_notice_days} хоногийн өмнө` : null} />
              <Row k="Урьдчилсан санал ирцэд" v={meeting.prevote_counts_as_attendance == null ? null : meeting.prevote_counts_as_attendance ? 'Тооцно' : 'Тооцохгүй'} />
            </dl>
            {meeting.description && <p className="text-sm text-gray-600 mt-3 whitespace-pre-line">{meeting.description}</p>}
          </section>

          {/* ===== Хэлэлцэх асуудал ===== */}
          <section className="bg-white rounded-2xl border p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Хэлэлцэх асуудал</h2>
            <ol className="space-y-3">
              {agenda.map((a) => (
                <li key={a.id} className="text-sm">
                  <p className="font-medium text-gray-900">{a.position}. {a.title}</p>
                  {a.description && <p className="text-gray-600 whitespace-pre-line">{a.description}</p>}
                  {a.decision_draft && <p className="text-gray-500 italic whitespace-pre-line">Шийдвэрийн төсөл: {a.decision_draft}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">
                    Батлагдах босго: {thresholdText(a.pass_threshold_pct, a.pass_threshold_strict)}
                    {a.prevote_enabled ? ' · урьдчилсан санал авна' : ''}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          {/* ===== Сууцны жагсаалт ===== */}
          <section className="bg-white rounded-2xl border p-5">
            <h2 className="font-semibold text-gray-900">Санал өгөх эрхтэй сууц</h2>
            <p className="text-xs text-gray-500 mb-3">Хурал зарласан өдрийн оршин суугчийн бүртгэлээс хадгалсан жагсаалт.</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              <Stat label="Нийт сууц" value={stats.total} />
              <Stat label="Нийт саналын жин" value={Math.round(stats.totalWeight * 100) / 100} />
              <Stat label="Өмчлөгч тодорхойгүй" value={stats.unconfirmed} warn={stats.unconfirmed > 0} />
              <Stat label="Олон өмчлөгчтэй" value={stats.multi} warn={stats.multi > 0} />
            </div>
            {(stats.unconfirmed > 0 || stats.multi > 0) && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                «Өмчлөгч тодорхойгүй» — бүртгэлд эзэн гэж тэмдэглэгдсэн хүн алга. «Олон өмчлөгчтэй» — нэг тоотод хэд хэдэн эзэн
                бүртгэлтэй. Санал хураалтаас өмнө эдгээрийг шалгаж, хэн санал өгөхийг тодруулна уу.
              </p>
            )}
            <div className="flex gap-2 mb-2">
              <button onClick={() => setUnitFilter('all')} className={`text-xs px-3 py-1.5 rounded-lg border ${unitFilter === 'all' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600'}`}>Бүгд</button>
              <button onClick={() => setUnitFilter('review')} className={`text-xs px-3 py-1.5 rounded-lg border ${unitFilter === 'review' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600'}`}>Шалгах шаардлагатай</button>
            </div>
            <div className="max-h-96 overflow-auto border rounded-xl">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2">Байр-тоот</th>
                    <th className="text-left px-3 py-2">Нэр</th>
                    <th className="text-right px-3 py-2">Жин</th>
                    <th className="text-left px-3 py-2">Тэмдэглэл</th>
                  </tr>
                </thead>
                <tbody>
                  {shownUnits.map((u) => (
                    <tr key={u.id} className="border-t">
                      <td className="px-3 py-1.5 whitespace-nowrap">{u.building ? `${u.building}-` : ''}{u.apartment}</td>
                      <td className="px-3 py-1.5">{u.owner_name || '—'}</td>
                      <td className="px-3 py-1.5 text-right">{Number(u.weight)}</td>
                      <td className="px-3 py-1.5 text-xs text-amber-700">
                        {!u.owner_confirmed ? 'Өмчлөгч тодорхойгүй' : u.owner_count > 1 ? `${u.owner_count} өмчлөгч` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ===== Цуцлах ===== */}
          {canCancel && (
            <section>
              {!confirmCancel ? (
                <button onClick={() => setConfirmCancel(true)} className="text-sm text-red-600">Хурлыг цуцлах</button>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-5 space-y-3">
                  <p className="font-semibold text-red-800">Хурлыг цуцлах уу?</p>
                  <textarea className={inputCls} rows={2} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Цуцалсан шалтгаан (заавал)" />
                  <div className="flex gap-2">
                    <button onClick={cancel} disabled={busy || !cancelReason.trim()} className="flex-1 bg-red-600 text-white py-2.5 rounded-xl font-semibold disabled:opacity-50">Цуцлах</button>
                    <button onClick={() => setConfirmCancel(false)} className="px-5 py-2.5 rounded-xl border bg-white text-gray-600">Болих</button>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* ===== Түүх ===== */}
      {events.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-gray-500 mb-2">Түүх</h2>
          <ul className="text-xs text-gray-500 space-y-1">
            {events.map((e) => (
              <li key={e.id}>
                {fmt(e.created_at)} — {EVENT_LABEL[e.action] || e.action}
                {e.action === 'meeting.frozen' && e.payload ? ` (${e.payload.units} сууц)` : ''}
                {e.action === 'meeting.cancelled' && e.payload?.reason ? ` — ${String(e.payload.reason)}` : ''}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-3 border-b border-gray-50 py-1">
      <dt className="text-gray-500">{k}</dt>
      <dd className="text-gray-900 text-right">{v || '—'}</dd>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${warn ? 'bg-amber-50 border-amber-200' : 'bg-gray-50'}`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-lg font-bold ${warn ? 'text-amber-700' : 'text-gray-900'}`}>{value}</p>
    </div>
  );
}
