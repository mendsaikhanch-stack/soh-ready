'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminFrom } from '@/app/lib/admin-db';
import { getAdminSokhId } from '@/app/lib/admin-config';
import { officialUnitLabel } from '@/app/lib/bank-sms/unit-address';

// Банкны SMS-ээс автоматаар бүртгэгдсэн гүйлгээ — даргын хяналт.
// Бүх унших/бичих үйлдэл /api/admin/bank-sms-ээр (session-ий СӨХ-ээр хязгаарлагдана).
// Оршин суугч, нэхэмжлэхийн жагсаалтыг одоогийн adminFrom proxy-оос уншина.

interface Device {
  id: number; display_name: string; bank: string; allowed_senders: string[]; account_mask: string | null;
  auto_apply: boolean; token_prefix: string; status: 'active' | 'revoked';
  last_seen_at: string | null; last_sms_received_at: string | null; last_successful_delivery_at: string | null;
  last_error: string | null; last_error_at: string | null;
  last_status: { pending?: number | null; failed?: number | null; lastSmsAt?: string | null; appVersion?: string | null } | null;
}
interface Mapping {
  id: number; source_pattern: string; normalized_pattern: string; building_number: string;
  entrance_number: string | null; apartment_number: string; note: string | null; is_active: boolean;
}
interface Txn {
  id: number; transaction_reference: string | null; payment_channel: string | null; amount_mnt: number;
  balance_after_mnt: number | null; transaction_date: string; transaction_description: string | null;
  payer_reference: string | null; building_number: string | null; entrance_number: string | null;
  apartment_number: string | null; resident_id: number | null; suggested_invoice_id: number | null;
  matching_status: string; reconciliation_status: string; review_reason: string | null; payment_id: number | null;
  reviewed_at: string | null; review_note: string | null; created_at: string;
  resident: { id: number; name: string; building: string | null; apartment: string } | null;
}
interface SmsEvent {
  id: number; sender: string | null; received_at: string | null; server_received_at: string;
  processing_status: string; processing_error: string | null; transaction_id: number | null;
  retry_count: number; raw_body: string | null; raw_purged_at: string | null;
}
interface Resident { id: number; name: string; building: string | null; apartment: string; debt: number }
interface Invoice { id: number; year: number; month: number; amount: number; total_amount: number | null; paid_amount: number | null; status: string }

const REASON: Record<string, string> = {
  no_mapping: 'Тоот таних дүрэм олдсонгүй',
  mapped_no_resident: 'Тоот олдсон ч оршин суугч бүртгэлгүй',
  ambiguous_resident: 'Нэг тоотод олон айл — сонгоно уу',
  no_open_invoice: 'Төлөгдөөгүй нэхэмжлэх алга',
  multiple_open_invoices: 'Олон нэхэмжлэх — аль нэгийг сонгоно уу',
  amount_mismatch: 'Дүн нэхэмжлэхтэй таарахгүй',
  auto_apply_disabled: 'Автомат бүртгэл унтраалттай — шалгаад баталгаажуулна',
  apply_failed: 'Автоматаар бүртгэж чадсангүй',
  unit_unconfirmed: 'Тоот танигдсан ч байр баталгаагүй (дан тоот / «498-…») — айлыг шалгаж баталгаажуулна уу',
  unit_conflict: 'Бичсэн орц тоотын дугаартай таарахгүй — шалгана уу',
  unit_invalid: 'Ийм тоот тэр байранд байхгүй — шалгана уу',
  match_error: 'Тааруулахад алдаа гарсан — дахин тааруулна уу',
  unrecognized_format: 'SMS-ийн формат танигдсангүй',
  debit_unverified: 'Зарлагын SMS (орлого биш)',
  account_mismatch: 'Дансны дугаар таарахгүй',
  bad_amount: 'Дүн уншигдсангүй',
  bad_date: 'Огноо уншигдсангүй',
  processing_error: 'Боловсруулахад алдаа гарсан',
};

