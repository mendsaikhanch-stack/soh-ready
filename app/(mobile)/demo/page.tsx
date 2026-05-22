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

const myDeliveries = [
  {
    id: 1,
    sender: 'Шарга маркет',
    senderEmoji: '🛒',
    note: 'Хүнсний бүтээгдэхүүн',
    arrivedAt: '04.08  14:32',
    boxNo: 'A-12',
    code: '8472',
    hoursLeft: 18,
  },
  {
    id: 2,
    sender: 'BookHub',
    senderEmoji: '📚',
    note: 'Ном (1 ширхэг)',
    arrivedAt: '04.08  11:15',
    boxNo: 'B-04',
    code: '2391',
    hoursLeft: 15,
  },
];

const deliveryHistory = [
  { id: 11, sender: 'Унаа Худалдаа', emoji: '📦', date: '04.05', status: 'Авсан' },
  { id: 12, sender: 'GoGo Mongolia', emoji: '🛍️', date: '04.02', status: 'Авсан' },
  { id: 13, sender: 'Шарга маркет', emoji: '🛒', date: '03.28', status: 'Авсан' },
];

const easyBoxInfo = {
  location: '1-р давхар, лифтний дэргэд',
  hours: '06:00 - 24:00',
  totalBoxes: 24,
};

const myParking = [
  { id: 1, plate: '0123 УБА', model: 'Toyota Prius', color: 'Цагаан', spot: 'P7' },
];

const myBlockingReports = [
  { id: 1, plate: '0123 УБА', status: 'resolved', date: '04.03', label: 'Шийдвэрлэсэн' },
];

const occupiedSpots = new Set(['P1','P2','P4','P7','P9','P12','P15','P17','P20','P22','P25','P27']);

const pages = [
  { id: 'home', label: 'Нүүр', icon: '🏠' },
  { id: 'payments', label: 'Төлбөр', icon: '💰' },
  { id: 'utilities', label: 'Тоолуур', icon: '📊' },
  { id: 'announcements', label: 'Зарлал', icon: '📢' },
  { id: 'maintenance', label: 'Засвар', icon: '🔧' },
  { id: 'parking', label: 'Зогсоол', icon: '🚗' },
  { id: 'gate', label: 'Хаалга', icon: '🚧' },
  { id: 'elevator', label: 'Лифт', icon: '🛗' },
  { id: 'visitors', label: 'Зочин', icon: '🚪' },
  { id: 'parcels', label: 'Илгээмж', icon: '📦' },
  { id: 'profile', label: 'Профайл', icon: '👤' },
];

