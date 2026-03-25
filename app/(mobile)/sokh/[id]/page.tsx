'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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

const menuCategories = [
  {
    title: '💵 Санхүү',
    items: [
      { icon: '💰', label: 'Төлбөр', desc: 'Төлбөр төлөх, үлдэгдэл шалгах', href: 'payments', color: 'bg-green-50 border-green-200' },
      { icon: '📋', label: 'Тайлан', desc: 'Санхүүгийн тайлан, зардал', href: 'reports', color: 'bg-blue-50 border-blue-200' },
      { icon: '💰', label: 'Санхүү', desc: 'Төлбөр хаашаа зарцуулагдаж байна', href: 'finance', color: 'bg-cyan-50 border-cyan-200' },
      { icon: '📊', label: 'Тоолуур & Ашиглалт', desc: 'Заалт оруулах, хэрэглээ харах', href: 'utilities', color: 'bg-emerald-50 border-emerald-200' },
    ],
  },
  {
    title: '🏠 Амьдрал',
    items: [
      { icon: '📢', label: 'Зарлал', desc: 'Мэдэгдэл, мэдээлэл', href: 'announcements', color: 'bg-yellow-50 border-yellow-200' },
      { icon: '💬', label: 'Хөрш чат', desc: 'Оршин суугчидтай ярилцах', href: 'chat', color: 'bg-sky-50 border-sky-200' },
      { icon: '🗳', label: 'Санал хураалт', desc: 'Хурал, санал асуулга', href: 'voting', color: 'bg-pink-50 border-pink-200' },
      { icon: '🏪', label: 'Хөрш маркет', desc: 'Зар, худалдаа, солилцоо', href: 'marketplace', color: 'bg-teal-50 border-teal-200' },
      { icon: '📝', label: 'Гомдол / Санал', desc: 'Гомдол, санал, асуулт илгээх', href: 'complaints', color: 'bg-violet-50 border-violet-200' },
    ],
  },
  {
    title: '🔧 Үйлчилгээ',
    items: [
      { icon: '🔧', label: 'Засвар', desc: 'Засвар үйлчилгээний хүсэлт', href: 'maintenance', color: 'bg-orange-50 border-orange-200' },
      { icon: '🚗', label: 'Зогсоол', desc: 'Машин бүртгэл, зогсоолын мэдээлэл', href: 'parking', color: 'bg-indigo-50 border-indigo-200' },
      { icon: '🎬', label: 'Камер бичлэг', desc: 'Бичлэг шүүх хүсэлт илгээх', href: 'cctv-request', color: 'bg-gray-50 border-gray-300' },
      { icon: '🏢', label: 'Зай захиалга', desc: 'Хурлын өрөө, спорт заал', href: 'booking', color: 'bg-indigo-50 border-indigo-200' },
      { icon: '📦', label: 'Илгээмж', desc: 'Ачаа, бандероль хүлээн авах', href: 'packages', color: 'bg-orange-50 border-orange-200' },
    ],
  },
  {
    title: '📌 Бусад',
    items: [
      { icon: '👥', label: 'Оршин суугчид', desc: 'Айл өрхийн жагсаалт', href: 'residents', color: 'bg-purple-50 border-purple-200' },
      { icon: '👷', label: 'Ажилчид', desc: 'Ажилтнуудын мэдээлэл, хуваарь', href: 'staff', color: 'bg-amber-50 border-amber-200' },
      { icon: '🚨', label: 'Яаралтай', desc: 'Онцгой байдлын мэдэгдэл', href: 'emergency', color: 'bg-red-50 border-red-200' },
      { icon: '🏆', label: 'Оноо & Шагнал', desc: 'Идэвхтэй оршин суугчийн урамшуулал', href: 'points', color: 'bg-amber-50 border-amber-200' },
      { icon: '🏪', label: 'Дэлгүүр', desc: 'Хотхоны дэлгүүр, үйлчилгээ', href: 'shops', color: 'bg-rose-50 border-rose-200' },
      { icon: '📞', label: 'Холбоо барих', desc: 'СӨХ-тэй холбогдох', href: 'contact', color: 'bg-teal-50 border-teal-200' },
    ],
  },
];

