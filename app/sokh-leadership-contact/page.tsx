'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';

interface SokhRow {
  id: number;
  name: string;
  khoroos?: { name: string; districts?: { name: string; cities?: { name: string } } } | null;
}

interface KhorooRow {
  id: number;
  name: string;
  districts?: { name: string; cities?: { name: string } } | null;
}

const ROLE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'darga', label: 'СӨХ-н дарга' },
  { value: 'nyarav', label: 'Нярав' },
  { value: 'member', label: 'Зөвлөлийн гишүүн' },
  { value: 'other', label: 'Бусад' },
];

export default function SokhLeadershipContactPage() {
  const router = useRouter();
  const params = useSearchParams();
  const presetSokhId = params.get('sokh');

  const [mode, setMode] = useState<'existing' | 'new'>(presetSokhId ? 'existing' : 'existing');
  const [sokhs, setSokhs] = useState<SokhRow[]>([]);
  const [khoroos, setKhoroos] = useState<KhorooRow[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);

  const [sokhId, setSokhId] = useState<number | null>(presetSokhId ? Number(presetSokhId) : null);
  const [sokhName, setSokhName] = useState('');
  const [khorooId, setKhorooId] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [role, setRole] = useState('darga');
  const [note, setNote] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const [{ data: s }, { data: k }] = await Promise.all([
        supabase.from('sokh_organizations').select('id, name, khoroos(name, districts(name, cities(name)))').order('name'),
        supabase.from('khoroos').select('id, name, districts(name, cities(name))').order('id'),
      ]);
      const sokhRows = (s || []) as unknown as SokhRow[];
      setSokhs(sokhRows);
      setKhoroos((k || []) as unknown as KhorooRow[]);
      if (presetSokhId) {
        const found = sokhRows.find(r => r.id === Number(presetSokhId));
        if (found) setSokhName(found.name);
      }
      setLoadingMeta(false);
    };
    load();
  }, [presetSokhId]);

  const filteredSokhs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sokhs.slice(0, 30);
    return sokhs.filter(s => {
      const loc = `${s.khoroos?.districts?.cities?.name || ''} ${s.khoroos?.districts?.name || ''} ${s.khoroos?.name || ''}`;
      return `${s.name} ${loc}`.toLowerCase().includes(q);
    }).slice(0, 30);
  }, [sokhs, search]);

  const submit = async () => {
    setError('');
    if (mode === 'existing' && !sokhId) {
      setError('СӨХ сонгоно уу');
      return;
    }
    if (mode === 'new') {
      if (sokhName.trim().length < 2) { setError('СӨХ нэр оруулна уу'); return; }
      if (!khorooId) { setError('Хороо сонгоно уу'); return; }
    }
    if (contactName.trim().length < 2) { setError('Нэрээ оруулна уу'); return; }
    if (!/^\d{8}$/.test(contactPhone)) { setError('Утасны дугаар 8 оронтой'); return; }

    setSubmitting(true);
    try {
      const res = await fetch('/api/leads/sokh-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sokh_id: mode === 'existing' ? sokhId : null,
          sokh_name: mode === 'new' ? sokhName.trim() : null,
          khoroo_id: mode === 'new' ? khorooId : null,
          contact_name: contactName.trim(),
          contact_phone: contactPhone,
          role,
          note: note.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Алдаа гарлаа');
        setSubmitting(false);
        return;
      }
      setDone(data.message || 'Хүсэлт хүлээн авагдлаа.');
    } catch {
      setError('Сүлжээний алдаа');
      setSubmitting(false);
    }
  };

  if (loadingMeta) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Ачаалж байна...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-[460px] min-h-screen bg-white">
        <div className="bg-blue-600 text-white px-4 py-4">
          <button onClick={() => router.back()} className="text-white/80 text-sm mb-1">← Буцах</button>
          <h1 className="text-lg font-bold">📞 Хотол-той холбогдох</h1>
          <p className="text-xs text-white/80 mt-0.5">СӨХ-н удирдлага гэрээ байгуулах</p>
        </div>

        <div className="px-4 py-6">
          {done ? (
            <div className="text-center py-10">
              <div className="text-5xl mb-4">✅</div>
              <h2 className="text-lg font-bold mb-2">Хүсэлт хүлээн авагдлаа</h2>
              <p className="text-sm text-gray-600 mb-6">{done}</p>
              <button
                onClick={() => router.push('/')}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm"
              >
                Үндсэн хуудас
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-700 mb-4">
                Та СӨХ-н дарга, нярав эсвэл удирдлагын баг бол доорх формыг бөглөнө үү.
                Манай баг 24 цагт багтаан утсаар эргэн холбогдоно.
              </p>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm mb-4">
                  {error}
                </div>
              )}

              {/* Mode tabs */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => { setMode('existing'); setError(''); }}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition ${
                    mode === 'existing' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  📍 Жагсаалтаас сонгох
                </button>
                <button
                  onClick={() => { setMode('new'); setError(''); }}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition ${
                    mode === 'new' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  ✏️ Шинэ нэр
                </button>
              </div>

              {mode === 'existing' ? (
                <div className="mb-4">
                  <label className="text-xs text-gray-500 mb-1 block">СӨХ сонгоно</label>
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="🔍 Нэр, дүүрэг, хороо..."
                    className="w-full border rounded-xl px-4 py-3 text-sm bg-white mb-2"
                  />
                  {sokhId && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 mb-2 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-blue-700">Сонгосон</p>
                        <p className="text-sm font-semibold text-blue-900">{sokhName}</p>
                      </div>
                      <button onClick={() => { setSokhId(null); setSokhName(''); }} className="text-xs text-blue-700 underline">Цуцлах</button>
                    </div>
                  )}
                  {!sokhId && (
                    <div className="border rounded-xl divide-y max-h-72 overflow-y-auto">
                      {filteredSokhs.length === 0 ? (
                        <p className="px-4 py-6 text-center text-sm text-gray-400">Олдсонгүй</p>
                      ) : filteredSokhs.map(s => (
                        <button
                          key={s.id}
                          onClick={() => { setSokhId(s.id); setSokhName(s.name); setSearch(''); }}
                          className="w-full text-left px-3 py-2.5 hover:bg-blue-50 active:bg-blue-100"
                        >
                          <p className="font-medium text-sm">{s.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {[s.khoroos?.districts?.cities?.name, s.khoroos?.districts?.name, s.khoroos?.name].filter(Boolean).join(' · ') || '—'}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3 mb-4">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">СӨХ-н нэр</label>
                    <input
                      type="text"
                      value={sokhName}
                      onChange={e => setSokhName(e.target.value)}
                      placeholder="Нарантуул СӨХ"
                      className="w-full border rounded-xl px-4 py-3 text-sm bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Хороо</label>
                    <select
                      value={khorooId || ''}
                      onChange={e => setKhorooId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full border rounded-xl px-4 py-3 text-sm bg-white"
                    >
                      <option value="">— Сонгох —</option>
                      {khoroos.map(k => (
                        <option key={k.id} value={k.id}>
                          {[k.districts?.cities?.name, k.districts?.name, k.name].filter(Boolean).join(' · ')}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="border-t pt-4 mt-4 space-y-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Таны нэр</label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={e => setContactName(e.target.value)}
                    placeholder="Овог Нэр"
                    className="w-full border rounded-xl px-4 py-3 text-sm bg-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Утасны дугаар</label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={contactPhone}
                    onChange={e => setContactPhone(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    placeholder="99XXXXXX"
                    className="w-full border rounded-xl px-4 py-3 text-sm bg-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Үүрэг</label>
                  <select
                    value={role}
                    onChange={e => setRole(e.target.value)}
                    className="w-full border rounded-xl px-4 py-3 text-sm bg-white"
                  >
                    {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Нэмэлт мэдэгдэл (заавал биш)</label>
                  <textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    rows={3}
                    placeholder="Жишээ нь: айлын тоо, онцгой шаардлага..."
                    className="w-full border rounded-xl px-4 py-3 text-sm bg-white"
                    maxLength={1000}
                  />
                </div>
              </div>

              <button
                onClick={submit}
                disabled={submitting}
                className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-semibold text-sm mt-6 disabled:opacity-50 active:bg-blue-700 transition"
              >
                {submitting ? 'Илгээж байна...' : 'Хүсэлт илгээх'}
              </button>

              <p className="text-center text-xs text-gray-400 mt-4">
                Илгээснээр та манай баг тантай холбогдохыг зөвшөөрч байна.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
