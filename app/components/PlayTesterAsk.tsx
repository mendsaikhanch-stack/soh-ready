'use client';

// Аппыг ӨМНӨӨС НЬ ашиглаж байгаа оршин суугчаас Play туршилтад оролцох
// Gmail хаягийг асууна. Google-ийн production эрхэд 12+ хүн аппыг СУУЛГААД
// 14 хоног ашигласан байх ёстой — хамгийн итгэлтэй эх сурвалж нь эдгээр хүмүүс.
//
// Хэнд харагдах вэ:
//   • зөвхөн Android (iPhone-оос Play-ийн тестер болох боломжгүй)
//   • зөвхөн нэвтэрсэн оршин суугч
//   • хаасан эсвэл илгээсэн бол дахиж харагдахгүй (localStorage)

import { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';

const DISMISS_KEY = 'khotol.playTesterAsk.done';

export default function PlayTesterAsk() {
  const [show, setShow] = useState(false);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Android эсэхийг шалгана — iPhone хэрэглэгчийг дэмий түгшээхгүй
    const isAndroid = /android/i.test(navigator.userAgent);
    if (!isAndroid) return;
    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      // localStorage хаалттай хөтөч — банner-ыг харуулсан ч болно
    }
    setShow(true);
  }, []);

  const remember = () => {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* хаалттай бол алгасна */ }
  };

  const dismiss = () => { remember(); setShow(false); };

  const submit = async () => {
    setError('');
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
      setError('Имэйл хаягаа зөв бичнэ үү');
      return;
    }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('Дахин нэвтэрч орно уу');
        setSaving(false);
        return;
      }
      const res = await fetch('/api/play-testers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ email: value, platform: 'android' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Хадгалж чадсангүй');
        setSaving(false);
        return;
      }
      remember();
      setDone(true);
    } catch {
      setError('Сервертэй холбогдож чадсангүй');
    }
    setSaving(false);
  };

  if (!show) return null;

  if (done) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
        <b>Баярлалаа! 🙏</b> Таны хаягийг бүртгэлээ. 1–2 хоногийн дотор Google Play-ээс
        урилга ирнэ — түүнийг дарж аппаа суулгаарай.
        <button onClick={() => setShow(false)} className="block mt-3 text-green-700 underline">Хаах</button>
      </div>
    );
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
      {!open ? (
        <>
          <p className="text-sm text-gray-800">
            <b>Хотолыг Play дэлгүүрт гаргахад тусална уу</b>
          </p>
          <p className="text-xs text-gray-600 mt-1">
            Апп одоо туршилтын шатанд байна. 12 хүн туршиж өгвөл бүх хүнд нээлттэй болно.
            Танд хийх зүйл — Gmail хаягаа үлдээгээд, ирэх урилгаар аппаа суулгах.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setOpen(true)}
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold active:bg-blue-700"
            >
              Тусална
            </button>
            <button onClick={dismiss} className="px-4 text-sm text-gray-500">Дараа</button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-gray-800"><b>Gmail хаягаа бичнэ үү</b></p>
          <p className="text-xs text-gray-600 mt-1">
            Google Play энэ хаяг руу урилга илгээнэ. Зөвхөн үүнд ашиглана, өөр хэнд ч
            дамжуулахгүй.
          </p>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="жишээ@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border rounded-lg px-3 py-2.5 text-sm bg-white mt-3"
          />
          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
          <div className="flex gap-2 mt-3">
            <button
              onClick={submit}
              disabled={saving}
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 active:bg-blue-700"
            >
              {saving ? 'Илгээж байна...' : 'Илгээх'}
            </button>
            <button onClick={dismiss} className="px-4 text-sm text-gray-500">Болих</button>
          </div>
        </>
      )}
    </div>
  );
}
