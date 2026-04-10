'use client';

import { useState, useEffect } from 'react';

interface PricingTier {
  id: string;
  name: string;
  locations: string;
  perHousehold: number;
  sokhMonthly: number;
  description: string;
}

interface PlatformSettings {
  platformName: string;
  email: string;
  phone: string;
  // СӨХ-ийн сарын төлбөр
  sokhBaseFee: number;
  // Айлын сарын төлбөр
  perHouseholdFee: number;
  // Зэрэглэлүүд
  tiers: PricingTier[];
  // Мэдэгдлүүд
  notifications: {
    newSokh: boolean;
    supportTicket: boolean;
    paymentReceived: boolean;
    weeklyReport: boolean;
  };
}

const DEFAULT_TIERS: PricingTier[] = [
  { id: 'premium', name: 'Премиум', locations: 'Зайсан, Ривер Гарден, Хайлааст', perHousehold: 5000, sokhMonthly: 150000, description: 'Өндөр зэрэглэлийн орон сууцны хотхон' },
  { id: 'standard', name: 'Стандарт', locations: 'Төв хэсэг, Баянгол, Сүхбаатар, Чингэлтэй', perHousehold: 3000, sokhMonthly: 100000, description: 'Хотын төв хэсгийн орон сууц' },
  { id: 'basic', name: 'Энгийн', locations: 'Баянхошуу, Хан-Уул захын хэсэг, Налайх', perHousehold: 1000, sokhMonthly: 50000, description: 'Захын хэсгийн орон сууц' },
  { id: 'free', name: 'Үнэгүй', locations: 'Шинээр бүртгүүлсэн, туршилт', perHousehold: 0, sokhMonthly: 0, description: '50 хүртэл айлтай СӨХ-д 3 сар үнэгүй' },
];

const STORAGE_KEY = 'sokh-platform-settings';

