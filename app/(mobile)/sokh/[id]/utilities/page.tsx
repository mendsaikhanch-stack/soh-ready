'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';
import { useAuth } from '@/app/lib/auth-context';

interface Usage {
  id: number;
  type: string;
  amount: number;
  cost: number;
  month: number;
  year: number;
}

interface Reading {
  id: number;
  utility_type: string;
  previous_reading: number;
  current_reading: number;
  consumption: number;
  month: number;
  year: number;
  created_at: string;
}

interface Bill {
  id: number;
  utility_type: string;
  consumption: number;
  rate: number;
  amount: number;
  status: string;
  month: number;
  year: number;
}

interface QPayInvoice {
  invoice_id: string;
  qr_image: string;
  urls: { name: string; logo: string; link: string }[];
}

const typeMap: Record<string, { label: string; icon: string; color: string; unit: string; bg: string; border: string }> = {
  electricity: { label: 'Цахилгаан', icon: '⚡', color: 'text-yellow-600', unit: 'кВт/ц', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  water: { label: 'Ус', icon: '💧', color: 'text-blue-600', unit: 'м³', bg: 'bg-blue-50', border: 'border-blue-200' },
  heating: { label: 'Дулаан', icon: '🔥', color: 'text-red-600', unit: 'мкв', bg: 'bg-red-50', border: 'border-red-200' },
};

const months = ['1-р сар','2-р сар','3-р сар','4-р сар','5-р сар','6-р сар','7-р сар','8-р сар','9-р сар','10-р сар','11-р сар','12-р сар'];

export default function UtilitiesPage() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'history' | 'reading'>('reading');
  const [usages, setUsages] = useState<Usage[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState('electricity');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Заалт оруулах
  const [readingValue, setReadingValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Дулааны тооцоолуур
  const [areaSqm, setAreaSqm] = useState(0);
  const [heatingRate, setHeatingRate] = useState(0);

  // QPay төлбөр
  const [payingBill, setPayingBill] = useState<Bill | null>(null);
  const [qpayInvoice, setQpayInvoice] = useState<QPayInvoice | null>(null);
  const [qpayLoading, setQpayLoading] = useState(false);
  const [qpayError, setQpayError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [paySuccess, setPaySuccess] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    fetchData();
  }, [params.id, selectedYear, profile]);

  const fetchData = async () => {
    setLoading(true);

    // Ашиглалтын түүх (хуучин)
    const { data: usageData } = await supabase
      .from('utility_usage')
      .select('*')
      .eq('sokh_id', params.id)
      .eq('year', selectedYear)
      .order('month', { ascending: true });
    setUsages(usageData || []);

    // Хэрэв нэвтэрсэн бол тоолуур заалт + нэхэмжлэх + дулааны мэдээлэл
    if (profile) {
      const [{ data: rd }, { data: bl }, { data: resData }, { data: tariffData }] = await Promise.all([
        supabase
          .from('meter_readings')
          .select('*')
          .eq('resident_id', profile.id)
          .order('year', { ascending: false })
          .order('month', { ascending: false })
          .limit(20),
        supabase
          .from('utility_bills')
          .select('*')
          .eq('resident_id', profile.id)
          .order('year', { ascending: false })
          .order('month', { ascending: false })
          .limit(20),
        supabase
          .from('residents')
          .select('area_sqm')
          .eq('id', profile.id)
          .limit(1),
        supabase
          .from('utility_tariffs')
          .select('rate_per_unit')
          .eq('sokh_id', params.id)
          .eq('utility_type', 'heating')
          .order('effective_from', { ascending: false })
          .limit(1),
      ]);
      setReadings(rd || []);
      setBills(bl || []);
      setAreaSqm(resData && resData.length > 0 ? Number(resData[0].area_sqm) || 0 : 0);
      setHeatingRate(tariffData && tariffData.length > 0 ? Number(tariffData[0].rate_per_unit) || 0 : 0);
    }

    setLoading(false);
  };

  // Одоогийн сарын заалт оруулсан эсэх
  const currentReading = readings.find(
    r => r.utility_type === selectedType && r.month === currentMonth && r.year === currentYear
  );

  // Өмнөх заалт
  const prevReading = readings.find(
    r => r.utility_type === selectedType && !(r.month === currentMonth && r.year === currentYear)
  );

  // Тухайн төрлийн нэхэмжлэхүүд
  const typeBills = bills.filter(b => b.utility_type === selectedType);

  const submitReading = async () => {
    if (!readingValue || !profile) return;
    setSubmitting(true);
    setSubmitResult(null);

    const currentVal = Number(readingValue);
    const prevVal = prevReading ? Number(prevReading.current_reading) : 0;

    if (currentVal < prevVal) {
      setSubmitResult({ type: 'error', msg: `Заалт өмнөхөөсөө (${prevVal}) бага байж болохгүй` });
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.from('meter_readings').insert([{
      sokh_id: Number(params.id),
      resident_id: profile.id,
      apartment: profile.apartment,
      utility_type: selectedType,
      previous_reading: prevVal,
      current_reading: currentVal,
      year: currentYear,
      month: currentMonth,
    }]);

    if (error) {
      if (error.message.includes('unique') || error.message.includes('duplicate')) {
        setSubmitResult({ type: 'error', msg: 'Энэ сарын заалт аль хэдийн оруулсан байна' });
      } else {
        setSubmitResult({ type: 'error', msg: 'Алдаа: ' + error.message });
      }
    } else {
      setSubmitResult({ type: 'success', msg: 'Заалт амжилттай илгээгдлээ!' });
      setReadingValue('');
      await fetchData();
    }
    setSubmitting(false);
  };

  // Unmount-д polling зогсоох
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // QPay төлбөр эхлүүлэх
  const startPayBill = async (bill: Bill) => {
    setPayingBill(bill);
    setQpayInvoice(null);
    setPaySuccess(false);
    setQpayError(null);
    setQpayLoading(true);

    try {
      const res = await fetch('/api/qpay/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: bill.amount,
          description: `Тоот — ${typeMap[bill.utility_type]?.label || bill.utility_type} (${months[bill.month - 1]} ${bill.year})`,
          orderId: `UTIL-${bill.id}-${Date.now()}`,
        }),
      });
      const data = await res.json();
      if (data.invoice_id) {
        setQpayInvoice(data);
        startPolling(data.invoice_id, bill);
      } else {
        setQpayError(data.error || 'QPay нэхэмжлэх үүсгэж чадсангүй');
      }
    } catch (err) {
      console.error('QPay error:', err);
      setQpayError('Сүлжээний алдаа. Дахин оролдоно уу.');
    }
    setQpayLoading(false);
  };

  const startPolling = (invoiceId: string, bill: Bill) => {
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
          pollingRef.current = null;
          setChecking(false);
          setPaySuccess(true);

          // utility_bills статус шинэчлэх
          await supabase
            .from('utility_bills')
            .update({ status: 'paid', paid_at: new Date().toISOString() })
            .eq('id', bill.id);

          // payments бүртгэх
          await supabase.from('payments').insert([{
            resident_id: profile?.id,
            amount: bill.amount,
            description: `QPay — ${typeMap[bill.utility_type]?.label || bill.utility_type} (${months[bill.month - 1]} ${bill.year})`,
          }]);

          setBills(prev => prev.map(b => b.id === bill.id ? { ...b, status: 'paid' } : b));

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

    pollingRef.current = interval;

    // 5 минутын дараа зогсоох
    setTimeout(() => {
      clearInterval(interval);
      if (pollingRef.current === interval) {
        pollingRef.current = null;
        setChecking(false);
      }
    }, 5 * 60 * 1000);
  };

  const closePayModal = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setPayingBill(null);
    setQpayInvoice(null);
    setQpayError(null);
    setChecking(false);
    setPaySuccess(false);
  };

  const filteredUsages = usages.filter(u => u.type === selectedType);
  const maxAmount = Math.max(...filteredUsages.map(u => u.amount), 1);
  const totalCost = filteredUsages.reduce((sum, u) => sum + u.cost, 0);
  const tp = typeMap[selectedType];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-emerald-600 text-white px-4 py-4">
        <button onClick={() => router.push(`/sokh/${params.id}`)} className="text-white/80 text-sm mb-1">
          ← Буцах
        </button>
        <h1 className="text-lg font-bold">📊 Ашиглалт & Тоолуур</h1>
      </div>

      {/* Type selector */}
      <div className="px-4 pt-4">
        <div className="flex gap-2 mb-4">
          {Object.entries(typeMap).map(([key, val]) => (
            <button
              key={key}
              onClick={() => { setSelectedType(key); setReadingValue(''); setSubmitResult(null); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition ${
                selectedType === key
                  ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-400'
                  : 'bg-white text-gray-500 border border-gray-200'
              }`}
            >
              {val.icon} {val.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mx-4 bg-gray-100 rounded-xl p-1">
        <button
          onClick={() => setActiveTab('reading')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === 'reading' ? 'bg-white shadow-sm' : 'text-gray-500'
          }`}
        >
          {tp.icon} {selectedType === 'heating' ? 'Тооцоолуур' : 'Заалт оруулах'}
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

      {loading ? (
        <p className="text-gray-400 text-center py-8">Ачаалж байна...</p>
      ) : (
        <div className="px-4 py-4">
          {/* ========== ЗААЛТ ОРУУЛАХ / ТООЦООЛУУР TAB ========== */}
          {activeTab === 'reading' && (
            <>
              {/* Дулааны тооцоолуур */}
              {selectedType === 'heating' ? (
                <div className={`rounded-xl p-4 border mb-4 ${tp.bg} ${tp.border}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">🔥</span>
                    <div>
                      <p className="font-semibold text-sm">Дулааны тооцоолуур — {months[currentMonth - 1]}</p>
                      <p className="text-xs text-gray-500">{currentYear} он</p>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">Таны байрны талбай</span>
                      <span className="text-sm font-bold">{areaSqm > 0 ? `${areaSqm} мкв` : <span className="text-red-400">бүртгэлгүй</span>}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">Тариф (₮/мкв)</span>
                      <span className="text-sm font-medium">{heatingRate > 0 ? `${heatingRate.toLocaleString()}₮` : '-'}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="text-xs text-gray-500">Энэ сарын дулааны төлбөр</span>
                      <span className="text-lg font-bold text-red-600">
                        {areaSqm > 0 && heatingRate > 0
                          ? `${Math.round(areaSqm * heatingRate).toLocaleString()}₮`
                          : '-'}
                      </span>
                    </div>
                  </div>

                  {areaSqm === 0 && (
                    <p className="text-xs text-red-500 mt-2 text-center">
                      Байрны мкв бүртгэгдээгүй байна. СӨХ-ийн админд хандана уу.
                    </p>
                  )}
                </div>
              ) : (
              /* Ус / Цахилгаан тоолуур заалт */
              <div className={`rounded-xl p-4 border mb-4 ${tp.bg} ${tp.border}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{tp.icon}</span>
                  <div>
                    <p className="font-semibold text-sm">{tp.label} — {months[currentMonth - 1]}</p>
                    <p className="text-xs text-gray-500">{currentYear} он</p>
                  </div>
                </div>

                {currentReading ? (
                  <div className="bg-white rounded-lg p-3 mt-2">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-gray-500">Өмнөх заалт</span>
                      <span className="text-sm">{currentReading.previous_reading} {tp.unit}</span>
                    </div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-gray-500">Одоогийн заалт</span>
                      <span className="text-sm font-bold">{currentReading.current_reading} {tp.unit}</span>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t">
                      <span className="text-xs text-gray-500">Хэрэглээ</span>
                      <span className={`text-sm font-bold ${tp.color}`}>{currentReading.consumption} {tp.unit}</span>
                    </div>
                    <p className="text-xs text-green-600 mt-2 text-center">Энэ сарын заалт илгээгдсэн ✓</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-lg p-3 mt-2">
                    {prevReading && (
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-xs text-gray-500">Өмнөх заалт</span>
                        <span className="text-sm font-medium">{prevReading.current_reading} {tp.unit}</span>
                      </div>
                    )}
                    <label className="text-xs text-gray-500 block mb-1">Одоогийн заалт ({tp.unit})</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder={`Тоолуурын заалт (${tp.unit})`}
                        value={readingValue}
                        onChange={e => setReadingValue(e.target.value)}
                        className="flex-1 border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        inputMode="decimal"
                      />
                      <button
                        onClick={submitReading}
                        disabled={submitting || !readingValue}
                        className="bg-emerald-600 text-white px-5 py-3 rounded-xl font-medium text-sm active:bg-emerald-700 disabled:opacity-50"
                      >
                        {submitting ? '...' : 'Илгээх'}
                      </button>
                    </div>

                    {readingValue && prevReading && Number(readingValue) > prevReading.current_reading && (
                      <p className="text-xs text-gray-500 mt-2">
                        Хэрэглээ: <span className={`font-bold ${tp.color}`}>
                          {(Number(readingValue) - prevReading.current_reading).toFixed(1)} {tp.unit}
                        </span>
                      </p>
                    )}
                  </div>
                )}

                {submitResult && (
                  <div className={`mt-2 p-3 rounded-xl text-sm ${
                    submitResult.type === 'success'
                      ? 'bg-green-50 border border-green-200 text-green-700'
                      : 'bg-red-50 border border-red-200 text-red-700'
                  }`}>
                    {submitResult.msg}
                  </div>
                )}
              </div>
              )}

              {/* Нэхэмжлэхүүд */}
              {typeBills.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-gray-500 mb-2">НЭХЭМЖЛЭХ</h3>
                  <div className="space-y-2">
                    {typeBills.slice(0, 6).map(b => (
                      <div key={b.id} className={`rounded-xl p-3 border ${b.status === 'paid' ? 'bg-green-50 border-green-200' : `${tp.bg} ${tp.border}`}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">{months[b.month - 1]} {b.year}</p>
                            <p className="text-xs text-gray-500">{Number(b.consumption)} {tp.unit} x {Number(b.rate).toLocaleString()}₮</p>
                          </div>
                          <div className="text-right">
                            <p className={`font-bold text-sm ${b.status === 'paid' ? 'text-green-600' : 'text-red-500'}`}>
                              {Number(b.amount).toLocaleString()}₮
                            </p>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                              b.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {b.status === 'paid' ? 'Төлсөн ✓' : 'Төлөгдөөгүй'}
                            </span>
                          </div>
                        </div>
                        {b.status !== 'paid' && Number(b.amount) > 0 && (
                          <button
                            onClick={() => startPayBill(b)}
                            className="w-full mt-2 bg-green-600 text-white py-2.5 rounded-xl font-medium text-sm active:bg-green-700 transition flex items-center justify-center gap-2"
                          >
                            <span>💳</span> QPay-ээр төлөх ({Number(b.amount).toLocaleString()}₮)
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Өмнөх заалтуудын түүх */}
              {readings.filter(r => r.utility_type === selectedType).length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 mb-2">ӨМНӨХ ЗААЛТУУД</h3>
                  <div className="bg-white rounded-xl border overflow-hidden">
                    {readings.filter(r => r.utility_type === selectedType).slice(0, 6).map(r => (
                      <div key={r.id} className="flex items-center justify-between px-3 py-2.5 border-b last:border-0">
                        <span className="text-sm">{months[r.month - 1]} {r.year}</span>
                        <span className="text-sm text-gray-500">{r.previous_reading} → {r.current_reading}</span>
                        <span className={`text-sm font-medium ${tp.color}`}>{r.consumption} {tp.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ========== ТҮҮХ TAB ========== */}
          {activeTab === 'history' && (
            <>
              {/* Year selector */}
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => setSelectedYear(y => y - 1)} className="px-3 py-1.5 bg-white rounded-lg border text-sm">
                  ← {selectedYear - 1}
                </button>
                <span className="font-bold text-lg">{selectedYear}</span>
                <button onClick={() => setSelectedYear(y => y + 1)} className="px-3 py-1.5 bg-white rounded-lg border text-sm"
                  disabled={selectedYear >= new Date().getFullYear()}>
                  {selectedYear + 1} →
                </button>
              </div>

              {/* Total */}
              <div className="bg-white rounded-xl p-4 shadow-sm mb-4 text-center">
                <p className="text-sm text-gray-500">Нийт зардал ({selectedYear})</p>
                <p className={`text-2xl font-bold ${tp.color}`}>
                  {totalCost.toLocaleString()}₮
                </p>
              </div>

              {/* Chart */}
              {filteredUsages.length === 0 ? (
                <div className="bg-white rounded-xl p-6 text-center">
                  <p className="text-3xl mb-2">📭</p>
                  <p className="text-gray-400">Мэдээлэл байхгүй</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-500 mb-3">САРЫН ХЭРЭГЛЭЭ ({tp.unit})</h3>
                  <div className="space-y-2">
                    {filteredUsages.map((u) => (
                      <div key={u.id} className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-16">{months[u.month - 1]}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              selectedType === 'electricity' ? 'bg-yellow-400' :
                              selectedType === 'water' ? 'bg-blue-400' : 'bg-red-400'
                            }`}
                            style={{ width: `${(u.amount / maxAmount) * 100}%` }}
                          />
                          <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                            {u.amount}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500 w-20 text-right">{u.cost.toLocaleString()}₮</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* QPay төлбөр modal */}
      {payingBill && !paySuccess && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={closePayModal}>
          <div
            className="bg-white w-full max-w-[430px] rounded-t-2xl p-6 max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4"></div>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">{typeMap[payingBill.utility_type]?.icon || '⚡'}</span>
              <div>
                <h2 className="text-lg font-bold">{typeMap[payingBill.utility_type]?.label || payingBill.utility_type} төлбөр</h2>
                <p className="text-sm text-gray-500">
                  {months[payingBill.month - 1]} {payingBill.year} — {Number(payingBill.amount).toLocaleString()}₮
                </p>
              </div>
            </div>

            {qpayLoading && (
              <div className="text-center py-8">
                <div className="animate-spin text-3xl mb-3">⏳</div>
                <p className="text-gray-500 text-sm">QPay нэхэмжлэх үүсгэж байна...</p>
              </div>
            )}

            {qpayError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-center">
                <p className="text-sm text-red-700 mb-2">{qpayError}</p>
                <button
                  onClick={() => startPayBill(payingBill!)}
                  className="text-sm font-medium text-red-600 underline"
                >
                  Дахин оролдох
                </button>
              </div>
            )}

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

                {checking && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 flex items-center gap-2">
                    <div className="animate-spin text-lg">⏳</div>
                    <p className="text-sm text-blue-700">Төлбөр хүлээж байна...</p>
                  </div>
                )}

                {/* Банкны апп deep link */}
                {qpayInvoice.urls && qpayInvoice.urls.length > 0 && (
                  <>
                    <h3 className="text-xs font-semibold text-gray-400 mb-3">БАНКНЫ АПП-ААР ШУУД ТӨЛӨХ</h3>
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
              className="w-full py-3 rounded-xl font-semibold text-sm border border-gray-300 text-gray-600"
            >
              Цуцлах
            </button>
          </div>
        </div>
      )}

      {/* Амжилттай */}
      {paySuccess && payingBill && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 mx-4 text-center max-w-[350px]">
            <div className="text-5xl mb-3">✅</div>
            <h2 className="text-lg font-bold mb-1">Амжилттай!</h2>
            <p className="text-sm text-gray-500">
              {typeMap[payingBill.utility_type]?.label} — {Number(payingBill.amount).toLocaleString()}₮ төлөгдлөө
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
