'use client';

import { useState } from 'react';

interface VoterRow {
  phone: string;
  name: string;
}

interface CreateResult {
  id: number;
  result_url: string;
  vote_url: string;
  voters_count: number;
}

export default function PublicProposalPage() {
  const [orgName, setOrgName] = useState('');
  const [creatorName, setCreatorName] = useState('');
  const [creatorPhone, setCreatorPhone] = useState('');
  const [title, setTitle] = useState('Хотол системийг нэвтрүүлэх үү?');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [days, setDays] = useState(3);
  const [threshold, setThreshold] = useState(50);
  const [autoApprove, setAutoApprove] = useState(true);
  const [voters, setVoters] = useState<VoterRow[]>([{ phone: '', name: '' }, { phone: '', name: '' }]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<CreateResult | null>(null);

  const setVoter = (i: number, key: keyof VoterRow, val: string) => {
    setVoters((prev) => prev.map((v, idx) => (idx === i ? { ...v, [key]: key === 'phone' ? val.replace(/\D/g, '').slice(0, 8) : val } : v)));
  };
  const addVoter = () => setVoters((p) => [...p, { phone: '', name: '' }]);
  const removeVoter = (i: number) => setVoters((p) => p.filter((_, idx) => idx !== i));

  const submit = async () => {
    setError('');
    const validVoters = voters.filter((v) => v.phone.length === 8);
    if (!title.trim()) return setError('Асуулт оруулна уу');
    if (creatorPhone.length !== 8) return setError('Даргын утасны дугаар (8 орон) оруулна уу');
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
          org_name: orgName,
          creator_name: creatorName,
          creator_phone: creatorPhone,
          voters: validVoters.map((v) => ({ phone: v.phone, name: v.name })),
        }),
      });
      const data = await res.json();
      if (res.ok) setResult(data);
      else setError(data.error || 'Үүсгэхэд алдаа гарлаа');
    } catch {
      setError('Сервертэй холбогдож чадсангүй');
    }
    setBusy(false);
  };

  if (result) {
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center px-4 py-10">
        <div className="w-full max-w-md text-center">
          <div className="text-4xl mb-3">✅</div>
          <h1 className="text-xl font-bold text-gray-900">Санал асуулга үүслээ</h1>
          <p className="text-sm text-gray-500 mt-1">
            {result.voters_count} гишүүний утас руу санал өгөх линк илгээгдлээ.
          </p>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mt-6 text-left space-y-3">
            <div>
              <p className="text-xs text-gray-400 mb-1">Гишүүдэд илгээсэн санал өгөх линк</p>
              <code className="block text-xs bg-gray-50 rounded-lg p-2 break-all">{result.vote_url}</code>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Үр дүн хянах нууц линк (зөвхөн танд)</p>
              <a href={result.result_url} className="block text-xs bg-blue-50 text-blue-700 rounded-lg p-2 break-all">
                {result.result_url}
              </a>
            </div>
          </div>
          <a href={result.result_url} className="inline-block mt-6 bg-blue-600 text-white px-5 py-3 rounded-xl font-semibold hover:bg-blue-700">
            Үр дүн хянах →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="text-2xl font-bold text-blue-600">Хотол</div>
          <p className="text-sm text-gray-500 mt-1">ТУЗ-ийн гишүүдээсээ цахимаар санал аваарай</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <Field label="СӨХ / байрны нэр">
            <input className={inputCls} value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Жишээ: 45-р байрны СӨХ" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Даргын нэр">
              <input className={inputCls} value={creatorName} onChange={(e) => setCreatorName(e.target.value)} placeholder="Таны нэр" />
            </Field>
            <Field label="Даргын утас *">
              <input inputMode="numeric" className={inputCls} value={creatorPhone} onChange={(e) => setCreatorPhone(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="99XXXXXX" />
            </Field>
          </div>

          <Field label="Асуулт *">
            <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>

          <Field label="Тайлбар">
            <textarea className={inputCls} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Дэлгэрэнгүй тайлбар (заавал биш)" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Төсвийн дүн (₮)">
              <input inputMode="numeric" className={inputCls} value={budget} onChange={(e) => setBudget(e.target.value.replace(/\D/g, ''))} placeholder="Заавал биш" />
            </Field>
            <Field label="Хугацаа (хоног)">
              <input inputMode="numeric" className={inputCls} value={days} onChange={(e) => setDays(Math.min(30, Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1)))} />
            </Field>
          </div>

          {/* Шийдвэр гаргалтын дүрмүүд */}
          <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-blue-900">⚡ Шийдвэрлэх дүрэм</p>
            <Field label="Батлагдах босго">
              <select className={inputCls} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))}>
                <option value={50}>Энгийн олонхи ( &gt;50% )</option>
                <option value={67}>Гуравны хоёр ( ⅔ · 67% )</option>
                <option value={75}>Дөрөвний гурав ( ¾ · 75% )</option>
                <option value={100}>Бүх гишүүн ( 100% )</option>
              </select>
            </Field>
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
                    <button onClick={() => removeVoter(i)} className="px-3 text-gray-400 hover:text-red-500">✕</button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={addVoter} className="mt-2 text-sm text-blue-600 font-medium">+ Гишүүн нэмэх</button>
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-xl">{error}</div>}

          <button
            onClick={submit}
            disabled={busy}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50"
          >
            {busy ? 'Үүсгэж байна...' : 'Санал асуулга үүсгэж, урих'}
          </button>
          <p className="text-xs text-gray-400 text-center">
            Гишүүд апп татахгүйгээр, утсаар нь очсон линкээр орж санал өгнө.
          </p>
        </div>

        <p className="text-center text-[11px] text-gray-300 mt-6">© Хотол · khotol.com</p>
      </div>
    </div>
  );
}

const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700 block mb-1">{label}</label>
      {children}
    </div>
  );
}
