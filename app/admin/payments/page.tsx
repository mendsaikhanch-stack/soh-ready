'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';

interface Resident { id: number; name: string; apartment: string; debt: number; }
interface Payment { id: number; resident_id: number; amount: number; description: string; paid_at: string; }

interface BankAccount {
  bankName: string;
  accountNumber: string;
  accountName: string;
  connected: boolean;
}

const BANKS = ['Хаан банк', 'Голомт банк', 'ХХБ', 'Төрийн банк', 'Хас банк', 'Капитрон банк', 'Богд банк'];

export default function AdminPayments() {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'record' | 'bank'>('overview');
  const [showForm, setShowForm] = useState(false);
  const [selectedResident, setSelectedResident] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('Сарын төлбөр');
  const [saving, setSaving] = useState(false);

  // Данс холболт
  const [bankAccount, setBankAccount] = useState<BankAccount>({
    bankName: 'Хаан банк',
    accountNumber: '',
    accountName: '',
    connected: false,
  });
  const [bankSaved, setBankSaved] = useState(false);

  useEffect(() => {
    fetchData();
    const savedBank = localStorage.getItem('sokh-admin-bank');
    if (savedBank) setBankAccount(JSON.parse(savedBank));
  }, []);

  const fetchData = async () => {
    const { data: res } = await supabase.from('residents').select('id,name,apartment,debt').order('apartment');
    setResidents(res || []);
    const { data: pay } = await supabase.from('payments').select('*').order('paid_at', { ascending: false }).limit(50);
    setPayments(pay || []);
    setLoading(false);
  };

  const recordPayment = async () => {
    if (!selectedResident || !amount) return;
    setSaving(true);
    const resId = Number(selectedResident);
    const amt = Number(amount);

    await supabase.from('payments').insert([{ resident_id: resId, amount: amt, description }]);
    const resident = residents.find(r => r.id === resId);
    if (resident) {
      await supabase.from('residents').update({ debt: Math.max(0, resident.debt - amt) }).eq('id', resId);
    }

    setShowForm(false);
    setAmount('');
    setSelectedResident('');
    setSaving(false);
    await fetchData();
  };

  const saveBankAccount = () => {
    if (!bankAccount.accountNumber || !bankAccount.accountName) return;
    const updated = { ...bankAccount, connected: true };
    setBankAccount(updated);
    localStorage.setItem('sokh-admin-bank', JSON.stringify(updated));
    setBankSaved(true);
    setTimeout(() => setBankSaved(false), 2000);
  };

  const getResidentName = (id: number) => {
    const r = residents.find(r => r.id === id);
    return r ? `${r.name} (${r.apartment})` : 'Тодорхойгүй';
  };

  const totalDebt = residents.reduce((s, r) => s + r.debt, 0);
  const totalCollected = payments.reduce((s, p) => s + Number(p.amount), 0);
  const debtors = residents.filter(r => r.debt > 0).length;

  // Сарын орлого тооцоо
  const now = new Date();
  const thisMonthPayments = payments.filter(p => {
    const d = new Date(p.paid_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const thisMonthTotal = thisMonthPayments.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">💰 Төлбөр & Орлого</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1">
        {[
          { key: 'overview' as const, label: '📊 Орлого', },
          { key: 'record' as const, label: '💳 Төлбөр бүртгэх' },
          { key: 'bank' as const, label: '🏦 Данс холболт' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition ${
              activeTab === t.key ? 'bg-white shadow' : 'text-gray-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ========== OVERVIEW ========== */}
      {activeTab === 'overview' && (
        <div>
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-sm text-green-600">Энэ сарын орлого</p>
              <p className="text-2xl font-bold text-green-700">{thisMonthTotal.toLocaleString()}₮</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-sm text-blue-600">Нийт цуглуулсан</p>
              <p className="text-2xl font-bold text-blue-700">{totalCollected.toLocaleString()}₮</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm text-red-600">Нийт өр</p>
              <p className="text-2xl font-bold text-red-700">{totalDebt.toLocaleString()}₮</p>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <p className="text-sm text-orange-600">Өртэй айл</p>
              <p className="text-2xl font-bold text-orange-700">{debtors} / {residents.length}</p>
            </div>
          </div>

          {/* Данс мэдээлэл */}
          {bankAccount.connected && (
            <div className="bg-white border rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                    <span className="text-lg">🏦</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{bankAccount.bankName}</p>
                    <p className="text-xs text-gray-500">{bankAccount.accountNumber} · {bankAccount.accountName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-xs text-green-600 font-medium">Холбогдсон</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t">
                <div>
                  <p className="text-[10px] text-gray-500">Өнөөдрийн орлого</p>
                  <p className="text-sm font-bold text-green-600">
                    {payments.filter(p => new Date(p.paid_at).toDateString() === now.toDateString()).reduce((s, p) => s + Number(p.amount), 0).toLocaleString()}₮
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">7 хоногийн</p>
                  <p className="text-sm font-bold">
                    {payments.filter(p => Date.now() - new Date(p.paid_at).getTime() < 7 * 86400000).reduce((s, p) => s + Number(p.amount), 0).toLocaleString()}₮
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">Энэ сарын</p>
                  <p className="text-sm font-bold">{thisMonthTotal.toLocaleString()}₮</p>
                </div>
              </div>
            </div>
          )}

          {!bankAccount.connected && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <p className="text-sm font-semibold text-yellow-700">Данс холбогдоогүй</p>
                  <p className="text-xs text-yellow-600">Орлогын мэдээллийг бодит цагаар авахын тулд данс холбоно уу</p>
                </div>
              </div>
              <button onClick={() => setActiveTab('bank')} className="px-3 py-1.5 bg-yellow-600 text-white rounded-lg text-xs font-medium">
                Данс холбох
              </button>
            </div>
          )}

          {/* Сүүлийн төлбөрүүд */}
          <h3 className="font-semibold text-sm text-gray-500 mb-3">СҮҮЛИЙН ОРЛОГУУД</h3>
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr className="text-left text-sm text-gray-500">
                  <th className="px-4 py-3">Огноо</th>
                  <th className="px-4 py-3">Оршин суугч</th>
                  <th className="px-4 py-3">Тайлбар</th>
                  <th className="px-4 py-3 text-right">Дүн</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Төлбөр бүртгэгдээгүй</td></tr>
                ) : payments.slice(0, 20).map(p => (
                  <tr key={p.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">{new Date(p.paid_at).toLocaleDateString('mn-MN')}</td>
                    <td className="px-4 py-3 text-sm">{getResidentName(p.resident_id)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{p.description}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-green-600">+{Number(p.amount).toLocaleString()}₮</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========== RECORD ========== */}
      {activeTab === 'record' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">Оршин суугчийн төлбөр бүртгэх</p>
            <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
              + Төлбөр бүртгэх
            </button>
          </div>

          {showForm && (
            <div className="bg-white border rounded-xl p-4 mb-6">
              <h3 className="font-semibold mb-3">Төлбөр бүртгэх</h3>
              <div className="grid grid-cols-3 gap-3">
                <select value={selectedResident} onChange={e => setSelectedResident(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
                  <option value="">Оршин суугч сонгох...</option>
                  {residents.map(r => (
                    <option key={r.id} value={r.id}>{r.name} ({r.apartment}) {r.debt > 0 ? `- Өр: ${r.debt.toLocaleString()}₮` : ''}</option>
                  ))}
                </select>
                <input placeholder="Дүн (₮)" type="number" value={amount} onChange={e => setAmount(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
                <input placeholder="Тайлбар" value={description} onChange={e => setDescription(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg text-sm">Цуцлах</button>
                <button onClick={recordPayment} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm disabled:opacity-50">
                  {saving ? 'Бүртгэж байна...' : 'Бүртгэх'}
                </button>
              </div>
            </div>
          )}

          {/* Өртэй айлуудын жагсаалт */}
          <h3 className="font-semibold text-sm text-gray-500 mb-3">ӨРТЭЙ АЙЛУУД ({debtors})</h3>
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr className="text-left text-sm text-gray-500">
                  <th className="px-4 py-3">Нэр</th>
                  <th className="px-4 py-3">Тоот</th>
                  <th className="px-4 py-3 text-right">Өр</th>
                </tr>
              </thead>
              <tbody>
                {residents.filter(r => r.debt > 0).sort((a, b) => b.debt - a.debt).map(r => (
                  <tr key={r.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium">{r.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{r.apartment}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-red-500">{r.debt.toLocaleString()}₮</td>
                  </tr>
                ))}
                {debtors === 0 && (
                  <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-400">Өртэй айл байхгүй ✓</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========== BANK ========== */}
      {activeTab === 'bank' && (
        <div>
          {bankSaved && (
            <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-xl text-sm mb-4">
              ✅ Дансны мэдээлэл хадгалагдлаа!
            </div>
          )}

          <div className="bg-white border rounded-xl p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <span className="text-2xl">🏦</span>
              </div>
              <div>
                <h2 className="font-bold text-lg">Дансны холболт</h2>
                <p className="text-sm text-gray-500">Оршин суугчдаас ирэх төлбөрийг хүлээн авах данс</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Банк сонгох</label>
                <select
                  value={bankAccount.bankName}
                  onChange={e => setBankAccount({ ...bankAccount, bankName: e.target.value })}
                  className="w-full border rounded-xl px-4 py-3 text-sm"
                >
                  {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Дансны дугаар</label>
                <input
                  value={bankAccount.accountNumber}
                  onChange={e => setBankAccount({ ...bankAccount, accountNumber: e.target.value })}
                  placeholder="жнь: 5012345678"
                  className="w-full border rounded-xl px-4 py-3 text-sm font-mono"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Дансны эзэмшигчийн нэр</label>
                <input
                  value={bankAccount.accountName}
                  onChange={e => setBankAccount({ ...bankAccount, accountName: e.target.value })}
                  placeholder="жнь: Сэргэлэн СӨХ"
                  className="w-full border rounded-xl px-4 py-3 text-sm"
                />
              </div>
              <button
                onClick={saveBankAccount}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-blue-700 transition"
              >
                {bankAccount.connected ? 'Шинэчлэх' : 'Данс холбох'}
              </button>
            </div>
          </div>

          {/* Холбогдсон дансны мэдээлэл */}
          {bankAccount.connected && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-semibold text-green-700">Данс амжилттай холбогдсон</span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-green-600">Банк</p>
                  <p className="font-medium">{bankAccount.bankName}</p>
                </div>
                <div>
                  <p className="text-xs text-green-600">Дансны дугаар</p>
                  <p className="font-medium font-mono">{bankAccount.accountNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-green-600">Эзэмшигч</p>
                  <p className="font-medium">{bankAccount.accountName}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
