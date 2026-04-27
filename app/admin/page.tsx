'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { getAdminSokhId } from '@/app/lib/admin-config';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    residents: 0,
    debtResidents: 0,
    totalDebt: 0,
    totalPaid: 0,
    announcements: 0,
    pendingMaintenance: 0,
    pendingComplaints: 0,
    activePolls: 0,
    unreadMessages: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const sokhId = await getAdminSokhId();

      const [resCountRes, resDataRes, payDataRes, annCountRes, maintCountRes, complaintCountRes, pollCountRes, msgCountRes] = await Promise.all([
        supabase.from('residents').select('*', { count: 'exact', head: true }).eq('sokh_id', sokhId),
        supabase.from('residents').select('debt').eq('sokh_id', sokhId),
        supabase.from('payments').select('amount, residents!inner(sokh_id)').eq('residents.sokh_id', sokhId),
        supabase.from('announcements').select('*', { count: 'exact', head: true }).eq('sokh_id', sokhId),
        supabase.from('maintenance_requests').select('*', { count: 'exact', head: true }).eq('sokh_id', sokhId).eq('status', 'pending'),
        supabase.from('complaints').select('*', { count: 'exact', head: true }).eq('sokh_id', sokhId).eq('status', 'pending'),
        supabase.from('polls').select('*', { count: 'exact', head: true }).eq('sokh_id', sokhId).eq('status', 'active'),
        supabase.from('messages').select('*', { count: 'exact', head: true }).eq('sokh_id', sokhId),
      ]);

      const resData = resDataRes.data;
      const debtResidents = resData?.filter(r => Number(r.debt) > 0).length || 0;
      const totalDebt = resData?.reduce((sum, r) => sum + Number(r.debt), 0) || 0;
      const totalPaid = payDataRes.data?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      setStats({
        residents: resCountRes.count || 0,
        debtResidents,
        totalDebt,
        totalPaid,
        announcements: annCountRes.count || 0,
        pendingMaintenance: maintCountRes.count || 0,
        pendingComplaints: complaintCountRes.count || 0,
        activePolls: pollCountRes.count || 0,
        unreadMessages: msgCountRes.count || 0,
      });
      setLoading(false);
    };
    fetchStats();
  }, []);

  if (loading) return <div className="p-8 text-gray-400">Ачаалж байна...</div>;

  const cards = [
    { label: 'Нийт айл өрх', value: stats.residents, icon: '👥', color: 'bg-blue-50 border-blue-200 text-blue-700' },
    { label: 'Өртэй айл', value: stats.debtResidents, icon: '⚠️', color: 'bg-red-50 border-red-200 text-red-700' },
    { label: 'Нийт өр', value: `${stats.totalDebt.toLocaleString()}₮`, icon: '💸', color: 'bg-red-50 border-red-200 text-red-700' },
    { label: 'Нийт төлбөр цуглуулсан', value: `${stats.totalPaid.toLocaleString()}₮`, icon: '💰', color: 'bg-green-50 border-green-200 text-green-700' },
    { label: 'Зарлал', value: stats.announcements, icon: '📢', color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
    { label: 'Хүлээгдэж буй засвар', value: stats.pendingMaintenance, icon: '🔧', color: 'bg-orange-50 border-orange-200 text-orange-700' },
    { label: 'Шинэ гомдол/санал', value: stats.pendingComplaints, icon: '📝', color: 'bg-violet-50 border-violet-200 text-violet-700' },
    { label: 'Идэвхтэй санал хураалт', value: stats.activePolls, icon: '🗳', color: 'bg-pink-50 border-pink-200 text-pink-700' },
    { label: 'Мессеж', value: stats.unreadMessages, icon: '💬', color: 'bg-teal-50 border-teal-200 text-teal-700' },
  ];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">📊 Хянах самбар</h1>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {cards.map((c) => (
          <div key={c.label} className={`rounded-xl border p-4 ${c.color}`}>
            <div className="flex items-center justify-between">
              <span className="text-2xl">{c.icon}</span>
              <span className="text-2xl font-bold">{c.value}</span>
            </div>
            <p className="text-sm mt-2 opacity-80">{c.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
