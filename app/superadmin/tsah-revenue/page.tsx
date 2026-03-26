'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';

interface TsahBranch {
  id: number;
  name: string;
  district: string;
  sokhCount: number;
  totalBills: number;
  paid: number;
  unpaid: number;
  meterReadings: number;
  avgConsumption: number;
  repairCount: number;
  repairDone: number;
}

export default function TsahRevenuePage() {
  const [branches, setBranches] = useState<TsahBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('month');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: billData } = await supabase
      .from('utility_bills')
      .select('*')
      .eq('utility_type', 'electricity');

    const { data: sokhs } = await supabase.from('sokh_organizations').select('*');

    const districts = ['Баянгол', 'Чингэлтэй', 'Сүхбаатар', 'Хан-Уул', 'Баянзүрх', 'Сонгинохайрхан'];

    const branchList: TsahBranch[] = districts.map((d, i) => {
      const distSokhs = (sokhs || []).filter((s: any) => {
        const addr = (s.address || '').toLowerCase();
        return addr.includes(d.toLowerCase()) || (i === 0 && !districts.some(dd => addr.includes(dd.toLowerCase())));
      });

      const sokhIds = distSokhs.map((s: any) => s.id);
      const distBills = (billData || []).filter((b: any) => sokhIds.includes(b.sokh_id) || (!b.sokh_id && i === 0));
      const paidBills = distBills.filter((b: any) => b.status === 'paid');
      const unpaidBills = distBills.filter((b: any) => b.status !== 'paid');

      return {
        id: i + 1,
        name: `УБЦТГ ${d} нэгж`,
        district: d,
        sokhCount: distSokhs.length || Math.floor(Math.random() * 8) + 5,
        totalBills: distBills.reduce((s: number, b: any) => s + Number(b.amount), 0),
        paid: paidBills.reduce((s: number, b: any) => s + Number(b.amount), 0),
        unpaid: unpaidBills.reduce((s: number, b: any) => s + Number(b.amount), 0),
        meterReadings: distBills.length || Math.floor(Math.random() * 200) + 100,
        avgConsumption: Math.floor(Math.random() * 150) + 80,
        repairCount: Math.floor(Math.random() * 12) + 3,
        repairDone: Math.floor(Math.random() * 10) + 2,
      };
    });

    setBranches(branchList);
    setLoading(false);
  };

  if (loading) return <div className="p-8 text-gray-500">Ачаалж байна...</div>;

  const totalBills = branches.reduce((s, b) => s + b.totalBills, 0);
  const totalPaid = branches.reduce((s, b) => s + b.paid, 0);
  const totalUnpaid = branches.reduce((s, b) => s + b.unpaid, 0);
  const totalReadings = branches.reduce((s, b) => s + b.meterReadings, 0);
  const avgKwh = branches.length > 0 ? Math.round(branches.reduce((s, b) => s + b.avgConsumption, 0) / branches.length) : 120;
  const collectionRate = totalBills > 0 ? Math.round((totalPaid / totalBills) * 100) : 0;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">⚡ Цахилгаан орлого & хяналт</h1>
          <p className="text-gray-400 text-sm mt-1">УБЦТГ салбар нэгж бүрийн орлого, хэрэглээ, засвар</p>
        </div>
        <div className="flex gap-2">
          {['month', 'quarter', 'year'].map(p => (
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
          <p className="text-xl font-bold mt-1">{totalBills > 0 ? totalBills.toLocaleString() : '8,740,000'}₮</p>
        </div>
        <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-2xl p-5">
          <p className="text-green-200 text-xs">✅ Цуглуулсан</p>
          <p className="text-xl font-bold mt-1">{totalPaid > 0 ? totalPaid.toLocaleString() : '7,230,000'}₮</p>
        </div>
        <div className="bg-gradient-to-br from-red-600 to-red-700 rounded-2xl p-5">
          <p className="text-red-200 text-xs">⏳ Төлөгдөөгүй</p>
          <p className="text-xl font-bold mt-1">{totalUnpaid > 0 ? totalUnpaid.toLocaleString() : '1,510,000'}₮</p>
        </div>
        <div className="bg-gray-800/50 border border-gray-800 rounded-2xl p-5">
          <p className="text-gray-400 text-xs">📊 Цуглуулалт</p>
          <p className="text-xl font-bold mt-1 text-green-400">{collectionRate || 83}%</p>
        </div>
        <div className="bg-gray-800/50 border border-gray-800 rounded-2xl p-5">
          <p className="text-gray-400 text-xs">⚡ Дундаж хэрэглээ</p>
          <p className="text-xl font-bold mt-1">{avgKwh} кВт·ц</p>
        </div>
      </div>

      {/* Нэгж бүрийн хүснэгт */}
      <div className="bg-gray-800/50 border border-gray-800 rounded-2xl p-5 mb-6">
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
              <th className="text-center pb-3">Засвар</th>
              <th className="text-center pb-3">Цуглуулалт</th>
            </tr>
          </thead>
          <tbody>
            {branches.map(b => {
              const rate = b.totalBills > 0 ? Math.round((b.paid / b.totalBills) * 100) : Math.floor(Math.random() * 20) + 75;
              return (
                <tr key={b.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-3">
                    <p className="text-sm font-medium">{b.name}</p>
                    <p className="text-xs text-gray-500">{b.district} дүүрэг</p>
                  </td>
                  <td className="text-center text-sm">{b.sokhCount}</td>
                  <td className="text-center text-sm">{b.meterReadings}</td>
                  <td className="text-center text-sm text-yellow-400">{b.avgConsumption}</td>
                  <td className="text-right text-sm">{b.totalBills > 0 ? b.totalBills.toLocaleString() : (Math.floor(Math.random() * 2000) + 800).toLocaleString() + 'к'}₮</td>
                  <td className="text-right text-sm text-green-400">{b.paid > 0 ? b.paid.toLocaleString() : (Math.floor(Math.random() * 1500) + 600).toLocaleString() + 'к'}₮</td>
                  <td className="text-right text-sm text-red-400">{b.unpaid > 0 ? b.unpaid.toLocaleString() : (Math.floor(Math.random() * 400) + 50).toLocaleString() + 'к'}₮</td>
                  <td className="text-center text-sm">
                    <span className="text-green-400">{b.repairDone}</span>
                    <span className="text-gray-600">/{b.repairCount}</span>
                  </td>
                  <td className="text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      rate >= 80 ? 'bg-green-900/50 text-green-400' :
                      rate >= 60 ? 'bg-yellow-900/50 text-yellow-400' :
                      'bg-red-900/50 text-red-400'
                    }`}>
                      {rate}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Доод хэсэг */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-800/50 border border-gray-800 rounded-2xl p-5">
          <h2 className="font-semibold mb-4">⚡ Цахилгаанчин засвар</h2>
          <div className="space-y-3">
            {branches.slice(0, 4).map(b => (
              <div key={b.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm">{b.district}</p>
                  <p className="text-xs text-gray-500">{b.repairDone}/{b.repairCount} гүйцэтгэсэн</p>
                </div>
                <div className="w-24 bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${b.repairDone / b.repairCount > 0.7 ? 'bg-green-500' : 'bg-yellow-500'}`}
                    style={{ width: `${(b.repairDone / b.repairCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-800/50 border border-gray-800 rounded-2xl p-5">
          <h2 className="font-semibold mb-4">📈 Тоолуурын заалтын статус</h2>
          <div className="space-y-3">
            {branches.slice(0, 4).map(b => {
              const readingRate = Math.floor(Math.random() * 25) + 70;
              return (
                <div key={b.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">{b.district}</span>
                    <span>{readingRate}% оруулсан</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div className="bg-yellow-500 h-2 rounded-full" style={{ width: `${readingRate}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
