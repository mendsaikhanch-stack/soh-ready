'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { adminFrom } from '@/app/lib/admin-db';

interface Proposal {
  id: number;
  title: string;
  description: string | null;
  budget_amount: number | null;
  status: string;
  kind: string;
  result_token: string;
  expires_at: string;
  created_at: string;
}
interface VoterRow {
  phone: string;
  name: string;
}
type Council = 'board' | 'audit';
interface Member {
  id: number;
  council: Council;
  full_name: string;
  phone_number: string;
  position: string | null;
  resident_id?: number | null;
}
// Апп дахь «🏛 Зөвлөл» хэсгийн төлөв
type AppState = 'active' | 'waiting' | 'mismatch' | 'none';
interface InviteRow {
  phone_number: string;
  full_name: string | null;
  council?: Council | null;
  invite_token: string;
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Явагдаж байна',
  passed: 'Батлагдсан',
  rejected: 'Татгалзсан',
  expired: 'Хугацаа дууссан',
  cancelled: 'Цуцлагдсан',
};

const COUNCIL_LABEL: Record<Council, string> = {
  board: 'ТУЗ',
  audit: 'Хяналтын зөвлөл',
};

export default function AdminBoardPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Байнгын гишүүдийн жагсаалт
  const [members, setMembers] = useState<Member[]>([]);
  // Оршин суугчаар бүртгэлтэй (апп-аар тайлан харах боломжтой) гишүүдийн утас
  const [appState, setAppState] = useState<Record<number, AppState>>({});
  const [membersMissing, setMembersMissing] = useState(false);
  const [mCouncil, setMCouncil] = useState<Council>('board');
  const [mName, setMName] = useState('');
  const [mPhone, setMPhone] = useState('');
  const [mPosition, setMPosition] = useState('');
  const [mBusy, setMBusy] = useState(false);
  const [mError, setMError] = useState('');

  // Шинэ санал
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [days, setDays] = useState(3);
  const [threshold, setThreshold] = useState(50);
  const [autoApprove, setAutoApprove] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [voters, setVoters] = useState<VoterRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Урилгын линк харах
  const [openId, setOpenId] = useState<number | null>(null);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [votedPhones, setVotedPhones] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState('');

  const load = useCallback(async () => {
    const { data } = await adminFrom('proposals').select('*').order('created_at', { ascending: false });
    setProposals((data as unknown as Proposal[]) || []);
    setLoading(false);
  }, []);

  const loadMembers = useCallback(async () => {
    const { data, error: err } = await adminFrom('board_members').select('*').order('full_name');
    if (err) {
      setMembersMissing(true);
      return;
    }
    setMembersMissing(false);
    const list = (data as Member[]) || [];
    setMembers(list);
    const rIds = list.map((m) => m.resident_id).filter((x): x is number => !!x);
    const rmap = new Map<number, { phone: string; auth_user_id: string | null }>();
    if (rIds.length > 0) {
      const { data: res } = await adminFrom('residents').select('id, phone, auth_user_id').in('id', rIds);
      for (const r of (res as { id: number; phone: string; auth_user_id: string | null }[]) || []) rmap.set(r.id, r);
    }
    const st: Record<number, AppState> = {};
    for (const m of list) {
      const r = m.resident_id ? rmap.get(m.resident_id) : undefined;
      st[m.id] = !r ? 'none'
        : (r.phone || '').trim() !== m.phone_number ? 'mismatch'
        : r.auth_user_id ? 'active' : 'waiting';
    }
    setAppState(st);
  }, []);

  useEffect(() => {
    const run = async () => { await Promise.all([load(), loadMembers()]); };
    run();
  }, [load, loadMembers]);

  const addMember = async () => {
    setMError('');
    if (!mName.trim()) return setMError('Нэр оруулна уу');
    if (mPhone.length !== 8) return setMError('Утас 8 оронтой байна');
    if (members.some((m) => m.council === mCouncil && m.phone_number === mPhone)) {
      return setMError('Энэ дугаар аль хэдийн бүртгэлтэй');
    }
    setMBusy(true);
    const { error: err } = await adminFrom('board_members').insert({
      council: mCouncil,
      full_name: mName.trim(),
      phone_number: mPhone,
      position: mPosition.trim() || null,
    });
    setMBusy(false);
    if (err) return setMError(err);
    setMName(''); setMPhone(''); setMPosition('');
    loadMembers();
  };

  const removeMember = async (m: Member) => {
    await adminFrom('board_members').delete().eq('id', m.id);
    loadMembers();
  };

  const setVoter = (i: number, key: keyof VoterRow, val: string) => {
    setVoters((prev) => prev.map((v, idx) => (idx === i ? { ...v, [key]: key === 'phone' ? val.replace(/\D/g, '').slice(0, 8) : val } : v)));
  };

  const resetForm = () => {
    setTitle(''); setDescription(''); setBudget(''); setDays(3);
    setThreshold(50); setAutoApprove(false);
    // Анхдагчаар ТУЗ-ийн бүх гишүүнийг сонгоно; Хяналтын зөвлөлийг дарга өөрөө нэмнэ
    setSelected(new Set(members.filter((m) => m.council === 'board').map((m) => m.id)));
    setVoters(members.length === 0 ? [{ phone: '', name: '' }] : []);
    setError('');
  };

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const create = async () => {
    setError('');
    const fromMembers = members
      .filter((m) => selected.has(m.id))
      .map((m) => ({ phone: m.phone_number, name: m.full_name, council: m.council }));
    const manual = voters.filter((v) => v.phone.length === 8).map((v) => ({ phone: v.phone, name: v.name }));
    const all = [...fromMembers, ...manual];
    if (!title.trim()) return setError('Асуудлын гарчиг оруулна уу');
    if (all.length === 0) return setError('Дор хаяж 1 гишүүн сонгоно уу');

    setBusy(true);
    try {
      const res = await fetch('/api/vote/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          budget_amount: budget ? Number(budget.replace(/\D/g, '')) : null,
          expires_in_days: days,
          pass_threshold_percentage: threshold,
          auto_approve_on_timeout: autoApprove,
          voters: all,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowForm(false);
        await load();
        openInvites(data.id);
      } else {
        setError(data.error || 'Үүсгэхэд алдаа гарлаа');
      }
    } catch {
      setError('Сервертэй холбогдож чадсангүй');
    }
    setBusy(false);
  };

  const openInvites = async (proposalId: number) => {
    if (openId === proposalId) { setOpenId(null); return; }
    setOpenId(proposalId);
    setInvites([]);
    const [{ data: vs }, { data: votes }] = await Promise.all([
      adminFrom('proposal_voters').select('*').eq('proposal_id', proposalId).order('full_name'),
      adminFrom('proposal_votes').select('phone_number').eq('proposal_id', proposalId),
    ]);
    setInvites((vs as InviteRow[]) || []);
    setVotedPhones(new Set(((votes as { phone_number: string }[]) || []).map((v) => v.phone_number)));
  };

  const inviteUrl = (proposalId: number, token: string) =>
    `${window.location.origin}/vote/${proposalId}?t=${token}`;

  const inviteText = (p: Proposal, r: InviteRow) =>
    `Сайн байна уу${r.full_name ? `, ${r.full_name}` : ''}. "${p.title}" асуудлаар ТУЗ-ийн санал өгнө үү (${new Date(p.expires_at).toLocaleDateString('mn-MN')} хүртэл): ${inviteUrl(p.id, r.invite_token)}`;

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(''), 1500);
    } catch { /* clipboard хориотой орчин */ }
  };

  const boardMembers = members.filter((m) => m.council === 'board');
  const auditMembers = members.filter((m) => m.council === 'audit');

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">🗳 Цахим ТУЗ</h1>
          <p className="text-sm text-gray-500">ТУЗ болон Хяналтын зөвлөлийн гишүүдээс цахимаар санал хураах</p>
        </div>
        <div className="flex gap-2">
        <Link href="/admin/board/reports" className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">
          📑 Тайлан илгээх
        </Link>
        <Link href="/admin/board/chat" className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">
          💬 Зөвлөлийн чат
        </Link>
        <button
          onClick={() => { setShowForm((s) => !s); resetForm(); }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          {showForm ? 'Болих' : '+ Шинэ санал'}
        </button>
        </div>
      </div>

      {/* ---------- Гишүүдийн жагсаалт ---------- */}
      <div className="bg-white rounded-2xl border p-5 mb-6 max-w-3xl">
        <p className="font-semibold text-gray-900 mb-1">👥 Зөвлөлийн гишүүд</p>
        <p className="text-xs text-gray-400 mb-4">
          Апп-д «🏛 Зөвлөл» хэсэг (тайлан, санал, санхүү, чат) нээх бол <Link href="/admin/residents" className="text-blue-600 underline">Оршин суугчид</Link> хуудаснаас тухайн хүний «Зөвлөл» баганыг сонгоно.
          Энд гараар нэмсэн гишүүд зөвхөн линкээр санал өгнө.
        </p>

        {membersMissing ? (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm p-3 rounded-xl">
            Гишүүдийн хүснэгт үүсээгүй байна — <code>supabase-board-members-migration.sql</code>-ийг ажиллуулна уу.
          </div>
        ) : (
          <>
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <MemberList title="Төлөөлөн удирдах зөвлөл (ТУЗ)" list={boardMembers} state={appState} onRemove={removeMember} />
              <MemberList title="Хяналтын зөвлөл" list={auditMembers} state={appState} onRemove={removeMember} />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <select className={inputCls} value={mCouncil} onChange={(e) => setMCouncil(e.target.value as Council)}>
                <option value="board">ТУЗ</option>
                <option value="audit">Хяналтын зөвлөл</option>
              </select>
              <input className={inputCls} value={mName} onChange={(e) => setMName(e.target.value)} placeholder="Нэр *" />
              <input inputMode="numeric" className={inputCls} value={mPhone} onChange={(e) => setMPhone(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="Утас *" />
              <input className={inputCls} value={mPosition} onChange={(e) => setMPosition(e.target.value)} placeholder="Албан тушаал" />
              <button onClick={addMember} disabled={mBusy} className="bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-50 py-2.5">
                {mBusy ? '...' : '+ Нэмэх'}
              </button>
            </div>
            {mError && <p className="text-sm text-red-600 mt-2">{mError}</p>}
          </>
        )}
      </div>

      {/* ---------- Шинэ санал ---------- */}
      {showForm && (
        <div className="bg-white rounded-2xl border p-5 mb-6 space-y-4 max-w-2xl">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Асуудал *</label>
            <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Жишээ: 2026 оны төсөв батлах" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Тайлбар</label>
            <textarea className={inputCls} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Төсвийн дүн (₮)</label>
              <input inputMode="numeric" className={inputCls} value={budget} onChange={(e) => setBudget(e.target.value.replace(/\D/g, ''))} placeholder="Заавал биш" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Хугацаа (хоног)</label>
              <input inputMode="numeric" className={inputCls} value={days} onChange={(e) => setDays(Math.min(30, Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1)))} />
            </div>
          </div>

          <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-blue-900">⚡ Шийдвэрлэх дүрэм</p>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Батлагдах босго</label>
              <select className={inputCls} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))}>
                <option value={50}>Энгийн олонхи ( &gt;50% )</option>
                <option value={67}>Гуравны хоёр ( ⅔ · 67% )</option>
                <option value={75}>Дөрөвний гурав ( ¾ · 75% )</option>
                <option value={100}>Бүх гишүүн ( 100% )</option>
              </select>
            </div>
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={autoApprove} onChange={(e) => setAutoApprove(e.target.checked)} className="mt-0.5 w-4 h-4" />
              <span className="text-sm text-gray-700">
                Хугацаанд хариу өгөөгүй гишүүнийг автоматаар <b>“Зөвшөөрсөн”</b>-д тооцох
              </span>
            </label>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Санал өгөх гишүүд *</p>
            {members.length > 0 && (
              <div className="space-y-1 mb-3">
                {members.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 text-sm cursor-pointer py-1">
                    <input type="checkbox" className="w-4 h-4" checked={selected.has(m.id)} onChange={() => toggle(m.id)} />
                    <span className="text-gray-800">{m.full_name}</span>
                    <span className="text-xs text-gray-400">{m.phone_number}</span>
                    <CouncilTag council={m.council} />
                  </label>
                ))}
              </div>
            )}
            <div className="space-y-2">
              {voters.map((v, i) => (
                <div key={i} className="flex gap-2">
                  <input inputMode="numeric" className={`${inputCls} flex-1`} value={v.phone} onChange={(e) => setVoter(i, 'phone', e.target.value)} placeholder="Утас (99XXXXXX)" />
                  <input className={`${inputCls} flex-1`} value={v.name} onChange={(e) => setVoter(i, 'name', e.target.value)} placeholder="Нэр" />
                  <button onClick={() => setVoters((p) => p.filter((_, idx) => idx !== i))} className="px-3 text-gray-400 hover:text-red-500">✕</button>
                </div>
              ))}
            </div>
            <button onClick={() => setVoters((p) => [...p, { phone: '', name: '' }])} className="mt-2 text-sm text-blue-600 font-medium">+ Жагсаалтад ороогүй хүн нэмэх</button>
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-xl">{error}</div>}

          <button onClick={create} disabled={busy} className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50">
            {busy ? 'Үүсгэж байна...' : 'Үүсгэх'}
          </button>
          <p className="text-xs text-gray-400 text-center">Үүсгэсний дараа гишүүн бүрийн хувийн линкийг өөрийн утаснаас SMS / Messenger-ээр илгээнэ.</p>
        </div>
      )}

      {/* ---------- Саналын жагсаалт ---------- */}
      {loading ? (
        <p className="text-gray-400">Ачаалж байна...</p>
      ) : proposals.length === 0 ? (
        <div className="bg-white rounded-2xl border p-10 text-center text-gray-400">
          Одоогоор санал асуулга алга. “+ Шинэ санал” дарж эхлүүлээрэй.
        </div>
      ) : (
        <div className="grid gap-3 max-w-3xl">
          {proposals.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900 truncate">{p.title}</h3>
                    <StatusBadge status={p.status} />
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {p.budget_amount != null ? `Төсөв: ${Number(p.budget_amount).toLocaleString()}₮ · ` : ''}
                    Дуусах: {new Date(p.expires_at).toLocaleDateString('mn-MN')}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => openInvites(p.id)}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium hover:bg-gray-50"
                  >
                    {openId === p.id ? 'Хаах' : 'Гишүүд / Линк'}
                  </button>
                  <a
                    href={`/vote/${p.id}/result?k=${p.result_token}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-medium hover:bg-gray-800"
                  >
                    Үр дүн / Протокол
                  </a>
                </div>
              </div>

              {openId === p.id && (
                <div className="mt-3 border-t pt-3 space-y-2">
                  {invites.length === 0 ? (
                    <p className="text-xs text-gray-400">Ачаалж байна...</p>
                  ) : (
                    invites.map((r) => {
                      const voted = votedPhones.has(r.phone_number);
                      const text = inviteText(p, r);
                      const key = `${p.id}:${r.phone_number}`;
                      return (
                        <div key={r.phone_number} className="flex items-center justify-between gap-2 text-sm">
                          <div className="min-w-0">
                            <span className="text-gray-800">{r.full_name || '-'}</span>
                            <span className="text-xs text-gray-400 ml-2">{r.phone_number}</span>
                            {r.council && <span className="ml-2"><CouncilTag council={r.council} /></span>}
                            {voted && <span className="ml-2 text-xs font-medium text-green-600">✓ санал өгсөн</span>}
                          </div>
                          {p.status === 'active' && !voted && (
                            <div className="flex gap-1.5 shrink-0">
                              <a
                                href={`sms:${r.phone_number}?&body=${encodeURIComponent(text)}`}
                                className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
                              >
                                SMS
                              </a>
                              <button
                                onClick={() => copy(key, text)}
                                className="px-2.5 py-1 border border-gray-200 rounded-lg text-xs font-medium hover:bg-gray-50"
                              >
                                {copied === key ? 'Хуулсан ✓' : 'Хуулах'}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                  {p.status === 'active' && (
                    <p className="text-[11px] text-gray-400 pt-1">
                      «SMS» нь таны утасны мессеж апп-ыг нээнэ (компьютер дээр «Хуулах» дараад Messenger/Viber-ээр илгээнэ үү). Линк гишүүн бүрт хувийн — бусдад бүү дамжуул.
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

const APP_STATE: Record<AppState, { label: string; cls: string; title: string }> = {
  active: { label: '📱 апп идэвхтэй', cls: 'text-green-600', title: 'Апп дээр «🏛 Зөвлөл» хэсэг нээлттэй' },
  waiting: { label: '⏳ бүртгүүлээгүй', cls: 'text-amber-600', title: 'Оршин суугчийн мөр тэмдэглэгдсэн — апп-д бүртгүүлмэгц нээгдэнэ' },
  mismatch: { label: '⚠️ утас зөрсөн', cls: 'text-red-500', title: 'Бүртгэлийн утас өөрчлөгдсөн — Оршин суугчид хуудаснаас баталгаажуулна уу' },
  none: { label: 'зөвхөн линк', cls: 'text-gray-300', title: 'Оршин суугчтай холбоогүй — линкээр санал өгнө. Апп эрх олгох бол Оршин суугчид хуудаснаас «Зөвлөл» сонгоно' },
};

function MemberList({ title, list, state, onRemove }: { title: string; list: Member[]; state: Record<number, AppState>; onRemove: (m: Member) => void }) {
  return (
    <div className="border border-gray-100 rounded-xl p-3">
      <p className="text-sm font-medium text-gray-700 mb-2">{title} <span className="text-gray-400">({list.length})</span></p>
      {list.length === 0 ? (
        <p className="text-xs text-gray-300">Гишүүн алга</p>
      ) : (
        <ul className="space-y-1">
          {list.map((m) => (
            <li key={m.id} className="flex items-center justify-between text-sm">
              <span className="min-w-0 truncate">
                <span className="text-gray-800">{m.full_name}</span>
                {m.position && <span className="text-xs text-gray-400"> · {m.position}</span>}
                <span className="text-xs text-gray-400 ml-2">{m.phone_number}</span>
                {state[m.id] && (
                  <span className={`ml-1.5 text-[10px] font-medium ${APP_STATE[state[m.id]].cls}`} title={APP_STATE[state[m.id]].title}>
                    {APP_STATE[state[m.id]].label}
                  </span>
                )}
              </span>
              <button onClick={() => onRemove(m)} className="text-gray-300 hover:text-red-500 px-2" title="Хасах">✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CouncilTag({ council }: { council: Council }) {
  const cls = council === 'audit' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700';
  return <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${cls}`}>{COUNCIL_LABEL[council]}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'passed' ? 'bg-green-100 text-green-700'
    : status === 'rejected' ? 'bg-red-100 text-red-700'
    : status === 'active' ? 'bg-blue-100 text-blue-700'
    : 'bg-gray-100 text-gray-600';
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded whitespace-nowrap ${cls}`}>{STATUS_LABEL[status] || status}</span>;
}
