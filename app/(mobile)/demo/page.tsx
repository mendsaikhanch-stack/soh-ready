'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const tabs = ['Нүүр', 'Төлбөр', 'Зарлал', 'Засвар', 'Тайлан'];
const tabIcons = ['🏠', '💰', '📢', '🔧', '📋'];

const residents = [
  { name: 'Б. Батболд', apt: 'A-101', debt: 150000, paid: 350000 },
  { name: 'Д. Сараа', apt: 'A-203', debt: 0, paid: 500000 },
  { name: 'Г. Ганбаатар', apt: 'B-105', debt: 85000, paid: 215000 },
  { name: 'О. Оюунаа', apt: 'B-301', debt: 200000, paid: 100000 },
  { name: 'Н. Нарантуяа', apt: 'C-402', debt: 0, paid: 500000 },
  { name: 'С. Сүхбаатар', apt: 'A-505', debt: 50000, paid: 450000 },
  { name: 'Э. Энхжаргал', apt: 'C-201', debt: 100000, paid: 200000 },
  { name: 'Т. Тамир', apt: 'B-404', debt: 0, paid: 500000 },
];

const payments = [
  { name: 'Д. Сараа', apt: 'A-203', amount: 50000, date: '2026.03.20', desc: 'Сарын төлбөр' },
  { name: 'Н. Нарантуяа', apt: 'C-402', amount: 50000, date: '2026.03.19', desc: 'Сарын төлбөр' },
  { name: 'Т. Тамир', apt: 'B-404', amount: 100000, date: '2026.03.18', desc: '2 сарын төлбөр' },
  { name: 'Б. Батболд', apt: 'A-101', amount: 50000, date: '2026.03.15', desc: 'Сарын төлбөр' },
  { name: 'С. Сүхбаатар', apt: 'A-505', amount: 50000, date: '2026.03.12', desc: 'Сарын төлбөр' },
];

const announcements = [
  { type: '🚨', title: 'Цэвэр усны засвар', content: '2026.03.25-нд 09:00-18:00 цагт цэвэр ус хаагдана. Ус нөөцлөнө үү.', date: '03.21', color: 'bg-red-50 border-red-200' },
  { type: '📅', title: 'Оршин суугчдын хурал', content: '2026.04.01-нд 19:00 цагт хурал болно. Зогсоолын асуудал хэлэлцэнэ.', date: '03.20', color: 'bg-blue-50 border-blue-200' },
  { type: 'ℹ️', title: 'Зогсоолын шинэ дүрэм', content: 'Зөвхөн бүртгэлтэй машин зогсоно. 04.01-ээс мөрдөнө.', date: '03.18', color: 'bg-gray-50 border-gray-200' },
  { type: '⚠️', title: 'Хогны цагийн хуваарь', content: 'Хог 08:00-10:00, 18:00-20:00 цагт гаргана. Бусад цагт хориглоно.', date: '03.15', color: 'bg-yellow-50 border-yellow-200' },
];

const maintenanceItems = [
  { title: 'Лифт эвдэрсэн (A блок)', status: 'in_progress', statusLabel: 'Хийгдэж байна', color: 'bg-blue-100 text-blue-700', date: '03.19' },
  { title: 'Орцны гэрэл унтарсан B-2', status: 'completed', statusLabel: 'Дууссан', color: 'bg-green-100 text-green-700', date: '03.17' },
  { title: 'Дулааны хоолой алдаж байна', status: 'pending', statusLabel: 'Хүлээгдэж буй', color: 'bg-yellow-100 text-yellow-700', date: '03.21' },
];

const incomeData = [
  { label: 'Сарын төлбөр', amount: 7800000, percent: 72 },
  { label: 'Зогсоолын хураамж', amount: 2100000, percent: 19 },
  { label: 'Бусад орлого', amount: 900000, percent: 9 },
];