const mnt = (n: number | string | null | undefined) => (n == null ? '—' : `${Number(n).toLocaleString()}₮`);
const when = (s: string | null | undefined) => (s ? new Date(s).toLocaleString('mn-MN') : '—');
const unit = (b: string | null, e: string | null, a: string | null) => (a ? [b, e, a].filter(Boolean).join('-') : '—');

function txnBadge(t: Txn): { label: string; cls: string } {
  if (t.reconciliation_status === 'auto_applied') return { label: '✓ Автоматаар бүртгэсэн', cls: 'bg-green-100 text-green-700' };
  if (t.reconciliation_status === 'confirmed') return { label: '✓ Баталгаажуулсан', cls: 'bg-green-100 text-green-700' };
  if (t.reconciliation_status === 'ignored') return { label: 'Хасагдсан', cls: 'bg-gray-100 text-gray-500' };
  if (t.matching_status === 'matched') return { label: 'Тохирсон — шалгах', cls: 'bg-blue-100 text-blue-700' };
  if (t.matching_status === 'unmatched') return { label: 'Тоот танигдаагүй', cls: 'bg-amber-100 text-amber-800' };
  return { label: 'Шалгах', cls: 'bg-amber-100 text-amber-800' };
}

const EVENT_LABEL: Record<string, string> = {
  received: 'Хүлээн авсан', processed: 'Боловсруулсан', duplicate: 'Давхардсан',
  needs_review: 'Шалгах', failed: 'Алдаатай',
};

