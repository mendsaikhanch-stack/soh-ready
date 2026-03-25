'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';

interface Org { id: number; name: string; }

const utilityTypes = [
  { value: 'water', label: 'Ус', icon: '💧', color: 'bg-blue-400' },
  { value: 'heating', label: 'Дулаан', icon: '🔥', color: 'bg-red-400' },
  { value: 'electricity', label: 'Цахилгаан', icon: '⚡', color: 'bg-yellow-400' },
];

const months = ['1-р сар','2-р сар','3-р сар','4-р сар','5-р сар','6-р сар','7-р сар','8-р сар','9-р сар','10-р сар','11-р сар','12-р сар'];

interface MonthlyData {
  month: number;
  billed: number;
  paid: number;
  water: number;
  heating: number;
  electricity: number;
}

export default function OsnaaReports() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrg, setSelectedOrg] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);

  useEffect(() => {
    const fetchOrgs = async () => {
      const { data } = await supabase.from('sokh_organizations').select('id, name').order('name');
      setOrgs(data || []);
      if (data && data.length > 0) setSelectedOrg(String(data[0].id));
      setLoading(false);
    };
    fetchOrgs();
  }, []);

  useEffect(() => {
    if (selectedOrg) fetchReport();
  }, [selectedOrg, selectedYear]);

  const fetchReport = async () => {
    setLoading(true);
    const { data: bills } = await supabase
      .from('utility_bills')
      .select('*')
      .eq('sokh_id', selectedOrg)
      .eq('year', selectedYear);

    const allBills = bills || [];

    const data: MonthlyData[] = [];
    for (let m = 1; m <= 12; m++) {
      const monthBills = allBills.filter(b => b.month === m);
      data.push({
        month: m,
        billed: monthBills.reduce((s, b) => s + Number(b.amount), 0),
        paid: monthBills.filter(b => b.status === 'paid').reduce((s, b) => s + Number(b.amount), 0),
        water: monthBills.filter(b => b.utility_type === 'water').reduce((s, b) => s + Number(b.amount), 0),
        heating: monthBills.filter(b => b.utility_type === 'heating').reduce((s, b) => s + Number(b.amount), 0),
        electricity: monthBills.filter(b => b.utility_type === 'electricity').reduce((s, b) => s + Number(b.amount), 0),
      });
    }
    setMonthlyData(data);
    setLoading(false);
  };

  const yearTotal = monthlyData.reduce((s, d) => s + d.billed, 0);
  const yearPaid = monthlyData.reduce((s, d) => s + d.paid, 0);
  const maxBilled = Math.max(...monthlyData.map(d => d.billed), 1);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">📋 Тайлан</h1>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-6">
        <select value={selectedOrg} onChange={e => setSelectedOrg(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm">
          {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>

        <div className="flex items-center gap-1">
          <button onClick={() => setSelectedYear(y => y - 1)} className="px-2 py-1 bg-gray-100 rounded text-sm">←</button>
          <span className="font-medium px-2">{selectedYear}</span>
          <button onClick={() => setSelectedYear(y => y + 1)} className="px-2 py-1 bg-gray-100 rounded text-sm">→</button>
        </div>
      </div>

      {/* Year summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-500">Жилийн нийт нэхэмжлэл</p>
          <p className="text-2xl font-bold">{yearTotal.toLocaleString()}₮</p>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-500">Цуглуулсан</p>
          <p className="text-2xl font-bold text-green-600">{yearPaid.toLocaleString()}₮</p>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-500">Цуглуулалтын хувь</p>
          <p className={`text-2xl font-bold ${yearTotal > 0 && (yearPaid / yearTotal) >= 0.8 ? 'text-green-600' : 'text-red-600'}`}>
            {yearTotal > 0 ? Math.round((yearPaid / yearTotal) * 100) : 0}%
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400 text-center py-8">Ачаалж байна...</p>
      ) : (
        <>
          {/* Monthly chart */}
          <div className="bg-white border rounded-xl p-4 mb-6">
            <h3 className="text-sm font-semibold text-gray-500 mb-4">САРЫН ТАЙЛАН</h3>
            <div className="space-y-2">
              {monthlyData.map((d) => (
                <div key={d.month} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-16">{months[d.month - 1]}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-7 relative overflow-hidden">
                    {/* Paid portion */}
                    <div
                      className="absolute h-full bg-green-400 rounded-full"
                      style={{ width: `${(d.paid / maxBilled) * 100}%` }}
                    />
                    {/* Billed total */}
                    <div
                      className="absolute h-full bg-amber-300/50 rounded-full"
                      style={{ width: `${(d.billed / maxBilled) * 100}%` }}
                    />
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                      {d.billed > 0 ? `${d.billed.toLocaleString()}₮` : ''}
                    </span>
                  </div>
                  <span className="text-xs w-12 text-right">
                    {d.billed > 0 ? `${Math.round((d.paid / d.billed) * 100)}%` : '-'}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-400 inline-block"></span> Төлсөн</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-300 inline-block"></span> Нэхэмжилсэн</span>
            </div>
          </div>

          {/* By type */}
          <div className="bg-white border rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-500 mb-4">ТӨРЛӨӨР</h3>
            <div className="grid grid-cols-3 gap-4">
              {utilityTypes.map(ut => {
                const total = monthlyData.reduce((s, d) => s + (d as any)[ut.value], 0);
                return (
                  <div key={ut.value} className="text-center">
                    <span className="text-3xl">{ut.icon}</span>
                    <p className="font-bold text-lg mt-1">{total.toLocaleString()}₮</p>
                    <p className="text-xs text-gray-500">{ut.label}</p>
                    <p className="text-xs text-gray-400">{yearTotal > 0 ? Math.round((total / yearTotal) * 100) : 0}%</p>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
