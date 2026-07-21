'use client';

import { useState, useEffect } from 'react';

export default function AccountSettingsPage() {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(true);

  // Нууц үг солих
  const [pwCur, setPwCur] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwNew2, setPwNew2] = useState('');
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwSaving, setPwSaving] = useState(false);

  // Нэвтрэх нэр (утас) солих
  const [unCur, setUnCur] = useState('');
  const [unNew, setUnNew] = useState('');
  const [unMsg, setUnMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [unSaving, setUnSaving] = useState(false);

  useEffect(() => {
    fetch('/api/admin/account')
      .then(r => r.json())
      .then(d => { if (d.username) { setUsername(d.username); setUnNew(d.username); } })
      .finally(() => setLoading(false));
  }, []);

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (pwNew !== pwNew2) { setPwMsg({ ok: false, text: 'Шинэ нууц үг хоёр удаа таарахгүй байна' }); return; }
    if (pwNew.length < 8) { setPwMsg({ ok: false, text: 'Шинэ нууц үг 8-аас доошгүй тэмдэгт байна' }); return; }
    setPwSaving(true);
    try {
      const res = await fetch('/api/admin/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'password', currentPassword: pwCur, newPassword: pwNew }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPwMsg({ ok: true, text: '✓ Нууц үг амжилттай солигдлоо' });
        setPwCur(''); setPwNew(''); setPwNew2('');
      } else {
        setPwMsg({ ok: false, text: data.error || 'Алдаа гарлаа' });
      }
    } catch {
      setPwMsg({ ok: false, text: 'Сервертэй холбогдож чадсангүй' });
    }
    setPwSaving(false);
  };

  const changeUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnMsg(null);
    if (unNew.trim() === username) { setUnMsg({ ok: false, text: 'Одоогийн нэвтрэх нэртэй ижил байна' }); return; }
    setUnSaving(true);
    try {
      const res = await fetch('/api/admin/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'username', currentPassword: unCur, newUsername: unNew.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUsername(unNew.trim());
        setUnMsg({ ok: true, text: '✓ Нэвтрэх нэр солигдлоо. Дараагийн удаа шинэ нэрээрээ нэвтэрнэ үү.' });
        setUnCur('');
      } else {
        setUnMsg({ ok: false, text: data.error || 'Алдаа гарлаа' });
      }
    } catch {
      setUnMsg({ ok: false, text: 'Сервертэй холбогдож чадсангүй' });
    }
    setUnSaving(false);
  };

  const inputCls = 'w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const labelCls = 'text-sm font-medium text-gray-700 block mb-1';

  const Msg = ({ m }: { m: { ok: boolean; text: string } | null }) =>
    m ? (
      <div className={`text-sm p-3 rounded-xl border ${m.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-600'}`}>
        {m.text}
      </div>
    ) : null;

  if (loading) return <div className="p-6 text-gray-400">Ачаалж байна...</div>;

  return (
    <div className="p-6 max-w-lg">
      <h1 className="text-2xl font-bold mb-1">🔑 Миний нэвтрэлт</h1>
      <p className="text-sm text-gray-500 mb-6">
        Нэвтрэх нэр, нууц үгээ өөрчилнө. Аюулгүй байдлын үүднээс одоогийн нууц үгээ баталгаажуулна.
      </p>

      {/* Нууц үг солих */}
      <form onSubmit={changePassword} className="bg-white border rounded-2xl p-5 mb-5 space-y-4">
        <h2 className="font-bold text-base">Нууц үг солих</h2>
        <div>
          <label className={labelCls}>Одоогийн нууц үг</label>
          <input type="password" value={pwCur} onChange={e => setPwCur(e.target.value)}
            className={inputCls} autoComplete="current-password" placeholder="••••••••" />
        </div>
        <div>
          <label className={labelCls}>Шинэ нууц үг</label>
          <input type="password" value={pwNew} onChange={e => setPwNew(e.target.value)}
            className={inputCls} autoComplete="new-password" placeholder="Хамгийн багадаа 8 тэмдэгт" />
        </div>
        <div>
          <label className={labelCls}>Шинэ нууц үг (давтах)</label>
          <input type="password" value={pwNew2} onChange={e => setPwNew2(e.target.value)}
            className={inputCls} autoComplete="new-password" placeholder="••••••••" />
        </div>
        <Msg m={pwMsg} />
        <button type="submit" disabled={pwSaving || !pwCur || !pwNew || !pwNew2}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50">
          {pwSaving ? 'Хадгалж байна...' : 'Нууц үг солих'}
        </button>
      </form>

      {/* Нэвтрэх нэр (утас) солих */}
      <form onSubmit={changeUsername} className="bg-white border rounded-2xl p-5 space-y-4">
        <h2 className="font-bold text-base">Нэвтрэх нэр (утасны дугаар) солих</h2>
        <p className="text-xs text-gray-400 -mt-2">Одоогийн нэвтрэх нэр: <span className="font-semibold text-gray-600">{username}</span></p>
        <div>
          <label className={labelCls}>Шинэ нэвтрэх нэр</label>
          <input type="text" value={unNew} onChange={e => setUnNew(e.target.value)}
            className={inputCls} autoComplete="username" placeholder="Шинэ утасны дугаар" />
        </div>
        <div>
          <label className={labelCls}>Одоогийн нууц үг (баталгаажуулах)</label>
          <input type="password" value={unCur} onChange={e => setUnCur(e.target.value)}
            className={inputCls} autoComplete="current-password" placeholder="••••••••" />
        </div>
        <Msg m={unMsg} />
        <button type="submit" disabled={unSaving || !unCur || !unNew}
          className="w-full bg-gray-800 text-white py-3 rounded-xl font-semibold hover:bg-gray-900 transition disabled:opacity-50">
          {unSaving ? 'Хадгалж байна...' : 'Нэвтрэх нэр солих'}
        </button>
      </form>
    </div>
  );
}
