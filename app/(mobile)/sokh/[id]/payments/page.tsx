'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';

interface BillItem {
  id: string;
  name: string;
  icon: string;
  amount: number;
  paid: boolean;
  color: string;
}

type PayMethod = 'qpay' | 'bank' | 'card' | null;

const bankApps = [
  { id: 'khan', name: 'Хаан банк', color: 'bg-green-600', scheme: 'khanbank://payment' },
  { id: 'golomt', name: 'Голомт', color: 'bg-blue-700', scheme: 'golomtbank://payment' },
  { id: 'tdb', name: 'ХХБ', color: 'bg-red-600', scheme: 'tdbm://payment' },
  { id: 'state', name: 'Төрийн банк', color: 'bg-sky-600', scheme: 'statebank://payment' },
  { id: 'xac', name: 'Хас банк', color: 'bg-emerald-600', scheme: 'xacbank://payment' },
  { id: 'bogd', name: 'Богд банк', color: 'bg-amber-600', scheme: 'bogdbank://payment' },
  { id: 'ckbank', name: 'Капитрон', color: 'bg-purple-600', scheme: 'capitronbank://payment' },
  { id: 'most', name: 'Most Money', color: 'bg-orange-500', scheme: 'mostmoney://payment' },
  { id: 'social', name: 'SocialPay', color: 'bg-pink-600', scheme: 'socialpay://payment' },
  { id: 'monpay', name: 'MonPay', color: 'bg-indigo-600', scheme: 'monpay://payment' },
  { id: 'hipay', name: 'Hi-Pay', color: 'bg-teal-500', scheme: 'hipay://payment' },
];

