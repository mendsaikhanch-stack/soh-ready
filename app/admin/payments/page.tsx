'use client';

import { useState, useEffect } from 'react';
import { adminFrom } from '@/app/lib/admin-db';
import { getAdminSokhId } from '@/app/lib/admin-config';
import * as XLSX from 'xlsx';

interface Resident { id: number; name: string; apartment: string; debt: number; }
interface Payment { id: number; resident_id: number; amount: number; description: string; paid_at: string; }

/** Оршин суугчийн "Би шилжүүлсэн" мэдэгдэл — дарга банкны хуулгатай тулгаж баталгаажуулна */
interface PaymentNotice {
  id: number;
  resident_id: number;
  amount: number;
  description: string | null;
  status: string;
  created_at: string;
}

/** /admin/bank-account дээр тохируулсан хураамж хүлээн авах данс */
interface BankRow {
  bank_name: string;
  account_number: string;
  account_holder: string;
  qr_image_url: string | null;
}

export default function AdminPayments() {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [notices, setNotices] = useState<PaymentNotice[]>([]);
  const [resolving, setResolving] = useState<number | null>(null);
  const [bankRow, setBankRow] = useState<BankRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'record' | 'bank'>('overview');
  const [showForm, setShowForm] = useState(false);
  const [selectedResident, setSelectedResident] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('Сарын төлбөр');
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const sokhId = await getAdminSokhId();
    // adminFrom proxy ашиглана — admin нь Supabase auth биш тул anon client RLS-д блоклогддог.
    const { data: res } = await adminFrom('residents').select('id,name,apartment,debt').eq('sokh_id', sokhId).order('apartment', { ascending: true });
    const residentList = (res as unknown as Resident[]) || [];
    setResidents(residentList);
    // payments нь sokh_id шууд байхгүй — proxy resident_id-ээр scope хийдэг тул айлуудын id-аар уншина.
    const residentIds = residentList.map(r => r.id);
    const { data: pay } = residentIds.length
      ? await adminFrom('payments').select('*').in('resident_id', residentIds).order('paid_at', { ascending: false }).limit(50)
      : { data: [] };
    setPayments((pay as unknown as Payment[]) || []);

    // Баталгаажуулахыг хүлээж буй "Би шилжүүлсэн" мэдэгдлүүд
    const { data: nt } = await adminFrom('payment_notices')
      .select('*').eq('sokh_id', sokhId).eq('status', 'pending').order('created_at', { ascending: true });
    setNotices((nt as unknown as PaymentNotice[]) || []);

    // Хураамж хүлээн авах данс (/admin/bank-account дээр тохируулдаг)
    const { data: bank } = await adminFrom('sokh_bank_accounts').select('*').eq('sokh_id', sokhId).single();
    setBankRow((bank as unknown as BankRow) || null);

    setLoading(false);
  };

  // Баталгаажуулах: төлбөрийг бүртгээд өрөөс хасна.
  // Дараалал чухал — эхлээд мэдэгдлийг хааж давхар боловсруулахаас сэргийлнэ.
  const confirmNotice = async (n: PaymentNotice) => {
    const resident = residents.find(r => r.id === n.resident_id);
    if (!confirm(
      `${resident ? `${resident.name} (${resident.apartment})` : 'Оршин суугч'} — ${Number(n.amount).toLocaleString()}₮\n\n` +
      `Банкны хуулгаас энэ гүйлгээг ОЛСОН эсэхээ шалгасан уу?\n` +
      `Баталгаажуулбал төлбөр бүртгэгдэж, тэр дүнгээр өр нь хасагдана.`
    )) return;

    setResolving(n.id);
    const { error: closeErr } = await adminFrom('payment_notices')
      .update({ status: 'confirmed', resolved_at: new Date().toISOString() }).eq('id', n.id);
    if (closeErr) {
      setResolving(null);
      alert(`Баталгаажуулж чадсангүй: ${closeErr}`);
      return;
    }

    const { error: payErr } = await adminFrom('payments')
      .insert([{ resident_id: n.resident_id, amount: n.amount, description: n.description || 'Банкаар шилжүүлсэн' }]);
    if (payErr) {
      // Мэдэгдэл хаагдсан ч төлбөр бүртгэгдээгүй — даргад ХЭЛНЭ, чимээгүй өнгөрөхгүй
      setResolving(null);
      alert(`⚠️ Мэдэгдэл хаагдсан ч төлбөр бүртгэгдсэнгүй: ${payErr}\n\n"Төлбөр бүртгэх" хэсгээс гараар нэмнэ үү.`);
      await fetchData();
      return;
    }
    if (resident) {
      await adminFrom('residents')
        .update({ debt: Math.max(0, resident.debt - Number(n.amount)) }).eq('id', n.resident_id);
    }

    setResolving(null);
    await fetchData();
  };

  const rejectNotice = async (n: PaymentNotice) => {
    if (!confirm('Банкны хуулгад энэ гүйлгээ ОЛДООГҮЙ бол татгалзана. Үргэлжлүүлэх үү?')) return;
    setResolving(n.id);
    await adminFrom('payment_notices')
      .update({ status: 'rejected', resolved_at: new Date().toISOString() }).eq('id', n.id);
    setResolving(null);
    await fetchData();
  };

  const recordPayment = async () => {
    if (!selectedResident || !amount) return;
    setSaving(true);
    const resId = Number(selectedResident);
    const amt = Number(amount);

    await adminFrom('payments').insert([{ resident_id: resId, amount: amt, description }]);
    const resident = residents.find(r => r.id === resId);
    if (resident) {
      await adminFrom('residents').update({ debt: Math.max(0, resident.debt - amt) }).eq('id', resId);
    }

    setShowForm(false);
    setAmount('');
    setSelectedResident('');
    setSaving(false);
    await fetchData();
  };

  const getResidentName = (id: number) => {
    const r = residents.find(r => r.id === id);
    return r ? `${r.name} (${r.apartment})` : 'Тодорхойгүй';
  };

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    // Төлбөрийн түүх sheet
    const payData = payments.map(p => ({
      'Огноо': new Date(p.paid_at).toLocaleDateString('mn-MN'),
      'Оршин суугч': getResidentName(p.resident_id),
      'Тайлбар': p.description,
      'Дүн (₮)': Number(p.amount),
    }));
    const paySheet = XLSX.utils.json_to_sheet(payData);
    XLSX.utils.book_append_sheet(wb, paySheet, 'Төлбөрийн түүх');

    // Өртэй айлууд sheet
    const debtData = residents.filter(r => r.debt > 0).sort((a, b) => b.debt - a.debt).map(r => ({
      'Нэр': r.name,
      'Тоот': r.apartment,
      'Өр (₮)': r.debt,
    }));
    const debtSheet = XLSX.utils.json_to_sheet(debtData);
    XLSX.utils.book_append_sheet(wb, debtSheet, 'Өртэй айлууд');

    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `төлбөр-${today}.xlsx`);
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
        <button
          onClick={exportToExcel}
          disabled={loading || payments.length === 0}
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition disabled:opacity-50 flex items-center gap-2"
        >
          📥 Excel татах
        </button>
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

      {/* ========== БАТАЛГААЖУУЛАХ ХҮЛЭЭЖ БУЙ ========== */}
      {activeTab === 'overview' && notices.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 mb-6">
          <h3 className="font-semibold text-amber-900 mb-1">
            🔔 {notices.length} оршин суугч «шилжүүлсэн» гэж мэдэгдсэн
          </h3>
          <p className="text-xs text-amber-800 mb-3">
            Банкны хуулгаа шалгаад тухайн гүйлгээг олсон бол баталгаажуулна уу.
            Баталгаажуулбал төлбөр бүртгэгдэж, өр нь хасагдана.
          </p>
          <div className="space-y-2">
            {notices.map(n => (
              <div key={n.id} className="bg-white rounded-lg p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{getResidentName(n.resident_id)}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {n.description || 'Банкаар шилжүүлсэн'} · {new Date(n.created_at).toLocaleString('mn-MN')}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-bold text-sm">{Number(n.amount).toLocaleString()}₮</span>
                  <button
                    onClick={() => confirmNotice(n)}
                    disabled={resolving === n.id}
                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium disabled:opacity-50"
                  >
                    {resolving === n.id ? '...' : '✓ Баталгаажуулах'}
                  </button>
                  <button
                    onClick={() => rejectNotice(n)}
                    disabled={resolving === n.id}
                    className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs disabled:opacity-50"
                  >
                    Олдсонгүй
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

          {/* Хураамж хүлээн авах данс — /admin/bank-account дээр тохируулсан бодит мөр */}
          {bankRow ? (
            <div className="bg-white border rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                    <span className="text-lg">🏦</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{bankRow.bank_name}</p>
                    <p className="text-xs text-gray-500">{bankRow.account_number} · {bankRow.account_holder}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-green-600 font-medium">
                    {bankRow.qr_image_url ? 'QR-тай ✓' : 'QR оруулаагүй'}
                  </span>
                  <a href="/admin/bank-account" className="text-xs text-blue-600 hover:underline">Засах</a>
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
                    {payments.filter(p => now.getTime() - new Date(p.paid_at).getTime() < 7 * 86400000).reduce((s, p) => s + Number(p.amount), 0).toLocaleString()}₮
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">Энэ сарын</p>
                  <p className="text-sm font-bold">{thisMonthTotal.toLocaleString()}₮</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <p className="text-sm font-semibold text-yellow-700">Хураамж хүлээн авах данс оруулаагүй</p>
                  <p className="text-xs text-yellow-600">Данс оруулмагц оршин суугчид апп дээрээ QR-аар төлж эхэлнэ</p>
                </div>
              </div>
              <a href="/admin/bank-account" className="px-3 py-1.5 bg-yellow-600 text-white rounded-lg text-xs font-medium">
                Данс тохируулах
              </a>
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
        <div className="bg-white border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <span className="text-2xl">🏦</span>
            </div>
            <div>
              <h2 className="font-bold text-lg">Хураамж хүлээн авах данс</h2>
              <p className="text-sm text-gray-500">Оршин суугчийн апп дээр харагдах данс, QR код</p>
            </div>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            Дансаа тусдаа хуудаснаас удирдана. Тэнд оруулсан данс, QR зураг нь оршин
            суугчийн апп дээр «Төлбөр» хэсэгт шууд харагдаж, банкны аппаараа уншуулж
            төлөх боломжтой болно.
          </p>
          <a
            href="/admin/bank-account"
            className="inline-block px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Данс тохируулах →
          </a>
        </div>
      )}
    </div>
  );
}
