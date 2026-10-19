'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';

interface UtilityBill {
  sokh_id: number | null;
  amount: number | string;
  consumption: number | string | null;
  status: string;
  year: number;
  month: number;
}

interface SokhRow {
  id: number;
  address: string | null;
}

interface TsahBranch {
  id: number;
  name: string;
  district: string;
  sokhCount: number;
  totalBills: number;
  paid: number;
  unpaid: number;
  meterReadings: number;
  avgConsumption: number | null;
}

type Period = 'month' | 'quarter' | 'year';

const DISTRICTS = ['Баянгол', 'Чингэлтэй', 'Сүхбаатар', 'Хан-Уул', 'Баянзүрх', 'Сонгинохайрхан'];

// Сонгосон хугацаанд (одоогийн сар / сүүлийн 3 сар / энэ жил) хамаарах эсэх
function inPeriod(b: UtilityBill, period: Period, now: Date) {
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  if (period === 'month') return b.year === y && b.month === m;
  if (period === 'year') return b.year === y;
  const idx = b.year * 12 + b.month;
  const cur = y * 12 + m;
  return idx > cur - 3 && idx <= cur;
}

function buildBranch(id: number, name: string, district: string, sokhs: SokhRow[], bills: UtilityBill[]): TsahBranch {
  const paidBills = bills.filter(b => b.status === 'paid');
  const unpaidBills = bills.filter(b => b.status !== 'paid');
  const withConsumption = bills.filter(b => b.consumption !== null && b.consumption !== '');
  return {
    id,
    name,
    district,
    sokhCount: sokhs.length,
    totalBills: bills.reduce((s, b) => s + Number(b.amount), 0),
    paid: paidBills.reduce((s, b) => s + Number(b.amount), 0),
    unpaid: unpaidBills.reduce((s, b) => s + Number(b.amount), 0),
    meterReadings: bills.length,
    avgConsumption: withConsumption.length > 0
      ? Math.round(withConsumption.reduce((s, b) => s + Number(b.consumption), 0) / withConsumption.length)
      : null,
  };
}

