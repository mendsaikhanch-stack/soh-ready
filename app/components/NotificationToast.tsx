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

    // Supabase realtime: шинэ мэдэгдэл сонсох
    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'scheduled_notifications',
          filter: `sokh_id=eq.${sokhId}`,
        },
        (payload) => {
          const data = payload.new as any;
          if (data.status === 'sent') {
            const iconMap: Record<string, string> = {
              debt: '💰',
              announcement: '📢',
              custom: '✉️',
            };
            addToast({
              id: `sn-${data.id}`,
              title: data.title,
              message: data.message,
              icon: iconMap[data.type] || '🔔',
              url: `/sokh/${sokhId}/notifications`,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'announcements',
          filter: `sokh_id=eq.${sokhId}`,
        },
        (payload) => {
          const data = payload.new as any;
          addToast({
            id: `ann-${data.id}`,
            title: data.title,
            message: data.content?.slice(0, 80) || '',
            icon: '📢',
            url: `/sokh/${sokhId}/announcements`,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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