const expenseData = [
  { label: 'Цахилгаан (нийтийн)', amount: 1200000, percent: 22 },
  { label: 'Цэвэрлэгээ', amount: 900000, percent: 17 },
  { label: 'Засвар үйлчилгээ', amount: 1500000, percent: 28 },
  { label: 'Харуул хамгаалалт', amount: 1000000, percent: 18 },
  { label: 'Удирдлагын зардал', amount: 800000, percent: 15 },
];

export default function DemoPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(0);
  const [reportTab, setReportTab] = useState<'income' | 'expense'>('income');

  const totalDebt = residents.reduce((s, r) => s + r.debt, 0);
  const debtCount = residents.filter(r => r.debt > 0).length;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Demo banner */}
      <div className="bg-yellow-400 text-yellow-900 text-center py-2 text-xs font-semibold">
        Демо горим — Бодит өгөгдөл биш · <button onClick={() => router.push('/')} className="underline">Буцах</button>
      </div>

      {/* Header */}
      <div className="bg-blue-600 text-white px-4 py-3">
        <h1 className="text-base font-bold">Нарантуул СӨХ</h1>
        <p className="text-xs text-blue-200">Баянгол дүүрэг, 1-р хороо</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto pb-20">
        {/* Tab: Нүүр */}
        {activeTab === 0 && (
          <div className="px-4 py-4">
            {/* Pricing */}
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-4 mb-4 text-white shadow-lg">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🎁</span>
                <h3 className="font-bold text-sm">Эхний 1 сар ҮНЭГҮЙ туршилт</h3>
              </div>
              <div className="bg-white/15 backdrop-blur-sm rounded-xl p-3 mb-2">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-xs text-blue-200">Сарын хураамж (2-р сараас)</p>
                    <p className="text-2xl font-bold">50,000₮<span className="text-sm font-normal text-blue-200">/сар</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-blue-200">Айл тус бүр</p>
                    <p className="text-2xl font-bold">1,000₮<span className="text-sm font-normal text-blue-200">/сар</span></p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-blue-200 text-center">Жишээ: 100 айлтай СӨХ → 50,000 + 100×1,000 = <span className="text-white font-semibold">150,000₮/сар</span></p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                <p className="text-xl font-bold">{residents.length}</p>
                <p className="text-xs text-gray-500">Нийт айл</p>
              </div>
              <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                <p className="text-xl font-bold text-red-500">{debtCount}</p>
                <p className="text-xs text-gray-500">Өртэй</p>
              </div>
              <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                <p className="text-xl font-bold text-red-500">{(totalDebt / 1000).toFixed(0)}к</p>
                <p className="text-xs text-gray-500">Нийт өр ₮</p>
              </div>
            </div>

            {/* Recent activity */}
            <h3 className="text-sm font-semibold text-gray-500 mb-2">СҮҮЛИЙН ТӨЛБӨР</h3>
            <div className="space-y-2 mb-4">
              {payments.slice(0, 3).map((p, i) => (
                <div key={i} className="bg-white rounded-xl p-3 flex justify-between items-center shadow-sm">
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.date}</p>
                  </div>
                  <span className="text-green-600 font-semibold text-sm">+{p.amount.toLocaleString()}₮</span>
                </div>
              ))}
            </div>

            {/* Residents */}
            <h3 className="text-sm font-semibold text-gray-500 mb-2">ОРШИН СУУГЧИД</h3>
            <div className="space-y-1.5">
              {residents.map((r, i) => (
                <div key={i} className="bg-white rounded-xl p-3 flex justify-between items-center shadow-sm">
                  <div>
                    <p className="text-sm font-medium">{r.name}</p>
                    <p className="text-xs text-gray-400">🏠 {r.apt}</p>
                  </div>
                  <span className={`text-sm font-semibold ${r.debt > 0 ? 'text-red-500' : 'text-green-500'}`}>
                    {r.debt > 0 ? `${r.debt.toLocaleString()}₮` : '✅'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab: Төлбөр */}
        {activeTab === 1 && (
          <div className="px-4 py-4">
            <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
              <div className="flex justify-between mb-3">
                <div>
                  <p className="text-xs text-gray-500">Сарын төлбөр</p>
                  <p className="text-xl font-bold">50,000₮</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Цуглуулалтын хувь</p>
                  <p className="text-xl font-bold text-blue-600">72%</p>
                </div>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3">
                <div className="bg-blue-500 h-3 rounded-full" style={{ width: '72%' }} />
              </div>
            </div>

            <h3 className="text-sm font-semibold text-gray-500 mb-2">ТӨЛБӨРИЙН ТҮҮХ</h3>
            <div className="space-y-2">
              {payments.map((p, i) => (
                <div key={i} className="bg-white rounded-xl p-3 flex justify-between items-center shadow-sm">
                  <div>
                    <p className="text-sm font-medium">{p.name} ({p.apt})</p>
                    <p className="text-xs text-gray-400">{p.date} · {p.desc}</p>
                  </div>
                  <span className="text-green-600 font-semibold text-sm">{p.amount.toLocaleString()}₮</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab: Зарлал */}
        {activeTab === 2 && (
          <div className="px-4 py-4 space-y-3">
            {announcements.map((a, i) => (
              <div key={i} className={`rounded-xl p-4 border shadow-sm ${a.color}`}>
                <div className="flex items-start gap-2">
                  <span className="text-lg">{a.type}</span>
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <h3 className="font-semibold text-sm">{a.title}</h3>
                      <span className="text-xs text-gray-400">{a.date}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{a.content}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab: Засвар */}
        {activeTab === 3 && (
          <div className="px-4 py-4">
            <button className="w-full bg-orange-500 text-white py-3 rounded-xl font-medium text-sm mb-4">
              + Шинэ хүсэлт гаргах
            </button>
            <div className="space-y-2">
              {maintenanceItems.map((m, i) => (
                <div key={i} className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-medium text-sm">{m.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${m.color}`}>{m.statusLabel}</span>
                  </div>
                  <p className="text-xs text-gray-400">{m.date}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab: Тайлан */}
        {activeTab === 4 && (
          <div className="px-4 py-4">
            <div className="bg-white rounded-xl p-4 shadow-sm mb-4 text-center">
              <p className="text-xs text-gray-500">2026 оны 3-р сар</p>
              <div className="flex justify-center gap-8 mt-2">
                <div>
                  <p className="text-lg font-bold text-green-600">{(incomeData.reduce((s, d) => s + d.amount, 0) / 1000000).toFixed(1)}M₮</p>
                  <p className="text-xs text-gray-500">Орлого</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-red-500">{(expenseData.reduce((s, d) => s + d.amount, 0) / 1000000).toFixed(1)}M₮</p>
                  <p className="text-xs text-gray-500">Зарлага</p>
                </div>
              </div>
            </div>

            <div className="flex gap-2 mb-4">
              <button onClick={() => setReportTab('income')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium ${reportTab === 'income' ? 'bg-green-600 text-white' : 'bg-white text-gray-500'}`}>
                Орлого
              </button>
              <button onClick={() => setReportTab('expense')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium ${reportTab === 'expense' ? 'bg-red-500 text-white' : 'bg-white text-gray-500'}`}>
                Зарлага
              </button>
            </div>

            <div className="space-y-2">
              {(reportTab === 'income' ? incomeData : expenseData).map(d => (
                <div key={d.label} className="bg-white rounded-xl p-3 shadow-sm">
                  <div className="flex justify-between text-sm mb-1">
                    <span>{d.label}</span>
                    <span className="font-semibold">{d.amount.toLocaleString()}₮</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className={`h-2 rounded-full ${reportTab === 'income' ? 'bg-green-500' : 'bg-red-400'}`}
                      style={{ width: `${d.percent}%` }} />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{d.percent}%</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Tab Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
        <div className="max-w-[430px] mx-auto flex">
          {tabs.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className={`flex-1 py-2.5 flex flex-col items-center gap-0.5 transition ${
                activeTab === i ? 'text-blue-600' : 'text-gray-400'
              }`}
            >
              <span className="text-lg">{tabIcons[i]}</span>
              <span className="text-xs">{tab}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
