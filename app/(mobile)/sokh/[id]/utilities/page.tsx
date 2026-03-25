'use client';

import { useState, useEffect } from 'react';
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

const typeMap: Record<string, { label: string; icon: string; color: string; unit: string; bg: string; border: string }> = {
  electricity: { label: 'Цахилгаан', icon: '⚡', color: 'text-yellow-600', unit: 'кВт/ц', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  water: { label: 'Ус', icon: '💧', color: 'text-blue-600', unit: 'м³', bg: 'bg-blue-50', border: 'border-blue-200' },
  heating: { label: 'Дулаан', icon: '🔥', color: 'text-red-600', unit: 'Гкал', bg: 'bg-red-50', border: 'border-red-200' },
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

    // Хэрэв нэвтэрсэн бол тоолуур заалт + нэхэмжлэх
    if (profile) {
      const [{ data: rd }, { data: bl }] = await Promise.all([
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
      ]);
      setReadings(rd || []);
      setBills(bl || []);
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
          {tp.icon} Заалт оруулах
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
          {/* ========== ЗААЛТ ОРУУЛАХ TAB ========== */}
          {activeTab === 'reading' && (
            <>
              {/* Одоогийн сарын статус */}
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

              {/* Нэхэмжлэхүүд */}
              {typeBills.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-gray-500 mb-2">НЭХЭМЖЛЭХ</h3>
                  <div className="space-y-2">
                    {typeBills.slice(0, 6).map(b => (
                      <div key={b.id} className="bg-white rounded-xl p-3 flex items-center justify-between border">
                        <div>
                          <p className="text-sm font-medium">{months[b.month - 1]} {b.year}</p>
                          <p className="text-xs text-gray-500">{Number(b.consumption)} {tp.unit} x {Number(b.rate).toLocaleString()}₮</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-sm">{Number(b.amount).toLocaleString()}₮</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                            b.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {b.status === 'paid' ? 'Төлсөн' : 'Төлөгдөөгүй'}
                          </span>
                        </div>
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
    </div>
  );
}
