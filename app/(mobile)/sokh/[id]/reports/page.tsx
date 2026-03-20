'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function ReportsPage() {
  const params = useParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'income' | 'expense'>('income');

  // Жишээ өгөгдөл (дараа нь DB-ээс татна)
  const incomeData = [
    { label: 'Сарын төлбөр', amount: 2500000, percent: 70 },
    { label: 'Зогсоолын хураамж', amount: 800000, percent: 22 },
    { label: 'Бусад орлого', amount: 300000, percent: 8 },
  ];

  const expenseData = [
    { label: 'Цахилгаан (нийтийн)', amount: 450000, percent: 25 },
    { label: 'Цэвэрлэгээ', amount: 350000, percent: 19 },
    { label: 'Засвар үйлчилгээ', amount: 500000, percent: 28 },
    { label: 'Харуул хамгаалалт', amount: 300000, percent: 17 },
    { label: 'Бусад зардал', amount: 200000, percent: 11 },
  ];

  const data = activeTab === 'income' ? incomeData : expenseData;
  const total = data.reduce((sum, d) => sum + d.amount, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-blue-600 text-white px-4 py-4">
        <button onClick={() => router.push(`/sokh/${params.id}`)} className="text-white/80 text-sm mb-1">
          ← Буцах
        </button>
        <h1 className="text-lg font-bold">📋 Санхүүгийн тайлан</h1>
      </div>

      {/* Month Selector */}
      <div className="px-4 pt-4">
        <div className="bg-white rounded-xl shadow-sm p-3 text-center">
          <p className="text-xs text-gray-500">Тайлант сар</p>
          <p className="text-lg font-bold">2026 оны 3-р сар</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex px-4 pt-4 gap-2">
        <button
          onClick={() => setActiveTab('income')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === 'income' ? 'bg-green-600 text-white' : 'bg-white text-gray-500'
          }`}
        >
          Орлого
        </button>
        <button
          onClick={() => setActiveTab('expense')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === 'expense' ? 'bg-red-500 text-white' : 'bg-white text-gray-500'
          }`}
        >
          Зарлага
        </button>
      </div>

      {/* Total */}
      <div className="px-4 pt-4">
        <div className={`rounded-xl p-4 text-center ${activeTab === 'income' ? 'bg-green-50' : 'bg-red-50'}`}>
          <p className="text-xs text-gray-500">Нийт {activeTab === 'income' ? 'орлого' : 'зарлага'}</p>
          <p className={`text-2xl font-bold ${activeTab === 'income' ? 'text-green-600' : 'text-red-500'}`}>
            {total.toLocaleString()}₮
          </p>
        </div>
      </div>

      {/* Breakdown */}
      <div className="px-4 py-4 space-y-2">
        {data.map((item) => (
          <div key={item.label} className="bg-white rounded-xl p-3">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">{item.label}</span>
              <span className="text-sm font-semibold">{item.amount.toLocaleString()}₮</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${activeTab === 'income' ? 'bg-green-500' : 'bg-red-400'}`}
                style={{ width: `${item.percent}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">{item.percent}%</p>
          </div>
        ))}
      </div>
    </div>
  );
}