export default function PaymentsPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [totalDebt, setTotalDebt] = useState(0);
  const [activeTab, setActiveTab] = useState<'bills' | 'history'>('bills');
  const [payMethod, setPayMethod] = useState<PayMethod>(null);
  const [payingBill, setPayingBill] = useState<BillItem | null>(null);
  const [paySuccess, setPaySuccess] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);

  // Нийтийн үйлчилгээний төлбөрүүд
  const [bills, setBills] = useState<BillItem[]>([
    { id: 'sokh', name: 'СӨХ хураамж', icon: '🏢', amount: 15000, paid: false, color: 'bg-blue-50 border-blue-200' },
    { id: 'water', name: 'Ус', icon: '💧', amount: 8500, paid: false, color: 'bg-cyan-50 border-cyan-200' },
    { id: 'heating', name: 'Дулаан', icon: '🔥', amount: 35000, paid: false, color: 'bg-orange-50 border-orange-200' },
    { id: 'electric', name: 'Цахилгаан', icon: '⚡', amount: 12000, paid: false, color: 'bg-yellow-50 border-yellow-200' },
    { id: 'maintenance', name: 'Ашиглалт', icon: '🔧', amount: 5000, paid: false, color: 'bg-gray-50 border-gray-200' },
    { id: 'cable', name: 'Кабелийн ТВ', icon: '📺', amount: 8000, paid: true, color: 'bg-purple-50 border-purple-200' },
    { id: 'internet', name: 'Интернет', icon: '🌐', amount: 25000, paid: true, color: 'bg-indigo-50 border-indigo-200' },
  ]);

  useEffect(() => {
    const fetchData = async () => {
      // Оршин суугчийн өр татах
      const { data: residents } = await supabase
        .from('residents')
        .select('debt')
        .eq('sokh_id', params.id);

      if (residents && residents.length > 0) {
        const debt = residents.reduce((s, r) => s + Number(r.debt || 0), 0);
        setTotalDebt(debt);
      }

      // Төлбөрийн түүх
      const { data: payData } = await supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      setPayments(payData || []);

      setLoading(false);
    };
    fetchData();
  }, [params.id]);

  const unpaidBills = bills.filter(b => !b.paid);
  const paidBills = bills.filter(b => b.paid);
  const unpaidTotal = unpaidBills.reduce((s, b) => s + b.amount, 0);

  const startPay = (bill: BillItem) => {
    setPayingBill(bill);
    setPayMethod(null);
    setPaySuccess(false);
  };

  const payAll = () => {
    setPayingBill({ id: 'all', name: 'Бүх төлбөр', icon: '💰', amount: unpaidTotal, paid: false, color: '' });
    setPayMethod(null);
    setPaySuccess(false);
  };

  const confirmPay = () => {
    if (!payMethod || !payingBill) return;
    setPaySuccess(true);

    if (payingBill.id === 'all') {
      setBills(prev => prev.map(b => ({ ...b, paid: true })));
    } else {
      setBills(prev => prev.map(b => b.id === payingBill.id ? { ...b, paid: true } : b));
    }

    setTimeout(() => {
      setPayingBill(null);
      setPaySuccess(false);
    }, 2000);
  };

  const timeAgo = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('mn-MN') + ' ' + d.toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Ачаалж байна...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-green-600 text-white px-4 py-4">
        <button onClick={() => router.push(`/sokh/${params.id}`)} className="text-white/80 text-sm mb-1">
          ← Буцах
        </button>
        <h1 className="text-lg font-bold">💰 Төлбөр</h1>
      </div>

      {/* Нийт үлдэгдэл */}
      <div className="px-4 -mt-3">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex justify-between items-center mb-1">
            <p className="text-xs text-gray-500">Энэ сарын нийт</p>
            <p className="text-xs text-gray-500">Төлөгдөөгүй</p>
          </div>
          <div className="flex justify-between items-center">
            <p className="text-xl font-bold">{bills.reduce((s, b) => s + b.amount, 0).toLocaleString()}₮</p>
            <p className={`text-xl font-bold ${unpaidTotal > 0 ? 'text-red-500' : 'text-green-500'}`}>
              {unpaidTotal > 0 ? `${unpaidTotal.toLocaleString()}₮` : 'Төлсөн ✓'}
            </p>
          </div>
          {unpaidTotal > 0 && (
            <button
              onClick={payAll}
              className="w-full mt-3 bg-green-600 text-white py-3 rounded-xl font-medium active:bg-green-700 transition"
            >
              Бүгдийг төлөх ({unpaidTotal.toLocaleString()}₮)
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mx-4 mt-4 bg-gray-100 rounded-xl p-1">
        <button
          onClick={() => setActiveTab('bills')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === 'bills' ? 'bg-white shadow-sm' : 'text-gray-500'
          }`}
        >
          Төлбөрүүд
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === 'history' ? 'bg-white shadow-sm' : 'text-gray-500'
          }`}
        >
          Түүх
        </button>
      </div>

      {/* Bills tab */}
      {activeTab === 'bills' && (
        <div className="px-4 py-4">
          {/* Төлөгдөөгүй */}
          {unpaidBills.length > 0 && (
            <>
              <h2 className="text-sm font-semibold text-gray-500 mb-3">ТӨЛӨГДӨӨГҮЙ</h2>
              <div className="space-y-2 mb-6">
                {unpaidBills.map(bill => (
                  <div key={bill.id} className={`rounded-xl p-3 border ${bill.color}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{bill.icon}</span>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{bill.name}</p>
                        <p className="text-red-500 font-semibold text-sm">{bill.amount.toLocaleString()}₮</p>
                      </div>
                      <button
                        onClick={() => startPay(bill)}
                        className="px-4 py-2 bg-green-600 text-white text-xs font-medium rounded-lg active:bg-green-700"
                      >
                        Төлөх
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Төлсөн */}
          {paidBills.length > 0 && (
            <>
              <h2 className="text-sm font-semibold text-gray-500 mb-3">ТӨЛСӨН ✓</h2>
              <div className="space-y-2">
                {paidBills.map(bill => (
                  <div key={bill.id} className="rounded-xl p-3 border bg-green-50 border-green-200 opacity-75">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{bill.icon}</span>
                      <div className="flex-1">
                        <p className="font-medium text-sm text-gray-600">{bill.name}</p>
                        <p className="text-green-600 text-sm">{bill.amount.toLocaleString()}₮</p>
                      </div>
                      <span className="text-green-500 text-sm font-medium">Төлсөн ✓</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* History tab */}
      {activeTab === 'history' && (
        <div className="px-4 py-4">
          <h2 className="text-sm font-semibold text-gray-500 mb-3">ТӨЛБӨРИЙН ТҮҮХ</h2>
          {payments.length === 0 ? (
            <div className="bg-white rounded-xl p-6 text-center">
              <p className="text-gray-400">Төлбөрийн түүх байхгүй</p>
            </div>
          ) : (
            <div className="space-y-2">
              {payments.map((p) => (
                <div key={p.id} className="bg-white rounded-xl p-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-sm">{p.description || 'Сарын төлбөр'}</p>
                    <p className="text-xs text-gray-400">{timeAgo(p.created_at)}</p>
                  </div>
                  <span className="text-green-600 font-semibold text-sm">
                    -{(p.amount || 0).toLocaleString()}₮
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Төлбөр төлөх modal */}
      {payingBill && !paySuccess && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={() => setPayingBill(null)}>
          <div
            className="bg-white w-full max-w-[430px] rounded-t-2xl p-6 max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4"></div>
            <h2 className="text-lg font-bold mb-1">Төлбөр төлөх</h2>
            <p className="text-sm text-gray-500 mb-4">{payingBill.name} — {payingBill.amount.toLocaleString()}₮</p>

            {/* Банкны апп-аар төлөх */}
            <h3 className="text-sm font-semibold text-gray-500 mb-3">БАНКНЫ АПП-ААР ТӨЛӨХ</h3>
            <div className="grid grid-cols-5 gap-2 mb-6">
              {bankApps.map(bank => (
                <button
                  key={bank.id}
                  onClick={() => {
                    window.location.href = bank.scheme;
                    // Апп нээгдэхгүй бол 1.5 секундын дараа store руу чиглүүлнэ
                    setTimeout(() => {
                      setPayMethod('bank');
                    }, 1500);
                  }}
                  className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-gray-50 active:scale-95 transition"
                >
                  <div className={`w-11 h-11 ${bank.color} rounded-xl flex items-center justify-center`}>
                    <span className="text-white text-xs font-bold">
                      {bank.name.slice(0, 2)}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-600 text-center leading-tight">{bank.name}</span>
                </button>
              ))}
            </div>

            {/* Бусад арга */}
            <h3 className="text-sm font-semibold text-gray-500 mb-3">БУСАД АРГА</h3>
            <div className="space-y-2 mb-4">
              <button
                onClick={() => setPayMethod('bank')}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition ${
                  payMethod === 'bank' ? 'border-green-500 bg-green-50' : 'border-gray-200'
                }`}
              >
                <span className="text-xl">🏦</span>
                <div className="flex-1">
                  <p className="font-medium text-sm">Дансаар шилжүүлэх</p>
                  <p className="text-xs text-gray-500">Дансны мэдээлэл харах</p>
                </div>
                {payMethod === 'bank' && <span className="text-green-500">✓</span>}
              </button>

              <button
                onClick={() => setPayMethod('card')}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition ${
                  payMethod === 'card' ? 'border-green-500 bg-green-50' : 'border-gray-200'
                }`}
              >
                <span className="text-xl">💳</span>
                <div className="flex-1">
                  <p className="font-medium text-sm">Карт</p>
                  <p className="text-xs text-gray-500">Visa, Mastercard</p>
                </div>
                {payMethod === 'card' && <span className="text-green-500">✓</span>}
              </button>
            </div>

            {/* Банк данс */}
            {payMethod === 'bank' && (
              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Банк:</span>
                    <span className="font-medium">Хаан банк</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Данс:</span>
                    <span className="font-medium font-mono">5012345678</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Нэр:</span>
                    <span className="font-medium">СӨХ нэр</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Гүйлгээний утга:</span>
                    <span className="font-medium">{payingBill.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Дүн:</span>
                    <span className="font-bold text-green-600">{payingBill.amount.toLocaleString()}₮</span>
                  </div>
                </div>
              </div>
            )}

            {/* Карт */}
            {payMethod === 'card' && (
              <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-3">
                <input type="text" placeholder="Картын дугаар" maxLength={19}
                  className="w-full border rounded-lg px-3 py-2.5 text-sm" />
                <div className="flex gap-2">
                  <input type="text" placeholder="MM/YY" maxLength={5}
                    className="flex-1 border rounded-lg px-3 py-2.5 text-sm" />
                  <input type="text" placeholder="CVV" maxLength={3}
                    className="w-20 border rounded-lg px-3 py-2.5 text-sm" />
                </div>
              </div>
            )}

            {payMethod && (
              <button
                onClick={confirmPay}
                className="w-full py-3 rounded-xl font-semibold text-sm bg-green-600 text-white active:bg-green-700 transition"
              >
                Төлсөн ({payingBill.amount.toLocaleString()}₮)
              </button>
            )}
          </div>
        </div>
      )}

      {/* Амжилттай */}
      {paySuccess && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 mx-4 text-center max-w-[350px]">
            <div className="text-5xl mb-3">✅</div>
            <h2 className="text-lg font-bold mb-1">Амжилттай!</h2>
            <p className="text-sm text-gray-500">{payingBill?.name} — {payingBill?.amount.toLocaleString()}₮ төлөгдлөө</p>
          </div>
        </div>
      )}
    </div>
  );
}
