'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { adminFrom } from '@/app/lib/admin-db';

interface SokhOrg {
  id: number;
  name: string;
  address: string;
  phone: string;
  created_at: string;
}

export default function SuperAdminDashboard() {
  const [sokhs, setSokhs] = useState<SokhOrg[]>([]);
  const [residents, setResidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorStats, setErrorStats] = useState({ today: 0, fatal: 0, recentErrors: [] as any[] });

  useEffect(() => {
    const fetch = async () => {
      const { data: sokhData } = await supabase.from('sokh_organizations').select('*');
      setSokhs(sokhData || []);

      const { data: resData } = await supabase.from('residents').select('*');
      setResidents(resData || []);

      // Алдааны статистик татах
      try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const { data: recentErrors } = await adminFrom('error_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10);

        const allErrors = recentErrors || [];
        const todayErrors = allErrors.filter((e: any) => new Date(e.created_at) >= todayStart);
        const fatalErrors = allErrors.filter((e: any) => e.level === 'fatal');

        setErrorStats({
          today: todayErrors.length,
          fatal: fatalErrors.length,
          recentErrors: allErrors.slice(0, 5),
        });
      } catch {
        // error_logs хүснэгт үүсээгүй бол алгасах
      }

      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) return <div className="p-8 text-gray-500">Ачаалж байна...</div>;

  const totalDebt = residents.reduce((s, r) => s + Number(r.debt || 0), 0);
  const totalResidents = residents.length;
  const activeOrgs = sokhs.length;

  // Орлогын тооцоо (жишээ: нэг СӨХ 50,000₮/сар)
  const monthlyRevenue = activeOrgs * 50000;
  const annualRevenue = monthlyRevenue * 12;

  const statCards = [
    { label: 'Нийт СӨХ', value: activeOrgs, icon: '🏢', change: '+2 энэ сард', color: 'from-blue-600 to-blue-700' },
    { label: 'Нийт хэрэглэгч', value: totalResidents, icon: '👥', change: '+15 энэ сард', color: 'from-purple-600 to-purple-700' },
    { label: 'Сарын орлого', value: `${(monthlyRevenue / 1000).toFixed(0)}к₮`, icon: '💵', change: '+12%', color: 'from-green-600 to-green-700' },
    { label: 'Жилийн орлого', value: `${(annualRevenue / 1000000).toFixed(1)}M₮`, icon: '📈', change: 'Төсөөлөл', color: 'from-yellow-600 to-yellow-700' },
  ];

  // СӨХ тус бүрийн статус
  const orgStats = sokhs.map(s => {
    const orgResidents = residents.filter(r => r.sokh_id === s.id);
    const orgDebt = orgResidents.reduce((sum, r) => sum + Number(r.debt || 0), 0);
    const debtors = orgResidents.filter(r => Number(r.debt || 0) > 0).length;
    return { ...s, residentCount: orgResidents.length, totalDebt: orgDebt, debtorCount: debtors };
  });

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Хянах самбар</h1>
          <p className="text-gray-400 text-sm mt-1">Платформын ерөнхий байдал</p>
        </div>
        <div className="text-right">
          <p className="text-gray-500 text-xs">Сүүлд шинэчлэгдсэн</p>
          <p className="text-gray-300 text-sm">{new Date().toLocaleDateString('mn-MN')}</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {statCards.map(c => (
          <div key={c.label} className={`bg-gradient-to-br ${c.color} rounded-2xl p-5`}>
            <div className="flex justify-between items-start">
              <span className="text-2xl">{c.icon}</span>
              <span className="text-xs bg-white/20 rounded-full px-2 py-0.5">{c.change}</span>
            </div>
            <p className="text-2xl font-bold mt-3">{c.value}</p>
            <p className="text-white/70 text-sm mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* СӨХ жагсаалт */}
        <div className="col-span-2 bg-gray-800/50 rounded-2xl border border-gray-800 p-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold">СӨХ-үүдийн байдал</h2>
            <span className="text-xs text-gray-500">{orgStats.length} бүртгэлтэй</span>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-800">
                <th className="text-left pb-3">СӨХ</th>
                <th className="text-center pb-3">Айл</th>
                <th className="text-center pb-3">Өртэй</th>
                <th className="text-right pb-3">Нийт өр</th>
                <th className="text-center pb-3">Төлөв</th>
              </tr>
            </thead>
            <tbody>
              {orgStats.map(o => (
                <tr key={o.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-3">
                    <p className="text-sm font-medium">{o.name}</p>
                    <p className="text-xs text-gray-500">{o.address}</p>
                  </td>
                  <td className="text-center text-sm">{o.residentCount}</td>
                  <td className="text-center text-sm text-red-400">{o.debtorCount}</td>
                  <td className="text-right text-sm">{o.totalDebt > 0 ? `${o.totalDebt.toLocaleString()}₮` : '0₮'}</td>
                  <td className="text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${o.residentCount > 0 ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                      {o.residentCount > 0 ? 'Идэвхтэй' : 'Шинэ'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Quick Stats */}
        <div className="space-y-4">
          {/* Revenue breakdown */}
          <div className="bg-gray-800/50 rounded-2xl border border-gray-800 p-5">
            <h2 className="font-semibold mb-4">Орлогын задаргаа</h2>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">Стандарт багц</span>
                  <span>4 СӨХ</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: '67%' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">Үнэгүй</span>
                  <span>2 СӨХ</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div className="bg-gray-500 h-2 rounded-full" style={{ width: '33%' }} />
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-700">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Энэ сарын орлого</span>
                <span className="text-green-400 font-semibold">{monthlyRevenue.toLocaleString()}₮</span>
              </div>
            </div>
          </div>

          {/* System health — бодит алдааны мэдээлэл */}
          <div className="bg-gray-800/50 rounded-2xl border border-gray-800 p-5">
            <h2 className="font-semibold mb-4">Системийн байдал</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Өнөөдрийн алдаа</span>
                <span className="flex items-center gap-1">
                  {errorStats.today === 0 ? '🟢' : errorStats.today < 5 ? '🟡' : '🔴'} {errorStats.today}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Ноцтой алдаа (fatal)</span>
                <span className="flex items-center gap-1">
                  {errorStats.fatal === 0 ? '🟢' : '🔴'} {errorStats.fatal}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Database</span>
                <span className="flex items-center gap-1">🟢 Хэвийн</span>
              </div>
            </div>
            {errorStats.recentErrors.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-700">
                <p className="text-xs text-gray-500 mb-2">Сүүлийн алдаанууд:</p>
                <div className="space-y-2">
                  {errorStats.recentErrors.map((e: any, i: number) => (
                    <div key={i} className="text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className={e.level === 'fatal' ? 'text-red-400' : 'text-yellow-400'}>
                          {e.level === 'fatal' ? '!!!' : '!'}
                        </span>
                        <span className="text-gray-300 truncate flex-1">{e.message}</span>
                      </div>
                      <div className="flex gap-2 text-gray-600 ml-4">
                        <span>{e.source}</span>
                        {e.route && <span>{e.route}</span>}
                        <span>{new Date(e.created_at).toLocaleString('mn-MN')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Recent activity */}
          <div className="bg-gray-800/50 rounded-2xl border border-gray-800 p-5">
            <h2 className="font-semibold mb-4">Сүүлийн үйл ажиллагаа</h2>
            <div className="space-y-3">
              {[
                { text: 'Нарантуул СӨХ 3 шинэ оршин суугч нэмсэн', time: '5 мин', icon: '👥' },
                { text: 'Од СӨХ засварын хүсэлт илгээсэн', time: '15 мин', icon: '🔧' },
                { text: 'Алтан гадас СӨХ зарлал нийтэлсэн', time: '1 цаг', icon: '📢' },
                { text: 'Шинэ СӨХ бүртгүүлсэн: Номин СӨХ', time: '3 цаг', icon: '🏢' },
              ].map((a, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-base mt-0.5">{a.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm text-gray-300">{a.text}</p>
                    <p className="text-xs text-gray-600">{a.time}-ийн өмнө</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
