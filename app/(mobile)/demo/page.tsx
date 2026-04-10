'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// ====== MOCK DATA ======
const me = {
  name: 'Б. Батболд',
  apartment: 'A-101',
  phone: '9911-2233',
  email: 'batbold@example.mn',
  sokhName: 'Нарантуул СӨХ',
  sokhAddress: 'Баянгол дүүрэг, 1-р хороо',
  debt: 150000,
};

const myBills = [
  { id: 1, name: 'СӨХ хураамж (4-р сар)', amount: 50000, due: '2026.04.20' },
  { id: 2, name: 'Хогны хураамж', amount: 15000, due: '2026.04.20' },
  { id: 3, name: 'Лифтний засвар', amount: 35000, due: '2026.04.25' },
  { id: 4, name: 'Цахилгаан (3-р сар)', amount: 50000, due: '2026.04.15' },
];

const myPayments = [
  { id: 1, date: '2026.03.15', desc: 'Сарын төлбөр (3-р сар)', amount: 50000 },
  { id: 2, date: '2026.02.14', desc: 'Сарын төлбөр (2-р сар)', amount: 50000 },
  { id: 3, date: '2026.01.18', desc: 'Сарын төлбөр (1-р сар)', amount: 50000 },
];

const announcements = [
  { id: 1, type: '🚨', title: 'Цэвэр усны засвар', content: '2026.04.15-нд 09:00-18:00 цагт цэвэр ус хаагдана. Ус нөөцлөнө үү.', date: '04.08', color: 'bg-red-50 border-red-200' },
  { id: 2, type: '📅', title: 'Оршин суугчдын хурал', content: '2026.04.20-нд 19:00 цагт нийтийн хурал болно. Зогсоолын асуудал, лифтний засвар.', date: '04.05', color: 'bg-blue-50 border-blue-200' },
  { id: 3, type: 'ℹ️', title: 'Зогсоолын шинэ дүрэм', content: 'Зөвхөн бүртгэлтэй машин зогсоно. 04.15-аас мөрдөнө.', date: '04.01', color: 'bg-gray-50 border-gray-200' },
];

const utilities = [
  { type: '💧', label: 'Ус', current: 12.5, prev: 11.0, unit: 'м³', amount: 18750, color: 'bg-blue-50 border-blue-200' },
  { type: '🔥', label: 'Дулаан', current: 285, prev: 260, unit: 'кВт·ц', amount: 42750, color: 'bg-red-50 border-red-200' },
  { type: '⚡', label: 'Цахилгаан', current: 215, prev: 195, unit: 'кВт·ц', amount: 35400, color: 'bg-yellow-50 border-yellow-200' },
];

const myRequests = [
  { id: 1, title: 'Угаалгын өрөөний цоргны эвдрэл', status: 'Хийгдэж байна', date: '04.07', color: 'bg-blue-100 text-blue-700' },
  { id: 2, title: 'Цонхны шил хагарсан', status: 'Дууссан', date: '03.20', color: 'bg-green-100 text-green-700' },
  { id: 3, title: 'Орцны гэрэл унтарсан', status: 'Хүлээгдэж буй', date: '03.15', color: 'bg-yellow-100 text-yellow-700' },
];

const visitors = [
  { id: 1, code: '4827', name: 'Аав ээж', expires: '2026.04.10 22:00', active: true },
  { id: 2, code: '1932', name: 'Сантехникч', expires: '2026.04.09 18:00', active: false },
];

const pages = [
  { id: 'home', label: 'Нүүр', icon: '🏠' },
  { id: 'payments', label: 'Төлбөр', icon: '💰' },
  { id: 'utilities', label: 'Тоолуур', icon: '📊' },
  { id: 'announcements', label: 'Зарлал', icon: '📢' },
  { id: 'maintenance', label: 'Засвар', icon: '🔧' },
  { id: 'visitors', label: 'Зочин', icon: '🚪' },
  { id: 'profile', label: 'Профайл', icon: '👤' },
];

