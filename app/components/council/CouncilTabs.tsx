'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import BoardReportFiles, { type ReportFile } from '@/app/components/BoardReportFiles';

// Апп дахь «🏛 Зөвлөл» хэсгийн табууд. Бүх өгөгдлийг /api/council (эсвэл
// /api/board-reports) серверээр эрх шалгуулж авна — клиентээс шууд хүснэгт уншихгүй.

export async function councilFetch(path: string, init?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = { ...(init?.headers as Record<string, string> || {}) };
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  if (init?.body) headers['Content-Type'] = 'application/json';
  const res = await fetch(path, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

const money = (n: number) => `${Math.round(Number(n) || 0).toLocaleString()}₮`;
const fmtDate = (s: string) => new Date(s).toLocaleDateString('mn-MN');

function Empty({ text }: { text: string }) {
  return <div className="bg-white rounded-xl border p-6 text-center text-sm text-gray-400">{text}</div>;
}

// ===================== Тайлан =====================
interface Report { id: number; title: string; body: string | null; created_at: string; read: boolean; files: ReportFile[] }

export function ReportsTab({ sokhId, onRead }: { sokhId: number; onRead?: () => void }) {
  const [reports, setReports] = useState<Report[] | null>(null);
  useEffect(() => {
    (async () => {
      const { ok, data } = await councilFetch(`/api/board-reports?sokhId=${sokhId}`);
      const list: Report[] = ok ? data.reports || [] : [];
      setReports(list);
      const unread = list.filter((r) => !r.read).map((r) => r.id);
      if (unread.length > 0) {
        await councilFetch('/api/board-reports', { method: 'POST', body: JSON.stringify({ sokhId, reportIds: unread }) });
        onRead?.();
      }
    })();
  }, [sokhId, onRead]);

  if (!reports) return <p className="text-center text-gray-400 py-8 text-sm">Ачаалж байна...</p>;
  if (reports.length === 0) return <Empty text="Даргаас тайлан ирээгүй байна." />;
  return (
    <div className="space-y-3">
      {reports.map((r) => (
        <div key={r.id} className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 flex-1">{r.title}</h3>
            {!r.read && <span className="text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full">ШИНЭ</span>}
          </div>
          <p className="text-xs text-gray-400">{new Date(r.created_at).toLocaleString('mn-MN')}</p>
          {r.body && <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{r.body}</p>}
          {r.files.length > 0 && <BoardReportFiles files={r.files} />}
        </div>
      ))}
      <p className="text-[11px] text-gray-400 text-center">Хавсралтын линк 1 цаг хүчинтэй.</p>
    </div>
  );
}

// ===================== Санал =====================
interface Tally { approve: number; disapprove: number; abstain: number; voted: number; total: number }
interface Proposal {
  id: number; title: string; description: string | null; budget_amount: number | null; status: string;
  pass_threshold_percentage: number; expires_at: string; tally: Tally; invited: boolean; my_vote: string | null;
  protocol_url: string;
}
const STATUS: Record<string, { label: string; cls: string }> = {
  active: { label: 'Явагдаж байна', cls: 'bg-blue-100 text-blue-700' },
  passed: { label: 'Батлагдсан', cls: 'bg-green-100 text-green-700' },
  rejected: { label: 'Татгалзсан', cls: 'bg-red-100 text-red-700' },
  expired: { label: 'Хугацаа дууссан', cls: 'bg-gray-100 text-gray-600' },
  cancelled: { label: 'Цуцлагдсан', cls: 'bg-gray-100 text-gray-600' },
};
const VOTE_LABEL: Record<string, string> = { approve: '✅ Зөвшөөрсөн', disapprove: '❌ Татгалзсан', abstain: '➖ Түдгэлзсэн' };
const VOTE_BTN: Record<string, string> = { approve: '✅ Зөвшөөрөх', disapprove: '❌ Татгалзах', abstain: '➖ Түдгэлзэх' };

export function ProposalsTab({ sokhId, canAct, onVoted }: { sokhId: number; canAct: boolean; onVoted?: () => void }) {
  const [list, setList] = useState<Proposal[] | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [comment, setComment] = useState<Record<number, string>>({});
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { ok, data } = await councilFetch(`/api/council?sokhId=${sokhId}&view=proposals`);
    setList(ok ? data.proposals || [] : []);
  }, [sokhId]);
  useEffect(() => {
    const run = async () => { await load(); };
    run();
  }, [load]);

  const vote = async (p: Proposal, voteValue: string) => {
    if (!window.confirm(`«${p.title}» асуудалд «${VOTE_BTN[voteValue]}» гэж санал өгөх үү? Дараа нь өөрчлөх боломжгүй.`)) return;
    setBusyId(p.id);
    setError('');
    const { ok, data } = await councilFetch('/api/council', {
      method: 'POST',
      body: JSON.stringify({ sokhId, action: 'vote', proposalId: p.id, voteValue, comment: comment[p.id] || '' }),
    });
    if (!ok) setError(data.error || 'Санал бүртгэхэд алдаа');
    await load();
    onVoted?.();
    setBusyId(null);
  };

  if (!list) return <p className="text-center text-gray-400 py-8 text-sm">Ачаалж байна...</p>;
  if (list.length === 0) return <Empty text="Санал хураалт алга." />;
  return (
    <div className="space-y-3">
      {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-xl">{error}</div>}
      {list.map((p) => {
        const st = STATUS[p.status] || STATUS.expired;
        const pct = (n: number) => (p.tally.total ? Math.round((n / p.tally.total) * 100) : 0);
        const canVote = canAct && p.status === 'active' && p.invited && !p.my_vote;
        return (
          <div key={p.id} className="bg-white rounded-xl border p-4">
            <div className="flex items-start gap-2">
              <h3 className="font-semibold text-gray-900 flex-1">{p.title}</h3>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded whitespace-nowrap ${st.cls}`}>{st.label}</span>
            </div>
            <p className="text-xs text-gray-400">
              {p.budget_amount != null ? `Төсөв: ${money(p.budget_amount)} · ` : ''}Дуусах: {fmtDate(p.expires_at)} · Босго {p.pass_threshold_percentage}%
            </p>
            {p.description && <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{p.description}</p>}

            <div className="mt-3 text-xs text-gray-500">
              {p.tally.voted}/{p.tally.total} санал · ✅ {p.tally.approve} ({pct(p.tally.approve)}%) · ❌ {p.tally.disapprove} · ➖ {p.tally.abstain}
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden mt-1">
                <div className="h-full bg-green-500" style={{ width: `${pct(p.tally.approve)}%` }} />
              </div>
            </div>

            {p.my_vote && <p className="mt-2 text-sm font-medium text-gray-700">Таны санал: {VOTE_LABEL[p.my_vote]}</p>}
            {canVote && (
              <div className="mt-3 space-y-2">
                <textarea
                  rows={2}
                  value={comment[p.id] || ''}
                  onChange={(e) => setComment((c) => ({ ...c, [p.id]: e.target.value }))}
                  placeholder="Сэтгэгдэл (заавал биш)"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                />
                <div className="grid grid-cols-3 gap-2">
                  {(['approve', 'disapprove', 'abstain'] as const).map((v) => (
                    <button
                      key={v}
                      disabled={busyId === p.id}
                      onClick={() => vote(p, v)}
                      className={`py-2 rounded-xl text-xs font-semibold border disabled:opacity-50 ${
                        v === 'approve' ? 'border-green-300 text-green-700 bg-green-50'
                        : v === 'disapprove' ? 'border-red-300 text-red-700 bg-red-50'
                        : 'border-gray-300 text-gray-600 bg-gray-50'}`}
                    >
                      {VOTE_BTN[v]}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {p.status === 'active' && !p.my_vote && !p.invited && canAct && (
              <p className="mt-2 text-xs text-gray-400">Энэ саналд таныг санал өгөгчөөр оруулаагүй байна.</p>
            )}
            {!canAct && p.status === 'active' && (
              <p className="mt-2 text-xs text-purple-600">Хяналтын зөвлөл — зөвхөн хянаж харна.</p>
            )}
            <a href={p.protocol_url} target="_blank" rel="noopener noreferrer" className="inline-block mt-3 text-xs text-blue-600 font-medium">
              Протокол харах →
            </a>
          </div>
        );
      })}
    </div>
  );
}

// ===================== Санхүү =====================
interface BudgetRow { id: number; category: string; name: string | null; description: string | null; amount: number }
interface Payable { id: number; vendor: string; category: string; amount: number; paid_amount: number; due_date: string | null; status: string; description: string | null }
interface Finance {
  year: number; month: number;
  invoices: { count: number; paid_count: number; billed: number; collected: number };
  debt: { debtors: number; total: number };
  income: BudgetRow[]; expense: BudgetRow[]; payables: Payable[];
  reserve: { balance: number; recent: { type: string; amount: number; description: string | null; occurred_at: string }[] };
}

export function FinanceTab({ sokhId }: { sokhId: number }) {
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 });
  const [f, setF] = useState<Finance | null>(null);

  useEffect(() => {
    (async () => {
      setF(null);
      const { ok, data } = await councilFetch(`/api/council?sokhId=${sokhId}&view=finance&year=${ym.y}&month=${ym.m}`);
      if (ok) setF(data as Finance);
    })();
  }, [sokhId, ym]);

  const shift = (d: number) => setYm(({ y, m }) => {
    const t = y * 12 + (m - 1) + d;
    return { y: Math.floor(t / 12), m: (t % 12) + 1 };
  });

  const sum = (rows: BudgetRow[]) => rows.reduce((s, r) => s + Number(r.amount || 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between bg-white rounded-xl border px-3 py-2">
        <button onClick={() => shift(-1)} className="px-3 text-gray-500">‹</button>
        <span className="text-sm font-semibold">{ym.y} оны {ym.m}-р сар</span>
        <button onClick={() => shift(1)} className="px-3 text-gray-500">›</button>
      </div>
      {!f ? (
        <p className="text-center text-gray-400 py-8 text-sm">Ачаалж байна...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Нэхэмжилсэн" value={money(f.invoices.billed)} sub={`${f.invoices.count} нэхэмжлэх`} />
            <Stat label="Цугларсан" value={money(f.invoices.collected)}
              sub={`${f.invoices.paid_count}/${f.invoices.count} төлсөн · ${f.invoices.billed ? Math.round((f.invoices.collected / f.invoices.billed) * 100) : 0}%`} />
            <Stat label="Нийт авлага (өр)" value={money(f.debt.total)} sub={`${f.debt.debtors} айл`} tone="red" />
            <Stat label="Нөөц сангийн үлдэгдэл" value={money(f.reserve.balance)} tone="indigo" />
          </div>

          <Section title={`Орлого · ${money(sum(f.income))}`}>
            {f.income.length === 0 ? <Muted text="Бүртгэл алга" /> : f.income.map((r) => <Line key={r.id} left={r.name || r.category} right={money(r.amount)} sub={r.description} />)}
          </Section>
          <Section title={`Зарлага · ${money(sum(f.expense))}`}>
            {f.expense.length === 0 ? <Muted text="Бүртгэл алга" /> : f.expense.map((r) => <Line key={r.id} left={r.name || r.category} right={money(r.amount)} sub={r.description} />)}
          </Section>
          <Section title={`Төлөгдөөгүй өглөг · ${f.payables.length}`}>
            {f.payables.length === 0 ? <Muted text="Өглөг алга" /> : f.payables.map((p) => (
              <Line key={p.id} left={p.vendor} right={money(Number(p.amount) - Number(p.paid_amount || 0))}
                sub={`${p.description || p.category}${p.due_date ? ` · хугацаа ${fmtDate(p.due_date)}` : ''}`} />
            ))}
          </Section>
          {f.reserve.recent.length > 0 && (
            <Section title="Нөөц сангийн сүүлийн гүйлгээ">
              {f.reserve.recent.map((r, i) => (
                <Line key={i} left={r.description || (r.type === 'withdrawal' ? 'Зарлага' : 'Орлого')}
                  right={`${r.type === 'withdrawal' ? '−' : '+'}${money(r.amount)}`} sub={fmtDate(r.occurred_at)} />
              ))}
            </Section>
          )}
          <p className="text-[11px] text-gray-400 text-center">Айл тус бүрийн өрийг нууцлалын үүднээс нийлбэрээр харуулав.</p>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'red' | 'indigo' }) {
  const c = tone === 'red' ? 'text-red-600' : tone === 'indigo' ? 'text-indigo-600' : 'text-gray-900';
  return (
    <div className="bg-white rounded-xl border p-3">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className={`text-base font-bold ${c}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border p-3">
      <p className="text-sm font-semibold text-gray-700 mb-2">{title}</p>
      <div className="divide-y divide-gray-50">{children}</div>
    </div>
  );
}
function Line({ left, right, sub }: { left: string; right: string; sub?: string | null }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 text-sm">
      <div className="min-w-0">
        <p className="text-gray-800 truncate">{left}</p>
        {sub && <p className="text-[11px] text-gray-400 truncate">{sub}</p>}
      </div>
      <span className="font-medium text-gray-700 whitespace-nowrap">{right}</span>
    </div>
  );
}
function Muted({ text }: { text: string }) {
  return <p className="text-xs text-gray-300 py-1">{text}</p>;
}

// ===================== Гомдол / засвар =====================
interface Complaint { id: number; category: string; title: string; description: string | null; status: string; admin_reply: string | null; created_at: string }
interface Maint { id: number; title: string; description: string | null; status: string; created_at: string }

const ISSUE_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Хүлээгдэж буй', cls: 'bg-yellow-100 text-yellow-700' },
  in_progress: { label: 'Хийгдэж байна', cls: 'bg-blue-100 text-blue-700' },
  resolved: { label: 'Шийдвэрлэсэн', cls: 'bg-green-100 text-green-700' },
  completed: { label: 'Дууссан', cls: 'bg-green-100 text-green-700' },
  done: { label: 'Дууссан', cls: 'bg-green-100 text-green-700' },
  rejected: { label: 'Татгалзсан', cls: 'bg-red-100 text-red-700' },
};
const CAT: Record<string, string> = { complaint: '😤 Гомдол', suggestion: '💡 Санал', question: '❓ Асуулт' };

export function IssuesTab({ sokhId }: { sokhId: number }) {
  const [data, setData] = useState<{ complaints: Complaint[]; maintenance: Maint[] } | null>(null);
  const [kind, setKind] = useState<'complaints' | 'maintenance'>('complaints');
  const [openOnly, setOpenOnly] = useState(true);

  useEffect(() => {
    (async () => {
      const { ok, data: d } = await councilFetch(`/api/council?sokhId=${sokhId}&view=issues`);
      setData(ok ? d : { complaints: [], maintenance: [] });
    })();
  }, [sokhId]);

  if (!data) return <p className="text-center text-gray-400 py-8 text-sm">Ачаалж байна...</p>;
  const isOpen = (s: string) => s === 'pending' || s === 'in_progress';
  const rows = (kind === 'complaints' ? data.complaints : data.maintenance).filter((r) => !openOnly || isOpen(r.status));
  const openCount = (list: { status: string }[]) => list.filter((r) => isOpen(r.status)).length;

  return (
    <div className="space-y-3">
      <div className="flex gap-1 bg-white rounded-xl border p-1">
        {(['complaints', 'maintenance'] as const).map((k) => (
          <button key={k} onClick={() => setKind(k)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold ${kind === k ? 'bg-slate-800 text-white' : 'text-gray-500'}`}>
            {k === 'complaints' ? `Гомдол / санал (${openCount(data.complaints)})` : `Засвар (${openCount(data.maintenance)})`}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-xs text-gray-500 px-1">
        <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} />
        Зөвхөн шийдэгдээгүй
      </label>
      {rows.length === 0 ? <Empty text="Жагсаалт хоосон." /> : rows.map((r) => {
        const st = ISSUE_STATUS[r.status] || { label: r.status, cls: 'bg-gray-100 text-gray-600' };
        const c = r as Complaint;
        return (
          <div key={r.id} className="bg-white rounded-xl border p-3">
            <div className="flex items-start gap-2">
              <p className="font-medium text-sm text-gray-900 flex-1">{r.title}</p>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded whitespace-nowrap ${st.cls}`}>{st.label}</span>
            </div>
            <p className="text-[11px] text-gray-400">
              {kind === 'complaints' && c.category ? `${CAT[c.category] || c.category} · ` : ''}{fmtDate(r.created_at)}
            </p>
            {r.description && <p className="text-xs text-gray-600 mt-1 line-clamp-3">{r.description}</p>}
            {kind === 'complaints' && c.admin_reply && (
              <p className="text-xs text-blue-700 bg-blue-50 rounded-lg px-2 py-1 mt-2">Даргын хариу: {c.admin_reply}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
