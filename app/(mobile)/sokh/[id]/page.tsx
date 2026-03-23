'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';
import { useAuth } from '@/app/lib/auth-context';
import { isPushSupported, requestPermission, subscribeToPush } from '@/app/lib/push';
import { getTheme } from '@/app/lib/themes';
import Image from 'next/image';

interface SokhOrg {
  id: number;
  name: string;
  address: string;
  phone: string;
  logo_url: string | null;
  theme: string | null;
}

const menuItems = [
  { icon: '💰', label: 'Төлбөр', desc: 'Төлбөр төлөх, үлдэгдэл шалгах', href: 'payments', color: 'bg-green-50 border-green-200' },
  { icon: '📋', label: 'Тайлан', desc: 'Санхүүгийн тайлан, зардал', href: 'reports', color: 'bg-blue-50 border-blue-200' },
  { icon: '📢', label: 'Зарлал', desc: 'Мэдэгдэл, мэдээлэл', href: 'announcements', color: 'bg-yellow-50 border-yellow-200' },
  { icon: '🔧', label: 'Засвар', desc: 'Засвар үйлчилгээний хүсэлт', href: 'maintenance', color: 'bg-orange-50 border-orange-200' },
  { icon: '👥', label: 'Оршин суугчид', desc: 'Айл өрхийн жагсаалт', href: 'residents', color: 'bg-purple-50 border-purple-200' },
  { icon: '🚗', label: 'Зогсоол', desc: 'Машин бүртгэл, зогсоолын мэдээлэл', href: 'parking', color: 'bg-indigo-50 border-indigo-200' },
  { icon: '🎬', label: 'Камер бичлэг', desc: 'Бичлэг шүүх хүсэлт илгээх', href: 'cctv-request', color: 'bg-gray-50 border-gray-300' },
  { icon: '📊', label: 'Ашиглалт', desc: 'Цахилгаан, ус, дулааны хэрэглээ', href: 'utilities', color: 'bg-emerald-50 border-emerald-200' },
  { icon: '💬', label: 'Хөрш чат', desc: 'Оршин суугчидтай ярилцах', href: 'chat', color: 'bg-sky-50 border-sky-200' },
  { icon: '👷', label: 'Ажилчид', desc: 'Ажилтнуудын мэдээлэл, хуваарь', href: 'staff', color: 'bg-amber-50 border-amber-200' },
  { icon: '🚨', label: 'Яаралтай', desc: 'Онцгой байдлын мэдэгдэл', href: 'emergency', color: 'bg-red-50 border-red-200' },
  { icon: '📝', label: 'Гомдол / Санал', desc: 'Гомдол, санал, асуулт илгээх', href: 'complaints', color: 'bg-violet-50 border-violet-200' },
  { icon: '🏪', label: 'Хөрш маркет', desc: 'Зар, худалдаа, солилцоо', href: 'marketplace', color: 'bg-teal-50 border-teal-200' },
  { icon: '🏢', label: 'Зай захиалга', desc: 'Хурлын өрөө, спорт заал', href: 'booking', color: 'bg-indigo-50 border-indigo-200' },
  { icon: '💰', label: 'Санхүү', desc: 'Төлбөр хаашаа зарцуулагдаж байна', href: 'finance', color: 'bg-cyan-50 border-cyan-200' },
  { icon: '🏆', label: 'Оноо & Шагнал', desc: 'Идэвхтэй оршин суугчийн урамшуулал', href: 'points', color: 'bg-amber-50 border-amber-200' },
  { icon: '📦', label: 'Илгээмж', desc: 'Ачаа, бандероль хүлээн авах', href: 'packages', color: 'bg-orange-50 border-orange-200' },
  { icon: '🏪', label: 'Дэлгүүр', desc: 'Хотхоны дэлгүүр, үйлчилгээ', href: 'shops', color: 'bg-rose-50 border-rose-200' },
  { icon: '🗳', label: 'Санал хураалт', desc: 'Хурал, санал асуулга', href: 'voting', color: 'bg-pink-50 border-pink-200' },
  { icon: '📞', label: 'Холбоо барих', desc: 'СӨХ-тэй холбогдох', href: 'contact', color: 'bg-teal-50 border-teal-200' },
];

export default function SokhDashboard() {
  const params = useParams();
  const router = useRouter();
  const { profile, signOut } = useAuth();
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

    // Push notification бүртгэх
    if (isPushSupported()) {
      requestPermission().then(perm => {
        if (perm === 'granted') {
          subscribeToPush(Number(params.id));
        }
      });
    }
  }, [params.id]);

  const theme = getTheme(sokh?.theme || 'classic');

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
      <div className={`${theme.header} ${theme.headerText} px-4 py-4`}>
        {/* Хэрэглэгчийн мэдээлэл */}
        {profile && (
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/20">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-sm font-bold">
                {profile.name.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-medium">{profile.name}</p>
                <p className="text-xs text-white/60">{profile.apartment}</p>
              </div>
            </div>
            <button
              onClick={async () => { await signOut(); router.replace('/login'); }}
              className="text-xs text-white/70 hover:text-white px-2 py-1 rounded-lg hover:bg-white/10"
            >
              Гарах
            </button>
          </div>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {sokh?.logo_url ? (
              <Image
                src={sokh.logo_url}
                alt={sokh.name}
                width={40}
                height={40}
                className="w-10 h-10 rounded-xl object-contain bg-white/20"
              />
            ) : (
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-lg font-bold">
                {sokh?.name?.charAt(0)}
              </div>
            )}
            <div>
              <h1 className="text-lg font-bold">{sokh?.name}</h1>
              <p className="text-sm text-white/70">{sokh?.address}</p>
            </div>
          </div>
          {/* Мэдэгдлийн хонх */}
          <button
            onClick={() => router.push(`/sokh/${params.id}/notifications`)}
            className="relative p-2"
          >
            <span className="text-2xl">🔔</span>
            {notifCount > 0 && (
              <span className={`absolute -top-0.5 -right-0.5 ${theme.badge} text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center`}>
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
            className={`w-full flex items-center gap-3 p-4 rounded-xl border ${theme.cardBg} ${theme.cardBorder} text-left active:scale-[0.98] transition`}
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