export default function SokhDashboard() {
  const params = useParams();
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const [sokh, setSokh] = useState<SokhOrg | null>(null);
  const [stats, setStats] = useState({ residents: 0, totalDebt: 0, announcements: 0 });
  const [notifCount, setNotifCount] = useState(0);
  const [recentAnnouncements, setRecentAnnouncements] = useState<{ id: number; title: string; type: string; created_at: string }[]>([]);
  const [myDebt, setMyDebt] = useState(0);
  const [myRequests, setMyRequests] = useState<{ id: number; title: string; status: string; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Pull-to-refresh
  const touchStartY = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = async (e: React.TouchEvent) => {
    const delta = e.changedTouches[0].clientY - touchStartY.current;
    const el = scrollRef.current;
    if (delta > 80 && el && el.scrollTop <= 0 && !refreshing) {
      setRefreshing(true);
      await fetchData(false);
      setRefreshing(false);
    }
  };

  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
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

      // Сүүлийн 3 зарлал
      const { data: recentAnns } = await supabase
        .from('announcements')
        .select('id, title, type, created_at')
        .eq('sokh_id', params.id)
        .order('created_at', { ascending: false })
        .limit(3);
      setRecentAnnouncements(recentAnns || []);

      // Миний хувийн өр
      if (profile) {
        setMyDebt(Number(profile.debt) || 0);
      }

      // Миний засвар хүсэлтүүд
      const { data: reqData } = await supabase
        .from('maintenance_requests')
        .select('id, title, status, created_at')
        .eq('sokh_id', params.id)
        .order('created_at', { ascending: false })
        .limit(3);
      setMyRequests(reqData || []);

      setLoading(false);
    }, [params.id, profile]);

  useEffect(() => {
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
      <div className="min-h-screen bg-gray-50 animate-pulse">
        {/* Header skeleton */}
        <div className="bg-gray-200 px-4 py-4">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-300/30">
            <div className="w-8 h-8 bg-gray-300 rounded-full" />
            <div className="space-y-1">
              <div className="h-3 w-20 bg-gray-300 rounded" />
              <div className="h-2 w-14 bg-gray-300 rounded" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-300 rounded-xl" />
            <div className="space-y-1">
              <div className="h-4 w-32 bg-gray-300 rounded" />
              <div className="h-3 w-24 bg-gray-300 rounded" />
            </div>
          </div>
        </div>
        {/* Quick actions skeleton */}
        <div className="flex gap-2 px-4 mt-3">
          {[1,2,3,4].map(i => (
            <div key={i} className="flex-shrink-0 w-20 h-16 bg-white rounded-xl shadow-sm" />
          ))}
        </div>
        {/* Stats skeleton */}
        <div className="grid grid-cols-3 gap-2 px-4 mt-3">
          {[1,2,3].map(i => (
            <div key={i} className="bg-white rounded-xl shadow-sm p-3 h-16" />
          ))}
        </div>
        {/* Menu skeleton */}
        <div className="px-4 mt-4 space-y-2">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-16 bg-white rounded-xl shadow-sm" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="min-h-screen bg-gray-50 overflow-y-auto"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      {refreshing && (
        <div className="flex items-center justify-center py-3 bg-blue-50 text-blue-600 text-xs font-medium">
          <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          Шинэчилж байна...
        </div>
      )}
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

      {/* Хайлт */}
      <div className="px-4 mt-3">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Үйлчилгээ хайх..."
            className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
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

      {/* Quick Actions */}
      <div className="flex gap-2 px-4 mt-3 overflow-x-auto scrollbar-hide">
        {[
          { icon: '💳', label: 'Төлбөр төлөх', href: 'payments' },
          { icon: '🔧', label: 'Засвар хүсэлт', href: 'maintenance' },
          { icon: '📊', label: 'Тоолуур', href: 'utilities' },
          { icon: '🚨', label: 'Яаралтай', href: 'emergency' },
        ].map(a => (
          <button
            key={a.href}
            onClick={() => router.push(`/sokh/${params.id}/${a.href}`)}
            className="flex-shrink-0 flex flex-col items-center gap-1 bg-white rounded-xl shadow-sm px-4 py-3 active:scale-95 transition"
          >
            <span className="text-xl">{a.icon}</span>
            <span className="text-[11px] font-medium text-gray-600 whitespace-nowrap">{a.label}</span>
          </button>
        ))}
      </div>

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

      {/* Миний өр */}
      {profile && myDebt > 0 && (
        <div
          className="mx-4 mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3 active:scale-[0.98] transition cursor-pointer"
          onClick={() => router.push(`/sokh/${params.id}/payments`)}
        >
          <span className="text-2xl">💳</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-700">Миний өр</p>
            <p className="text-xs text-amber-600">{myDebt.toLocaleString()}₮ төлөгдөөгүй</p>
          </div>
          <span className="text-amber-300">›</span>
        </div>
      )}

      {/* Сүүлийн зарлалууд */}
      {recentAnnouncements.length > 0 && (
        <div className="px-4 mt-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-500">СҮҮЛИЙН ЗАРЛАЛ</h2>
            <button
              onClick={() => router.push(`/sokh/${params.id}/announcements`)}
              className="text-xs text-blue-500"
            >
              Бүгдийг харах
            </button>
          </div>
          <div className="space-y-2">
            {recentAnnouncements.map(a => (
              <div
                key={a.id}
                onClick={() => router.push(`/sokh/${params.id}/announcements`)}
                className="bg-white rounded-xl p-3 shadow-sm flex items-center gap-3 active:scale-[0.98] transition cursor-pointer"
              >
                <span className="text-lg">
                  {a.type === 'urgent' ? '🚨' : a.type === 'warning' ? '⚠️' : a.type === 'event' ? '📅' : '📢'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.title}</p>
                  <p className="text-xs text-gray-400">{new Date(a.created_at).toLocaleDateString('mn-MN')}</p>
                </div>
                <span className="text-gray-300">›</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Сүүлийн засвар хүсэлтүүд */}
      {myRequests.length > 0 && (
        <div className="px-4 mt-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-500">ЗАСВАР ХҮСЭЛТ</h2>
            <button
              onClick={() => router.push(`/sokh/${params.id}/maintenance`)}
              className="text-xs text-blue-500"
            >
              Бүгдийг харах
            </button>
          </div>
          <div className="space-y-2">
            {myRequests.map(r => (
              <div
                key={r.id}
                onClick={() => router.push(`/sokh/${params.id}/maintenance`)}
                className="bg-white rounded-xl p-3 shadow-sm flex items-center gap-3 active:scale-[0.98] transition cursor-pointer"
              >
                <span className="text-lg">
                  {r.status === 'done' ? '✅' : r.status === 'in_progress' ? '🔨' : '🕐'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.title}</p>
                  <p className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString('mn-MN')}</p>
                </div>
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                  r.status === 'done' ? 'bg-green-100 text-green-700' :
                  r.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {r.status === 'done' ? 'Дууссан' : r.status === 'in_progress' ? 'Хийгдэж байна' : 'Хүлээгдэж байна'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Menu */}
      <div className="px-4 py-4 space-y-4">
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

        {menuCategories.map((cat) => {
          const q = searchQuery.toLowerCase();
          const filteredItems = q
            ? cat.items.filter(item => item.label.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q))
            : cat.items;
          if (filteredItems.length === 0) return null;
          return (
            <div key={cat.title}>
              <h2 className="text-sm font-semibold text-gray-500 mb-2">{cat.title}</h2>
              <div className="space-y-2">
                {filteredItems.map((item) => (
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
          );
        })}
      </div>
    </div>
  );
}
