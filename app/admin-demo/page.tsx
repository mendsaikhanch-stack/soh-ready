'use client';

// khotol.com/admin-demo — СӨХ-ийн удирдлагад тараах танилцуулгын линк.
// Нууц үг асуухгүй: нээмэгц демо сешн олгоод удирдлагын панел руу оруулна.
//
// Ганц зогсолт: хэрэглэгч аль хэдийн ӨӨРИЙН эрхээр нэвтэрсэн байвал асууна.
// Эс тэгвэл сониуцаад линк дарсан дарга өөрийн сешнээсээ шалтгаангүй гарч,
// «яагаад намайг гаргачихав» гэсэн дуудлага болно.

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import HotolLogo from '@/app/components/HotolLogo';

type Stage = 'checking' | 'confirm' | 'entering' | 'error';

export default function AdminDemoPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('checking');
  const [error, setError] = useState('');

  const enterDemo = useCallback(async () => {
    setStage('entering');
    setError('');
    try {
      const res = await fetch('/api/demo/admin', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Демо горимд орж чадсангүй');
        setStage('error');
        return;
      }
      router.replace('/admin');
    } catch {
      setError('Сервертэй холбогдож чадсангүй');
      setStage('error');
    }
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/check?type=admin');
        const data = await res.json();
        if (cancelled) return;
        // Өөрийн эрхээрээ нэвтэрсэн жинхэнэ дарга бол эхлээд асууна
        if (data.authenticated && !data.demo) {
          setStage('confirm');
          return;
        }
      } catch {
        // шалгаж чадсангүй — демо рүү шууд оруулна
      }
      if (!cancelled) enterDemo();
    })();
    return () => { cancelled = true; };
  }, [enterDemo]);

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm text-center">
        <div className="flex justify-center mb-3"><HotolLogo size={144} showText={false} /></div>

        {(stage === 'checking' || stage === 'entering') && (
          <>
            <h1 className="text-lg font-bold">Танилцуулга бэлдэж байна…</h1>
            <p className="text-sm text-gray-500 mt-2">
              СӨХ-ийн даргын удирдлагын панел руу оруулж байна.
            </p>
          </>
        )}

        {stage === 'confirm' && (
          <>
            <h1 className="text-lg font-bold">Та өөрийн эрхээрээ нэвтэрсэн байна</h1>
            <p className="text-sm text-gray-500 mt-2">
              Танилцуулга үзвэл өөрийн СӨХ-ийн эрхээс гарна. Дараа нь дахин нэвтэрнэ.
            </p>
            <button
              onClick={enterDemo}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold text-sm mt-5 active:bg-blue-700 transition"
            >
              Танилцуулга үзэх
            </button>
            <button
              onClick={() => router.replace('/admin')}
              className="w-full text-sm text-gray-500 mt-3 py-2"
            >
              Үгүй, өөрийн панел руугаа буцах
            </button>
          </>
        )}

        {stage === 'error' && (
          <>
            <h1 className="text-lg font-bold">Уучлаарай</h1>
            <p className="text-sm text-red-600 mt-2">{error}</p>
            <button
              onClick={enterDemo}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold text-sm mt-5 active:bg-blue-700 transition"
            >
              Дахин оролдох
            </button>
          </>
        )}
      </div>
    </div>
  );
}