export default function DemoPage() {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(0);

  const totalDue = myBills.reduce((s, b) => s + b.amount, 0);

  // Track which page is in view as user scrolls
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const idx = Math.round(el.scrollLeft / el.clientWidth);
      setCurrentPage(idx);
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  const goToPage = (idx: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: idx * el.clientWidth, behavior: 'smooth' });
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Top demo banner */}
      <div className="bg-yellow-400 text-yellow-900 text-center py-1.5 text-[11px] font-semibold flex-shrink-0">
        Демо горим — Жишээ өгөгдөл · {pages[currentPage].label} ({currentPage + 1}/{pages.length})
      </div>

      {/* Horizontal swipe container */}
      <div
        ref={scrollRef}
        className="flex-1 flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory scroll-smooth"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <style>{`div::-webkit-scrollbar { display: none; }`}</style>

        {/* ====== PAGE 1: HOME ====== */}
        <section className="w-full flex-shrink-0 snap-start overflow-y-auto">
          <div className="bg-blue-600 text-white px-4 py-4">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/20">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center text-sm font-bold">
                  {me.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium">{me.name}</p>
                  <p className="text-xs text-white/70">{me.apartment}</p>
                </div>
              </div>
              <span className="text-xl">🔔</span>
            </div>
            <h1 className="text-lg font-bold">🏢 {me.sokhName}</h1>
            <p className="text-xs text-white/70">{me.sokhAddress}</p>
          </div>

          <div className="mx-4 mt-3 bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-3">
            <span className="text-2xl">💰</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-700">Төлбөрийн үлдэгдэл</p>
              <p className="text-xs text-red-600">{me.debt.toLocaleString()}₮ төлөгдөөгүй</p>
            </div>
            <span className="text-red-300 text-xl">›</span>
          </div>

          <div className="grid grid-cols-3 gap-2 px-4 mt-3">
            <div className="bg-white rounded-xl shadow-sm p-3 text-center">
              <p className="text-xl font-bold">{myPayments.length}</p>
              <p className="text-xs text-gray-500">Төлбөр</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-3 text-center">
              <p className="text-xl font-bold text-red-500">{(me.debt / 1000).toFixed(0)}к</p>
              <p className="text-xs text-gray-500">Өр ₮</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-3 text-center">
              <p className="text-xl font-bold text-blue-500">{announcements.length}</p>
              <p className="text-xs text-gray-500">Зарлал</p>
            </div>
          </div>

          <div className="px-4 mt-4">
            <h2 className="text-sm font-semibold text-gray-500 mb-2">СҮҮЛИЙН ЗАРЛАЛ</h2>
            <div className="space-y-2">
              {announcements.slice(0, 2).map(a => (
                <div key={a.id} className="bg-white rounded-xl p-3 shadow-sm flex items-center gap-3">
                  <span className="text-lg">{a.type}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{a.title}</p>
                    <p className="text-xs text-gray-400">{a.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="px-4 mt-4 pb-24">
            <h2 className="text-sm font-semibold text-gray-500 mb-2">ҮЙЛЧИЛГЭЭНҮҮД</h2>
            <div className="grid grid-cols-3 gap-2">
              {[
                { i: '💰', l: 'Төлбөр' },
                { i: '📊', l: 'Тоолуур' },
                { i: '📢', l: 'Зарлал' },
                { i: '🔧', l: 'Засвар' },
                { i: '🚪', l: 'Зочин' },
                { i: '👤', l: 'Профайл' },
              ].map((it, i) => (
                <div key={i} className="bg-white rounded-xl p-3 text-center shadow-sm">
                  <div className="text-2xl mb-1">{it.i}</div>
                  <p className="text-xs">{it.l}</p>
                </div>
              ))}
            </div>
            <p className="text-center text-[11px] text-gray-400 mt-4">← Зүүн тийш гүйлгээд цааш үзнэ үү →</p>
          </div>
        </section>

        {/* ====== PAGE 2: PAYMENTS ====== */}
        <section className="w-full flex-shrink-0 snap-start overflow-y-auto">
          <div className="bg-blue-600 text-white px-4 py-4">
            <h1 className="text-lg font-bold">💰 Төлбөр</h1>
            <p className="text-xs text-white/70">{me.name} · {me.apartment}</p>
          </div>
          <div className="px-4 py-4">
            <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl p-4 mb-4 text-white shadow-lg">
              <p className="text-xs opacity-90">Нийт төлөх дүн</p>
              <p className="text-3xl font-bold mt-1">{totalDue.toLocaleString()}₮</p>
              <button className="w-full mt-3 bg-white text-red-600 py-3 rounded-xl font-bold text-sm">
                💳 QPay-ээр төлөх
              </button>
            </div>

            <h3 className="text-sm font-semibold text-gray-500 mb-2">ТӨЛБӨРИЙН ЗАДЛАЛ</h3>
            <div className="space-y-2 mb-4">
              {myBills.map(b => (
                <div key={b.id} className="bg-white rounded-xl p-3 flex justify-between items-center shadow-sm">
                  <div>
                    <p className="text-sm font-medium">{b.name}</p>
                    <p className="text-xs text-gray-400">Хүчинтэй: {b.due}</p>
                  </div>
                  <span className="text-sm font-semibold text-red-500">{b.amount.toLocaleString()}₮</span>
                </div>
              ))}
            </div>

            <h3 className="text-sm font-semibold text-gray-500 mb-2">ТҮҮХ</h3>
            <div className="space-y-2 pb-24">
              {myPayments.map(p => (
                <div key={p.id} className="bg-white rounded-xl p-3 flex justify-between items-center shadow-sm">
                  <div>
                    <p className="text-sm font-medium">{p.desc}</p>
                    <p className="text-xs text-gray-400">{p.date}</p>
                  </div>
                  <span className="text-green-600 font-semibold text-sm">+{p.amount.toLocaleString()}₮</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ====== PAGE 3: UTILITIES ====== */}
        <section className="w-full flex-shrink-0 snap-start overflow-y-auto">
          <div className="bg-blue-600 text-white px-4 py-4">
            <h1 className="text-lg font-bold">📊 Тоолуурын хэрэглээ</h1>
            <p className="text-xs text-white/70">2026 оны 4-р сар</p>
          </div>
          <div className="px-4 py-4 pb-24">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 text-xs text-blue-700">
              💡 Сар бүрийн заалтаа оруулж хэрэглээгээ хянаарай.
            </div>
            <div className="space-y-3">
              {utilities.map(u => (
                <div key={u.label} className={`rounded-xl p-4 border shadow-sm ${u.color}`}>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-3xl">{u.type}</span>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{u.label}</p>
                      <p className="text-xs text-gray-500">Энэ сарын хэрэглээ</p>
                    </div>
                    <p className="text-xl font-bold">{(u.current - u.prev).toFixed(1)}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs border-t pt-2">
                    <div>
                      <p className="text-gray-400">Өмнөх</p>
                      <p className="font-semibold">{u.prev}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Одоо</p>
                      <p className="font-semibold">{u.current}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Дүн</p>
                      <p className="font-semibold text-red-500">{u.amount.toLocaleString()}₮</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ====== PAGE 4: ANNOUNCEMENTS ====== */}
        <section className="w-full flex-shrink-0 snap-start overflow-y-auto">
          <div className="bg-blue-600 text-white px-4 py-4">
            <h1 className="text-lg font-bold">📢 Зарлал, мэдээлэл</h1>
            <p className="text-xs text-white/70">{announcements.length} мэдэгдэл</p>
          </div>
          <div className="px-4 py-4 space-y-3 pb-24">
            {announcements.map(a => (
              <div key={a.id} className={`rounded-xl p-4 border shadow-sm ${a.color}`}>
                <div className="flex items-start gap-2">
                  <span className="text-2xl">{a.type}</span>
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <h3 className="font-semibold text-sm">{a.title}</h3>
                      <span className="text-xs text-gray-400">{a.date}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1 leading-relaxed">{a.content}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ====== PAGE 5: MAINTENANCE ====== */}
        <section className="w-full flex-shrink-0 snap-start overflow-y-auto">
          <div className="bg-blue-600 text-white px-4 py-4">
            <h1 className="text-lg font-bold">🔧 Засварын хүсэлт</h1>
            <p className="text-xs text-white/70">Миний {myRequests.length} хүсэлт</p>
          </div>
          <div className="px-4 py-4 pb-24">
            <button className="w-full bg-orange-500 text-white py-3 rounded-xl font-medium text-sm mb-4 shadow-md">
              + Шинэ хүсэлт гаргах
            </button>
            <h3 className="text-sm font-semibold text-gray-500 mb-2">МИНИЙ ХҮСЭЛТҮҮД</h3>
            <div className="space-y-2">
              {myRequests.map(r => (
                <div key={r.id} className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex justify-between items-start mb-1 gap-2">
                    <h3 className="font-medium text-sm flex-1">{r.title}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap ${r.color}`}>{r.status}</span>
                  </div>
                  <p className="text-xs text-gray-400">{r.date}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ====== PAGE 6: VISITORS ====== */}
        <section className="w-full flex-shrink-0 snap-start overflow-y-auto">
          <div className="bg-blue-600 text-white px-4 py-4">
            <h1 className="text-lg font-bold">🚪 Зочны бүртгэл</h1>
            <p className="text-xs text-white/70">QR код үүсгэж зочдод илгээх</p>
          </div>
          <div className="px-4 py-4 pb-24">
            <button className="w-full bg-teal-500 text-white py-3 rounded-xl font-medium text-sm mb-4 shadow-md">
              + Шинэ зочин урих
            </button>
            <h3 className="text-sm font-semibold text-gray-500 mb-2">МИНИЙ КОДУУД</h3>
            <div className="space-y-2">
              {visitors.map(v => (
                <div key={v.id} className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{v.name}</p>
                      <p className="text-xs text-gray-400">Хүчинтэй: {v.expires}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold tracking-wider text-blue-600">{v.code}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${v.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {v.active ? '● Идэвхтэй' : 'Дууссан'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ====== PAGE 7: PROFILE ====== */}
        <section className="w-full flex-shrink-0 snap-start overflow-y-auto">
          <div className="bg-blue-600 text-white px-4 py-4">
            <h1 className="text-lg font-bold">👤 Профайл</h1>
            <p className="text-xs text-white/70">Миний мэдээлэл</p>
          </div>
          <div className="px-4 py-4 pb-24">
            <div className="bg-white rounded-2xl p-6 shadow-sm text-center mb-4">
              <div className="w-20 h-20 mx-auto bg-blue-100 rounded-full flex items-center justify-center text-3xl font-bold text-blue-600 mb-3">
                {me.name.charAt(0)}
              </div>
              <h2 className="font-bold text-lg">{me.name}</h2>
              <p className="text-sm text-gray-500">{me.apartment} · {me.sokhName}</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm divide-y">
              <div className="flex justify-between items-center px-4 py-3">
                <span className="text-sm text-gray-500">Утас</span>
                <span className="text-sm font-medium">{me.phone}</span>
              </div>
              <div className="flex justify-between items-center px-4 py-3">
                <span className="text-sm text-gray-500">Имэйл</span>
                <span className="text-sm font-medium">{me.email}</span>
              </div>
              <div className="flex justify-between items-center px-4 py-3">
                <span className="text-sm text-gray-500">Тоот</span>
                <span className="text-sm font-medium">{me.apartment}</span>
              </div>
              <div className="flex justify-between items-center px-4 py-3">
                <span className="text-sm text-gray-500">СӨХ</span>
                <span className="text-sm font-medium">{me.sokhName}</span>
              </div>
            </div>

            <button className="w-full mt-4 bg-gray-100 text-gray-700 py-3 rounded-xl text-sm font-medium">
              ✏️ Засах
            </button>

            <button onClick={() => router.push('/')} className="w-full mt-3 text-xs text-gray-400 underline">
              Үндсэн хуудас руу буцах
            </button>
          </div>
        </section>
      </div>

      {/* Bottom dots indicator */}
      <div className="bg-white border-t px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-center gap-2">
          {pages.map((p, i) => (
            <button
              key={p.id}
              onClick={() => goToPage(i)}
              className={`flex flex-col items-center transition ${currentPage === i ? 'opacity-100' : 'opacity-40'}`}
            >
              <span className="text-base leading-none">{p.icon}</span>
              <span className="text-[9px] mt-0.5">{p.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
