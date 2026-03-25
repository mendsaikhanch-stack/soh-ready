'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { adminFrom } from '@/app/lib/admin-db';

interface Bill { id: number; apartment: string; utility_type: string; amount: number; status: string; consumption: number; paid_at: string | null; }
interface Org { id: number; name: string; }

const utilityTypes = [
  { value: 'water', label: 'Ус', icon: '💧' },
  { value: 'heating', label: 'Дулаан', icon: '🔥' },
  { value: 'electricity', label: 'Цахилгаан', icon: '⚡' },
];

const months = ['1-р сар','2-р сар','3-р сар','4-р сар','5-р сар','6-р сар','7-р сар','8-р сар','9-р сар','10-р сар','11-р сар','12-р сар'];

export default function OsnaaPayments() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedOrg, setSelectedOrg] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [filterStatus, setFilterStatus] = useState('all');

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
    if (selectedOrg) fetchBills();
  }, [selectedOrg, selectedMonth, selectedYear]);

  const fetchBills = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('utility_bills')
      .select('*')
      .eq('sokh_id', selectedOrg)
      .eq('year', selectedYear)
      .eq('month', selectedMonth)
      .order('apartment');
    setBills(data || []);
    setLoading(false);
  };

  const markPaid = async (id: number) => {
    await adminFrom('utility_bills').update({
      status: 'paid',
      paid_at: new Date().toISOString(),
    }).eq('id', id);
    await fetchBills();
  };

  const markUnpaid = async (id: number) => {
    await adminFrom('utility_bills').update({
      status: 'unpaid',
      paid_at: null,
    }).eq('id', id);
    await fetchBills();
  };

  const filtered = filterStatus === 'all' ? bills : bills.filter(b => b.status === filterStatus);
  const totalBilled = bills.reduce((s, b) => s + Number(b.amount), 0);
  const totalPaid = bills.filter(b => b.status === 'paid').reduce((s, b) => s + Number(b.amount), 0);
  const collectionRate = totalBilled > 0 ? Math.round((totalPaid / totalBilled) * 100) : 0;

  const getType = (t: string) => utilityTypes.find(u => u.value === t) || utilityTypes[0];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">💳 Төлбөр хянах</h1>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select value={selectedOrg} onChange={e => setSelectedOrg(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm">
          {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>

        <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}
          className="border rounded-lg px-3 py-2 text-sm">
          {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>

        <div className="flex items-center gap-1">
          <button onClick={() => setSelectedYear(y => y - 1)} className="px-2 py-1 bg-gray-100 rounded text-sm">←</button>
          <span className="font-medium px-2">{selectedYear}</span>
          <button onClick={() => setSelectedYear(y => y + 1)} className="px-2 py-1 bg-gray-100 rounded text-sm">→</button>
        </div>

        <div className="flex gap-1 ml-auto">
          {[
            { value: 'all', label: 'Бүгд' },
            { value: 'unpaid', label: 'Төлөгдөөгүй' },
            { value: 'paid', label: 'Төлсөн' },
          ].map(s => (
            <button key={s.value} onClick={() => setFilterStatus(s.value)}
              className={`px-3 py-1.5 rounded-lg text-sm ${filterStatus === s.value ? 'bg-amber-600 text-white' : 'bg-gray-100'}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-500">Нийт нэхэмжилсэн</p>
          <p className="text-xl font-bold">{totalBilled.toLocaleString()}₮</p>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-500">Цуглуулсан</p>
          <p className="text-xl font-bold text-green-600">{totalPaid.toLocaleString()}₮</p>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-500">Үлдэгдэл</p>
          <p className="text-xl font-bold text-red-600">{(totalBilled - totalPaid).toLocaleString()}₮</p>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-500">Цуглуулалтын хувь</p>
          <p className={`text-xl font-bold ${collectionRate >= 80 ? 'text-green-600' : collectionRate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
            {collectionRate}%
          </p>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-gray-400 text-center py-8">Ачаалж байна...</p>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs text-gray-500">Тоот</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500">Төрөл</th>
                <th className="px-4 py-3 text-right text-xs text-gray-500">Дүн</th>
                <th className="px-4 py-3 text-center text-xs text-gray-500">Төлөв</th>
                <th className="px-4 py-3 text-right text-xs text-gray-500">Үйлдэл</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => {
                const ut = getType(b.utility_type);
                return (
                  <tr key={b.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{b.apartment}</td>
                    <td className="px-4 py-3">{ut.icon} {ut.label}</td>
                    <td className="px-4 py-3 text-right font-medium">{Number(b.amount).toLocaleString()}₮</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        b.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {b.status === 'paid' ? 'Төлсөн' : 'Төлөгдөөгүй'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {b.status === 'unpaid' ? (
                        <button onClick={() => markPaid(b.id)}
                          className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium hover:bg-green-200">
                          Төлсөн гэж тэмдэглэх
                        </button>
                      ) : (
                        <button onClick={() => markUnpaid(b.id)}
                          className="text-gray-400 text-xs hover:underline">
                          Буцаах
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Нэхэмжлэх байхгүй</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
