'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';

interface Notification {
  id: string;
  type: 'debt' | 'announcement' | 'reminder' | 'info';
  title: string;
  message: string;
  date: string;
  read: boolean;
  icon: string;
  color: string;
  action?: string;
}

export default function NotificationsPage() {
  const params = useParams();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    generateNotifications();
  }, [params.id]);

  const generateNotifications = async () => {
    const notifs: Notification[] = [];
    const now = new Date();
    const sokhId = params.id;

    // 1. Өртэй оршин суугчдын сануулга
    const { data: residents } = await supabase
      .from('residents')
      .select('*')
      .eq('sokh_id', sokhId);

    if (residents) {
      const debtResidents = residents.filter(r => r.debt > 0);
      const totalDebt = debtResidents.reduce((s, r) => s + Number(r.debt), 0);

      if (totalDebt > 0) {
        // Нийт өрийн мэдэгдэл
        notifs.push({
          id: 'debt-summary',
          type: 'debt',
          title: 'Төлбөрийн үлдэгдэл',
          message: `Нийт ${debtResidents.length} тоот ${totalDebt.toLocaleString()}₮ өртэй байна. Хугацаандаа төлөөрэй.`,
          date: now.toISOString(),
          read: false,
          icon: '💰',
          color: 'bg-red-50 border-red-200',
          action: 'payments',
        });

        // Их өртэй тоотуудын сануулга
        const highDebt = debtResidents
          .sort((a, b) => b.debt - a.debt)
          .slice(0, 5);

        highDebt.forEach(r => {
          if (r.debt >= 200000) {
            notifs.push({
              id: `debt-${r.id}`,
              type: 'reminder',
              title: `${r.apartment || r.name} - өр хэтэрсэн`,
              message: `${r.debt.toLocaleString()}₮ өртэй. Нэн даруй төлөхийг анхааруулж байна.`,
              date: now.toISOString(),
              read: false,
              icon: '🚨',
              color: 'bg-red-50 border-red-300',
            });
          }
        });

        // Сарын сануулга (сар бүрийн 1, 10, 20-нд)
        const day = now.getDate();
        if (day <= 3) {
          notifs.push({
            id: 'monthly-reminder',
            type: 'reminder',
            title: 'Сарын төлбөрийн сануулга',
            message: `${now.getFullYear()} оны ${now.getMonth() + 1}-р сарын төлбөрөө төлнө үү. Хугацаа: Сар бүрийн 25-ны дотор.`,
            date: now.toISOString(),
            read: false,
            icon: '📅',
            color: 'bg-yellow-50 border-yellow-200',
            action: 'payments',
          });
        } else if (day >= 20 && day <= 25) {
          notifs.push({
            id: 'deadline-warning',
            type: 'reminder',
            title: 'Төлбөрийн хугацаа дуусах гэж байна',
            message: `Энэ сарын төлбөрөө 25-ны дотор төлнө үү. Хугацаа хэтрэхээс өмнө төлөөрэй!`,
            date: now.toISOString(),
            read: false,
            icon: '⏰',
            color: 'bg-orange-50 border-orange-200',
            action: 'payments',
          });
        }
      }
    }

    // 2. Шинэ зарлалууд
    const { data: announcements } = await supabase
      .from('announcements')
      .select('*')
      .eq('sokh_id', sokhId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (announcements) {
      const readIds = getReadAnnouncements();

      announcements.forEach(a => {
        const isNew = !readIds.includes(a.id);
        const daysDiff = Math.floor((now.getTime() - new Date(a.created_at).getTime()) / 86400000);

        notifs.push({
          id: `ann-${a.id}`,
          type: 'announcement',
          title: a.title,
          message: a.content.length > 100 ? a.content.slice(0, 100) + '...' : a.content,
          date: a.created_at,
          read: !isNew,
          icon: a.type === 'urgent' ? '🚨' : a.type === 'warning' ? '⚠️' : a.type === 'event' ? '📅' : '📢',
          color: isNew
            ? (a.type === 'urgent' ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200')
            : 'bg-gray-50 border-gray-200',
          action: 'announcements',
        });
      });
    }

    // 3. Системийн мэдэгдлүүд
    notifs.push({
      id: 'welcome',
      type: 'info',
      title: 'СӨХ Систем-д тавтай морил',
      message: 'Та төлбөр, зарлал, засварын мэдээллээ энд хянах боломжтой.',
      date: new Date(now.getTime() - 86400000 * 7).toISOString(),
      read: true,
      icon: '👋',
      color: 'bg-gray-50 border-gray-200',
    });

    // Шинэ зүйлсийг эхэнд, хуучин зүйлсийг хойно
    notifs.sort((a, b) => {
      if (a.read !== b.read) return a.read ? 1 : -1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    setNotifications(notifs);
    setLoading(false);
  };

  // LocalStorage-д уншсан зарлалуудыг хадгалах
  const getReadAnnouncements = (): number[] => {
    try {
      const stored = localStorage.getItem(`sokh-${params.id}-read-announcements`);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  };

  const markAllRead = () => {
    // Зарлалуудыг уншсан болгох
    const annIds = notifications
      .filter(n => n.id.startsWith('ann-'))
      .map(n => parseInt(n.id.replace('ann-', '')));
    localStorage.setItem(`sokh-${params.id}-read-announcements`, JSON.stringify(annIds));

    // Бүх мэдэгдлийг уншсан болгох
    localStorage.setItem(`sokh-${params.id}-notif-seen`, new Date().toISOString());
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleNotifClick = (notif: Notification) => {
    if (notif.action) {
      router.push(`/sokh/${params.id}/${notif.action}`);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins} мин`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} цаг`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} өдөр`;
    return `${Math.floor(days / 30)} сар`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-blue-600 text-white px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <button onClick={() => router.push(`/sokh/${params.id}`)} className="text-white/80 text-sm mb-1">
              ← Буцах
            </button>
            <h1 className="text-lg font-bold">🔔 Мэдэгдэл</h1>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs bg-white/20 px-3 py-1.5 rounded-lg"
            >
              Бүгдийг уншсан
            </button>
          )}
        </div>
        {unreadCount > 0 && (
          <p className="text-sm text-white/70 mt-1">{unreadCount} шинэ мэдэгдэл</p>
        )}
      </div>

      {/* Notifications */}
      <div className="px-4 py-4">
        {loading ? (
          <p className="text-gray-400 text-center py-8">Ачаалж байна...</p>
        ) : notifications.length === 0 ? (
          <div className="bg-white rounded-xl p-6 text-center">
            <p className="text-3xl mb-2">🔔</p>
            <p className="text-gray-400">Мэдэгдэл байхгүй</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleNotifClick(n)}
                className={`w-full text-left rounded-xl p-4 border transition active:scale-[0.98] ${n.color} ${
                  !n.read ? 'shadow-sm' : 'opacity-75'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl mt-0.5">{n.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className={`text-sm ${!n.read ? 'font-bold' : 'font-medium'}`}>{n.title}</h3>
                      {!n.read && (
                        <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">{n.message}</p>
                    <p className="text-xs text-gray-400 mt-1.5">{timeAgo(n.date)}-н өмнө</p>
                  </div>
                  {n.action && (
                    <span className="text-gray-300 mt-1">›</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
