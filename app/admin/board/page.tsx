'use client';

import { useEffect, useState, useCallback } from 'react';
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

const STATUS_LABEL: Record<string, string> = {
  active: 'Явагдаж байна',
  passed: 'Батлагдсан',
  rejected: 'Татгалзсан',
  expired: 'Хугацаа дууссан',
  cancelled: 'Цуцлагдсан',
};

export default function AdminBoardPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [days, setDays] = useState(3);
  const [threshold, setThreshold] = useState(50);
  const [autoApprove, setAutoApprove] = useState(false);
  const [voters, setVoters] = useState<VoterRow[]>([{ phone: '', name: '' }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data } = await adminFrom('proposals').select('*').order('created_at');
    setProposals((data as unknown as Proposal[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const run = async () => { await load(); };
    run();
  }, [load]);

  const setVoter = (i: number, key: keyof VoterRow, val: string) => {
    setVoters((prev) => prev.map((v, idx) => (idx === i ? { ...v, [key]: key === 'phone' ? val.replace(/\D/g, '').slice(0, 8) : val } : v)));
  };

  const resetForm = () => {
    setTitle(''); setDescription(''); setBudget(''); setDays(3);
    setThreshold(50); setAutoApprove(false);
    setVoters([{ phone: '', name: '' }]); setError('');
  };

  const create = async () => {
    setError('');
    const validVoters = voters.filter((v) => v.phone.length === 8);
    if (!title.trim()) return setError('Асуудлын гарчиг оруулна уу');
    if (validVoters.length === 0) return setError('Дор хаяж 1 гишүүний утас оруулна уу');

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
          voters: validVoters.map((v) => ({ phone: v.phone, name: v.name })),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        resetForm();
        setShowForm(false);
        load();
      } else {
        setError(data.error || 'Үүсгэхэд алдаа гарлаа');
      }
    } catch {
      setError('Сервертэй холбогдож чадсангүй');
    }
    setBusy(false);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">🗳 Цахим ТУЗ</h1>
          <p className="text-sm text-gray-500">ТУЗ-ийн гишүүдээс цахимаар санал хураах</p>
        </div>
        <button
          onClick={() => { setShowForm((s) => !s); resetForm(); }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          {showForm ? 'Болих' : '+ Шинэ санал'}
        </button>
      </div>

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
            <p className="text-sm font-medium text-gray-700 mb-2">ТУЗ-ийн гишүүд *</p>
            <div className="space-y-2">
              {voters.map((v, i) => (
                <div key={i} className="flex gap-2">
                  <input inputMode="numeric" className={`${inputCls} flex-1`} value={v.phone} onChange={(e) => setVoter(i, 'phone', e.target.value)} placeholder="Утас (99XXXXXX)" />
                  <input className={`${inputCls} flex-1`} value={v.name} onChange={(e) => setVoter(i, 'name', e.target.value)} placeholder="Нэр" />
                  {voters.length > 1 && (
                    <button onClick={() => setVoters((p) => p.filter((_, idx) => idx !== i))} className="px-3 text-gray-400 hover:text-red-500">✕</button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => setVoters((p) => [...p, { phone: '', name: '' }])} className="mt-2 text-sm text-blue-600 font-medium">+ Гишүүн нэмэх</button>
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-xl">{error}</div>}

          <button onClick={create} disabled={busy} className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50">
            {busy ? 'Үүсгэж байна...' : 'Үүсгэж, гишүүдийг урих'}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-gray-400">Ачаалж байна...</p>
      ) : proposals.length === 0 ? (
        <div className="bg-white rounded-2xl border p-10 text-center text-gray-400">
          Одоогоор санал асуулга алга. “+ Шинэ санал” дарж эхлүүлээрэй.
        </div>
      ) : (
        <div className="grid gap-3 max-w-3xl">
          {proposals.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border p-4 flex items-center justify-between gap-4">
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
              <a
                href={`/vote/${p.id}/result?k=${p.result_token}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-medium hover:bg-gray-800"
              >
                Үр дүн / Протокол
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'passed' ? 'bg-green-100 text-green-700'
    : status === 'rejected' ? 'bg-red-100 text-red-700'
    : status === 'active' ? 'bg-blue-100 text-blue-700'
    : 'bg-gray-100 text-gray-600';
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded whitespace-nowrap ${cls}`}>{STATUS_LABEL[status] || status}</span>;
}
