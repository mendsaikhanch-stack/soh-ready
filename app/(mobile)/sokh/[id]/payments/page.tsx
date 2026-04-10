'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';
import { useAuth } from '@/app/lib/auth-context';

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
  const { profile } = useAuth();
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
  const [paymentStep, setPaymentStep] = useState<'select' | 'qpay'>('select');
  const [receiptPayment, setReceiptPayment] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      // 1. Суурь төлбөрүүд (billing_items)
      const { data: billingItems } = await supabase
        .from('billing_items')
        .select('*')
        .eq('sokh_id', params.id)
        .eq('is_active', true)
        .order('sort_order');

      let baseBills: BillItem[];
      if (billingItems && billingItems.length > 0) {
        baseBills = billingItems.map(item => ({
          id: item.id,
          name: item.name,
          icon: item.icon || '💰',
          amount: Number(item.amount) || 0,
          paid: false,
          color: BILL_COLORS[item.category] || BILL_COLORS['other'],
        }));
      } else {
        baseBills = [
          { id: 1, name: 'СӨХ хураамж', icon: '🏢', amount: 15000, paid: false, color: 'bg-blue-50 border-blue-200' },
          { id: 2, name: 'Ус', icon: '💧', amount: 0, paid: false, color: 'bg-cyan-50 border-cyan-200' },
          { id: 3, name: 'Дулаан', icon: '🔥', amount: 0, paid: false, color: 'bg-orange-50 border-orange-200' },
          { id: 4, name: 'Цахилгаан', icon: '⚡', amount: 0, paid: false, color: 'bg-yellow-50 border-yellow-200' },
          { id: 5, name: 'Ашиглалт', icon: '🔧', amount: 5000, paid: false, color: 'bg-gray-50 border-gray-200' },
        ];
      }

      // 2. ОСНААК нэхэмжлэх — тухайн айлын бодит тооцоо (utility_bills)
      if (profile) {
        const { data: utilityBills } = await supabase
          .from('utility_bills')
          .select('*')
          .eq('resident_id', profile.id)
          .eq('year', currentYear)
          .eq('month', currentMonth);

        if (utilityBills && utilityBills.length > 0) {
          const typeToName: Record<string, string> = { water: 'Ус', heating: 'Дулаан', electricity: 'Цахилгаан' };
          const typeToIcon: Record<string, string> = { water: '💧', heating: '🔥', electricity: '⚡' };
          const typeToColor: Record<string, string> = {
            water: 'bg-cyan-50 border-cyan-200',
            heating: 'bg-orange-50 border-orange-200',
            electricity: 'bg-yellow-50 border-yellow-200',
          };

          for (const ub of utilityBills) {
            const billName = typeToName[ub.utility_type];
            if (!billName) continue;

            const idx = baseBills.findIndex(b => b.name === billName);
            if (idx >= 0) {
              // Байгаа billing item-г ОСНААК дүнгээр солих
              baseBills[idx].amount = Number(ub.amount);
              baseBills[idx].paid = ub.status === 'paid';
            } else {
              // Байхгүй бол шинээр нэмэх
              baseBills.push({
                id: ub.id + 10000,
                name: billName,
                icon: typeToIcon[ub.utility_type],
                amount: Number(ub.amount),
                paid: ub.status === 'paid',
                color: typeToColor[ub.utility_type] || 'bg-gray-50 border-gray-200',
              });
            }
          }
        }
      }

      // 0₮ төлбөрүүдийг нуух (ОСНААК тооцоогүй бол)
      setBills(baseBills.filter(b => b.amount > 0 || b.paid));

      // 3. Тухайн хэрэглэгчийн өр
      if (profile) {
        const { data: myResident } = await supabase
          .from('residents')
          .select('id, debt')
          .eq('sokh_id', params.id)
          .eq('phone', profile.phone)
          .limit(1)
          .single();

        if (myResident) {
          setTotalDebt(Number(myResident.debt || 0));
        }
      }

      // 4. Тухайн хэрэглэгчийн төлбөрийн түүх
      let payQuery = supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (profile) {
        payQuery = payQuery.eq('resident_id', profile.id);
      }

      const { data: payData } = await payQuery;
      setPayments(payData || []);

      setLoading(false);
    };
    fetchData();
  }, [params.id, profile]);

  const unpaidBills = bills.filter(b => !b.paid);
  const paidBills = bills.filter(b => b.paid);
  const unpaidTotal = unpaidBills.reduce((s, b) => s + b.amount, 0);

  const startPay = (bill: BillItem) => {
    setPayingBill(bill);
    setQpayInvoice(null);
    setPaySuccess(false);
    setPaymentStep('select');
  };

  const selectQPay = async () => {
    if (!payingBill) return;
    setPaymentStep('qpay');
    setQpayLoading(true);

    try {
      const res = await fetch('/api/qpay/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: payingBill.amount,
          description: `Хотол — ${payingBill.name}`,
          orderId: `${params.id}-${payingBill.id}-${Date.now()}`,
        }),
      });
      const data = await res.json();
      if (data.invoice_id) {
        setQpayInvoice(data);
        startPolling(data.invoice_id, payingBill);
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
      } catch {
        // QPay polling алдаа — дараагийн interval дахин шалгана
      }
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
    setPaymentStep('select');
  };

  const PAYMENT_METHODS = [
    { name: 'QPay', color: '#00B140', textColor: 'white', action: 'qpay' },
    { name: 'SocialPay', color: '#6C3EF5', textColor: 'white', action: 'socialpay' },
  ];

  const BANK_APPS = [
    { name: 'Хаан банк', short: 'ХААН', color: '#00529B' },
    { name: 'Голомт банк', short: 'ГОЛ', color: '#F26522' },
    { name: 'ХХБ', short: 'ХХБ', color: '#009FE3' },
    { name: 'Хас банк', short: 'ХАС', color: '#E30613' },
    { name: 'Төрийн банк', short: 'ТӨР', color: '#003876' },
    { name: 'Богд банк', short: 'БОГД', color: '#8B0000' },
    { name: 'Капитрон', short: 'КАП', color: '#1B3A5C' },
    { name: 'Чингис хаан', short: 'ЧХБ', color: '#C8102E' },
    { name: 'М банк', short: 'М', color: '#E91E63' },
    { name: 'Ард', short: 'АРД', color: '#FF6F00' },
    { name: 'Most Money', short: 'МОСТ', color: '#4CAF50' },
    { name: 'Invescore', short: 'INV', color: '#1A237E' },
  ];

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
                <button
                  key={p.id}
                  onClick={() => setReceiptPayment(p)}
                  className="w-full bg-white rounded-xl p-3 flex justify-between items-center hover:bg-gray-50 active:scale-[0.99] transition text-left"
                >
                  <div>
                    <p className="font-medium text-sm">{p.description || 'Сарын төлбөр'}</p>
                    <p className="text-xs text-gray-400">{timeAgo(p.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-green-600 font-semibold text-sm">
                      -{(p.amount || 0).toLocaleString()}₮
                    </span>
                    <span className="text-gray-300 text-xs">›</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Төлбөр төлөх modal */}
      {payingBill && !paySuccess && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={closePayModal}>
          <div
            className="bg-white w-full max-w-[430px] rounded-t-2xl p-6 max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4"></div>
            <h2 className="text-lg font-bold mb-1">Төлбөр төлөх</h2>
            <p className="text-sm text-gray-500 mb-4">{payingBill.name} — {payingBill.amount.toLocaleString()}₮</p>

            {/* Step 1: Төлбөрийн арга сонгох */}
            {paymentStep === 'select' && (
              <>
                {/* QPay, SocialPay */}
                <h3 className="text-xs font-semibold text-gray-400 mb-3">ТӨЛБӨРИЙН СИСТЕМ</h3>
                <div className="grid grid-cols-2 gap-3 mb-5">
                  {PAYMENT_METHODS.map(pm => (
                    <button
                      key={pm.name}
                      onClick={pm.action === 'qpay' ? selectQPay : undefined}
                      className="flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-gray-100 hover:border-gray-300 active:scale-95 transition"
                    >
                      <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm"
                        style={{ backgroundColor: pm.color }}
                      >
                        <span className="text-white font-bold text-xs">{pm.name}</span>
                      </div>
                      <span className="text-sm font-medium text-gray-700">{pm.name}</span>
                    </button>
                  ))}
                </div>

                {/* Банкны аппууд */}
                <h3 className="text-xs font-semibold text-gray-400 mb-3">БАНКНЫ АПП</h3>
                <div className="grid grid-cols-4 gap-3 mb-5">
                  {BANK_APPS.map(bank => (
                    <button
                      key={bank.name}
                      className="flex flex-col items-center gap-1.5 active:scale-95 transition"
                    >
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm"
                        style={{ backgroundColor: bank.color }}
                      >
                        <span className="text-white font-bold text-[10px]">{bank.short}</span>
                      </div>
                      <span className="text-[10px] text-gray-600 text-center leading-tight">{bank.name}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Step 2: QPay QR */}
            {paymentStep === 'qpay' && (
              <>
                {qpayLoading && (
                  <div className="text-center py-8">
                    <div className="animate-spin text-3xl mb-3">⏳</div>
                    <p className="text-gray-500 text-sm">QPay invoice үүсгэж байна...</p>
                  </div>
                )}

                {qpayInvoice && !qpayLoading && (
                  <>
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

                    {checking && (
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 flex items-center gap-2">
                        <div className="animate-spin text-lg">⏳</div>
                        <p className="text-sm text-blue-700">Төлбөр хүлээж байна...</p>
                      </div>
                    )}

                    {qpayInvoice.urls && qpayInvoice.urls.length > 0 && (
                      <>
                        <h3 className="text-xs font-semibold text-gray-400 mb-3">АПП-ААР НЭЭХ</h3>
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
                  onClick={() => setPaymentStep('select')}
                  className="w-full py-3 rounded-xl font-semibold text-sm border border-gray-300 text-gray-600 mb-2"
                >
                  ← Буцах
                </button>
              </>
            )}

            <button
              onClick={closePayModal}
              className="w-full py-3 rounded-xl font-semibold text-sm border border-gray-300 text-gray-600"
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

      {/* Receipt Modal */}
      {receiptPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={() => setReceiptPayment(null)}>
          <div
            className="bg-white w-full max-w-[430px] rounded-t-2xl p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4"></div>

            {/* Receipt card */}
            <div id="receipt-content" className="bg-gray-50 rounded-2xl p-5 mb-4">
              <div className="text-center mb-4">
                <div className="text-3xl mb-1">🧾</div>
                <h3 className="font-bold text-lg">Төлбөрийн баримт</h3>
                <p className="text-xs text-gray-400">#{String(receiptPayment.id).padStart(6, '0')}</p>
              </div>

              <div className="border-t border-dashed border-gray-300 my-3"></div>

              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Төлбөр</span>
                  <span className="font-medium">{receiptPayment.description || 'Сарын төлбөр'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Дүн</span>
                  <span className="font-bold text-green-600">{(receiptPayment.amount || 0).toLocaleString()}₮</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Огноо</span>
                  <span className="font-medium">{timeAgo(receiptPayment.created_at || receiptPayment.paid_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Төлөв</span>
                  <span className="text-green-600 font-medium">Төлөгдсөн ✓</span>
                </div>
                {profile && (
                  <>
                    <div className="border-t border-dashed border-gray-300 my-2"></div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Нэр</span>
                      <span className="font-medium">{profile.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Тоот</span>
                      <span className="font-medium">{profile.apartment}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="border-t border-dashed border-gray-300 my-3"></div>
              <p className="text-center text-[10px] text-gray-400">Баримт автоматаар үүсгэгдсэн</p>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <button
                onClick={() => {
                  const text = `🧾 Төлбөрийн баримт #${String(receiptPayment.id).padStart(6, '0')}\n${receiptPayment.description || 'Сарын төлбөр'}\nДүн: ${(receiptPayment.amount || 0).toLocaleString()}₮\nОгноо: ${timeAgo(receiptPayment.created_at || receiptPayment.paid_at)}\nТөлөв: Төлөгдсөн ✓${profile ? `\nНэр: ${profile.name}\nТоот: ${profile.apartment}` : ''}`;
                  if (navigator.share) {
                    navigator.share({ title: 'Төлбөрийн баримт', text });
                  } else {
                    navigator.clipboard.writeText(text);
                    alert('Хуулагдлаа!');
                  }
                }}
                className="py-3 rounded-xl text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition"
              >
                📤 Хуваалцах
              </button>
              <button
                onClick={() => {
                  const text = `🧾 Төлбөрийн баримт #${String(receiptPayment.id).padStart(6, '0')}\n${receiptPayment.description || 'Сарын төлбөр'}\nДүн: ${(receiptPayment.amount || 0).toLocaleString()}₮\nОгноо: ${timeAgo(receiptPayment.created_at || receiptPayment.paid_at)}\nТөлөв: Төлөгдсөн ✓${profile ? `\nНэр: ${profile.name}\nТоот: ${profile.apartment}` : ''}`;
                  navigator.clipboard.writeText(text);
                  alert('Хуулагдлаа!');
                }}
                className="py-3 rounded-xl text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
              >
                📋 Хуулах
              </button>
            </div>

            <button
              onClick={() => setReceiptPayment(null)}
              className="w-full py-3 rounded-xl text-sm font-medium border border-gray-300 text-gray-600"
            >
              Хаах
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