export default function DemoPage() {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [revealedCodes, setRevealedCodes] = useState<Set<number>>(new Set());

  const totalDue = myBills.reduce((s, b) => s + b.amount, 0);

  const toggleCode = (id: number) => {
    setRevealedCodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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

        {/* ====== PAGE 6: PARKING ====== */}
        <section className="w-full flex-shrink-0 snap-start overflow-y-auto">
          <div className="bg-indigo-600 text-white px-4 py-4">
            <h1 className="text-lg font-bold">🚗 Зогсоол</h1>
            <p className="text-xs text-white/70">Машин, хаалт, зогсоолын схем</p>
          </div>
          <div className="px-4 py-4 pb-24">
            {/* My vehicles */}
            <h3 className="text-sm font-semibold text-gray-500 mb-2">МИНИЙ МАШИН</h3>
            <div className="space-y-2 mb-4">
              {myParking.map(v => (
                <div key={v.id} className="bg-white rounded-xl p-3 shadow-sm flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                    <span className="text-2xl">🚗</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-blue-700">{v.plate}</p>
                    <p className="text-xs text-gray-500">{v.model} · {v.color} · {v.spot}</p>
                  </div>
                  <span className="text-blue-500 text-xs font-medium px-2 py-1 bg-blue-50 rounded-lg">QR</span>
                </div>
              ))}
              <button className="w-full text-xs text-blue-600 font-medium py-2">+ Машин нэмэх</button>
            </div>

            {/* Gate open button */}
            <button className="w-full bg-green-600 text-white py-3.5 rounded-xl font-medium mb-3 flex items-center justify-center gap-2 shadow-sm">
              <span>🚧</span><span>Хаалт нээх хүсэлт</span>
            </button>

            {/* Blocking report */}
            <button className="w-full bg-red-50 border border-red-200 text-red-700 py-3.5 rounded-xl font-medium mb-4 flex items-center justify-center gap-2">
              <span>🚫</span><span>Машин хаагдсан мэдэгдэл</span>
            </button>

            {/* Past blocking reports */}
            {myBlockingReports.length > 0 && (
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-gray-500 mb-2">ӨМНӨХ МЭДЭГДЛҮҮД</h3>
                <div className="space-y-2">
                  {myBlockingReports.map(r => (
                    <div key={r.id} className="bg-white rounded-xl p-3 shadow-sm flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{r.plate}</p>
                        <p className="text-xs text-gray-400">{r.date}</p>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">{r.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Spot map */}
            <h3 className="text-xs font-semibold text-gray-500 mb-2">🅿️ ЗОГСООЛЫН СХЕМ</h3>
            <div className="bg-white rounded-xl p-3 shadow-sm">
              <div className="flex items-center gap-3 mb-2 text-[10px]">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-green-100 border border-green-300 rounded"></span> Сул ({30 - occupiedSpots.size})</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-red-100 border border-red-300 rounded"></span> Эзэлсэн ({occupiedSpots.size})</span>
              </div>
              <div className="grid grid-cols-6 gap-1">
                {Array.from({ length: 30 }, (_, i) => {
                  const spot = `P${i + 1}`;
                  const isOcc = occupiedSpots.has(spot);
                  const isMine = myParking[0]?.spot === spot;
                  return (
                    <div key={spot} className={`text-[10px] text-center rounded py-1.5 border ${
                      isMine ? 'bg-blue-100 border-blue-400 text-blue-800 font-bold' :
                      isOcc ? 'bg-red-50 border-red-200 text-red-600' :
                      'bg-green-50 border-green-200 text-green-700'
                    }`}>
                      {spot}{isMine && ' ★'}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ====== PAGE 7: GATE ====== */}
        <section className="w-full flex-shrink-0 snap-start overflow-y-auto">
          <div className="bg-slate-800 text-white px-4 py-4">
            <h1 className="text-lg font-bold">🚧 Хотхоны хаалга</h1>
            <p className="text-xs text-white/70">QR-аар нээх, зочинд QR илгээх</p>
          </div>
          <div className="px-4 py-4 pb-24 space-y-4">
            {/* My QR */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-slate-700 to-slate-900 px-4 py-3 text-white">
                <p className="text-xs opacity-80">Миний QR</p>
                <p className="font-semibold text-sm">{me.name} · {me.apartment}</p>
              </div>
              <div className="px-4 py-4 flex flex-col items-center gap-2">
                <div className="bg-white p-3 rounded-xl border-2 border-gray-200">
                  <div className="w-32 h-32 bg-[repeating-linear-gradient(45deg,#000_0,#000_3px,#fff_3px,#fff_6px)] rounded" />
                </div>
                <p className="text-[10px] text-gray-500 text-center">Хаалганы скэннерт ойртуулна уу</p>
              </div>
            </div>

            {/* Gate open button */}
            <button className="w-full bg-green-600 text-white py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow-sm">
              <span>🚧</span><span>Хаалт нээх хүсэлт илгээх</span>
            </button>

            {/* Guest QR card */}
            <div className="bg-white rounded-2xl shadow-sm p-3">
              <p className="text-sm font-medium mb-2">🎫 Зочинд QR илгээх</p>
              <input type="text" placeholder="Зочны нэр" defaultValue="Ц. Бат-Эрдэнэ" className="w-full border rounded-lg px-3 py-2 text-sm mb-2" />
              <div className="flex gap-2 mb-2">
                {[30, 60, 120, 240].map(m => (
                  <div key={m} className={`flex-1 text-xs py-1.5 rounded-lg border text-center ${m === 60 ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600'}`}>
                    {m} мин
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-gray-500 text-center">Зочиндоо илгээгээд 60 мин дотор хүчинтэй</p>
            </div>

            {/* Recent events */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 mb-2">СҮҮЛИЙН ҮЙЛДЭЛ</h3>
              <div className="bg-white rounded-xl shadow-sm divide-y">
                {[
                  { icon: '✅', text: 'Нээгдсэн', time: '14:32', src: 'QR' },
                  { icon: '🕐', text: 'Хүсэлт илгээсэн · Зочин Б.Болд', time: '11:08', src: 'Зочин' },
                  { icon: '✅', text: 'Нээгдсэн', time: 'Өчигдөр 18:45', src: 'QR' },
                ].map((e, i) => (
                  <div key={i} className="px-3 py-2.5 flex items-center gap-3">
                    <span className="text-lg">{e.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{e.text}</p>
                      <p className="text-[10px] text-gray-400">{e.time} · {e.src}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ====== PAGE 8: ELEVATOR ====== */}
        <section className="w-full flex-shrink-0 snap-start overflow-y-auto">
          <div className="bg-indigo-700 text-white px-4 py-4">
            <h1 className="text-lg font-bold">🛗 Лифт</h1>
            <p className="text-xs text-white/70">Дуудах, QR харуулах</p>
          </div>
          <div className="px-4 py-4 pb-24 space-y-4">
            {/* My QR */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 px-4 py-3 text-white">
                <p className="text-xs opacity-80">Миний QR</p>
                <p className="font-semibold text-sm">{me.name} · {me.apartment} · 3-р давхар</p>
              </div>
              <div className="px-4 py-4 flex flex-col items-center gap-2">
                <div className="bg-white p-3 rounded-xl border-2 border-gray-200">
                  <div className="w-32 h-32 bg-[repeating-linear-gradient(-45deg,#000_0,#000_3px,#fff_3px,#fff_6px)] rounded" />
                </div>
                <p className="text-[10px] text-gray-500 text-center">Скэннерт ойртуулахад 3-р давхрыг автоматаар сонгоно</p>
              </div>
            </div>

            {/* Quick call */}
            <button className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow-sm">
              <span>🛗</span><span>3-р давхар руу дуудах</span>
            </button>

            {/* Elevator selector */}
            <div className="bg-white rounded-xl p-3 shadow-sm">
              <p className="text-xs font-semibold text-gray-500 mb-2">ЛИФТ СОНГОХ</p>
              <div className="flex gap-2">
                <div className="flex-1 py-2 rounded-lg bg-indigo-600 text-white text-center text-sm">Лифт #1</div>
                <div className="flex-1 py-2 rounded-lg border border-gray-200 text-gray-600 text-center text-sm">Лифт #2</div>
              </div>
            </div>

            {/* Floor picker */}
            <div className="bg-white rounded-xl p-3 shadow-sm">
              <p className="text-xs font-semibold text-gray-500 mb-2">ДАВХАР СОНГОХ</p>
              <div className="grid grid-cols-4 gap-1.5">
                {Array.from({ length: 16 }, (_, i) => i + 1).map(f => {
                  const isMine = f === 3;
                  const isSel = f === 7;
                  return (
                    <div key={f} className={`aspect-square rounded-lg border text-sm font-medium flex flex-col items-center justify-center ${
                      isSel ? 'bg-indigo-600 text-white border-indigo-600' :
                      isMine ? 'bg-blue-50 border-blue-300 text-blue-700' :
                      'border-gray-200 text-gray-700'
                    }`}>
                      {f}
                      {isMine && <span className="text-[7px] opacity-70">миний</span>}
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 w-full bg-green-600 text-white py-2.5 rounded-lg text-sm font-medium text-center">
                7-р давхар руу дуудах
              </div>
            </div>

            {/* Recent calls */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 mb-2">СҮҮЛИЙН ДУУДЛАГА</h3>
              <div className="bg-white rounded-xl shadow-sm divide-y">
                {[
                  { icon: '✅', text: 'Лифт #1 · 1 → 3', time: '14:28', status: 'Ирсэн', color: 'bg-green-100 text-green-700' },
                  { icon: '🕐', text: 'Лифт #2 · 1 → 7', time: '13:50', status: 'Хүлээгдэж буй', color: 'bg-yellow-100 text-yellow-700' },
                  { icon: '✅', text: 'Лифт #1 · 1 → 3', time: 'Өчигдөр 20:14', status: 'Ирсэн', color: 'bg-green-100 text-green-700' },
                ].map((c, i) => (
                  <div key={i} className="px-3 py-2.5 flex items-center gap-3">
                    <span className="text-lg">{c.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{c.text}</p>
                      <p className="text-[10px] text-gray-400">{c.time}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${c.color}`}>{c.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ====== PAGE 9: VISITORS ====== */}
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

        {/* ====== PAGE 7: PARCELS (EasyBox) ====== */}
        <section className="w-full flex-shrink-0 snap-start overflow-y-auto">
          <div className="bg-gradient-to-br from-orange-500 to-amber-600 text-white px-4 py-4">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold">📦 Илгээмж</h1>
              <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full font-semibold">EasyBox</span>
            </div>
            <p className="text-xs text-white/80 mt-0.5">{easyBoxInfo.location}</p>
          </div>
          <div className="px-4 py-4 pb-24">
            {/* Hero */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-orange-200 rounded-2xl p-4 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-orange-700 font-semibold">ХҮЛЭЭЖ БУЙ</p>
                  <p className="text-3xl font-bold text-orange-900">{myDeliveries.length}</p>
                  <p className="text-[11px] text-orange-700">илгээмж танай хайрцагт байна</p>
                </div>
                <span className="text-5xl">📬</span>
              </div>
            </div>

            {/* Active deliveries */}
            <h3 className="text-xs font-semibold text-gray-500 mb-2">⏳ АВАХ ИЛГЭЭМЖ</h3>
            <div className="space-y-2 mb-4">
              {myDeliveries.map(d => {
                const revealed = revealedCodes.has(d.id);
                const urgent = d.hoursLeft < 24;
                return (
                  <div key={d.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <div className="p-3">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl shrink-0">{d.senderEmoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold">{d.sender}</p>
                          <p className="text-[11px] text-gray-500">{d.note}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">📅 {d.arrivedAt} · Хайрцаг {d.boxNo}</p>
                        </div>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${urgent ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                          {d.hoursLeft < 24 ? `${d.hoursLeft} цаг` : `${Math.floor(d.hoursLeft / 24)} өдөр`} үлдсэн
                        </span>
                      </div>

                      {revealed ? (
                        <div className="mt-3 pt-3 border-t border-dashed border-gray-200 flex items-center gap-3">
                          <div className="w-16 h-16 bg-gray-900 rounded-lg flex items-center justify-center text-white text-2xl shrink-0">
                            ⬛
                          </div>
                          <div className="flex-1">
                            <p className="text-[10px] text-gray-500 uppercase font-semibold">Хүлээн авах код</p>
                            <p className="text-3xl font-bold font-mono tracking-widest text-gray-900">{d.code}</p>
                            <p className="text-[10px] text-gray-400">Хайрцганд гарын тэмдэг тавьж нээнэ</p>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleCode(d.id)}
                          className="mt-3 w-full bg-gradient-to-br from-orange-500 to-amber-600 text-white text-sm font-semibold py-2.5 rounded-lg active:scale-[0.98] transition"
                        >
                          📱 Хүлээн авах код харах
                        </button>
                      )}

                      {revealed && (
                        <button
                          type="button"
                          onClick={() => toggleCode(d.id)}
                          className="mt-2 w-full text-[10px] text-gray-400 underline"
                        >
                          Кодыг нуух
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-[11px] text-blue-900 leading-relaxed mb-4">
              <p className="font-semibold mb-1">ℹ️ Хэрхэн ажиллах вэ</p>
              <ol className="list-decimal pl-4 space-y-0.5 text-[10px]">
                <li>Захиалга өгөхдөө хүргэлтийн хаягт энэ EasyBox-ын код өгнө</li>
                <li>Хайрцагт орохдоо апп болон SMS-р мэдэгдэнэ</li>
                <li>2 хоногийн дотор очиж авна — дараа нь буцаагдана</li>
              </ol>
            </div>

            {/* History */}
            <h3 className="text-xs font-semibold text-gray-500 mb-2">📜 ӨМНӨХ ИЛГЭЭМЖ</h3>
            <div className="bg-white rounded-xl shadow-sm divide-y">
              {deliveryHistory.map(h => (
                <div key={h.id} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="text-xl shrink-0">{h.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{h.sender}</p>
                    <p className="text-[10px] text-gray-400">{h.date}</p>
                  </div>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 shrink-0">
                    ✓ {h.status}
                  </span>
                </div>
              ))}
            </div>

            {/* Location */}
            <div className="mt-4 bg-white rounded-xl shadow-sm p-3 flex items-center gap-3">
              <span className="text-2xl">📍</span>
              <div className="flex-1">
                <p className="text-xs text-gray-500">Хайрцагны байршил</p>
                <p className="text-sm font-medium">{easyBoxInfo.location}</p>
                <p className="text-[10px] text-gray-400">Цаг: {easyBoxInfo.hours} · {easyBoxInfo.totalBoxes} хайрцагтай</p>
              </div>
            </div>
          </div>
        </section>

        {/* ====== PAGE 8: PROFILE ====== */}
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
