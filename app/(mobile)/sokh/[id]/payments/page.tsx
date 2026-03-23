'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';

interface BillItem {
  id: number;
  name: string;
  icon: string;
  amount: number;
  paid: boolean;
  color: string;
}

interface QPayInvoice {
  invoice_id: string;
  qr_image: string;
  urls: { name: string; logo: string; link: string }[];
}

const BILL_COLORS: Record<string, string> = {
  'service': 'bg-blue-50 border-blue-200',
  'utility': 'bg-orange-50 border-orange-200',
  'other': 'bg-gray-50 border-gray-200',
};

export default function PaymentsPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [totalDebt, setTotalDebt] = useState(0);
  const [activeTab, setActiveTab] = useState<'bills' | 'history'>('bills');
  const [payingBill, setPayingBill] = useState<BillItem | null>(null);
  const [paySuccess, setPaySuccess] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);
  const [bills, setBills] = useState<BillItem[]>([]);
  const [qpayInvoice, setQpayInvoice] = useState<QPayInvoice | null>(null);
  const [qpayLoading, setQpayLoading] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      // Төлбөрийн нэр төрөл Supabase-с татах
      const { data: billingItems } = await supabase
        .from('billing_items')
        .select('*')
        .eq('sokh_id', params.id)
        .eq('is_active', true)
        .order('sort_order');

      if (billingItems && billingItems.length > 0) {
        setBills(billingItems.map(item => ({
          id: item.id,
          name: item.name,
          icon: item.icon || '💰',
          amount: Number(item.amount) || 0,
          paid: false,
          color: BILL_COLORS[item.category] || BILL_COLORS['other'],
        })));
      } else {
        // Fallback: хэрэв billing_items хоосон бол default утгууд
        setBills([
          { id: 1, name: 'СӨХ хураамж', icon: '🏢', amount: 15000, paid: false, color: 'bg-blue-50 border-blue-200' },
          { id: 2, name: 'Ус', icon: '💧', amount: 8500, paid: false, color: 'bg-cyan-50 border-cyan-200' },
          { id: 3, name: 'Дулаан', icon: '🔥', amount: 35000, paid: false, color: 'bg-orange-50 border-orange-200' },
          { id: 4, name: 'Цахилгаан', icon: '⚡', amount: 12000, paid: false, color: 'bg-yellow-50 border-yellow-200' },
          { id: 5, name: 'Ашиглалт', icon: '🔧', amount: 5000, paid: false, color: 'bg-gray-50 border-gray-200' },
        ]);
      }

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

  const startPay = async (bill: BillItem) => {
    setPayingBill(bill);
    setQpayInvoice(null);
    setPaySuccess(false);
    setQpayLoading(true);

    try {
      const res = await fetch('/api/qpay/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: bill.amount,
          description: `Тоот — ${bill.name}`,
          orderId: `${params.id}-${bill.id}-${Date.now()}`,
        }),
      });
      const data = await res.json();
      if (data.invoice_id) {
        setQpayInvoice(data);
        startPolling(data.invoice_id, bill);
      }
    } catch (err) {
      console.error('QPay error:', err);
    }
    setQpayLoading(false);
  };

  const payAll = () => {
    startPay({ id: 0, name: 'Бүх төлбөр', icon: '💰', amount: unpaidTotal, paid: false, color: '' });
  };

  const startPolling = (invoiceId: string, bill: BillItem) => {
    setChecking(true);
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/qpay/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invoice_id: invoiceId }),
        });
        const data = await res.json();
        if (data.paid) {
          clearInterval(interval);
          setChecking(false);
          setPaySuccess(true);

          if (bill.id === 0) {
            setBills(prev => prev.map(b => ({ ...b, paid: true })));
          } else {
            setBills(prev => prev.map(b => b.id === bill.id ? { ...b, paid: true } : b));
          }

          // Суубаас-д төлбөр бүртгэх
          await supabase.from('payments').insert([{
            amount: bill.amount,
            description: `QPay — ${bill.name}`,
          }]);

          setTimeout(() => {
            setPayingBill(null);
            setPaySuccess(false);
            setQpayInvoice(null);
          }, 2500);
        }
      } catch {}
    }, 3000);

    // 5 минутын дараа polling зогсоох
    setTimeout(() => {
      clearInterval(interval);
      setChecking(false);
    }, 5 * 60 * 1000);
  };

  const closePayModal = () => {
    setPayingBill(null);
    setQpayInvoice(null);
    setChecking(false);
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

      {/* QPay төлбөр төлөх modal */}
      {payingBill && !paySuccess && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={closePayModal}>
          <div
            className="bg-white w-full max-w-[430px] rounded-t-2xl p-6 max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4"></div>
            <h2 className="text-lg font-bold mb-1">Төлбөр төлөх</h2>
            <p className="text-sm text-gray-500 mb-4">{payingBill.name} — {payingBill.amount.toLocaleString()}₮</p>

            {/* QPay ачаалж байна */}
            {qpayLoading && (
              <div className="text-center py-8">
                <div className="animate-spin text-3xl mb-3">⏳</div>
                <p className="text-gray-500 text-sm">QPay invoice үүсгэж байна...</p>
              </div>
            )}

            {/* QPay QR код */}
            {qpayInvoice && !qpayLoading && (
              <>
                {/* QR код */}
                <div className="text-center mb-4">
                  <div className="bg-white border-2 border-gray-200 rounded-2xl p-4 inline-block">
                    <img
                      src={`data:image/png;base64,${qpayInvoice.qr_image}`}
                      alt="QPay QR"
                      className="w-48 h-48 mx-auto"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">QR кодыг банкны апп-аар уншуулна уу</p>
                </div>

                {/* Төлбөр шалгаж байна */}
                {checking && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 flex items-center gap-2">
                    <div className="animate-spin text-lg">⏳</div>
                    <p className="text-sm text-blue-700">Төлбөр хүлээж байна...</p>
                  </div>
                )}

                {/* Банкны апп-ийн товчлуурууд (QPay deeplinks) */}
                {qpayInvoice.urls && qpayInvoice.urls.length > 0 && (
                  <>
                    <h3 className="text-sm font-semibold text-gray-500 mb-3">БАНКНЫ АПП-ААР ТӨЛӨХ</h3>
                    <div className="grid grid-cols-4 gap-2 mb-4">
                      {qpayInvoice.urls.slice(0, 12).map((bank, i) => (
                        <a
                          key={i}
                          href={bank.link}
                          className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-gray-50 active:scale-95 transition"
                        >
                          {bank.logo ? (
                            <img src={bank.logo} alt={bank.name} className="w-11 h-11 rounded-xl" />
                          ) : (
                            <div className="w-11 h-11 bg-blue-600 rounded-xl flex items-center justify-center">
                              <span className="text-white text-xs font-bold">{bank.name.slice(0, 2)}</span>
                            </div>
                          )}
                          <span className="text-[10px] text-gray-600 text-center leading-tight">{bank.name}</span>
                        </a>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}

            <button
              onClick={closePayModal}
              className="w-full py-3 rounded-xl font-semibold text-sm border border-gray-300 text-gray-600 mt-2"
            >
              Цуцлах
            </button>
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
