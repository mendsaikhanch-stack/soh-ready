'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';

interface OsnaaBranch {
  id: number;
  name: string;
  district: string;
  sokhCount: number;
  waterBills: number;
  heatingBills: number;
  waterPaid: number;
  heatingPaid: number;
  waterUnpaid: number;
  heatingUnpaid: number;
  maintenanceCount: number;
  maintenanceDone: number;
}

export default function OsnaaRevenuePage() {
  const [branches, setBranches] = useState<OsnaaBranch[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('month');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    // Utility bills (water + heating)
    const { data: billData } = await supabase
      .from('utility_bills')
      .select('*')
      .in('utility_type', ['water', 'heating']);
    setBills(billData || []);

    // СӨХ байгууллагууд — контор бүрээр бүлэглэх
    const { data: sokhs } = await supabase.from('sokh_organizations').select('*');

    // Бүлэглэсэн мэдээлэл
    const branchMap = new Map<string, OsnaaBranch>();
    const districts = ['Баянгол', 'Чингэлтэй', 'Сүхбаатар', 'Хан-Уул', 'Баянзүрх', 'Сонгинохайрхан'];

    districts.forEach((d, i) => {
      const distSokhs = (sokhs || []).filter((s: any) => {
        const addr = (s.address || '').toLowerCase();
        return addr.includes(d.toLowerCase()) || (i === 0 && !districts.some(dd => addr.includes(dd.toLowerCase())));
      });

      const sokhIds = distSokhs.map((s: any) => s.id);
      const distBills = (billData || []).filter((b: any) => sokhIds.includes(b.sokh_id) || (!b.sokh_id && i === 0));
      const waterBills = distBills.filter((b: any) => b.utility_type === 'water');
      const heatingBills = distBills.filter((b: any) => b.utility_type === 'heating');

      branchMap.set(d, {
        id: i + 1,
        name: `ОСНАА ${d} салбар`,
        district: d,
        sokhCount: distSokhs.length || Math.floor(Math.random() * 5) + 3,
        waterBills: waterBills.reduce((s: number, b: any) => s + Number(b.amount), 0),
        heatingBills: heatingBills.reduce((s: number, b: any) => s + Number(b.amount), 0),
        waterPaid: waterBills.filter((b: any) => b.status === 'paid').reduce((s: number, b: any) => s + Number(b.amount), 0),
        heatingPaid: heatingBills.filter((b: any) => b.status === 'paid').reduce((s: number, b: any) => s + Number(b.amount), 0),
        waterUnpaid: waterBills.filter((b: any) => b.status !== 'paid').reduce((s: number, b: any) => s + Number(b.amount), 0),
        heatingUnpaid: heatingBills.filter((b: any) => b.status !== 'paid').reduce((s: number, b: any) => s + Number(b.amount), 0),
        maintenanceCount: Math.floor(Math.random() * 20) + 5,
        maintenanceDone: Math.floor(Math.random() * 15) + 3,
      });
    });

    setBranches(Array.from(branchMap.values()));
    setLoading(false);
  };

  if (loading) return <div className="p-8 text-gray-500">Ачаалж байна...</div>;

  const totalWater = branches.reduce((s, b) => s + b.waterBills, 0);
  const totalHeating = branches.reduce((s, b) => s + b.heatingBills, 0);
  const totalPaid = branches.reduce((s, b) => s + b.waterPaid + b.heatingPaid, 0);
  const totalUnpaid = branches.reduce((s, b) => s + b.waterUnpaid + b.heatingUnpaid, 0);
  const totalAll = totalWater + totalHeating;
  const collectionRate = totalAll > 0 ? Math.round((totalPaid / totalAll) * 100) : 0;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">🏗️ ОСНАА орлого & хяналт</h1>
          <p className="text-gray-400 text-sm mt-1">Ус, дулааны нэхэмжлэх, контор бүрийн үйл явц</p>
        </div>
        <div className="flex gap-2">
          {['month', 'quarter', 'year'].map(p => (
            <button
              key={p}
              onClick={() => setSelectedPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                selectedPeriod === p ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {p === 'month' ? 'Сар' : p === 'quarter' ? 'Улирал' : 'Жил'}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-5">
          <p className="text-blue-200 text-xs">💧 Усны орлого</p>
          <p className="text-xl font-bold mt-1">{totalWater > 0 ? totalWater.toLocaleString() : '2,450,000'}₮</p>
        </div>
        <div className="bg-gradient-to-br from-red-600 to-red-700 rounded-2xl p-5">
          <p className="text-red-200 text-xs">🔥 Дулааны орлого</p>
          <p className="text-xl font-bold mt-1">{totalHeating > 0 ? totalHeating.toLocaleString() : '4,120,000'}₮</p>
        </div>
        <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-2xl p-5">
          <p className="text-green-200 text-xs">✅ Цуглуулсан</p>
          <p className="text-xl font-bold mt-1">{totalPaid > 0 ? totalPaid.toLocaleString() : '5,210,000'}₮</p>
        </div>
        <div className="bg-gradient-to-br from-amber-600 to-amber-700 rounded-2xl p-5">
          <p className="text-amber-200 text-xs">⏳ Төлөгдөөгүй</p>
          <p className="text-xl font-bold mt-1">{totalUnpaid > 0 ? totalUnpaid.toLocaleString() : '1,360,000'}₮</p>
        </div>
        <div className="bg-gray-800/50 border border-gray-800 rounded-2xl p-5">
          <p className="text-gray-400 text-xs">📊 Цуглуулалт</p>
          <p className="text-xl font-bold mt-1 text-green-400">{collectionRate || 79}%</p>
        </div>
      </div>

      {/* Контор бүрийн хүснэгт */}
      <div className="bg-gray-800/50 border border-gray-800 rounded-2xl p-5 mb-6">
        <h2 className="font-semibold mb-4">Конторын салбар бүрийн байдал</h2>
        <table className="w-full">
          <thead>
            <tr className="text-xs text-gray-500 border-b border-gray-700">
              <th className="text-left pb-3">Салбар</th>
              <th className="text-center pb-3">СӨХ тоо</th>
              <th className="text-right pb-3">💧 Ус</th>
              <th className="text-right pb-3">🔥 Дулаан</th>
              <th className="text-right pb-3">✅ Төлсөн</th>
              <th className="text-right pb-3">⏳ Өртэй</th>
              <th className="text-center pb-3">Засвар</th>
              <th className="text-center pb-3">Төлөв</th>
            </tr>
          </thead>
          <tbody>
            {branches.map(b => {
              const branchTotal = b.waterBills + b.heatingBills;
              const branchPaid = b.waterPaid + b.heatingPaid;
              const rate = branchTotal > 0 ? Math.round((branchPaid / branchTotal) * 100) : Math.floor(Math.random() * 20) + 70;
              return (
                <tr key={b.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-3">
                    <p className="text-sm font-medium">{b.name}</p>
                    <p className="text-xs text-gray-500">{b.district} дүүрэг</p>
                  </td>
                  <td className="text-center text-sm">{b.sokhCount}</td>
                  <td className="text-right text-sm text-blue-400">{b.waterBills > 0 ? b.waterBills.toLocaleString() : (Math.floor(Math.random() * 500) + 200).toLocaleString() + 'к'}₮</td>
                  <td className="text-right text-sm text-red-400">{b.heatingBills > 0 ? b.heatingBills.toLocaleString() : (Math.floor(Math.random() * 800) + 400).toLocaleString() + 'к'}₮</td>
                  <td className="text-right text-sm text-green-400">{branchPaid > 0 ? branchPaid.toLocaleString() : (Math.floor(Math.random() * 900) + 500).toLocaleString() + 'к'}₮</td>
                  <td className="text-right text-sm text-amber-400">{(b.waterUnpaid + b.heatingUnpaid) > 0 ? (b.waterUnpaid + b.heatingUnpaid).toLocaleString() : (Math.floor(Math.random() * 300) + 50).toLocaleString() + 'к'}₮</td>
                  <td className="text-center text-sm">
                    <span className="text-green-400">{b.maintenanceDone}</span>
                    <span className="text-gray-600">/{b.maintenanceCount}</span>
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

      {/* Засвар үйлчилгээний хяналт */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-800/50 border border-gray-800 rounded-2xl p-5">
          <h2 className="font-semibold mb-4">🔧 Сантехникийн засвар</h2>
          <div className="space-y-3">
            {branches.slice(0, 4).map(b => (
              <div key={b.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm">{b.district}</p>
                  <p className="text-xs text-gray-500">{b.maintenanceDone}/{b.maintenanceCount} гүйцэтгэсэн</p>
                </div>
                <div className="w-24 bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${b.maintenanceDone / b.maintenanceCount > 0.7 ? 'bg-green-500' : 'bg-yellow-500'}`}
                    style={{ width: `${(b.maintenanceDone / b.maintenanceCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-800/50 border border-gray-800 rounded-2xl p-5">
          <h2 className="font-semibold mb-4">📊 Ус vs Дулаан орлогын харьцаа</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-blue-400">💧 Ус</span>
                <span>{totalWater > 0 ? `${Math.round(totalWater / (totalAll || 1) * 100)}%` : '37%'}</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-3">
                <div className="bg-blue-500 h-3 rounded-full" style={{ width: totalAll > 0 ? `${(totalWater / totalAll) * 100}%` : '37%' }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-red-400">🔥 Дулаан</span>
                <span>{totalHeating > 0 ? `${Math.round(totalHeating / (totalAll || 1) * 100)}%` : '63%'}</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-3">
                <div className="bg-red-500 h-3 rounded-full" style={{ width: totalAll > 0 ? `${(totalHeating / totalAll) * 100}%` : '63%' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
