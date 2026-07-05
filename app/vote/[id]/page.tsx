'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';

interface Proposal {
  id: number;
  title: string;
  description: string | null;
  budget_amount: number | null;
  status: string;
  kind: string;
  org_name: string | null;
  expires_at: string;
}
interface Tally {
  approve: number;
  disapprove: number;
  abstain: number;
  voted: number;
  total: number;
}

type Step = 'phone' | 'otp' | 'vote' | 'done';

const STATUS_LABEL: Record<string, string> = {
  active: 'Санал хураалт явагдаж байна',
  passed: 'Батлагдсан',
  rejected: 'Татгалзсан',
  expired: 'Хугацаа дууссан',
  cancelled: 'Цуцлагдсан',
};

export default function VotePage() {
  const params = useParams();
  const proposalId = parseInt(String(params.id), 10);

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [tally, setTally] = useState<Tally | null>(null);
  const [loading, setLoading] = useState(true);

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [choice, setChoice] = useState<'approve' | 'disapprove' | 'abstain' | ''>('');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/vote/${proposalId}`);
      const data = await res.json();
      if (res.ok) {
        setProposal(data.proposal);
        setTally(data.tally);
      } else {
        setError(data.error || 'Уншиж чадсангүй');
      }
    } catch {
      setError('Сервертэй холбогдож чадсангүй');
    }
    setLoading(false);
  }, [proposalId]);

  useEffect(() => {
    load();
  }, [load]);

  const closed = proposal ? proposal.status !== 'active' : false;

  const sendOtp = async () => {
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/vote/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId, phone, action: 'send' }),
      });
      const data = await res.json();
      if (res.ok) setStep('otp');
      else setError(data.error || 'Код илгээхэд алдаа');
    } catch {
      setError('Сервертэй холбогдож чадсангүй');
    }
    setBusy(false);
  };

  const verifyOtp = async () => {
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/vote/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId, phone, action: 'verify', code }),
      });
      const data = await res.json();
      if (res.ok) setStep('vote');
      else setError(data.error || 'Код буруу');
    } catch {
      setError('Сервертэй холбогдож чадсангүй');
    }
    setBusy(false);
  };

  const castVote = async () => {
    if (!choice) return;
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/vote/cast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId, voteValue: choice, comment }),
      });
      const data = await res.json();
      if (res.ok) {
        setStep('done');
        load();
      } else {
        setError(data.error || 'Санал бүртгэхэд алдаа');
      }
    } catch {
      setError('Сервертэй холбогдож чадсангүй');
    }
    setBusy(false);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-400">Ачаалж байна...</div>;
  }
  if (!proposal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <p className="text-gray-500">{error || 'Санал асуулга олдсонгүй'}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center px-4 py-10">
      <div className="w-full max-w-md">
        {/* Толгой */}
        <div className="text-center mb-6">
          <div className="text-2xl font-bold text-blue-600">Хотол</div>
          <p className="text-xs text-gray-400 mt-0.5">Цахим ТУЗ · Санал асуулга</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          {proposal.org_name && (
            <p className="text-xs font-medium text-gray-400 mb-1">{proposal.org_name}</p>
          )}
          <h1 className="text-lg font-bold text-gray-900">{proposal.title}</h1>
          {proposal.description && (
            <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{proposal.description}</p>
          )}
          {proposal.budget_amount != null && (
            <div className="mt-3 inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-sm font-semibold px-3 py-1.5 rounded-lg">
              Төсөв: {Number(proposal.budget_amount).toLocaleString()}₮
            </div>
          )}

          <div className="mt-3 text-xs text-gray-400">
            Дуусах: {new Date(proposal.expires_at).toLocaleString('mn-MN')}
          </div>

          {/* Статус */}
          {closed && (
            <div className="mt-4 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium px-4 py-3 text-center">
              {STATUS_LABEL[proposal.status] || proposal.status}
            </div>
          )}

          <div className="my-5 border-t border-gray-100" />

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-xl">{error}</div>
          )}

          {/* --- Урсгал --- */}
          {closed ? (
            tally && <ResultBars tally={tally} />
          ) : step === 'phone' ? (
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700 block">Утасны дугаараа оруулна уу</label>
              <input
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="99XXXXXX"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={sendOtp}
                disabled={busy || phone.length !== 8}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50"
              >
                {busy ? 'Илгээж байна...' : 'Баталгаажуулах код авах'}
              </button>
              <p className="text-xs text-gray-400 text-center">Зөвхөн урьсан ТУЗ-ийн гишүүд санал өгөх боломжтой.</p>
            </div>
          ) : step === 'otp' ? (
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700 block">Ирсэн 6 оронтой кодыг оруулна уу</label>
              <input
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={verifyOtp}
                disabled={busy || code.length !== 6}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50"
              >
                {busy ? 'Шалгаж байна...' : 'Баталгаажуулах'}
              </button>
              <button onClick={() => setStep('phone')} className="w-full text-xs text-gray-400 py-1">
                ← Дугаар солих
              </button>
            </div>
          ) : step === 'vote' ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700">Таны шийдвэр</p>
              <div className="grid grid-cols-1 gap-2">
                <ChoiceBtn active={choice === 'approve'} color="green" onClick={() => setChoice('approve')} label="✅ Зөвшөөрөх" />
                <ChoiceBtn active={choice === 'disapprove'} color="red" onClick={() => setChoice('disapprove')} label="❌ Татгалзах" />
                <ChoiceBtn active={choice === 'abstain'} color="gray" onClick={() => setChoice('abstain')} label="➖ Түдгэлзэх" />
              </div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Сэтгэгдэл (заавал биш)"
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={castVote}
                disabled={busy || !choice}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50"
              >
                {busy ? 'Илгээж байна...' : 'Санал өгөх'}
              </button>
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="text-4xl mb-2">🎉</div>
              <p className="font-semibold text-gray-800">Таны санал бүртгэгдлээ. Баярлалаа!</p>
              {tally && (
                <div className="mt-5 text-left">
                  <ResultBars tally={tally} />
                </div>
              )}
            </div>
          )}
        </div>

        <p className="text-center text-[11px] text-gray-300 mt-6">© Хотол · khotol.com</p>
      </div>
    </div>
  );
}

function ChoiceBtn({
  active,
  color,
  label,
  onClick,
}: {
  active: boolean;
  color: 'green' | 'red' | 'gray';
  label: string;
  onClick: () => void;
}) {
  const ring =
    color === 'green' ? 'ring-green-500 bg-green-50' : color === 'red' ? 'ring-red-500 bg-red-50' : 'ring-gray-400 bg-gray-50';
  return (
    <button
      onClick={onClick}
      className={`w-full py-3 rounded-xl text-sm font-semibold border transition ${
        active ? `ring-2 ${ring} border-transparent` : 'border-gray-200 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  );
}

function ResultBars({ tally }: { tally: Tally }) {
  const total = tally.total || 1;
  const pct = (n: number) => Math.round((n / total) * 100);
  const bars = [
    { label: 'Зөвшөөрсөн', n: tally.approve, cls: 'bg-green-500' },
    { label: 'Татгалзсан', n: tally.disapprove, cls: 'bg-red-500' },
    { label: 'Түдгэлзсэн', n: tally.abstain, cls: 'bg-gray-400' },
  ];
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">
        {tally.voted}/{tally.total} гишүүн санал өгсөн
      </p>
      {bars.map((b) => (
        <div key={b.label}>
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span>{b.label}</span>
            <span className="font-medium">{b.n} ({pct(b.n)}%)</span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full ${b.cls} rounded-full transition-all`} style={{ width: `${pct(b.n)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
