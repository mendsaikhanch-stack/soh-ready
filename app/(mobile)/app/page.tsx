'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';

const features = [
  { icon: '💰', title: 'Төлбөр', desc: 'Онлайнаар төлбөр төлөх, үлдэгдэл шалгах', delay: '0.1s' },
  { icon: '📢', title: 'Зарлал', desc: 'Мэдэгдэл шууд хүлээн авах', delay: '0.2s' },
  { icon: '🔧', title: 'Засвар', desc: 'Хүсэлт гаргах, явц хянах', delay: '0.3s' },
  { icon: '📋', title: 'Тайлан', desc: 'Санхүүгийн тайлан харах', delay: '0.4s' },
];

export default function WelcomePage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.replace('/select');
      } else {
        setChecking(false);
        setTimeout(() => setShow(true), 50);
      }
    };
    checkAuth();
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex items-center justify-center">
        <div className="animate-pulse text-5xl">🏠</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex flex-col overflow-hidden relative">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
      <div className="absolute bottom-32 left-0 w-48 h-48 bg-white/5 rounded-full -translate-x-1/2" />

      {/* Top section */}
      <div className={`flex-1 flex flex-col items-center justify-center px-6 text-white relative z-10 transition-all duration-700 ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        {/* Logo */}
        <div className="w-20 h-20 bg-white/15 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-5 shadow-lg border border-white/20">
          <span className="text-4xl">🏠</span>
        </div>

        <h1 className="text-3xl font-bold tracking-tight mb-1">Тоот</h1>
        <p className="text-blue-200 text-sm mb-8">Таны байрны бүх зүйл нэг дор</p>

        {/* Feature grid */}
        <div className="grid grid-cols-2 gap-2.5 w-full">
          {features.map((f) => (
            <div
              key={f.title}
              className={`bg-white/10 backdrop-blur-sm rounded-2xl p-3.5 border border-white/10 transition-all duration-500 ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
              style={{ transitionDelay: f.delay }}
            >
              <span className="text-2xl block mb-2">{f.icon}</span>
              <p className="text-sm font-semibold">{f.title}</p>
              <p className="text-xs text-blue-200 mt-0.5 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom section */}
      <div className={`px-6 pb-8 pt-4 relative z-10 transition-all duration-700 delay-500 ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        {/* Stats bar */}
        <div className="flex justify-center gap-6 mb-6">
          <div className="text-center">
            <p className="text-white text-lg font-bold">500+</p>
            <p className="text-blue-300 text-xs">Айл өрх</p>
          </div>
          <div className="w-px bg-white/20" />
          <div className="text-center">
            <p className="text-white text-lg font-bold">50+</p>
            <p className="text-blue-300 text-xs">СӨХ</p>
          </div>
          <div className="w-px bg-white/20" />
          <div className="text-center">
            <p className="text-white text-lg font-bold">3</p>
            <p className="text-blue-300 text-xs">Хот</p>
          </div>
        </div>

        <button
          onClick={() => router.push('/register')}
          className="w-full bg-white text-blue-700 py-4 rounded-2xl font-bold text-sm shadow-lg shadow-blue-900/30 active:scale-[0.98] transition-transform"
        >
          Бүртгүүлэх
        </button>
        <button
          onClick={() => router.push('/login')}
          className="w-full mt-3 bg-white/10 backdrop-blur-sm border border-white/25 text-white py-4 rounded-2xl font-semibold text-sm active:bg-white/20 transition"
        >
          Нэвтрэх
        </button>

        <p className="text-center text-blue-300/60 text-xs mt-4">v1.0 · Тоот</p>
      </div>
    </div>
  );
}