export default function SettingsPage() {
  const [settings, setSettings] = useState<PlatformSettings>({
    platformName: 'Хотол',
    email: 'info@toot.mn',
    phone: '7700-1122',
    sokhBaseFee: 50000,
    perHouseholdFee: 1000,
    tiers: DEFAULT_TIERS,
    notifications: { newSokh: true, supportTicket: true, paymentReceived: false, weeklyReport: true },
  });
  const [saved, setSaved] = useState(false);
  const [editTier, setEditTier] = useState<string | null>(null);
  const [showAddTier, setShowAddTier] = useState(false);
  const [newTier, setNewTier] = useState<PricingTier>({ id: '', name: '', locations: '', perHousehold: 0, sokhMonthly: 0, description: '' });

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setSettings(JSON.parse(stored));
  }, []);

  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const updateTier = (id: string, field: keyof PricingTier, value: string | number) => {
    setSettings(prev => ({
      ...prev,
      tiers: prev.tiers.map(t => t.id === id ? { ...t, [field]: value } : t),
    }));
  };

  const addTier = () => {
    if (!newTier.name) return;
    const tier = { ...newTier, id: Date.now().toString() };
    setSettings(prev => ({ ...prev, tiers: [...prev.tiers, tier] }));
    setNewTier({ id: '', name: '', locations: '', perHousehold: 0, sokhMonthly: 0, description: '' });
    setShowAddTier(false);
  };

  const deleteTier = (id: string) => {
    if (!confirm('Зэрэглэл устгах уу?')) return;
    setSettings(prev => ({ ...prev, tiers: prev.tiers.filter(t => t.id !== id) }));
  };

  // Тооцоолол: 100 айлтай СӨХ-ийн нийт орлого
  const calcExample = (tier: PricingTier) => {
    const exampleHouseholds = 100;
    return tier.sokhMonthly + (tier.perHousehold * exampleHouseholds);
  };

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold mb-2">⚙️ Тохиргоо</h1>
      <p className="text-gray-400 text-sm mb-6">Платформын үнэ, зэрэглэл, мэдэгдлийн тохиргоо</p>

      {saved && (
        <div className="bg-green-900/30 border border-green-800 text-green-400 p-3 rounded-xl text-sm mb-4">
          ✅ Хадгалагдлаа!
        </div>
      )}

      <div className="space-y-6">

        {/* Платформын мэдээлэл */}
        <div className="bg-gray-800/50 border border-gray-800 rounded-2xl p-5">
          <h2 className="font-semibold mb-4">🏢 Платформын мэдээлэл</h2>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Нэр</label>
              <input
                value={settings.platformName}
                onChange={e => setSettings({ ...settings, platformName: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Имэйл</label>
              <input
                value={settings.email}
                onChange={e => setSettings({ ...settings, email: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Утас</label>
              <input
                value={settings.phone}
                onChange={e => setSettings({ ...settings, phone: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>
          </div>
        </div>

        {/* Үнийн бодлого */}
        <div className="bg-gray-800/50 border border-gray-800 rounded-2xl p-5">
          <h2 className="font-semibold mb-2">💰 Үнийн бодлого</h2>
          <p className="text-xs text-gray-500 mb-4">СӨХ-ийн сарын суурь төлбөр + айл тус бүрээс авах төлбөр. Хоёулаа нэмэгдэж тооцогдоно.</p>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-700">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🏢</span>
                <div>
                  <p className="text-sm font-medium">СӨХ-ийн суурь төлбөр</p>
                  <p className="text-[10px] text-gray-500">СӨХ байгууллагаас сар бүр</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={settings.sokhBaseFee}
                  onChange={e => setSettings({ ...settings, sokhBaseFee: Number(e.target.value) })}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white"
                />
                <span className="text-gray-400 text-sm whitespace-nowrap">₮/сар</span>
              </div>
            </div>

            <div className="bg-gray-900 rounded-xl p-4 border border-gray-700">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">👨‍👩‍👧‍👦</span>
                <div>
                  <p className="text-sm font-medium">Айлын нэмэлт төлбөр</p>
                  <p className="text-[10px] text-gray-500">Тоот тус бүрээс сар бүр</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={settings.perHouseholdFee}
                  onChange={e => setSettings({ ...settings, perHouseholdFee: Number(e.target.value) })}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white"
                />
                <span className="text-gray-400 text-sm whitespace-nowrap">₮/айл/сар</span>
              </div>
            </div>
          </div>

          {/* Тооцооны жишээ */}
          <div className="bg-blue-900/20 border border-blue-800/50 rounded-xl p-3">
            <p className="text-xs text-blue-400 mb-1">📊 Жишээ тооцоо (100 айлтай СӨХ):</p>
            <p className="text-sm text-blue-300">
              {settings.sokhBaseFee.toLocaleString()}₮ (суурь) + {settings.perHouseholdFee.toLocaleString()}₮ × 100 айл = <strong>{(settings.sokhBaseFee + settings.perHouseholdFee * 100).toLocaleString()}₮/сар</strong>
            </p>
          </div>
        </div>

        {/* Байршлын зэрэглэл */}
        <div className="bg-gray-800/50 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold">📍 Байршлын зэрэглэл</h2>
              <p className="text-xs text-gray-500 mt-1">Амьдарч буй байршлаас хамааран айлын төлбөр, СӨХ-ийн суурь төлбөр өөр өөр байна</p>
            </div>
            <button
              onClick={() => setShowAddTier(true)}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700"
            >
              + Зэрэглэл нэмэх
            </button>
          </div>

          {/* Зэрэглэлүүд */}
          <div className="space-y-3">
            {settings.tiers.map(tier => (
              <div key={tier.id} className={`bg-gray-900 rounded-xl border transition ${
                tier.id === 'premium' ? 'border-yellow-700' :
                tier.id === 'standard' ? 'border-blue-700' :
                tier.id === 'basic' ? 'border-green-700' :
                'border-gray-700'
              }`}>
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        tier.id === 'premium' ? 'bg-yellow-900/50 text-yellow-400' :
                        tier.id === 'standard' ? 'bg-blue-900/50 text-blue-400' :
                        tier.id === 'basic' ? 'bg-green-900/50 text-green-400' :
                        'bg-gray-800 text-gray-400'
                      }`}>
                        {tier.name}
                      </span>
                      <span className="text-xs text-gray-500">{tier.description}</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditTier(editTier === tier.id ? null : tier.id)}
                        className="text-xs text-blue-400 hover:underline"
                      >
                        {editTier === tier.id ? 'Хаах' : 'Засах'}
                      </button>
                      {tier.id !== 'free' && (
                        <button onClick={() => deleteTier(tier.id)} className="text-xs text-red-400 hover:underline">
                          Устгах
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Товч мэдээлэл */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-[10px] text-gray-500">СӨХ суурь</p>
                      <p className="text-sm font-bold">{tier.sokhMonthly.toLocaleString()}₮<span className="text-gray-500 font-normal">/сар</span></p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500">Айл бүрээс</p>
                      <p className="text-sm font-bold">{tier.perHousehold.toLocaleString()}₮<span className="text-gray-500 font-normal">/сар</span></p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500">100 айлтай бол</p>
                      <p className="text-sm font-bold text-green-400">{calcExample(tier).toLocaleString()}₮</p>
                    </div>
                  </div>

                  <p className="text-xs text-gray-500 mt-2">📍 {tier.locations}</p>

                  {/* Засах форм */}
                  {editTier === tier.id && (
                    <div className="mt-4 pt-4 border-t border-gray-700 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">Зэрэглэлийн нэр</label>
                          <input
                            value={tier.name}
                            onChange={e => updateTier(tier.id, 'name', e.target.value)}
                            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">Тайлбар</label>
                          <input
                            value={tier.description}
                            onChange={e => updateTier(tier.id, 'description', e.target.value)}
                            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">СӨХ суурь төлбөр (₮/сар)</label>
                          <input
                            type="number"
                            value={tier.sokhMonthly}
                            onChange={e => updateTier(tier.id, 'sokhMonthly', Number(e.target.value))}
                            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">Айл бүрээс (₮/сар)</label>
                          <input
                            type="number"
                            value={tier.perHousehold}
                            onChange={e => updateTier(tier.id, 'perHousehold', Number(e.target.value))}
                            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Хамаарах байршлууд</label>
                        <input
                          value={tier.locations}
                          onChange={e => updateTier(tier.id, 'locations', e.target.value)}
                          className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white"
                          placeholder="жнь: Зайсан, Ривер Гарден"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Шинэ зэрэглэл нэмэх */}
          {showAddTier && (
            <div className="bg-gray-900 rounded-xl border border-gray-700 p-4 mt-3">
              <h3 className="text-sm font-semibold mb-3">Шинэ зэрэглэл</h3>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Нэр</label>
                  <input
                    value={newTier.name}
                    onChange={e => setNewTier({ ...newTier, name: e.target.value })}
                    placeholder="жнь: VIP"
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Тайлбар</label>
                  <input
                    value={newTier.description}
                    onChange={e => setNewTier({ ...newTier, description: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">СӨХ суурь (₮/сар)</label>
                  <input
                    type="number"
                    value={newTier.sokhMonthly}
                    onChange={e => setNewTier({ ...newTier, sokhMonthly: Number(e.target.value) })}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Айл бүрээс (₮/сар)</label>
                  <input
                    type="number"
                    value={newTier.perHousehold}
                    onChange={e => setNewTier({ ...newTier, perHousehold: Number(e.target.value) })}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>
              <div className="mb-3">
                <label className="text-xs text-gray-500 mb-1 block">Байршлууд</label>
                <input
                  value={newTier.locations}
                  onChange={e => setNewTier({ ...newTier, locations: e.target.value })}
                  placeholder="жнь: Зайсан, Sky Resort"
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowAddTier(false)} className="px-4 py-2 border border-gray-600 rounded-lg text-sm text-gray-400">Цуцлах</button>
                <button onClick={addTier} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Нэмэх</button>
              </div>
            </div>
          )}
        </div>

        {/* Мэдэгдлийн тохиргоо */}
        <div className="bg-gray-800/50 border border-gray-800 rounded-2xl p-5">
          <h2 className="font-semibold mb-4">🔔 Мэдэгдлийн тохиргоо</h2>
          <div className="space-y-3">
            {[
              { key: 'newSokh' as const, label: 'Шинэ СӨХ бүртгүүлэхэд мэдэгдэл авах' },
              { key: 'supportTicket' as const, label: 'Дэмжлэгийн тикет ирэхэд мэдэгдэл авах' },
              { key: 'paymentReceived' as const, label: 'Төлбөр ороход мэдэгдэл авах' },
              { key: 'weeklyReport' as const, label: 'Долоо хоног бүр тайлан имэйлээр авах' },
            ].map(n => (
              <label key={n.key} className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-gray-300">{n.label}</span>
                <button
                  onClick={() => setSettings(prev => ({
                    ...prev,
                    notifications: { ...prev.notifications, [n.key]: !prev.notifications[n.key] },
                  }))}
                  className={`relative w-11 h-6 rounded-full transition ${settings.notifications[n.key] ? 'bg-blue-600' : 'bg-gray-600'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition ${settings.notifications[n.key] ? 'left-[22px]' : 'left-0.5'}`}></span>
                </button>
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
