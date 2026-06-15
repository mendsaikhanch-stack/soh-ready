'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  DEMO_STATUSES,
  DEMO_PRIORITIES,
  CONTACT_METHODS,
  HOUSEHOLD_RANGES,
  demoStatusMeta,
  demoPriorityMeta,
  contactMethodMeta,
  type DemoRequest,
  type DemoRequestNote,
} from '@/app/lib/demo-requests/constants';

interface Stats {
  total: number;
  new: number;
  demo_scheduled: number;
  proposal_sent: number;
  won: number;
  later: number;
}

const EMPTY_STATS: Stats = { total: 0, new: 0, demo_scheduled: 0, proposal_sent: 0, won: 0, later: 0 };

function fmtDate(s: string | null) {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('mn-MN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}
function fmtDateTime(s: string | null) {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('mn-MN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}
// datetime-local input-д тааруулсан утга (YYYY-MM-DDTHH:mm)
function toLocalInput(s: string | null) {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function DemoRequestsPage() {
  const [rows, setRows] = useState<DemoRequest[]>([]);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [city, setCity] = useState('');
  const [household, setHousehold] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (search.trim()) p.set('search', search.trim());
    if (status) p.set('status', status);
    if (priority) p.set('priority', priority);
    if (city.trim()) p.set('city', city.trim());
    if (household) p.set('household', household);
    const res = await fetch(`/api/mng-ctrl/demo-requests?${p.toString()}`);
    const data = await res.json();
    if (res.ok) {
      setRows(data.data || []);
      setStats(data.stats || EMPTY_STATS);
    }
    setLoading(false);
  }, [search, status, priority, city, household]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const resetFilters = () => {
    setSearch('');
    setStatus('');
    setPriority('');
    setCity('');
    setHousehold('');
  };

  const cards = [
    { label: 'Нийт', value: stats.total, cls: 'bg-gray-50 border-gray-200 text-gray-700' },
    { label: 'Шинэ', value: stats.new, cls: 'bg-blue-50 border-blue-200 text-blue-700' },
    { label: 'Demo товлосон', value: stats.demo_scheduled, cls: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
    { label: 'Үнийн санал', value: stats.proposal_sent, cls: 'bg-amber-50 border-amber-200 text-amber-700' },
    { label: 'Гэрээ болсон', value: stats.won, cls: 'bg-green-50 border-green-200 text-green-700' },
    { label: 'Дараа холбогдох', value: stats.later, cls: 'bg-gray-50 border-gray-200 text-gray-600' },
  ];

  const anyFilter = !!(search || status || priority || city || household);

  return (
    // /mng-ctrl-ийн хар shell дотор бие даасан цайвар панел (маркетингтай адил).
    <div className="p-6 min-h-screen bg-gray-50 text-gray-900">
      <h1 className="text-2xl font-bold mb-1">🖥 Demo хүсэлт / Lead CRM</h1>
      <p className="text-sm text-gray-500 mb-5">
        Олон нийтийн <code className="text-xs bg-gray-100 px-1 rounded">/demo-request</code> форомоор ирсэн СӨХ-ийн судалгаа,
        хүсэлт — холбогдох, demo хийх, гэрээ хүртэлх замыг хөтлөнө.
      </p>

      {/* Stats */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-5">
        {cards.map((c) => (
          <div key={c.label} className={`rounded-xl border p-4 ${c.cls}`}>
            <p className="text-2xl font-bold">{c.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border rounded-xl p-4 mb-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs text-gray-500 block mb-1">Хайх (нэр / утас / СӨХ)</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Хайх..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Статус</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Бүгд</option>
            {DEMO_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Чухал зэрэг</label>
          <select value={priority} onChange={(e) => setPriority(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Бүгд</option>
            {DEMO_PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Өрхийн тоо</label>
          <select value={household} onChange={(e) => setHousehold(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Бүгд</option>
            {HOUSEHOLD_RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <div className="w-32">
          <label className="text-xs text-gray-500 block mb-1">Хот / аймаг</label>
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="УБ..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {anyFilter && (
          <button onClick={resetFilters} className="text-sm text-gray-500 hover:text-gray-700 px-2 py-2">
            ✕ Цэвэрлэх
          </button>
        )}
      </div>

      {/* List */}
      <div className="bg-white border rounded-xl overflow-hidden">
        {loading ? (
          <p className="text-gray-400 text-center py-12">Ачаалж байна...</p>
        ) : rows.length === 0 ? (
          <p className="text-gray-400 text-center py-12">
            {anyFilter ? 'Шүүлтүүрт тохирох хүсэлт алга.' : 'Одоогоор demo хүсэлт ирээгүй байна.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left font-medium px-4 py-3">СӨХ / Байр</th>
                  <th className="text-left font-medium px-4 py-3">Холбоо барих</th>
                  <th className="text-left font-medium px-4 py-3">Байршил</th>
                  <th className="text-right font-medium px-4 py-3">Өрх</th>
                  <th className="text-left font-medium px-4 py-3">Статус</th>
                  <th className="text-left font-medium px-4 py-3">Чухал</th>
                  <th className="text-left font-medium px-4 py-3">Дараагийн холбоо</th>
                  <th className="text-left font-medium px-4 py-3">Ирсэн</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => {
                  const st = demoStatusMeta(r.status);
                  const pr = demoPriorityMeta(r.priority);
                  return (
                    <tr key={r.id} onClick={() => setOpenId(r.id)}
                      className="hover:bg-blue-50/50 cursor-pointer transition">
                      <td className="px-4 py-3 font-medium">{r.soh_name}</td>
                      <td className="px-4 py-3">
                        <div>{r.contact_name}</div>
                        <a href={`tel:${r.phone}`} onClick={(e) => e.stopPropagation()}
                          className="text-blue-600 hover:underline text-xs">{r.phone}</a>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {r.city}{r.district ? `, ${r.district}` : ''}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">{r.household_count ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${pr.cls}`}>{pr.label}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{fmtDate(r.next_follow_up_at)}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{fmtDate(r.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {openId && (
        <DetailDrawer
          id={openId}
          onClose={() => setOpenId(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Дэлгэрэнгүй цонх (drawer)
// ────────────────────────────────────────────────────────────

function DetailDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const [req, setReq] = useState<DemoRequest | null>(null);
  const [notes, setNotes] = useState<DemoRequestNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // CRM editable fields
  const [status, setStatus] = useState('new');
  const [priority, setPriority] = useState('normal');
  const [nextFollowUp, setNextFollowUp] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [priceNote, setPriceNote] = useState('');
  const [lostReason, setLostReason] = useState('');

  // new note
  const [noteText, setNoteText] = useState('');
  const [noteMethod, setNoteMethod] = useState('phone');
  const [addingNote, setAddingNote] = useState(false);

  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/mng-ctrl/demo-requests/${id}`);
    const data = await res.json();
    if (res.ok) {
      const r: DemoRequest = data.data;
      setReq(r);
      setNotes(data.notes || []);
      setStatus(r.status);
      setPriority(r.priority || 'normal');
      setNextFollowUp(toLocalInput(r.next_follow_up_at));
      setInternalNotes(r.internal_notes || '');
      setPriceNote(r.price_note || '');
      setLostReason(r.lost_reason || '');
    }
    setLoading(false);
  }, [id]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const saveCrm = async () => {
    setSaving(true);
    const res = await fetch(`/api/mng-ctrl/demo-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status,
        priority,
        next_follow_up_at: nextFollowUp || null,
        internal_notes: internalNotes,
        price_note: priceNote,
        lost_reason: lostReason,
      }),
    });
    setSaving(false);
    if (res.ok) {
      const data = await res.json();
      setReq(data.data);
      onChanged();
    }
  };

  const remove = async () => {
    if (!req) return;
    const ok = window.confirm(
      `"${req.soh_name}" хүсэлтийг бүрмөсөн устгах уу?\nХарилцсан тэмдэглэлүүд хамт устана. Энэ үйлдлийг буцаах боломжгүй.`
    );
    if (!ok) return;
    setDeleting(true);
    const res = await fetch(`/api/mng-ctrl/demo-requests/${id}`, { method: 'DELETE' });
    setDeleting(false);
    if (res.ok) {
      onChanged();
      onClose();
    } else {
      window.alert('Устгаж чадсангүй. Дахин оролдоно уу.');
    }
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    setAddingNote(true);
    const res = await fetch(`/api/mng-ctrl/demo-requests/${id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: noteText.trim(), contact_method: noteMethod }),
    });
    setAddingNote(false);
    if (res.ok) {
      setNoteText('');
      load();
      onChanged();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-gray-50 h-full overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
          <div className="min-w-0">
            <h2 className="text-lg font-bold truncate">{req?.soh_name || 'Ачаалж байна...'}</h2>
            {req && (
              <p className="text-xs text-gray-500">{req.city}{req.district ? `, ${req.district}` : ''} · ирсэн {fmtDate(req.created_at)}</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none px-2">×</button>
        </div>

        {loading || !req ? (
          <p className="text-gray-400 text-center py-16">Ачаалж байна...</p>
        ) : (
          <div className="p-6 space-y-5">
            {/* Contact + survey */}
            <Section title="Холбоо барих">
              <Field label="Холбогдох хүн" value={req.contact_name} />
              <Field label="Утас" value={<a href={`tel:${req.phone}`} className="text-blue-600 hover:underline">{req.phone}</a>} />
              <Field label="Үүрэг" value={req.role || '—'} />
            </Section>

            <Section title="Судалгаа">
              <Field label="Хороо" value={req.khoroo || '—'} />
              <Field label="Өрхийн тоо" value={req.household_count != null ? String(req.household_count) : '—'} />
              <Field label="Facebook групптэй эсэх" value={req.has_facebook_group || '—'} />
              <Field label="Excel ашигладаг эсэх" value={req.has_excel || '—'} />
              <Field label="Түрээслэгчийн асуудал" value={req.renter_issue_level || '—'} />
              <Field label="Одоо ашигладаг суваг" value={req.current_channels?.length ? req.current_channels.join(', ') : '—'} full />
              <Field label="Тулгамдсан асуудал" value={req.main_problems?.length ? req.main_problems.join(', ') : '—'} full />
              {req.notes && <Field label="Нэмэлт тэмдэглэл" value={req.notes} full />}
              {req.improvement_suggestions && <Field label="Сайжруулах санал" value={req.improvement_suggestions} full />}
            </Section>

            {(req.utm_source || req.utm_campaign || req.referrer) && (
              <Section title="Эх сурвалж">
                <Field label="UTM source" value={req.utm_source || '—'} />
                <Field label="UTM campaign" value={req.utm_campaign || '—'} />
                <Field label="Referrer" value={req.referrer || '—'} full />
              </Section>
            )}

            {/* CRM editor */}
            <div className="bg-white border rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">CRM</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Статус</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {DEMO_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Чухал зэрэг</label>
                  <select value={priority} onChange={(e) => setPriority(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {DEMO_PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Дараагийн холбоо барих огноо</label>
                <input type="datetime-local" value={nextFollowUp} onChange={(e) => setNextFollowUp(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Дотоод тэмдэглэл</label>
                <textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Үнийн тэмдэглэл</label>
                <input value={priceNote} onChange={(e) => setPriceNote(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {status === 'lost' && (
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Алдсан шалтгаан</label>
                  <input value={lostReason} onChange={(e) => setLostReason(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
                </div>
              )}
              <button onClick={saveCrm} disabled={saving}
                className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50">
                {saving ? 'Хадгалж байна...' : 'Хадгалах'}
              </button>
              <p className="text-xs text-gray-400">
                Сүүлд холбогдсон: {fmtDateTime(req.last_contacted_at)}
              </p>
            </div>

            {/* Notes / timeline */}
            <div className="bg-white border rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Харилцсан тэмдэглэл</h3>
              <div className="flex gap-2">
                <select value={noteMethod} onChange={(e) => setNoteMethod(e.target.value)}
                  className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {CONTACT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.icon} {m.label}</option>)}
                </select>
                <input value={noteText} onChange={(e) => setNoteText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addNote(); }}
                  placeholder="Юу ярьсан, тохирсон бэ..."
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button onClick={addNote} disabled={addingNote || !noteText.trim()}
                  className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-900 transition disabled:opacity-50">
                  Нэмэх
                </button>
              </div>
              {notes.length === 0 ? (
                <p className="text-gray-400 text-sm py-2">Тэмдэглэл алга.</p>
              ) : (
                <div className="space-y-2">
                  {notes.map((n) => {
                    const m = contactMethodMeta(n.contact_method);
                    return (
                      <div key={n.id} className="flex gap-2 text-sm border-l-2 border-gray-200 pl-3 py-1">
                        <span className="text-base leading-none">{m.icon}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-gray-800 whitespace-pre-wrap break-words">{n.note}</p>
                          <p className="text-xs text-gray-400">{m.label} · {fmtDateTime(n.created_at)}{n.created_by ? ` · ${n.created_by}` : ''}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Устгах */}
            <div className="border border-red-200 bg-red-50 rounded-xl p-4">
              <button onClick={remove} disabled={deleting}
                className="w-full text-red-600 border border-red-300 bg-white py-2.5 rounded-lg text-sm font-medium hover:bg-red-100 transition disabled:opacity-50">
                {deleting ? 'Устгаж байна...' : '🗑 Хүсэлтийг устгах'}
              </button>
              <p className="text-xs text-red-400 mt-2 text-center">Буцаах боломжгүй. Тэмдэглэлүүд хамт устана.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border rounded-xl p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">{children}</dl>
    </div>
  );
}

function Field({ label, value, full }: { label: string; value: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <dt className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">{label}</dt>
      <dd className="text-sm text-gray-800 break-words">{value}</dd>
    </div>
  );
}
