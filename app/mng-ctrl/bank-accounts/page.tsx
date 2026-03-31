'use client';

import { useState, useEffect } from 'react';
import type { PlatformBankAccount } from '@/app/lib/types/billing';

const BANKS = [
  'Хаан банк', 'Голомт банк', 'ХХБ', 'Төрийн банк', 'Хас банк',
  'Капитрон банк', 'Богд банк', 'Чингис хаан банк', 'М банк', 'Ард банк',
];

export default function BankAccountsPage() {
  const [accounts, setAccounts] = useState<PlatformBankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PlatformBankAccount | null>(null);
  const [form, setForm] = useState({ bank_name: BANKS[0], account_number: '', account_holder: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const fetchAccounts = async () => {
    const res = await fetch('/api/superadmin/bank-accounts');
    const data = await res.json();
    setAccounts(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { fetchAccounts(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ bank_name: BANKS[0], account_number: '', account_holder: '', notes: '' });
    setShowForm(true);
  };

  const openEdit = (acc: PlatformBankAccount) => {
    setEditing(acc);
    setForm({
      bank_name: acc.bank_name,
      account_number: acc.account_number,
      account_holder: acc.account_holder,
      notes: acc.notes || '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const method = editing ? 'PUT' : 'POST';
    const body = editing ? { id: editing.id, ...form } : form;

    await fetch('/api/superadmin/bank-accounts', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    setShowForm(false);
    setSaving(false);
    fetchAccounts();
  };

  const setPrimary = async (id: number) => {
    await fetch('/api/superadmin/bank-accounts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_primary: true }),
    });
    fetchAccounts();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Энэ дансыг устгах уу?')) return;
    await fetch(`/api/superadmin/bank-accounts?id=${id}`, { method: 'DELETE' });
    fetchAccounts();
  };

  const maskAccount = (num: string) => {
    if (num.length <= 4) return num;
    return '****' + num.slice(-4);
  };

  if (loading) {
    return <div className="p-8"><p className="text-gray-400">Ачаалж байна...</p></div>;
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Дансны тохиргоо</h1>
          <p className="text-sm text-gray-500 mt-1">Платформын орлого хүлээн авах данснууд</p>
        </div>
        <button onClick={openCreate} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700">
          + Данс нэмэх
        </button>
      </div>

      {accounts.length === 0 ? (
        <div className="bg-white rounded-2xl border p-8 text-center">
          <p className="text-4xl mb-3">🏦</p>
          <p className="text-gray-500">Данс бүртгэгдээгүй байна</p>
          <button onClick={openCreate} className="mt-3 text-blue-600 text-sm font-semibold hover:underline">
            Анхны данс нэмэх
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map(acc => (
            <div key={acc.id} className={`bg-white rounded-2xl border p-5 flex items-center justify-between ${acc.is_primary ? 'ring-2 ring-blue-500' : ''}`}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-2xl">🏦</div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold">{acc.bank_name}</p>
                    {acc.is_primary && (
                      <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full">ҮНДСЭН</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">{maskAccount(acc.account_number)} &middot; {acc.account_holder}</p>
                  {acc.notes && <p className="text-xs text-gray-400 mt-0.5">{acc.notes}</p>}
                </div>
              </div>

              <div className="flex gap-2">
                {!acc.is_primary && (
                  <button onClick={() => setPrimary(acc.id)} className="text-xs text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg">
                    Үндсэн болгох
                  </button>
                )}
                <button onClick={() => openEdit(acc)} className="text-xs text-gray-600 hover:bg-gray-100 px-3 py-1.5 rounded-lg">
                  Засах
                </button>
                <button onClick={() => handleDelete(acc.id)} className="text-xs text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg">
                  Устгах
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">{editing ? 'Данс засах' : 'Шинэ данс'}</h2>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Банк</label>
                <select value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))}
                  className="w-full border rounded-xl px-3 py-2 text-sm">
                  {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Дансны дугаар</label>
                <input value={form.account_number} onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))}
                  className="w-full border rounded-xl px-3 py-2 text-sm" placeholder="1234567890" />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Данс эзэмшигч</label>
                <input value={form.account_holder} onChange={e => setForm(f => ({ ...f, account_holder: e.target.value }))}
                  className="w-full border rounded-xl px-3 py-2 text-sm" placeholder="Нэр" />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Тэмдэглэл</label>
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full border rounded-xl px-3 py-2 text-sm" placeholder="Нэмэлт мэдээлэл..." />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border text-sm text-gray-600 hover:bg-gray-50">
                Болих
              </button>
              <button onClick={handleSave} disabled={saving || !form.account_number || !form.account_holder}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Хадгалж байна...' : 'Хадгалах'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
