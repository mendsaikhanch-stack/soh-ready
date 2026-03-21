'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';

interface SokhOrg {
  id: number;
  name: string;
  address: string;
  phone: string;
}

const menuItems = [
  { icon: '💰', label: 'Төлбөр', desc: 'Төлбөр төлөх, үлдэгдэл шалгах', href: 'payments', color: 'bg-green-50 border-green-200' },
  { icon: '📋', label: 'Тайлан', desc: 'Санхүүгийн тайлан, зардал', href: 'reports', color: 'bg-blue-50 border-blue-200' },
  { icon: '📢', label: 'Зарлал', desc: 'Мэдэгдэл, мэдээлэл', href: 'announcements', color: 'bg-yellow-50 border-yellow-200' },
  { icon: '🔧', label: 'Засвар', desc: 'Засвар үйлчилгээний хүсэлт', href: 'maintenance', color: 'bg-orange-50 border-orange-200' },
  { icon: '👥', label: 'Оршин суугчид', desc: 'Айл өрхийн жагсаалт', href: 'residents', color: 'bg-purple-50 border-purple-200' },
  { icon: '🗳', label: 'Санал хураалт', desc: 'Хурал, санал асуулга', href: 'voting', color: 'bg-pink-50 border-pink-200' },
  { icon: '📞', label: 'Холбоо барих', desc: 'СӨХ-тэй холбогдох', href: 'contact', color: 'bg-teal-50 border-teal-200' },
];

export default function SokhDashboard() {
  const params = useParams();
  const router = useRouter();
  const [sokh, setSokh] = useState<SokhOrg | null>(null);
  const [stats, setStats] = useState({ residents: 0, totalDebt: 0, announcements: 0 });
  const [notifCount, setNotifCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase
        .from('sokh_organizations')
        .select('*')
        .eq('id', params.id)
        .single();

      if (data) setSokh(data);

      const { count: resCount } = await supabase
        .from('residents')
        .select('*', { count: 'exact', head: true })
        .eq('sokh_id', params.id);

      const { data: debtData } = await supabase
        .from('residents')
        .select('debt')
        .eq('sokh_id', params.id)
        .gt('debt', 0);

      const totalDebt = debtData?.reduce((sum, r) => sum + Number(r.debt), 0) || 0;

      const { count: annCount } = await supabase
        .from('announcements')
        .select('*', { count: 'exact', head: true })
        .eq('sokh_id', params.id);

      setStats({
        residents: resCount || 0,
        totalDebt,
        announcements: annCount || 0,
      });

      // Мэдэгдлийн тоо
      let nc = 0;
      if (totalDebt > 0) nc++; // Өрийн мэдэгдэл
      if (debtData && debtData.some(r => Number(r.debt) >= 200000)) nc++; // Их өр

      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const { count: newAnn } = await supabase
        .from('announcements')
        .select('*', { count: 'exact', head: true })
        .eq('sokh_id', params.id)
        .gte('created_at', weekAgo);
      nc += newAnn || 0;

      const day = new Date().getDate();
      if (day <= 3 || (day >= 20 && day <= 25)) nc++;

      setNotifCount(nc);
      setLoading(false);
    };
    fetchData();
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Ачаалж байна...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-blue-600 text-white px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <button onClick={() => router.push('/')} className="text-white/80 text-sm mb-1">
              ← Буцах
            </button>
            <h1 className="text-lg font-bold">{sokh?.name}</h1>
            <p className="text-sm text-white/70">{sokh?.address}</p>
          </div>
          {/* Мэдэгдлийн хонх */}
          <button
            onClick={() => router.push(`/sokh/${params.id}/notifications`)}
            className="relative p-2"
          >
            <span className="text-2xl">🔔</span>
            {notifCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {notifCount > 9 ? '9+' : notifCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Өрийн сануулга banner */}
      {stats.totalDebt > 0 && (
        <div
          className="mx-4 mt-3 bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-3 active:scale-[0.98] transition cursor-pointer"
          onClick={() => router.push(`/sokh/${params.id}/payments`)}
        >
          <span className="text-2xl">💰</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-700">Төлбөрийн үлдэгдэл</p>
            <p className="text-xs text-red-600">
              Нийт {stats.totalDebt.toLocaleString()}₮ төлөгдөөгүй байна
            </p>
          </div>
          <span className="text-red-300">›</span>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2 px-4 mt-3">
        <div className="bg-white rounded-xl shadow-sm p-3 text-center">
          <p className="text-xl font-bold">{stats.residents}</p>
          <p className="text-xs text-gray-500">Айл өрх</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-3 text-center">
          <p className="text-xl font-bold text-red-500">{stats.totalDebt > 0 ? `${(stats.totalDebt / 1000).toFixed(0)}к` : '0'}</p>
          <p className="text-xs text-gray-500">Нийт өр ₮</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-3 text-center">
          <p className="text-xl font-bold text-blue-500">{stats.announcements}</p>
          <p className="text-xs text-gray-500">Зарлал</p>
        </div>
      </div>

      {/* Menu */}
      <div className="px-4 py-4">
        <h2 className="text-sm font-semibold text-gray-500 mb-3">ҮЙЛЧИЛГЭЭ</h2>
        <div className="space-y-2">
          {/* Мэдэгдэл цэс */}
          <button
            onClick={() => router.push(`/sokh/${params.id}/notifications`)}
            className="w-full flex items-center gap-3 p-4 rounded-xl border bg-red-50 border-red-200 text-left active:scale-[0.98] transition"
          >
            <span className="text-2xl">🔔</span>
            <div className="flex-1">
              <p className="font-medium text-sm">Мэдэгдэл</p>
              <p className="text-xs text-gray-500">Сануулга, шинэ мэдээ</p>
            </div>
            {notifCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {notifCount}
              </span>
            )}
            <span className="text-gray-300">›</span>
          </button>

          {menuItems.map((item) => (
            <button
              key={item.href}
              onClick={() => router.push(`/sokh/${params.id}/${item.href}`)}
              className={`w-full flex items-center gap-3 p-4 rounded-xl border ${item.color} text-left active:scale-[0.98] transition`}
            >
              <span className="text-2xl">{item.icon}</span>
              <div>
                <p className="font-medium text-sm">{item.label}</p>
                <p className="text-xs text-gray-500">{item.desc}</p>
              </div>
              <span className="ml-auto text-gray-300">›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
