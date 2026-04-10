'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// ====== MOCK DATA — СӨХ-ийн админ нүднээс ======
const sokh = {
  name: 'Нарантуул СӨХ',
  address: 'Баянгол дүүрэг, 1-р хороо',
  manager: 'Ц. Цэрэндулам',
  totalResidents: 124,
  totalDebt: 4850000,
  totalPaid: 7800000,
  collectionRate: 72,
  pendingMaintenance: 8,
  pendingComplaints: 3,
};

const residents = [
  { name: 'Б. Батболд', apt: 'A-101', debt: 150000, phone: '9911-2233' },
  { name: 'Д. Сараа', apt: 'A-203', debt: 0, phone: '9922-3344' },
  { name: 'Г. Ганбаатар', apt: 'B-105', debt: 85000, phone: '9933-4455' },
  { name: 'О. Оюунаа', apt: 'B-301', debt: 200000, phone: '9944-5566' },
  { name: 'Н. Нарантуяа', apt: 'C-402', debt: 0, phone: '9955-6677' },
  { name: 'С. Сүхбаатар', apt: 'A-505', debt: 50000, phone: '9966-7788' },
  { name: 'Э. Энхжаргал', apt: 'C-201', debt: 100000, phone: '9977-8899' },
  { name: 'Т. Тамир', apt: 'B-404', debt: 0, phone: '9988-9900' },
];

const recentPayments = [
  { name: 'Д. Сараа', apt: 'A-203', amount: 50000, date: '2026.04.08 14:32', method: 'QPay' },
  { name: 'Н. Нарантуяа', apt: 'C-402', amount: 50000, date: '2026.04.08 11:15', method: 'QPay' },
  { name: 'Т. Тамир', apt: 'B-404', amount: 100000, date: '2026.04.07 17:48', method: 'Бэлэн' },
  { name: 'Б. Батболд', apt: 'A-101', amount: 50000, date: '2026.04.05 09:22', method: 'QPay' },
  { name: 'С. Сүхбаатар', apt: 'A-505', amount: 50000, date: '2026.04.04 16:30', method: 'QPay' },
];

const announcements = [
  { id: 1, type: '🚨', title: 'Цэвэр усны засвар', target: 'Бүгд', date: '04.08', status: 'Илгээгдсэн', views: 89 },
  { id: 2, type: '📅', title: 'Оршин суугчдын хурал', target: 'Бүгд', date: '04.05', status: 'Илгээгдсэн', views: 112 },
  { id: 3, type: 'ℹ️', title: 'Зогсоолын шинэ дүрэм', target: 'Машинтай', date: '04.01', status: 'Илгээгдсэн', views: 64 },
];

const maintenanceRequests = [
  { id: 1, title: 'Лифт эвдэрсэн (A блок)', resident: 'Б.Батболд (A-101)', status: 'pending', priority: 'high', date: '04.08' },
  { id: 2, title: 'Орцны гэрэл унтарсан B-2', resident: 'Г.Ганбаатар (B-105)', status: 'in_progress', priority: 'medium', date: '04.07' },
  { id: 3, title: 'Дулааны хоолой алдаж байна', resident: 'О.Оюунаа (B-301)', status: 'pending', priority: 'high', date: '04.06' },
  { id: 4, title: 'Цонхны рам шалбарсан', resident: 'Э.Энхжаргал (C-201)', status: 'pending', priority: 'low', date: '04.05' },
];

const incomeData = [
  { label: 'Сарын хураамж', amount: 6200000, percent: 79 },
  { label: 'Зогсоолын хураамж', amount: 1100000, percent: 14 },
  { label: 'Бусад орлого', amount: 500000, percent: 7 },
];

const expenseData = [
  { label: 'Цахилгаан (нийтийн)', amount: 1200000, percent: 22 },
  { label: 'Цэвэрлэгээ', amount: 900000, percent: 17 },
  { label: 'Засвар үйлчилгээ', amount: 1500000, percent: 28 },
  { label: 'Харуул хамгаалалт', amount: 1000000, percent: 18 },
  { label: 'Удирдлагын зардал', amount: 800000, percent: 15 },
];

