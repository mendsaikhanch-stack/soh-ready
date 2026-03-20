'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';

export default function WelcomePage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.replace('/select');
      } else {
        setChecking(false);
      }
    };
    checkAuth();
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Ачаалж байна...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-600 to-blue-800 flex flex-col">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-white">
        <div className="text-6xl mb-4">🏢</div>
        <h1 className="text-2xl font-bold mb-2">СӨХ Систем</h1>
        <p className="text-blue-200 text-center text-sm leading-relaxed">
          Сууц өмчлөгчдийн холбооны удирдлагын систем
        </p>

        <div className="mt-8 space-y-3 w-full">
          <div className="flex items-center gap-3 bg-white/10 rounded-xl p-3">
            <span className="text-xl">💰</span>
            <div>
              <p className="text-sm font-medium">Төлбөр төлөх</p>
              <p className="text-xs text-blue-200">Сарын төлбөр, өрийн мэдээлэл</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white/10 rounded-xl p-3">
            <span className="text-xl">📢</span>
            <div>
              <p className="text-sm font-medium">Зарлал мэдэгдэл</p>
              <p className="text-xs text-blue-200">СӨХ-ийн мэдээлэл шууд хүлээн авах</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white/10 rounded-xl p-3">
            <span className="text-xl">🔧</span>
            <div>
              <p className="text-sm font-medium">Засвар үйлчилгээ</p>
              <p className="text-xs text-blue-200">Хүсэлт гаргах, явц хянах</p>
            </div>
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="px-6 pb-8 space-y-3">
        <button
          onClick={() => router.push('/register')}
          className="w-full bg-white text-blue-700 py-3.5 rounded-xl font-semibold text-sm active:bg-gray-100 transition"
        >
          Бүртгүүлэх
        </button>
        <button
          onClick={() => router.push('/login')}
          className="w-full bg-white/10 border border-white/30 text-white py-3.5 rounded-xl font-semibold text-sm active:bg-white/20 transition"
        >
          Нэвтрэх
        </button>
      </div>
    </div>
  );
}