async function api(action: string, body: Record<string, unknown>) {
  const res = await fetch('/api/admin/bank-sms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Алдаа (${res.status})`);
  return data;
}

export default function AdminBankSms() {
  const [tab, setTab] = useState<'txns' | 'events' | 'devices' | 'mappings'>('txns');
  const [devices, setDevices] = useState<Device[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [events, setEvents] = useState<SmsEvent[]>([]);
  const [sokhId, setSokhId] = useState<number | null>(null);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<'review' | 'all'>('review');
  // «Холбогдсон» төлөвийг ачаалсан мөчөөр тооцно (render дотор Date.now() дуудахгүй)
  const [loadedAt, setLoadedAt] = useState(0);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/bank-sms?view=overview');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoadError(data.error || 'Ачаалж чадсангүй');
      setLoading(false);
      return;
    }
    setLoadError(null);
    setLoadedAt(Date.now());
    setDevices(data.devices || []);
    setMappings(data.mappings || []);
    setTxns(data.transactions || []);
    setEvents(data.events || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    (async () => {
      const sokhId = await getAdminSokhId();
      setSokhId(sokhId);
      const { data } = await adminFrom('residents').select('id,name,building,apartment,debt').eq('sokh_id', sokhId).limit(5000);
      setResidents(((data as Resident[]) || []).slice().sort((a, b) =>
        `${a.building}-${a.apartment}`.localeCompare(`${b.building}-${b.apartment}`, undefined, { numeric: true })));
    })();
  }, [load]);

  const run = async (key: string, action: string, body: Record<string, unknown>, okMsg?: (d: Record<string, unknown>) => string | null) => {
    setBusy(key);
    try {
      const d = await api(action, body);
      const msg = okMsg?.(d);
      if (msg) alert(msg);
      await load();
      return d;
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Алдаа');
      return null;
    } finally {
      setBusy(null);
    }
  };

  const review = txns.filter(t => t.reconciliation_status === 'needs_review');
  const today = new Date(loadedAt).toISOString().slice(0, 10);
  const todayApplied = txns.filter(t => t.payment_id && t.transaction_date === today);
  const online = devices.filter(d => d.status === 'active' && d.last_seen_at && loadedAt - new Date(d.last_seen_at).getTime() < 30 * 60_000);
  const eventsReview = events.filter(e => e.processing_status === 'needs_review' || e.processing_status === 'failed');

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold">📲 Банкны SMS гүйлгээ</h1>
        <button onClick={load} className="px-4 py-2 bg-gray-100 rounded-lg text-sm font-medium hover:bg-gray-200">↻ Шинэчлэх</button>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Дансны орлогын SMS утаснаас автоматаар ирж, тоотоор нь айлтай холбогдоно. Эргэлзээтэй гүйлгээг энд шалгаж баталгаажуулна.
      </p>

      {loadError && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6 text-sm">{loadError}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm text-amber-700">Шалгах гүйлгээ</p>
          <p className="text-2xl font-bold text-amber-800">{review.length}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-sm text-green-600">Өнөөдөр бүртгэгдсэн</p>
          <p className="text-2xl font-bold text-green-700">{mnt(todayApplied.reduce((s, t) => s + Number(t.amount_mnt), 0))}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-600">Танигдаагүй SMS</p>
          <p className="text-2xl font-bold text-red-700">{eventsReview.length}</p>
        </div>
        <div className={`${online.length ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'} border rounded-xl p-4`}>
          <p className="text-sm text-blue-600">Дамжуулагч утас</p>
          <p className="text-2xl font-bold text-blue-700">{online.length} / {devices.filter(d => d.status === 'active').length} холбогдсон</p>
        </div>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1">
        {[
          { key: 'txns' as const, label: `💳 Гүйлгээ${review.length ? ` (${review.length})` : ''}` },
          { key: 'events' as const, label: `✉️ SMS лог${eventsReview.length ? ` (${eventsReview.length})` : ''}` },
          { key: 'devices' as const, label: '📱 Дамжуулагч утас' },
          { key: 'mappings' as const, label: '🏠 Тоот таних дүрэм' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition ${tab === t.key ? 'bg-white shadow' : 'text-gray-500'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? <p className="text-gray-400">Ачаалж байна...</p> : (
        <>
          {tab === 'txns' && (
            <TxnList txns={filter === 'review' ? review : txns} residents={residents} sokhId={sokhId} busy={busy} run={run}
              filter={filter} setFilter={setFilter} />
          )}
          {tab === 'events' && <EventList events={events} busy={busy} run={run} />}
          {tab === 'devices' && <DeviceList devices={devices} busy={busy} run={run} now={loadedAt} />}
          {tab === 'mappings' && <MappingList mappings={mappings} busy={busy} run={run} />}
        </>
      )}
    </div>
  );
}

type Run = (key: string, action: string, body: Record<string, unknown>, okMsg?: (d: Record<string, unknown>) => string | null) => Promise<Record<string, unknown> | null>;

// ── Гүйлгээ ──────────────────────────────────────────────────

function TxnList({ txns, residents, sokhId, busy, run, filter, setFilter }: {
  txns: Txn[]; residents: Resident[]; sokhId: number | null; busy: string | null; run: Run;
  filter: 'review' | 'all'; setFilter: (f: 'review' | 'all') => void;
}) {
  const [openId, setOpenId] = useState<number | null>(null);
  return (
    <div>
      <div className="flex gap-2 mb-3">
        {(['review', 'all'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
            {f === 'review' ? 'Шалгах шаардлагатай' : 'Бүгд (сүүлийн 300)'}
          </button>
        ))}
      </div>
      {txns.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center text-gray-400 text-sm">
          {filter === 'review' ? '✓ Шалгах гүйлгээ алга' : 'Гүйлгээ бүртгэгдээгүй байна'}
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>
                <th className="text-left px-3 py-2">Огноо</th>
                <th className="text-right px-3 py-2">Дүн</th>
                <th className="text-left px-3 py-2">Гүйлгээний утга</th>
                <th className="text-left px-3 py-2">Тоот / Айл</th>
                <th className="text-left px-3 py-2">Төлөв</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {txns.map(t => {
                const badge = txnBadge(t);
                const open = openId === t.id;
                return (
                  <tr key={t.id} className="align-top">
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div>{t.transaction_date}</div>
                      <div className="text-xs text-gray-400">{t.payment_channel?.toUpperCase() || 'Банк'} {t.transaction_reference || ''}</div>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold whitespace-nowrap">{mnt(t.amount_mnt)}</td>
                    <td className="px-3 py-3">
                      <div className="font-medium">{t.payer_reference || '—'}</div>
                      <div className="text-xs text-gray-400 break-all">{t.transaction_description}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div>{unit(t.building_number, t.entrance_number, t.apartment_number)}</div>
                      {sokhId != null && t.building_number && officialUnitLabel(sokhId, `${t.building_number}-${t.entrance_number}`, t.apartment_number) && (
                        <div className="text-xs text-gray-500">Албан ёсоор: {officialUnitLabel(sokhId, `${t.building_number}-${t.entrance_number}`, t.apartment_number)}</div>
                      )}
                      <div className="text-xs text-gray-500">{t.resident ? `${t.resident.name} (${t.resident.building}-${t.resident.apartment})` : ''}</div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>{badge.label}</span>
                      {t.reconciliation_status === 'needs_review' && t.review_reason && (
                        <div className="text-xs text-gray-500 mt-1">{REASON[t.review_reason] || t.review_reason}</div>
                      )}
                      {t.review_note && <div className="text-xs text-gray-400 mt-1">📝 {t.review_note}</div>}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-right">
                      {t.reconciliation_status === 'needs_review' && (
                        <div className="flex flex-col gap-1 items-end">
                          <button onClick={() => setOpenId(open ? null : t.id)}
                            className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium">
                            {open ? 'Хаах' : '✓ Баталгаажуулах'}
                          </button>
                          <button disabled={busy === `rm${t.id}`}
                            onClick={() => run(`rm${t.id}`, 'txn.rematch', { id: t.id })}
                            className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs disabled:opacity-50">
                            ↻ Дахин тааруулах
                          </button>
                          <button disabled={busy === `ig${t.id}`}
                            onClick={() => {
                              const note = prompt('Хасах шалтгаан (жишээ: СӨХ-ийн хураамж биш, буцаан олгосон)');
                              if (note) run(`ig${t.id}`, 'txn.ignore', { id: t.id, note });
                            }}
                            className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs disabled:opacity-50">
                            Хасах
                          </button>
                        </div>
                      )}
                      {t.reconciliation_status === 'ignored' && (
                        <button disabled={busy === `ro${t.id}`}
                          onClick={() => run(`ro${t.id}`, 'txn.reopen', { id: t.id })}
                          className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs disabled:opacity-50">
                          Сэргээх
                        </button>
                      )}
                      {open && <ConfirmPanel t={t} residents={residents} busy={busy} run={run} onDone={() => setOpenId(null)} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ConfirmPanel({ t, residents, busy, run, onDone }: {
  t: Txn; residents: Resident[]; busy: string | null; run: Run; onDone: () => void;
}) {
  const [residentId, setResidentId] = useState<string>(t.resident_id ? String(t.resident_id) : '');
  const [invoiceId, setInvoiceId] = useState<string>(t.suggested_invoice_id ? String(t.suggested_invoice_id) : '');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!residentId) return;
    adminFrom('invoices').select('id,year,month,amount,total_amount,paid_amount,status')
      .eq('resident_id', Number(residentId)).in('status', ['pending', 'overdue', 'partial'])
      .order('year').order('month')
      .then(({ data }) => setInvoices((data as Invoice[]) || []));
  }, [residentId]);

  const shown = q
    ? residents.filter(r => `${r.building}-${r.apartment} ${r.name}`.toLowerCase().includes(q.toLowerCase()))
    : residents;
  const chosen = residents.find(r => String(r.id) === residentId);

  const submit = async () => {
    if (!chosen) return;
    if (!confirm(
      `${chosen.name} (${chosen.building}-${chosen.apartment}) — ${mnt(t.amount_mnt)}\n\n` +
      `Баталгаажуулбал төлбөр бүртгэгдэж, өрөөс хасагдана. Үргэлжлүүлэх үү?`
    )) return;
    const d = await run(`cf${t.id}`, 'txn.confirm', {
      id: t.id, residentId: chosen.id, invoiceId: invoiceId ? Number(invoiceId) : null,
    });
    if (d) onDone();
  };

  return (
    <div className="mt-2 p-3 bg-gray-50 border rounded-lg text-left space-y-2 w-80 ml-auto whitespace-normal">
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Тоот эсвэл нэрээр хайх"
        className="w-full px-2 py-1.5 border rounded text-xs" />
      <select value={residentId} onChange={e => { setResidentId(e.target.value); setInvoiceId(''); }}
        className="w-full px-2 py-1.5 border rounded text-xs">
        <option value="">— Айл сонгох —</option>
        {shown.slice(0, 300).map(r => (
          <option key={r.id} value={r.id}>{r.building}-{r.apartment} · {r.name}{r.debt > 0 ? ` · өр ${mnt(r.debt)}` : ''}</option>
        ))}
      </select>
      <select value={invoiceId} onChange={e => setInvoiceId(e.target.value)} disabled={!residentId}
        className="w-full px-2 py-1.5 border rounded text-xs">
        <option value="">Нэхэмжлэхгүй (зөвхөн өрөөс хасна)</option>
        {(residentId ? invoices : []).map(i => {
          const total = i.total_amount ?? i.amount;
          return <option key={i.id} value={i.id}>{i.year}/{i.month} · үлдэгдэл {mnt(Number(total) - Number(i.paid_amount || 0))}</option>;
        })}
      </select>
      <button onClick={submit} disabled={!chosen || busy === `cf${t.id}`}
        className="w-full py-2 bg-green-600 text-white rounded-lg text-xs font-medium disabled:opacity-50">
        {busy === `cf${t.id}` ? '...' : `${mnt(t.amount_mnt)} бүртгэх`}
      </button>
    </div>
  );
}

// ── SMS лог ──────────────────────────────────────────────────

function EventList({ events, busy, run }: { events: SmsEvent[]; busy: string | null; run: Run }) {
  const [openId, setOpenId] = useState<number | null>(null);
  if (events.length === 0) {
    return <div className="bg-white rounded-xl border p-8 text-center text-gray-400 text-sm">SMS ирээгүй байна</div>;
  }
  return (
    <div className="bg-white rounded-xl border divide-y">
      {events.map(e => {
        const bad = e.processing_status === 'needs_review' || e.processing_status === 'failed';
        return (
          <div key={e.id} className="p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mr-2 ${bad ? 'bg-red-100 text-red-700' : e.processing_status === 'duplicate' ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'}`}>
                    {EVENT_LABEL[e.processing_status] || e.processing_status}
                  </span>
                  {when(e.server_received_at)} · {e.sender}
                  {e.retry_count > 0 && <span className="text-xs text-gray-400"> · утас {e.retry_count} удаа дахин илгээсэн</span>}
                </p>
                {e.processing_error && <p className="text-xs text-red-600 mt-1">{REASON[e.processing_error] || e.processing_error}</p>}
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => setOpenId(openId === e.id ? null : e.id)}
                  className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs">
                  {openId === e.id ? 'Нуух' : 'Текст'}
                </button>
                {bad && e.raw_body && (
                  <button disabled={busy === `ev${e.id}`}
                    onClick={() => run(`ev${e.id}`, 'event.reprocess', { id: e.id },
                      d => `Үр дүн: ${EVENT_LABEL[String(d.status)] || d.status}${d.reason ? ` — ${REASON[String(d.reason)] || d.reason}` : ''}`)}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs disabled:opacity-50">
                    ↻ Дахин боловсруулах
                  </button>
                )}
              </div>
            </div>
            {openId === e.id && (
              <pre className="mt-2 p-2 bg-gray-50 rounded text-xs whitespace-pre-wrap break-all">
                {e.raw_body ?? `Эх текст хадгалах хугацаа дууссан (${when(e.raw_purged_at)})`}
              </pre>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Дамжуулагч утас ──────────────────────────────────────────

function DeviceList({ devices, busy, run, now }: { devices: Device[]; busy: string | null; run: Run; now: number }) {
  const [name, setName] = useState('');
  const [senders, setSenders] = useState('');
  const [mask, setMask] = useState('');
  const [token, setToken] = useState<string | null>(null);

  const parseSenders = (s: string) => s.split(/[,\s]+/).map(x => x.trim()).filter(Boolean);

  const create = async () => {
    const d = await run('dev-new', 'device.create', { displayName: name, allowedSenders: parseSenders(senders), accountMask: mask });
    if (d?.token) { setToken(String(d.token)); setName(''); setSenders(''); setMask(''); }
  };

  return (
    <div className="space-y-4">
      {token && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4">
          <p className="font-semibold text-amber-900 mb-1">🔑 Төхөөрөмжийн токен — ЗӨВХӨН ОДОО харагдана</p>
          <p className="text-xs text-amber-800 mb-2">
            Утсан дээрх «Хотол SMS дамжуулагч» аппын «Токен» талбарт хуулж оруулна. Хуудсыг хаасны дараа дахин харах боломжгүй
            (алдвал «Токен шинэчлэх» дарна). Хэнд ч бүү илгээ.
          </p>
          <div className="flex gap-2">
            <code className="flex-1 bg-white border rounded px-2 py-1.5 text-xs break-all select-all">{token}</code>
            <button onClick={() => navigator.clipboard?.writeText(token)} className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs">Хуулах</button>
            <button onClick={() => setToken(null)} className="px-3 py-1.5 bg-white border rounded-lg text-xs">Хадгалсан</button>
          </div>
        </div>
      )}

      {devices.map(d => <DeviceCard key={d.id} d={d} now={now} busy={busy} run={run} onToken={setToken} parseSenders={parseSenders} />)}

      <div className="bg-white rounded-xl border p-4">
        <h3 className="font-semibold text-sm text-gray-500 mb-3">ШИНЭ ДАМЖУУЛАГЧ УТАС</h3>
        <div className="grid md:grid-cols-3 gap-3 mb-3">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Нэр (жишээ: Samsung — ХасБанк)" className="px-3 py-2 border rounded-lg text-sm" />
          <input value={senders} onChange={e => setSenders(e.target.value)} placeholder="Банкны SMS илгээгч (жишээ: 131888)" className="px-3 py-2 border rounded-lg text-sm" />
          <input value={mask} onChange={e => setMask(e.target.value)} placeholder="SMS дээрх дансны маск (жишээ: 5006***029)" className="px-3 py-2 border rounded-lg text-sm" />
        </div>
        <button onClick={create} disabled={!name.trim() || busy === 'dev-new'}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
          + Төхөөрөмж бүртгэж токен авах
        </button>
        <p className="text-xs text-gray-400 mt-2">
          Автомат бүртгэл анхдагчаар унтраалттай. Бодит SMS ирж зөв танигдаж байгааг шалгасны дараа асаана.
        </p>
      </div>
    </div>
  );
}

function DeviceCard({ d, now, busy, run, onToken, parseSenders }: {
  d: Device; now: number; busy: string | null; run: Run; onToken: (t: string) => void; parseSenders: (s: string) => string[];
}) {
  const [senders, setSenders] = useState((d.allowed_senders || []).join(', '));
  const [mask, setMask] = useState(d.account_mask || '');
  const seen = d.last_seen_at ? now - new Date(d.last_seen_at).getTime() : Infinity;
  const state = d.status === 'revoked'
    ? { label: 'Цуцлагдсан', cls: 'bg-gray-100 text-gray-500' }
    : seen < 30 * 60_000 ? { label: '● Холбогдсон', cls: 'bg-green-100 text-green-700' }
      : seen < 24 * 3600_000 ? { label: '● Сүүлд холбогдсон', cls: 'bg-amber-100 text-amber-800' }
        : { label: '● Холбогдоогүй', cls: 'bg-red-100 text-red-700' };

  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="font-semibold">{d.display_name} <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${state.cls}`}>{state.label}</span></p>
          <p className="text-xs text-gray-400">Токен: {d.token_prefix}… {d.last_status?.appVersion ? `· апп ${d.last_status.appVersion}` : ''}</p>
        </div>
        <div className="flex gap-2">
          <button disabled={busy === `rot${d.id}`}
            onClick={async () => {
              if (!confirm('Шинэ токен үүсгэвэл хуучин токен ажиллахаа болино. Үргэлжлүүлэх үү?')) return;
              const r = await run(`rot${d.id}`, 'device.rotate', { id: d.id });
              if (r?.token) onToken(String(r.token));
            }}
            className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs disabled:opacity-50">Токен шинэчлэх</button>
          {d.status === 'active' && (
            <button disabled={busy === `rev${d.id}`}
              onClick={() => confirm('Энэ утаснаас SMS хүлээж авахаа зогсоох уу?') && run(`rev${d.id}`, 'device.revoke', { id: d.id })}
              className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs disabled:opacity-50">Цуцлах</button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-3">
        <div><p className="text-gray-400">Сүүлд холбогдсон</p><p>{when(d.last_seen_at)}</p></div>
        <div><p className="text-gray-400">Сүүлийн SMS</p><p>{when(d.last_sms_received_at)}</p></div>
        <div><p className="text-gray-400">Сүүлийн амжилттай дамжуулалт</p><p>{when(d.last_successful_delivery_at)}</p></div>
        <div><p className="text-gray-400">Утсанд хүлээгдэж буй</p><p>{d.last_status?.pending ?? '—'}{d.last_status?.failed ? ` · алдаатай ${d.last_status.failed}` : ''}</p></div>
      </div>
      {d.last_error && (
        <p className="text-xs text-red-600 mb-3">Сүүлийн алдаа ({when(d.last_error_at)}): {d.last_error}</p>
      )}
      <div className="grid md:grid-cols-3 gap-3 items-end">
        <label className="text-xs text-gray-500">Илгээгч
          <input value={senders} onChange={e => setSenders(e.target.value)} className="mt-1 w-full px-3 py-2 border rounded-lg text-sm" />
        </label>
        <label className="text-xs text-gray-500">Дансны маск
          <input value={mask} onChange={e => setMask(e.target.value)} className="mt-1 w-full px-3 py-2 border rounded-lg text-sm" />
        </label>
        <button disabled={busy === `upd${d.id}`}
          onClick={() => run(`upd${d.id}`, 'device.update', { id: d.id, allowedSenders: parseSenders(senders), accountMask: mask }, () => 'Хадгаллаа')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">Хадгалах</button>
      </div>
      <label className="flex items-center gap-2 mt-3 text-sm">
        <input type="checkbox" checked={d.auto_apply} disabled={busy === `aa${d.id}`}
          onChange={e => {
            const on = e.target.checked;
            if (on && !confirm(
              'Автомат бүртгэл: тоот, айл, нэхэмжлэхийн дүн ЯГ таарсан гүйлгээг дарга шалгахгүйгээр төлбөр болгоно.\n\n' +
              'Бодит SMS-ээр шалгаж дууссан уу?'
            )) return;
            run(`aa${d.id}`, 'device.update', { id: d.id, autoApply: on });
          }} />
        Бүх нөхцөл таарвал төлбөрийг автоматаар бүртгэх
      </label>
    </div>
  );
}

// ── Тоот таних дүрэм ─────────────────────────────────────────

function MappingList({ mappings, busy, run }: { mappings: Mapping[]; busy: string | null; run: Run }) {
  const empty = { id: 0, sourcePattern: '', building: '', entrance: '', apartment: '', note: '' };
  const [form, setForm] = useState(empty);

  const save = async () => {
    const action = form.id ? 'mapping.update' : 'mapping.create';
    const d = await run('map-save', action, { ...form, id: form.id || undefined },
      r => (Number(r.rematched) > 0 ? `Хадгаллаа. ${r.rematched} гүйлгээг дахин тааруулав.` : null));
    if (d) setForm(empty);
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-900">
        Гүйлгээний утгыг (жишээ: «613тоот», «203 R BAIR 403 TOOT») байр-орц-тоот руу холбоно. Том/жижиг үсэг, зай, кирилл/латин
        ялгахгүй, гэхдээ <b>бүтэн утгаар нь яг таарах</b> ёстой — «403» гэх мэт дан тоотыг бусад байрны айлтай андуурахгүйн тулд
        зөвхөн дугаараар нь тааруулахгүй.
      </div>

      <div className="bg-white rounded-xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs">
            <tr>
              <th className="text-left px-3 py-2">Гүйлгээний утга</th>
              <th className="text-left px-3 py-2">Хэвшүүлсэн</th>
              <th className="text-left px-3 py-2">Байр-орц-тоот</th>
              <th className="text-left px-3 py-2">Тэмдэглэл</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {mappings.map(m => (
              <tr key={m.id} className={m.is_active ? '' : 'opacity-50'}>
                <td className="px-3 py-2 font-medium">{m.source_pattern}</td>
                <td className="px-3 py-2 text-xs font-mono text-gray-500">{m.normalized_pattern}</td>
                <td className="px-3 py-2">{unit(m.building_number, m.entrance_number, m.apartment_number)}</td>
                <td className="px-3 py-2 text-xs text-gray-500">{m.note}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button onClick={() => setForm({
                    id: m.id, sourcePattern: m.source_pattern, building: m.building_number,
                    entrance: m.entrance_number || '', apartment: m.apartment_number, note: m.note || '',
                  })} className="px-3 py-1 bg-gray-100 rounded-lg text-xs mr-1">Засах</button>
                  <button disabled={busy === `ma${m.id}`}
                    onClick={() => run(`ma${m.id}`, 'mapping.setActive', { id: m.id, active: !m.is_active })}
                    className="px-3 py-1 bg-gray-100 rounded-lg text-xs disabled:opacity-50">
                    {m.is_active ? 'Идэвхгүй болгох' : 'Идэвхжүүлэх'}
                  </button>
                </td>
              </tr>
            ))}
            {mappings.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400 text-sm">Дүрэм алга</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-xl border p-4">
        <h3 className="font-semibold text-sm text-gray-500 mb-3">{form.id ? 'ДҮРЭМ ЗАСАХ' : 'ШИНЭ ДҮРЭМ'}</h3>
        <div className="grid md:grid-cols-5 gap-3 mb-3">
          <input value={form.sourcePattern} onChange={e => setForm({ ...form, sourcePattern: e.target.value })}
            placeholder="Гүйлгээний утга (613тоот)" className="md:col-span-2 px-3 py-2 border rounded-lg text-sm" />
          <input value={form.building} onChange={e => setForm({ ...form, building: e.target.value })} placeholder="Байр" className="px-3 py-2 border rounded-lg text-sm" />
          <input value={form.entrance} onChange={e => setForm({ ...form, entrance: e.target.value })} placeholder="Орц" className="px-3 py-2 border rounded-lg text-sm" />
          <input value={form.apartment} onChange={e => setForm({ ...form, apartment: e.target.value })} placeholder="Тоот" className="px-3 py-2 border rounded-lg text-sm" />
        </div>
        <input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="Тэмдэглэл (заавал биш)"
          className="w-full px-3 py-2 border rounded-lg text-sm mb-3" />
        <div className="flex gap-2">
          <button onClick={save} disabled={!form.sourcePattern || !form.building || !form.apartment || busy === 'map-save'}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
            {form.id ? 'Хадгалах' : '+ Нэмэх'}
          </button>
          {form.id > 0 && <button onClick={() => setForm(empty)} className="px-4 py-2 bg-gray-100 rounded-lg text-sm">Болих</button>}
        </div>
      </div>
    </div>
  );
}
