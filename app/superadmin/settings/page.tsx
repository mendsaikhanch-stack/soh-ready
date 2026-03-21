'use client';

import { useState } from 'react';

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);

  const save = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">⚙️ Тохиргоо</h1>
      <p className="text-gray-400 text-sm mb-6">Платформын тохиргоо</p>

      {saved && (
        <div className="bg-green-900/30 border border-green-800 text-green-400 p-3 rounded-xl text-sm mb-4">
          ✅ Хадгалагдлаа!
        </div>
      )}

      <div className="space-y-6">
        {/* Platform info */}
        <div className="bg-gray-800/50 border border-gray-800 rounded-2xl p-5">
          <h2 className="font-semibold mb-4">Платформын мэдээлэл</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Платформын нэр</label>
              <input defaultValue="СӨХ Систем" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Холбоо барих имэйл</label>
              <input defaultValue="info@soh-system.mn" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Утас</label>
              <input defaultValue="7700-1122" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="bg-gray-800/50 border border-gray-800 rounded-2xl p-5">
          <h2 className="font-semibold mb-4">Үнийн тохиргоо</h2>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Стандарт багц (₮/сар)</label>
                <input type="number" defaultValue="50000" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Премиум багц (₮/сар)</label>
                <input type="number" defaultValue="150000" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Үнэгүй багцын хязгаар (айл)</label>
              <input type="number" defaultValue="50" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-gray-800/50 border border-gray-800 rounded-2xl p-5">
          <h2 className="font-semibold mb-4">Мэдэгдлийн тохиргоо</h2>
          <div className="space-y-3">
            {[
              { label: 'Шинэ СӨХ бүртгүүлэхэд мэдэгдэл авах', defaultChecked: true },
              { label: 'Дэмжлэгийн тикет ирэхэд мэдэгдэл авах', defaultChecked: true },
              { label: 'Төлбөр ороход мэдэгдэл авах', defaultChecked: false },
              { label: 'Долоо хоног бүр тайлан имэйлээр авах', defaultChecked: true },
            ].map(n => (
              <label key={n.label} className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-gray-300">{n.label}</span>
                <input type="checkbox" defaultChecked={n.defaultChecked} className="w-4 h-4 rounded" />
              </label>
            ))}
          </div>
        </div>

        <button onClick={save} className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-blue-700 transition">
          Хадгалах
        </button>
      </div>
    </div>
  );
}