const pages = [
  { id: 'dashboard', label: 'Хяналт', icon: '📊' },
  { id: 'residents', label: 'Айлууд', icon: '👥' },
  { id: 'payments', label: 'Төлбөр', icon: '💰' },
  { id: 'announcements', label: 'Зарлал', icon: '📢' },
  { id: 'maintenance', label: 'Засвар', icon: '🔧' },
  { id: 'reports', label: 'Тайлан', icon: '📈' },
];

export default function DemoAdminPage() {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(0);

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

  const totalIncome = incomeData.reduce((s, d) => s + d.amount, 0);
  const totalExpense = expenseData.reduce((s, d) => s + d.amount, 0);
  const debtCount = residents.filter(r => r.debt > 0).length;

  return (
    <div className="h-screen flex flex-col bg-gray-900 overflow-hidden">
      {/* Top demo banner */}
      <div className="bg-yellow-400 text-yellow-900 text-center py-1.5 text-[11px] font-semibold flex-shrink-0">
        Демо горим — СӨХ Удирдлага · {pages[currentPage].label} ({currentPage + 1}/{pages.length})
      </div>

      {/* Horizontal swipe container */}
      <div
        ref={scrollRef}
        className="flex-1 flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory scroll-smooth"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <style>{`div::-webkit-scrollbar { display: none; }`}</style>

        {/* ====== PAGE 1: DASHBOARD ====== */}
        <section className="w-full flex-shrink-0 snap-start overflow-y-auto bg-gray-50">
          <div className="bg-gray-900 text-white px-4 py-4">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 bg-blue-500 rounded-full flex items-center justify-center text-sm font-bold">
                  {sokh.manager.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium">{sokh.manager}</p>
                  <p className="text-[10px] text-white/50">СӨХ Дарга</p>
                </div>
              </div>
              <span className="text-[10px] bg-blue-600 px-2 py-1 rounded-full font-semibold">АДМИН</span>
            </div>
            <h1 className="text-lg font-bold">🏢 {sokh.name}</h1>
            <p className="text-xs text-white/60">{sokh.address}</p>
          </div>

          <div className="px-4 py-4">
            {/* Big stats */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">👥</span>
                  <p className="text-xs text-gray-500">Нийт айл</p>
                </div>
                <p className="text-2xl font-bold">{sokh.totalResidents}</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">⚠️</span>
                  <p className="text-xs text-gray-500">Өртэй</p>
                </div>
                <p className="text-2xl font-bold text-red-500">{debtCount}</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm col-span-2">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-xs text-gray-500">Цуглуулалтын хувь (4-р сар)</p>
                  <p className="text-lg font-bold text-blue-600">{sokh.collectionRate}%</p>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3">
                  <div className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full" style={{ width: `${sokh.collectionRate}%` }} />
                </div>
                <div className="flex justify-between mt-2 text-xs">
                  <span className="text-green-600 font-semibold">+{sokh.totalPaid.toLocaleString()}₮</span>
                  <span className="text-red-500 font-semibold">-{sokh.totalDebt.toLocaleString()}₮</span>
                </div>
              </div>
            </div>

            {/* Action items */}
            <h3 className="text-xs font-semibold text-gray-500 mb-2 mt-4">АНХААРАЛ ШААРДЛАГАТАЙ</h3>
            <div className="space-y-2 mb-4">
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-center gap-3">
                <span className="text-2xl">🔧</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-orange-700">Хүлээгдэж буй засвар</p>
                  <p className="text-xs text-orange-600">{sokh.pendingMaintenance} хүсэлт хариу хүлээж байна</p>
                </div>
                <span className="text-orange-300 text-xl">›</span>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 flex items-center gap-3">
                <span className="text-2xl">📝</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-purple-700">Гомдол / Санал</p>
                  <p className="text-xs text-purple-600">{sokh.pendingComplaints} шинэ хүсэлт</p>
                </div>
                <span className="text-purple-300 text-xl">›</span>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-3">
                <span className="text-2xl">💸</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-700">Их өртэй айл</p>
                  <p className="text-xs text-red-600">2 айл 200,000₮-аас дээш өртэй</p>
                </div>
                <span className="text-red-300 text-xl">›</span>
              </div>
            </div>

            {/* Quick menu */}
            <h3 className="text-xs font-semibold text-gray-500 mb-2">ШУУРХАЙ ҮЙЛДЭЛ</h3>
            <div className="grid grid-cols-3 gap-2 pb-24">
              {[
                { i: '➕', l: 'Зарлал' },
                { i: '👥', l: 'Айл нэмэх' },
                { i: '💰', l: 'Төлбөр' },
                { i: '📊', l: 'Тайлан' },
                { i: '🔧', l: 'Засвар' },
                { i: '⚙️', l: 'Тохируулга' },
              ].map((it, i) => (
                <button key={i} className="bg-white rounded-xl p-3 text-center shadow-sm active:scale-95 transition">
                  <div className="text-2xl mb-1">{it.i}</div>
                  <p className="text-xs">{it.l}</p>
                </button>
              ))}
            </div>
            <p className="text-center text-[11px] text-gray-400 -mt-20 pb-4">← Зүүн тийш гүйлгээд цааш үзнэ үү →</p>
          </div>
        </section>

        {/* ====== PAGE 2: RESIDENTS ====== */}
        <section className="w-full flex-shrink-0 snap-start overflow-y-auto bg-gray-50">
          <div className="bg-gray-900 text-white px-4 py-4">
            <h1 className="text-lg font-bold">👥 Оршин суугчид</h1>
            <p className="text-xs text-white/60">{residents.length} айлын мэдээлэл</p>
          </div>
          <div className="px-4 py-4">
            <div className="flex gap-2 mb-4">
              <button className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-medium">+ Шинэ айл</button>
              <button className="flex-1 bg-white border py-2.5 rounded-xl text-sm font-medium text-gray-700">📥 Excel оруулах</button>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                <p className="text-lg font-bold">{residents.length}</p>
                <p className="text-[10px] text-gray-500">Нийт</p>
              </div>
              <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                <p className="text-lg font-bold text-red-500">{debtCount}</p>
                <p className="text-[10px] text-gray-500">Өртэй</p>
              </div>
              <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                <p className="text-lg font-bold text-green-500">{residents.length - debtCount}</p>
                <p className="text-[10px] text-gray-500">Төлсөн</p>
              </div>
            </div>

            <h3 className="text-xs font-semibold text-gray-500 mb-2">ЖАГСААЛТ</h3>
            <div className="space-y-2 pb-24">
              {residents.map((r, i) => (
                <div key={i} className="bg-white rounded-xl p-3 shadow-sm">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-sm font-bold text-blue-600">
                        {r.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{r.name}</p>
                        <p className="text-xs text-gray-400">🏠 {r.apt} · 📞 {r.phone}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {r.debt > 0 ? (
                        <>
                          <p className="text-sm font-bold text-red-500">{r.debt.toLocaleString()}₮</p>
                          <p className="text-[10px] text-red-400">Өртэй</p>
                        </>
                      ) : (
                        <span className="text-2xl">✅</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ====== PAGE 3: PAYMENTS ====== */}
        <section className="w-full flex-shrink-0 snap-start overflow-y-auto bg-gray-50">
          <div className="bg-gray-900 text-white px-4 py-4">
            <h1 className="text-lg font-bold">💰 Төлбөр цуглуулалт</h1>
            <p className="text-xs text-white/60">2026 оны 4-р сар</p>
          </div>
          <div className="px-4 py-4">
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-4 mb-4 text-white shadow-lg">
              <p className="text-xs opacity-90">Энэ сард цугласан</p>
              <p className="text-3xl font-bold mt-1">{sokh.totalPaid.toLocaleString()}₮</p>
              <div className="mt-3 pt-3 border-t border-white/20 flex justify-between">
                <div>
                  <p className="text-xs opacity-80">Цуглуулалт</p>
                  <p className="text-lg font-bold">{sokh.collectionRate}%</p>
                </div>
                <div className="text-right">
                  <p className="text-xs opacity-80">Үлдсэн өр</p>
                  <p className="text-lg font-bold">{sokh.totalDebt.toLocaleString()}₮</p>
                </div>
              </div>
            </div>

            <div className="flex gap-2 mb-4">
              <button className="flex-1 bg-white border py-2.5 rounded-xl text-sm font-medium text-gray-700">📤 Тайлан татах</button>
              <button className="flex-1 bg-white border py-2.5 rounded-xl text-sm font-medium text-gray-700">🔔 Сануулах</button>
            </div>

            <h3 className="text-xs font-semibold text-gray-500 mb-2">СҮҮЛИЙН ОРЛОГО</h3>
            <div className="space-y-2 pb-24">
              {recentPayments.map((p, i) => (
                <div key={i} className="bg-white rounded-xl p-3 flex justify-between items-center shadow-sm">
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-gray-400">🏠 {p.apt} · {p.method}</p>
                    <p className="text-[10px] text-gray-400">{p.date}</p>
                  </div>
                  <span className="text-green-600 font-bold text-sm">+{p.amount.toLocaleString()}₮</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ====== PAGE 4: ANNOUNCEMENTS ====== */}
        <section className="w-full flex-shrink-0 snap-start overflow-y-auto bg-gray-50">
          <div className="bg-gray-900 text-white px-4 py-4">
            <h1 className="text-lg font-bold">📢 Зарлал удирдах</h1>
            <p className="text-xs text-white/60">{announcements.length} илгээсэн зарлал</p>
          </div>
          <div className="px-4 py-4">
            <button className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium text-sm mb-4 shadow-md">
              + Шинэ зарлал илгээх
            </button>

            <h3 className="text-xs font-semibold text-gray-500 mb-2">ИЛГЭЭСЭН ЗАРЛАЛ</h3>
            <div className="space-y-2 pb-24">
              {announcements.map(a => (
                <div key={a.id} className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-2xl">{a.type}</span>
                    <div className="flex-1">
                      <h3 className="font-semibold text-sm">{a.title}</h3>
                      <p className="text-[11px] text-gray-400">Хүлээн авагч: {a.target} · {a.date}</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-[11px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                      ✓ {a.status}
                    </span>
                    <span className="text-xs text-gray-500">👁 {a.views} харсан</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ====== PAGE 5: MAINTENANCE ====== */}
        <section className="w-full flex-shrink-0 snap-start overflow-y-auto bg-gray-50">
          <div className="bg-gray-900 text-white px-4 py-4">
            <h1 className="text-lg font-bold">🔧 Засварын хүсэлтүүд</h1>
            <p className="text-xs text-white/60">{maintenanceRequests.filter(r => r.status === 'pending').length} хүлээгдэж байна</p>
          </div>
          <div className="px-4 py-4">
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-yellow-700">{maintenanceRequests.filter(r => r.status === 'pending').length}</p>
                <p className="text-[10px] text-yellow-600">Хүлээгдэж буй</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-blue-700">{maintenanceRequests.filter(r => r.status === 'in_progress').length}</p>
                <p className="text-[10px] text-blue-600">Хийгдэж буй</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-green-700">15</p>
                <p className="text-[10px] text-green-600">Дууссан</p>
              </div>
            </div>

            <h3 className="text-xs font-semibold text-gray-500 mb-2">ИДЭВХТЭЙ ХҮСЭЛТҮҮД</h3>
            <div className="space-y-2 pb-24">
              {maintenanceRequests.map(r => {
                const statusColor = r.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700';
                const statusLabel = r.status === 'pending' ? 'Хүлээгдэж буй' : 'Хийгдэж байна';
                const priorityColor = r.priority === 'high' ? 'bg-red-100 text-red-700' : r.priority === 'medium' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600';
                const priorityLabel = r.priority === 'high' ? '🔴 Яаралтай' : r.priority === 'medium' ? '🟠 Дунд' : '⚪ Бага';
                return (
                  <div key={r.id} className="bg-white rounded-xl p-4 shadow-sm">
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <h3 className="font-medium text-sm flex-1">{r.title}</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap ${statusColor}`}>{statusLabel}</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{r.resident} · {r.date}</p>
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${priorityColor}`}>{priorityLabel}</span>
                      <button className="text-xs bg-blue-600 text-white px-3 py-1 rounded-full">Хариу өгөх</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ====== PAGE 6: REPORTS ====== */}
        <section className="w-full flex-shrink-0 snap-start overflow-y-auto bg-gray-50">
          <div className="bg-gray-900 text-white px-4 py-4">
            <h1 className="text-lg font-bold">📈 Санхүүгийн тайлан</h1>
            <p className="text-xs text-white/60">2026 оны 4-р сар</p>
          </div>
          <div className="px-4 py-4 pb-24">
            <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
              <div className="flex justify-around">
                <div className="text-center">
                  <p className="text-xs text-gray-500">Орлого</p>
                  <p className="text-2xl font-bold text-green-600">{(totalIncome / 1000000).toFixed(1)}M₮</p>
                </div>
                <div className="w-px bg-gray-200" />
                <div className="text-center">
                  <p className="text-xs text-gray-500">Зарлага</p>
                  <p className="text-2xl font-bold text-red-500">{(totalExpense / 1000000).toFixed(1)}M₮</p>
                </div>
                <div className="w-px bg-gray-200" />
                <div className="text-center">
                  <p className="text-xs text-gray-500">Үлдэгдэл</p>
                  <p className={`text-2xl font-bold ${totalIncome - totalExpense >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
                    {((totalIncome - totalExpense) / 1000000).toFixed(1)}M₮
                  </p>
                </div>
              </div>
            </div>

            <h3 className="text-xs font-semibold text-green-700 mb-2">📥 ОРЛОГО</h3>
            <div className="space-y-2 mb-4">
              {incomeData.map(d => (
                <div key={d.label} className="bg-white rounded-xl p-3 shadow-sm">
                  <div className="flex justify-between text-sm mb-1">
                    <span>{d.label}</span>
                    <span className="font-semibold">{d.amount.toLocaleString()}₮</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full" style={{ width: `${d.percent}%` }} />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">{d.percent}%</p>
                </div>
              ))}
            </div>

            <h3 className="text-xs font-semibold text-red-700 mb-2">📤 ЗАРЛАГА</h3>
            <div className="space-y-2">
              {expenseData.map(d => (
                <div key={d.label} className="bg-white rounded-xl p-3 shadow-sm">
                  <div className="flex justify-between text-sm mb-1">
                    <span>{d.label}</span>
                    <span className="font-semibold">{d.amount.toLocaleString()}₮</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="bg-red-400 h-2 rounded-full" style={{ width: `${d.percent}%` }} />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">{d.percent}%</p>
                </div>
              ))}
            </div>

            <button onClick={() => router.push('/')} className="w-full mt-4 text-xs text-gray-400 underline">
              Үндсэн хуудас руу буцах
            </button>
          </div>
        </section>
      </div>

      {/* Bottom dots indicator */}
      <div className="bg-gray-800 border-t border-gray-700 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-center gap-3">
          {pages.map((p, i) => (
            <button
              key={p.id}
              onClick={() => goToPage(i)}
              className={`flex flex-col items-center transition ${currentPage === i ? 'text-white opacity-100' : 'text-white opacity-40'}`}
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
