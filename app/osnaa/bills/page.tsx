'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { adminFrom } from '@/app/lib/admin-db';

interface Bill { id: number; resident_id: number; apartment: string; utility_type: string; consumption: number; rate: number; amount: number; status: string; month: number; year: number; }
interface Org { id: number; name: string; }

const utilityTypes = [
  { value: 'water', label: 'Ус', icon: '💧', unit: 'м³' },
  { value: 'heating', label: 'Дулаан', icon: '🔥', unit: 'Гкал' },
  { value: 'electricity', label: 'Цахилгаан', icon: '⚡', unit: 'кВт/ц' },
];

const months = ['1-р сар','2-р сар','3-р сар','4-р сар','5-р сар','6-р сар','7-р сар','8-р сар','9-р сар','10-р сар','11-р сар','12-р сар'];

export default function OsnaaBills() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState('');

  const [selectedOrg, setSelectedOrg] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [filterType, setFilterType] = useState('all');

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

  // Нэхэмжлэх үүсгэх: meter_readings * tariff = bill
  const generateBills = async () => {
    if (!selectedOrg) return;
    setGenerating(true);
    setGenResult('');

    // Тоолуурын заалтууд
    const { data: readings } = await supabase
      .from('meter_readings')
      .select('*')
      .eq('sokh_id', selectedOrg)
      .eq('year', selectedYear)
      .eq('month', selectedMonth);

    if (!readings || readings.length === 0) {
      setGenResult('Тоолуурын заалт байхгүй байна. Эхлээд заалт оруулна уу.');
      setGenerating(false);
      return;
    }

    // Тарифууд
    const { data: tariffs } = await supabase
      .from('utility_tariffs')
      .select('*')
      .eq('sokh_id', selectedOrg)
      .order('effective_from', { ascending: false });

    if (!tariffs || tariffs.length === 0) {
      setGenResult('Тариф тогтоогоогүй байна. Эхлээд тариф нэмнэ үү.');
      setGenerating(false);
      return;
    }

    // Тариф олох: utility_type-аар хамгийн сүүлийн тариф
    const getRate = (type: string) => {
      const t = tariffs.find(t => t.utility_type === type);
      return t ? Number(t.rate_per_unit) : 0;
    };

    let created = 0;
    let skipped = 0;

    for (const reading of readings) {
      const rate = getRate(reading.utility_type);
      if (rate === 0) { skipped++; continue; }

      const consumption = Number(reading.current_reading) - Number(reading.previous_reading || 0);
      const amount = Math.round(consumption * rate);

      // Байгаа эсэхийг шалгах (upsert шиг)
      const { data: existing } = await supabase
        .from('utility_bills')
        .select('id')
        .eq('resident_id', reading.resident_id)
        .eq('utility_type', reading.utility_type)
        .eq('year', selectedYear)
        .eq('month', selectedMonth)
        .limit(1);

      if (existing && existing.length > 0) {
        await adminFrom('utility_bills').update({
          consumption, rate, amount,
        }).eq('id', existing[0].id);
      } else {
        await adminFrom('utility_bills').insert([{
          sokh_id: Number(selectedOrg),
          resident_id: reading.resident_id,
          apartment: reading.apartment,
          utility_type: reading.utility_type,
          year: selectedYear,
          month: selectedMonth,
          consumption,
          rate,
          amount,
          status: 'unpaid',
        }]);
      }
      created++;
    }

    setGenResult(`${created} нэхэмжлэх үүсгэлээ${skipped > 0 ? `, ${skipped} алгаслаа (тариф байхгүй)` : ''}`);
    setGenerating(false);
    await fetchBills();
  };

  const filtered = filterType === 'all' ? bills : bills.filter(b => b.utility_type === filterType);
  const totalAmount = filtered.reduce((s, b) => s + Number(b.amount), 0);
  const unpaidAmount = filtered.filter(b => b.status === 'unpaid').reduce((s, b) => s + Number(b.amount), 0);
  const getType = (t: string) => utilityTypes.find(u => u.value === t) || utilityTypes[0];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">🧾 Нэхэмжлэх</h1>

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

        <button onClick={generateBills} disabled={generating}
          className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50">
          {generating ? 'Үүсгэж байна...' : '🧾 Нэхэмжлэх үүсгэх'}
        </button>

        <div className="flex gap-1 ml-auto">
          <button onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg text-sm ${filterType === 'all' ? 'bg-amber-600 text-white' : 'bg-gray-100'}`}>
            Бүгд
          </button>
          {utilityTypes.map(t => (
            <button key={t.value} onClick={() => setFilterType(t.value)}
              className={`px-3 py-1.5 rounded-lg text-sm ${filterType === t.value ? 'bg-amber-600 text-white' : 'bg-gray-100'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {genResult && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 p-3 rounded-xl text-sm mb-4">
          {genResult}
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-500">Нийт</p>
          <p className="text-xl font-bold">{totalAmount.toLocaleString()}₮</p>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-500">Төлөгдөөгүй</p>
          <p className="text-xl font-bold text-red-600">{unpaidAmount.toLocaleString()}₮</p>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-500">Төлсөн</p>
          <p className="text-xl font-bold text-green-600">{(totalAmount - unpaidAmount).toLocaleString()}₮</p>
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
                <th className="px-4 py-3 text-right text-xs text-gray-500">Хэрэглээ</th>
                <th className="px-4 py-3 text-right text-xs text-gray-500">Тариф</th>
                <th className="px-4 py-3 text-right text-xs text-gray-500">Дүн</th>
                <th className="px-4 py-3 text-center text-xs text-gray-500">Төлөв</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => {
                const ut = getType(b.utility_type);
                return (
                  <tr key={b.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{b.apartment}</td>
                    <td className="px-4 py-3">{ut.icon} {ut.label}</td>
                    <td className="px-4 py-3 text-right">{Number(b.consumption)} {ut.unit}</td>
                    <td className="px-4 py-3 text-right">{Number(b.rate).toLocaleString()}₮/{ut.unit}</td>
                    <td className="px-4 py-3 text-right font-medium">{Number(b.amount).toLocaleString()}₮</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        b.status === 'paid' ? 'bg-green-100 text-green-700' :
                        b.status === 'overdue' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {b.status === 'paid' ? 'Төлсөн' : b.status === 'overdue' ? 'Хугацаа хэтэрсэн' : 'Төлөгдөөгүй'}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Нэхэмжлэх байхгүй</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
