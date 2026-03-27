'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { getAdminSokhId } from '@/app/lib/admin-config';

interface Resident {
  name: string;
  apartment: string;
  entrance: number | null;
  floor: number | null;
  debt: number;
  phone: string;
}

interface Payment {
  amount: number;
  paid_at: string;
  resident_id: number;
}

interface EntranceStats {
  entrance: number;
  total: number;
  debtors: number;
  totalDebt: number;
  totalPaid: number;
  collectionRate: number;
  residents: Resident[];
}

export default function AdminReports() {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntrance, setSelectedEntrance] = useState<number | null>(null);
  const [view, setView] = useState<'overview' | 'entrance'>('overview');

  useEffect(() => {
    const fetchData = async () => {
      const sokhId = await getAdminSokhId();
      const { data: res } = await supabase
        .from('residents')
        .select('name,apartment,entrance,floor,debt,phone')
        .eq('sokh_id', sokhId)
        .order('entrance')
        .order('apartment');
      setResidents(res || []);

      const { data: pay } = await supabase
        .from('payments')
        .select('amount,paid_at,resident_id, residents!inner(sokh_id)')
        .eq('residents.sokh_id', sokhId)
        .order('paid_at', { ascending: false });
      setPayments(pay || []);
      setLoading(false);
    };
    fetchData();
  }, []);

  if (loading) return <div className="p-8 text-gray-400">Ачаалж байна...</div>;

  // Орцуудыг бүлэглэх
  const entranceMap = new Map<number, Resident[]>();
  residents.forEach(r => {
    const ent = r.entrance || parseEntrance(r.apartment);
    if (!entranceMap.has(ent)) entranceMap.set(ent, []);
    entranceMap.get(ent)!.push(r);
  });

  const entrances: EntranceStats[] = Array.from(entranceMap.entries())
    .map(([entrance, res]) => {
      const totalDebt = res.reduce((s, r) => s + Number(r.debt), 0);
      const debtors = res.filter(r => Number(r.debt) > 0).length;
      const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0) / (entranceMap.size || 1);
      const collectionRate = totalDebt + totalPaid > 0
        ? Math.round((totalPaid / (totalDebt + totalPaid)) * 100) : 100;
      return { entrance, total: res.length, debtors, totalDebt, totalPaid: Math.round(totalPaid), collectionRate, residents: res };
    })
    .sort((a, b) => a.entrance - b.entrance);

  const totalResidents = residents.length;
  const totalDebt = residents.reduce((s, r) => s + Number(r.debt), 0);
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
  const totalDebtors = residents.filter(r => Number(r.debt) > 0).length;
  const overallRate = totalDebt + totalPaid > 0 ? Math.round((totalPaid / (totalDebt + totalPaid)) * 100) : 100;

  const selectedData = selectedEntrance !== null ? entrances.find(e => e.entrance === selectedEntrance) : null;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">📋 Тайлан — Орц орцоор</h1>
        <button
          onClick={() => {
            const printArea = document.getElementById('report-print-area');
            if (!printArea) return;
            const win = window.open('', '_blank');
            if (!win) return;
            win.document.write(`
              <html><head><title>Тайлан</title>
              <style>
                body { font-family: sans-serif; padding: 20px; color: #111; }
                table { width: 100%; border-collapse: collapse; margin: 16px 0; }
                th, td { border: 1px solid #ccc; padding: 8px; text-align: left; font-size: 13px; }
                th { background: #f5f5f5; font-weight: 600; }
                .text-right { text-align: right; }
                .text-red { color: #dc2626; }
                .text-green { color: #16a34a; }
                h2 { margin-top: 24px; }
                .stats { display: flex; gap: 16px; margin-bottom: 16px; }
                .stat-box { border: 1px solid #ddd; border-radius: 8px; padding: 12px; flex: 1; }
                .stat-label { font-size: 11px; color: #666; }
                .stat-value { font-size: 20px; font-weight: bold; }
                @media print { body { padding: 0; } }
              </style></head><body>
              <h1>СӨХ Тайлан — ${new Date().toLocaleDateString('mn-MN')}</h1>
              <div class="stats">
                <div class="stat-box"><div class="stat-label">Нийт айл</div><div class="stat-value">${totalResidents}</div></div>
                <div class="stat-box"><div class="stat-label">Өртэй</div><div class="stat-value text-red">${totalDebtors}</div></div>
                <div class="stat-box"><div class="stat-label">Нийт өр</div><div class="stat-value text-red">${totalDebt.toLocaleString()}₮</div></div>
                <div class="stat-box"><div class="stat-label">Цуглуулалт</div><div class="stat-value text-green">${overallRate}%</div></div>
              </div>
              ${entrances.map(ent => `
                <h2>Орц ${ent.entrance} (${ent.total} айл, өр: ${ent.totalDebt.toLocaleString()}₮)</h2>
                <table>
                  <thead><tr><th>№</th><th>Нэр</th><th>Тоот</th><th>Утас</th><th class="text-right">Өр</th></tr></thead>
                  <tbody>
                    ${ent.residents.map((r, i) => `<tr>
                      <td>${i + 1}</td><td>${r.name}</td><td>${r.apartment}</td><td>${r.phone || '-'}</td>
                      <td class="text-right ${Number(r.debt) > 0 ? 'text-red' : ''}">${Number(r.debt) > 0 ? Number(r.debt).toLocaleString() + '₮' : '0₮'}</td>
                    </tr>`).join('')}
                  </tbody>
                </table>
              `).join('')}
              </body></html>
            `);
            win.document.close();
            win.print();
          }}
          className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 print:hidden"
        >
          📄 PDF татах
        </button>
      </div>

      {/* Нийт тоймлол */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">Нийт айл</p>
          <p className="text-2xl font-bold text-blue-600">{totalResidents}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">Нийт орц</p>
          <p className="text-2xl font-bold text-indigo-600">{entrances.length}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">Нийт цуглуулсан</p>
          <p className="text-2xl font-bold text-green-600">{totalPaid.toLocaleString()}₮</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">Нийт өр</p>
          <p className="text-2xl font-bold text-red-500">{totalDebt.toLocaleString()}₮</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">Өртэй айл</p>
          <p className="text-2xl font-bold text-orange-500">{totalDebtors}</p>
        </div>
      </div>

      {/* Цуглуулалтын ерөнхий хувь */}
      <div className="bg-white rounded-xl border p-4 mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium">Нийт цуглуулалтын хувь</span>
          <span className="text-sm font-bold text-blue-600">{overallRate}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3">
          <div className="bg-blue-500 h-3 rounded-full transition-all" style={{ width: `${overallRate}%` }} />
        </div>
      </div>

      {/* Орц бүрийн карт */}
      <h2 className="text-lg font-semibold mb-3">Орц бүрийн тайлан</h2>
      <div className="grid grid-cols-3 gap-4 mb-6">
        {entrances.map(ent => {
          const isSelected = selectedEntrance === ent.entrance;
          return (
            <div
              key={ent.entrance}
              onClick={() => setSelectedEntrance(isSelected ? null : ent.entrance)}
              className={`bg-white rounded-xl border-2 p-4 cursor-pointer transition hover:shadow-md ${
                isSelected ? 'border-blue-500 shadow-md' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-lg font-bold text-indigo-700">
                    {ent.entrance}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{ent.entrance}-р орц</p>
                    <p className="text-xs text-gray-500">{ent.total} айл</p>
                  </div>
                </div>
                {ent.debtors > 0 && (
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                    {ent.debtors} өртэй
                  </span>
                )}
              </div>

              {/* Цуглуулалтын хувь */}
              <div className="mb-2">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500">Цуглуулалт</span>
                  <span className={`font-bold ${ent.collectionRate >= 80 ? 'text-green-600' : ent.collectionRate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {ent.collectionRate}%
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${ent.collectionRate >= 80 ? 'bg-green-500' : ent.collectionRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${ent.collectionRate}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="text-center bg-green-50 rounded-lg p-1.5">
                  <p className="text-xs text-gray-500">Төлсөн</p>
                  <p className="text-xs font-bold text-green-700">{ent.totalPaid.toLocaleString()}₮</p>
                </div>
                <div className="text-center bg-red-50 rounded-lg p-1.5">
                  <p className="text-xs text-gray-500">Өр</p>
                  <p className="text-xs font-bold text-red-600">{ent.totalDebt.toLocaleString()}₮</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Сонгосон орцны дэлгэрэнгүй */}
      {selectedData && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-4 py-3 bg-indigo-50 border-b flex justify-between items-center">
            <h2 className="font-semibold text-sm text-indigo-700">
              🏢 {selectedData.entrance}-р орц — Дэлгэрэнгүй ({selectedData.total} айл)
            </h2>
            <button onClick={() => setSelectedEntrance(null)} className="text-xs text-gray-500 hover:underline">Хаах ✕</button>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="text-left text-sm text-gray-500">
                <th className="px-4 py-2">№</th>
                <th className="px-4 py-2">Нэр</th>
                <th className="px-4 py-2">Тоот</th>
                <th className="px-4 py-2">Утас</th>
                <th className="px-4 py-2 text-right">Өр</th>
                <th className="px-4 py-2 text-center">Төлөв</th>
              </tr>
            </thead>
            <tbody>
              {selectedData.residents
                .sort((a, b) => Number(b.debt) - Number(a.debt))
                .map((r, i) => (
                <tr key={i} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm text-gray-400">{i + 1}</td>
                  <td className="px-4 py-2 text-sm font-medium">{r.name}</td>
                  <td className="px-4 py-2 text-sm">{r.apartment}</td>
                  <td className="px-4 py-2 text-sm text-gray-500">{r.phone || '-'}</td>
                  <td className={`px-4 py-2 text-sm text-right font-semibold ${Number(r.debt) > 0 ? 'text-red-500' : 'text-green-500'}`}>
                    {Number(r.debt) > 0 ? `${Number(r.debt).toLocaleString()}₮` : '0₮'}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {Number(r.debt) === 0 ? (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Төлсөн</span>
                    ) : (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Өртэй</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Бүх өртэй айлууд */}
      {!selectedData && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-4 py-3 bg-red-50 border-b">
            <h2 className="font-semibold text-sm text-red-700">⚠️ Бүх өртэй айлууд — Орцоор ({totalDebtors})</h2>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="text-left text-sm text-gray-500">
                <th className="px-4 py-2">Орц</th>
                <th className="px-4 py-2">Нэр</th>
                <th className="px-4 py-2">Тоот</th>
                <th className="px-4 py-2 text-right">Өр</th>
              </tr>
            </thead>
            <tbody>
              {entrances.flatMap(ent =>
                ent.residents
                  .filter(r => Number(r.debt) > 0)
                  .sort((a, b) => Number(b.debt) - Number(a.debt))
                  .map((r, i) => (
                    <tr key={`${ent.entrance}-${i}`} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm">
                        <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded">
                          {ent.entrance}-р орц
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm font-medium">{r.name}</td>
                      <td className="px-4 py-2 text-sm">{r.apartment}</td>
                      <td className="px-4 py-2 text-sm text-right text-red-500 font-semibold">
                        {Number(r.debt).toLocaleString()}₮
                      </td>
                    </tr>
                  ))
              )}
              {totalDebtors === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Өртэй айл байхгүй 🎉</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// apartment текстээс орц таах (жнь: "301" → 3, "1-р орц" → 1, "A-101" → 1)
function parseEntrance(apartment: string): number {
  // "X-р орц" хайх
  const entranceMatch = apartment.match(/(\d+)\s*-?\s*р?\s*орц/i);
  if (entranceMatch) return parseInt(entranceMatch[1]);

  // Тоот дугаараас таах (жнь: "301" → 3-р давхарт 01 тоот → орц 1 гэж таах боломжгүй тул 1 гэнэ)
  // "A-101" → A = 1
  const letterMatch = apartment.match(/^([A-Za-zА-Яа-я])/);
  if (letterMatch) {
    const letter = letterMatch[1].toUpperCase();
    if (letter >= 'A' && letter <= 'Z') return letter.charCodeAt(0) - 64;
    return 1;
  }

  return 1;
}
