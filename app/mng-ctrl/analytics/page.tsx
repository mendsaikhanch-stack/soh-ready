'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';

interface Stats {
  totalResidents: number;
  totalOrgs: number;
  totalDebt: number;
  totalPaid: number;
  totalAnnouncements: number;
  totalMaintenance: number;
  totalComplaints: number;
  totalPolls: number;
}

interface FeatureUsage {
  name: string;
  table: string;
  count: number;
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [featureUsage, setFeatureUsage] = useState<FeatureUsage[]>([]);
  const [monthlyPayments, setMonthlyPayments] = useState<{ month: string; count: number; total: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    const [
      { count: resCount },
      { count: orgCount },
      { data: residents },
      { data: payments },
      { count: annCount },
      { count: maintCount },
      { count: compCount },
      { count: pollCount },
      { count: chatCount },
      { count: bookingCount },
      { count: marketCount },
      { count: cctvCount },
      { count: emergCount },
    ] = await Promise.all([
      supabase.from('residents').select('*', { count: 'exact', head: true }),
      supabase.from('sokh_organizations').select('*', { count: 'exact', head: true }),
      supabase.from('residents').select('debt'),
      supabase.from('payments').select('amount, created_at').order('created_at', { ascending: false }).limit(500),
      supabase.from('announcements').select('*', { count: 'exact', head: true }),
      supabase.from('maintenance_requests').select('*', { count: 'exact', head: true }),
      supabase.from('complaints').select('*', { count: 'exact', head: true }),
      supabase.from('polls').select('*', { count: 'exact', head: true }),
      supabase.from('chat_messages').select('*', { count: 'exact', head: true }),
      supabase.from('space_bookings').select('*', { count: 'exact', head: true }),
      supabase.from('marketplace_listings').select('*', { count: 'exact', head: true }),
      supabase.from('cctv_requests').select('*', { count: 'exact', head: true }),
      supabase.from('emergency_alerts').select('*', { count: 'exact', head: true }),
    ]);

    const totalDebt = (residents || []).reduce((s, r) => s + Number(r.debt || 0), 0);
    const totalPaid = (payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);

    setStats({
      totalResidents: resCount || 0,
      totalOrgs: orgCount || 0,
      totalDebt,
      totalPaid,
      totalAnnouncements: annCount || 0,
      totalMaintenance: maintCount || 0,
      totalComplaints: compCount || 0,
      totalPolls: pollCount || 0,
    });

    // Feature usage
    const features: FeatureUsage[] = [
      { name: 'Төлбөр', table: 'payments', count: (payments || []).length },
      { name: 'Зарлал', table: 'announcements', count: annCount || 0 },
      { name: 'Засвар хүсэлт', table: 'maintenance', count: maintCount || 0 },
      { name: 'Гомдол/Санал', table: 'complaints', count: compCount || 0 },
      { name: 'Чат', table: 'chat', count: chatCount || 0 },
      { name: 'Санал хураалт', table: 'polls', count: pollCount || 0 },
      { name: 'Зай захиалга', table: 'booking', count: bookingCount || 0 },
      { name: 'Маркет', table: 'marketplace', count: marketCount || 0 },
      { name: 'Камер хүсэлт', table: 'cctv', count: cctvCount || 0 },
      { name: 'Яаралтай', table: 'emergency', count: emergCount || 0 },
    ].sort((a, b) => b.count - a.count);
    setFeatureUsage(features);

    // Monthly payment breakdown
    const monthMap = new Map<string, { count: number; total: number }>();
    const monthNames = ['1-р сар','2-р сар','3-р сар','4-р сар','5-р сар','6-р сар','7-р сар','8-р сар','9-р сар','10-р сар','11-р сар','12-р сар'];
    (payments || []).forEach(p => {
      const d = new Date(p.created_at);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const label = `${monthNames[d.getMonth()]}`;
      const existing = monthMap.get(key) || { count: 0, total: 0 };
      monthMap.set(key, { count: existing.count + 1, total: existing.total + Number(p.amount || 0) });
    });
    const monthly = Array.from(monthMap.entries())
      .map(([key, val]) => {
        const [year, month] = key.split('-');
        return { month: monthNames[Number(month)], count: val.count, total: val.total };
      })
      .slice(0, 6);
    setMonthlyPayments(monthly);

    setLoading(false);
  };

  const maxFeature = featureUsage.length > 0 ? featureUsage[0].count : 1;
  const maxPayment = monthlyPayments.length > 0 ? Math.max(...monthlyPayments.map(m => m.total)) : 1;

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <p className="text-gray-400">Аналитик ачаалж байна...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-2">📈 Аналитик</h1>
      <p className="text-gray-400 text-sm mb-6">Бодит хэрэглээний статистик</p>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Нийт оршин суугч', value: stats?.totalResidents.toLocaleString() || '0' },
          { label: 'Нийт СӨХ', value: stats?.totalOrgs.toLocaleString() || '0' },
          { label: 'Нийт өр', value: `${(stats?.totalDebt || 0).toLocaleString()}₮` },
          { label: 'Нийт төлөгдсөн', value: `${(stats?.totalPaid || 0).toLocaleString()}₮` },
        ].map(s => (
          <div key={s.label} className="bg-gray-800/50 border border-gray-800 rounded-2xl p-4">
            <p className="text-gray-400 text-xs">{s.label}</p>
            <p className="text-xl font-bold mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Monthly payments chart */}
        <div className="bg-gray-800/50 border border-gray-800 rounded-2xl p-5">
          <h2 className="font-semibold mb-4">Сарын төлбөрүүд</h2>
          {monthlyPayments.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">Төлбөрийн мэдээлэл байхгүй</p>
          ) : (
            <div className="flex items-end gap-2 h-40">
              {monthlyPayments.map(d => (
                <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col gap-0.5" style={{ height: '120px' }}>
                    <div className="flex-1" />
                    <div
                      className="bg-blue-500/80 rounded-t"
                      style={{ height: `${(d.total / maxPayment) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500">{d.month.replace('-р сар', '')}</span>
                  <span className="text-[10px] text-gray-600">{d.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Feature usage */}
        <div className="bg-gray-800/50 border border-gray-800 rounded-2xl p-5">
          <h2 className="font-semibold mb-4">Функцийн хэрэглээ</h2>
          <div className="space-y-3">
            {featureUsage.slice(0, 8).map(f => (
              <div key={f.name}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-300">{f.name}</span>
                  <span className="text-gray-500">{f.count}</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${maxFeature > 0 ? (f.count / maxFeature) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