export default function TsahRevenuePage() {
  const [bills, setBills] = useState<UtilityBill[]>([]);
  const [sokhs, setSokhs] = useState<SokhRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('month');

  useEffect(() => {
    (async () => {
      const [{ data: billData }, { data: sokhData }] = await Promise.all([
        supabase
          .from('utility_bills')
          .select('sokh_id, amount, consumption, status, year, month')
          .eq('utility_type', 'electricity'),
        supabase.from('sokh_organizations').select('id, address'),
      ]);
      setBills((billData as UtilityBill[]) || []);
      setSokhs((sokhData as SokhRow[]) || []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="p-8 text-gray-500">Ачаалж байна...</div>;

  const now = new Date();
  const periodBills = bills.filter(b => inPeriod(b, selectedPeriod, now));

  // СӨХ-ийг хаягаар нь дүүрэгт хуваарилна; аль ч дүүрэгт таарахгүй бол "Бусад"
  const districtOf = (s: SokhRow) => {
    const addr = (s.address || '').toLowerCase();
    return DISTRICTS.find(d => addr.includes(d.toLowerCase())) ?? null;
  };
  const sokhDistrict = new Map(sokhs.map(s => [s.id, districtOf(s)]));
  const billDistrict = (b: UtilityBill) => (b.sokh_id != null ? sokhDistrict.get(b.sokh_id) ?? null : null);

  const branches: TsahBranch[] = DISTRICTS.map((d, i) =>
    buildBranch(
      i + 1,
      `УБЦТГ ${d} нэгж`,
      d,
      sokhs.filter(s => sokhDistrict.get(s.id) === d),
      periodBills.filter(b => billDistrict(b) === d),
    ),
  );
  const otherSokhs = sokhs.filter(s => sokhDistrict.get(s.id) === null);
  const otherBills = periodBills.filter(b => billDistrict(b) === null);
  if (otherSokhs.length > 0 || otherBills.length > 0) {
    branches.push(buildBranch(DISTRICTS.length + 1, 'Бусад', 'Хаяг тодорхойгүй', otherSokhs, otherBills));
  }

  const totalBills = branches.reduce((s, b) => s + b.totalBills, 0);
  const totalPaid = branches.reduce((s, b) => s + b.paid, 0);
  const totalUnpaid = branches.reduce((s, b) => s + b.unpaid, 0);
  const withConsumption = periodBills.filter(b => b.consumption !== null && b.consumption !== '');
  const avgKwh = withConsumption.length > 0
    ? Math.round(withConsumption.reduce((s, b) => s + Number(b.consumption), 0) / withConsumption.length)
    : null;
  const collectionRate = totalBills > 0 ? Math.round((totalPaid / totalBills) * 100) : null;

  const rateClass = (rate: number) =>
    rate >= 80 ? 'bg-green-900/50 text-green-400' :
    rate >= 60 ? 'bg-yellow-900/50 text-yellow-400' :
    'bg-red-900/50 text-red-400';

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">⚡ Цахилгаан орлого & хяналт</h1>
          <p className="text-gray-400 text-sm mt-1">УБЦТГ салбар нэгж бүрийн орлого, хэрэглээ</p>
        </div>
        <div className="flex gap-2">
          {(['month', 'quarter', 'year'] as const).map(p => (
            <button
              key={p}
              onClick={() => setSelectedPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                selectedPeriod === p ? 'bg-yellow-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {p === 'month' ? 'Сар' : p === 'quarter' ? 'Улирал' : 'Жил'}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-gradient-to-br from-yellow-600 to-yellow-700 rounded-2xl p-5">
          <p className="text-yellow-200 text-xs">⚡ Нийт нэхэмжлэх</p>
          <p className="text-xl font-bold mt-1">{totalBills.toLocaleString()}₮</p>
        </div>
        <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-2xl p-5">
          <p className="text-green-200 text-xs">✅ Цуглуулсан</p>
          <p className="text-xl font-bold mt-1">{totalPaid.toLocaleString()}₮</p>
        </div>
        <div className="bg-gradient-to-br from-red-600 to-red-700 rounded-2xl p-5">
          <p className="text-red-200 text-xs">⏳ Төлөгдөөгүй</p>
          <p className="text-xl font-bold mt-1">{totalUnpaid.toLocaleString()}₮</p>
        </div>
        <div className="bg-gray-800/50 border border-gray-800 rounded-2xl p-5">
          <p className="text-gray-400 text-xs">📊 Цуглуулалт</p>
          <p className="text-xl font-bold mt-1 text-green-400">{collectionRate !== null ? `${collectionRate}%` : '—'}</p>
        </div>
        <div className="bg-gray-800/50 border border-gray-800 rounded-2xl p-5">
          <p className="text-gray-400 text-xs">⚡ Дундаж хэрэглээ</p>
          <p className="text-xl font-bold mt-1">{avgKwh !== null ? `${avgKwh} кВт·ц` : '—'}</p>
        </div>
      </div>

      {/* Нэгж бүрийн хүснэгт */}
      <div className="bg-gray-800/50 border border-gray-800 rounded-2xl p-5">
        <h2 className="font-semibold mb-4">Салбар нэгж бүрийн байдал</h2>
        <table className="w-full">
          <thead>
            <tr className="text-xs text-gray-500 border-b border-gray-700">
              <th className="text-left pb-3">Нэгж</th>
              <th className="text-center pb-3">СӨХ тоо</th>
              <th className="text-center pb-3">Заалт</th>
              <th className="text-center pb-3">Дундаж кВт·ц</th>
              <th className="text-right pb-3">Нэхэмжлэх</th>
              <th className="text-right pb-3">Төлсөн</th>
              <th className="text-right pb-3">Өртэй</th>
              <th className="text-center pb-3">Цуглуулалт</th>
            </tr>
          </thead>
          <tbody>
            {branches.map(b => {
              const rate = b.totalBills > 0 ? Math.round((b.paid / b.totalBills) * 100) : null;
              return (
                <tr key={b.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-3">
                    <p className="text-sm font-medium">{b.name}</p>
                    <p className="text-xs text-gray-500">{b.name === 'Бусад' ? b.district : `${b.district} дүүрэг`}</p>
                  </td>
                  <td className="text-center text-sm">{b.sokhCount}</td>
                  <td className="text-center text-sm">{b.meterReadings}</td>
                  <td className="text-center text-sm text-yellow-400">{b.avgConsumption ?? '—'}</td>
                  <td className="text-right text-sm">{b.totalBills.toLocaleString()}₮</td>
                  <td className="text-right text-sm text-green-400">{b.paid.toLocaleString()}₮</td>
                  <td className="text-right text-sm text-red-400">{b.unpaid.toLocaleString()}₮</td>
                  <td className="text-center">
                    {rate !== null ? (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${rateClass(rate)}`}>{rate}%</span>
                    ) : (
                      <span className="text-xs text-gray-600">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {periodBills.length === 0 && (
          <p className="text-sm text-gray-500 mt-4">Сонгосон хугацаанд цахилгааны нэхэмжлэх бүртгэгдээгүй байна.</p>
        )}
      </div>
    </div>
  );
}
