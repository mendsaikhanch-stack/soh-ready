'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';

interface ToastNotif {
  id: string;
  title: string;
  message: string;
  icon: string;
  url?: string;
}

export default function NotificationToast() {
  const params = useParams();
  const router = useRouter();
  const [toasts, setToasts] = useState<ToastNotif[]>([]);

  const addToast = useCallback((notif: ToastNotif) => {
    setToasts(prev => [...prev, notif]);
    // 5 секундын дараа автомат алга болно
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== notif.id));
    }, 5000);
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  useEffect(() => {
    const sokhId = params?.id;
    if (!sokhId) return;

    // Өмнө нь энд Supabase Realtime `postgres_changes` байсан. Энэ компонент
    // оршин суугчийн бүх хуудсанд (layout) байнга mount хийгддэг тул нэг ч хүн
    // аппаа нээлттэй (утсан дээр арын фонд ч) орхивол Realtime сервер WAL-ийг
    // тасралтгүй poll хийж (`realtime.list_changes`), Disk I/O-ийн гол хэрэглэгч
    // болж байв (pg_stat_statements: 1.5 сая дуудлага, нийт хугацааны 63.7%).
    // Одоо зөвхөн дэлгэц харагдаж байх үед 60с тутам + буцаж ирэхэд индекстэй
    // хоёр жижиг query хийнэ. Яаралтай мэдэгдэл нь web push-оор очдог хэвээр.
    const ICONS: Record<string, string> = { debt: '💰', announcement: '📢', custom: '✉️' };
    let lastAnn: number | null = null;
    let lastSn: number | null = null;
    let busy = false;
    let cancelled = false;

    const poll = async () => {
      if (busy || cancelled || document.visibilityState !== 'visible') return;
      busy = true;
      try {
        const annQ = supabase.from('announcements').select('id, title, content')
          .eq('sokh_id', sokhId).order('id', { ascending: false }).limit(3);
        const snQ = supabase.from('scheduled_notifications').select('id, title, message, type')
          .eq('sokh_id', sokhId).eq('status', 'sent').order('id', { ascending: false }).limit(3);
        const [ann, sn] = await Promise.all([
          lastAnn == null ? annQ : annQ.gt('id', lastAnn),
          lastSn == null ? snQ : snQ.gt('id', lastSn),
        ]);
        if (cancelled) return;
        // Эхний удаа зөвхөн суурь id-г тогтооно — хуучин мэдэгдлийг toast хийхгүй.
        const firstAnn = lastAnn == null, firstSn = lastSn == null;
        if (!ann.error) {
          const rows = ann.data || [];
          lastAnn = Math.max(lastAnn ?? 0, ...rows.map(r => Number(r.id)));
          if (!firstAnn) for (const r of [...rows].reverse()) addToast({
            id: `ann-${r.id}`, title: r.title, message: r.content?.slice(0, 80) || '',
            icon: '📢', url: `/sokh/${sokhId}/announcements`,
          });
        }
        if (!sn.error) {
          const rows = sn.data || [];
          lastSn = Math.max(lastSn ?? 0, ...rows.map(r => Number(r.id)));
          if (!firstSn) for (const r of [...rows].reverse()) addToast({
            id: `sn-${r.id}`, title: r.title, message: r.message,
            icon: ICONS[r.type] || '🔔', url: `/sokh/${sokhId}/notifications`,
          });
        }
      } catch {
        // сүлжээгүй — дараагийн удаа дахин оролдоно
      } finally {
        busy = false;
      }
    };

    poll();
    const timer = setInterval(poll, 60_000);
    const onVisible = () => { if (document.visibilityState === 'visible') poll(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [params?.id, addToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] flex flex-col items-center gap-2 p-3 pointer-events-none">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className="w-full max-w-[410px] bg-white rounded-2xl shadow-xl border border-gray-200 p-4 pointer-events-auto animate-slide-down cursor-pointer"
          onClick={() => {
            removeToast(toast.id);
            if (toast.url) router.push(toast.url);
          }}
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl">{toast.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900">{toast.title}</p>
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{toast.message}</p>
            </div>
            <button
              onClick={e => { e.stopPropagation(); removeToast(toast.id); }}
              className="text-gray-300 hover:text-gray-500 text-lg leading-none"
            >
              &times;
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-2">Дарж дэлгэрэнгүй харах</p>
        </div>
      ))}
    </div>
  );
}
