'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';

interface Resident {
  name: string;
  apartment: string;
  entrance: number | null;
  debt: number;
}

function parseEntrance(apartment: string): number {
  const m = apartment.match(/(\d+)\s*-?\s*р?\s*орц/i);
  if (m) return parseInt(m[1]);
  const l = apartment.match(/^([A-Za-z])/);
  if (l) return l[1].toUpperCase().charCodeAt(0) - 64;
  return 1;
}

export default function ReportsPage() {
  const params = useParams();
  const router = useRouter();
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntrance, setSelectedEntrance] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase
        .from('residents')
        .select('name,apartment,entrance,debt')
        .eq('sokh_id', params.id)
        .order('entrance')
        .order('apartment');
      setResidents(data || []);
      setLoading(false);
    };
    fetchData();
  }, [params.id]);

  // Орцоор бүлэглэх
  const entranceMap = new Map<number, Resident[]>();
  residents.forEach(r => {
    const ent = r.entrance || parseEntrance(r.apartment);
    if (!entranceMap.has(ent)) entranceMap.set(ent, []);
    entranceMap.get(ent)!.push(r);
  });

  const entrances = Array.from(entranceMap.entries())
    .map(([num, res]) => ({
      num,
      total: res.length,
      debtors: res.filter(r => Number(r.debt) > 0).length,
      totalDebt: res.reduce((s, r) => s + Number(r.debt), 0),
      paidCount: res.filter(r => Number(r.debt) === 0).length,
      residents: res,
    }))
    .sort((a, b) => a.num - b.num);

  const totalDebt = residents.reduce((s, r) => s + Number(r.debt), 0);
  const totalDebtors = residents.filter(r => Number(r.debt) > 0).length;
  const paidRate = residents.length > 0
    ? Math.round(((residents.length - totalDebtors) / residents.length) * 100) : 100;

  const selected = selectedEntrance !== null ? entrances.find(e => e.num === selectedEntrance) : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-blue-600 text-white px-4 py-4">
        <button onClick={() => router.push(`/sokh/${params.id}`)} className="text-white/80 text-sm mb-1">
          ← Буцах
        </button>
        <h1 className="text-lg font-bold">📋 Тайлан — Орцоор</h1>
      </div>

      <div className="px-4 py-4">
        {/* Ерөнхий */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-white rounded-xl p-3 text-center shadow-sm">
            <p className="text-xl font-bold text-blue-600">{residents.length}</p>
            <p className="text-xs text-gray-500">Нийт айл</p>
          </div>
          <div className="bg-white rounded-xl p-3 text-center shadow-sm">
            <p className="text-xl font-bold text-red-500">{totalDebtors}</p>
            <p className="text-xs text-gray-500">Өртэй</p>
          </div>
          <div className="bg-white rounded-xl p-3 text-center shadow-sm">
            <p className="text-xl font-bold text-green-600">{paidRate}%</p>
            <p className="text-xs text-gray-500">Төлсөн</p>
          </div>
        </div>

        {loading ? (
          <p className="text-gray-400 text-center py-8">Ачаалж байна...</p>
        ) : (
          <>
            {/* Орц бүрийн товч */}
            <h2 className="text-sm font-semibold text-gray-500 mb-2">ОРЦ БҮРИЙН БАЙДАЛ</h2>
            <div className="space-y-2 mb-4">
              {entrances.map(ent => {
                const rate = ent.total > 0 ? Math.round((ent.paidCount / ent.total) * 100) : 100;
                const isOpen = selectedEntrance === ent.num;
                return (
                  <div key={ent.num}>
                    <div
                      onClick={() => setSelectedEntrance(isOpen ? null : ent.num)}
                      className={`bg-white rounded-xl p-3 shadow-sm cursor-pointer active:scale-[0.99] transition ${isOpen ? 'ring-2 ring-blue-500' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-lg font-bold text-indigo-700">
                          {ent.num}
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-center">
                            <p className="font-medium text-sm">{ent.num}-р орц</p>
                            <div className="flex items-center gap-2">
                              {ent.debtors > 0 && (
                                <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">
                                  {ent.debtors} өртэй
                                </span>
                              )}
                              <span className="text-xs text-gray-400">{isOpen ? '▲' : '▼'}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 bg-gray-100 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${rate >= 80 ? 'bg-green-500' : rate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                style={{ width: `${rate}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold text-gray-600">{rate}%</span>
                          </div>
                          <div className="flex justify-between mt-1">
                            <span className="text-[10px] text-gray-500">{ent.total} айл</span>
                            {ent.totalDebt > 0 && (
                              <span className="text-[10px] text-red-500">Өр: {ent.totalDebt.toLocaleString()}₮</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Дэлгэрэнгүй */}
                    {isOpen && (
                      <div className="bg-white rounded-b-xl border-t mx-2 p-2 space-y-1">
                        {ent.residents
                          .sort((a, b) => Number(b.debt) - Number(a.debt))
                          .map((r, i) => (
                          <div key={i} className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-gray-50">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${Number(r.debt) > 0 ? 'bg-red-500' : 'bg-green-500'}`} />
                              <span className="text-sm">{r.name}</span>
                              <span className="text-xs text-gray-400">{r.apartment}</span>
                            </div>
                            <span className={`text-xs font-semibold ${Number(r.debt) > 0 ? 'text-red-500' : 'text-green-600'}`}>
                              {Number(r.debt) > 0 ? `${Number(r.debt).toLocaleString()}₮` : '✅'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Нийт өр */}
            {totalDebt > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                <p className="text-xs text-red-600">Нийт өр</p>
                <p className="text-2xl font-bold text-red-600">{totalDebt.toLocaleString()}₮</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
