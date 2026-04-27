'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';

interface SokhRow {
  id: number;
  name: string;
  khoroos?: { name: string; districts?: { name: string; cities?: { name: string } } } | null;
}

export default function ActivatePage() {
  const router = useRouter();
  const params = useSearchParams();
  const presetSokhId = params.get('sokh');

  const [step, setStep] = useState<'select' | 'form'>(presetSokhId ? 'form' : 'select');
  const [sokhs, setSokhs] = useState<SokhRow[]>([]);
  const [loadingSokhs, setLoadingSokhs] = useState(true);
  const [search, setSearch] = useState('');

  const [sokhId, setSokhId] = useState<number | null>(presetSokhId ? Number(presetSokhId) : null);
  const [sokhName, setSokhName] = useState('');
  const [code, setCode] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [displayName, setDisplayName] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('sokh_organizations')
        .select('id, name, khoroos(name, districts(name, cities(name)))')
        .order('name');
      const rows = (data || []) as unknown as SokhRow[];
      setSokhs(rows);
      if (presetSokhId) {
        const found = rows.find(r => r.id === Number(presetSokhId));
        if (found) setSokhName(found.name);
      }
      setLoadingSokhs(false);
    };
    load();
  }, [presetSokhId]);

  const filteredSokhs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sokhs.slice(0, 50);
    return sokhs.filter(s => {
      const loc = `${s.khoroos?.districts?.cities?.name || ''} ${s.khoroos?.districts?.name || ''} ${s.khoroos?.name || ''}`;
      return `${s.name} ${loc}`.toLowerCase().includes(q);
    }).slice(0, 50);
  }, [sokhs, search]);

  const pickSokh = (s: SokhRow) => {
    setSokhId(s.id);
    setSokhName(s.name);
    setStep('form');
    setError('');
  };

  const submit = async () => {
    setError('');
    if (!sokhId) { setError('СӨХ сонгоогүй байна'); return; }
    if (!/^\d{6}$/.test(code)) { setError('Идэвхжүүлэх код 6 оронтой'); return; }
    if (!/^\d{8}$/.test(contactPhone)) { setError('Утасны дугаар 8 оронтой'); return; }
    if (username.length < 3 || !/^[a-zA-Z0-9_.-]+$/.test(username)) {
      setError('Нэвтрэх нэр 3+ тэмдэгт, латин үсэг/тоо/_-. зөвшөөрнө');
      return;
    }
    if (password.length < 8) { setError('Нууц үг хамгийн багадаа 8 тэмдэгт'); return; }
    if (password !== password2) { setError('Нууц үг таарахгүй байна'); return; }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sokh_id: sokhId,
          code,
          contact_phone: contactPhone,
          username,
          password,
          display_name: displayName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Алдаа гарлаа');
        setSubmitting(false);
        return;
      }
      router.replace('/admin');
    } catch {
      setError('Сүлжээний алдаа');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-[430px] min-h-screen bg-white">
        <div className="bg-amber-600 text-white px-4 py-4">
          <button onClick={() => router.push('/')} className="text-white/80 text-sm mb-1">← Буцах</button>
          <h1 className="text-lg font-bold">🔑 СӨХ-н админ идэвхжүүлэх</h1>
          <p className="text-xs text-white/80 mt-0.5">Хотол-той гэрээлсэн СӨХ-н дарга/нярав ашиглана</p>
        </div>

        <div className="px-4 py-6">
          {step === 'select' && (
            <>
              <p className="text-sm text-gray-600 mb-3">СӨХ-аа сонгоно уу</p>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="🔍 Нэр, дүүрэг, хороо..."
                className="w-full border rounded-xl px-4 py-3 text-sm bg-white mb-3"
                autoFocus
              />
              {loadingSokhs ? (
                <p className="text-gray-400 text-sm">Ачаалж байна...</p>
              ) : filteredSokhs.length === 0 ? (
                <p className="text-gray-400 text-sm py-8 text-center">СӨХ олдсонгүй</p>
              ) : (
                <div className="space-y-2">
                  {filteredSokhs.map(s => (
                    <button
                      key={s.id}
                      onClick={() => pickSokh(s)}
                      className="w-full text-left border rounded-xl px-4 py-3 hover:bg-amber-50 active:bg-amber-100 transition"
                    >
                      <p className="font-medium text-sm">{s.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {[s.khoroos?.districts?.cities?.name, s.khoroos?.districts?.name, s.khoroos?.name].filter(Boolean).join(' · ') || '—'}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {step === 'form' && (
            <>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
                <p className="text-xs text-amber-700">Сонгосон СӨХ</p>
                <p className="font-semibold text-sm text-amber-900">{sokhName || `#${sokhId}`}</p>
                {!presetSokhId && (
                  <button onClick={() => setStep('select')} className="text-xs text-amber-700 underline mt-1">Өөрчлөх</button>
                )}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm mb-4">
                  {error}
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Идэвхжүүлэх код (6 орон)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="w-full border rounded-xl px-4 py-3 text-sm bg-white tracking-[0.3em] text-center font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Холбоо барих утас</label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={contactPhone}
                    onChange={e => setContactPhone(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    placeholder="99XXXXXX"
                    className="w-full border rounded-xl px-4 py-3 text-sm bg-white"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">Хотол-аас код илгээсэн утасны дугаар</p>
                </div>

                <div className="border-t pt-3 mt-3">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Шинэ админ эрх</p>
                </div>

                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Нэвтрэх нэр (латин)</label>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value.trim())}
                    placeholder="darga, nyarav гэх мэт"
                    autoCapitalize="off"
                    autoCorrect="off"
                    className="w-full border rounded-xl px-4 py-3 text-sm bg-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Нэр (харуулах)</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="Овог Нэр"
                    className="w-full border rounded-xl px-4 py-3 text-sm bg-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Нууц үг (8+ тэмдэгт)</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full border rounded-xl px-4 py-3 text-sm bg-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Нууц үгээ давтах</label>
                  <input
                    type="password"
                    value={password2}
                    onChange={e => setPassword2(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && submit()}
                    className="w-full border rounded-xl px-4 py-3 text-sm bg-white"
                  />
                </div>
              </div>

              <button
                onClick={submit}
                disabled={submitting}
                className="w-full bg-amber-600 text-white py-3.5 rounded-xl font-semibold text-sm mt-6 disabled:opacity-50 active:bg-amber-700 transition"
              >
                {submitting ? 'Идэвхжүүлж байна...' : 'Идэвхжүүлэх'}
              </button>

              <p className="text-center text-xs text-gray-400 mt-4">
                Кодоо мэдэхгүй бол Хотол-той холбогдоно уу
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
