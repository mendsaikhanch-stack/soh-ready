'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';

interface Ticket {
  id: number;
  content: string;
  type: string;
  created_at: string;
  sokh_name?: string;
}

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [feedback, setFeedback] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data: msgs } = await supabase.from('messages').select('*').order('created_at', { ascending: false });
      setTickets(msgs || []);

      const { data: maint } = await supabase.from('maintenance_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false });
      setFeedback(maint || []);

      setLoading(false);
    };
    fetch();
  }, []);

  // Жишээ дэмжлэгийн тикетүүд
  const sampleTickets = [
    { id: 1, org: 'Нарантуул СӨХ', subject: 'Excel импорт ажиллахгүй байна', status: 'open', priority: 'high', time: '2 цагийн өмнө' },
    { id: 2, org: 'Од СӨХ', subject: 'Оршин суугч нэмэх товч дарахад алдаа гарна', status: 'open', priority: 'medium', time: '5 цагийн өмнө' },
    { id: 3, org: 'Алтан гадас СӨХ', subject: 'Тайлан татаж авах боломжтой юу?', status: 'resolved', priority: 'low', time: '1 өдрийн өмнө' },
    { id: 4, org: 'Номин СӨХ', subject: 'Утасны апп хэзээ гарах вэ?', status: 'resolved', priority: 'low', time: '2 өдрийн өмнө' },
  ];

  const statusColors: Record<string, string> = {
    open: 'bg-red-900/50 text-red-400',
    resolved: 'bg-green-900/50 text-green-400',
  };

  const priorityColors: Record<string, string> = {
    high: 'bg-red-500',
    medium: 'bg-yellow-500',
    low: 'bg-gray-500',
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-2">🛠 Дэмжлэг</h1>
      <p className="text-gray-400 text-sm mb-6">СӨХ-үүдээс ирсэн хүсэлт, эргэх холбоо</p>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-red-900/20 border border-red-900/50 rounded-2xl p-4">
          <p className="text-2xl font-bold text-red-400">{sampleTickets.filter(t => t.status === 'open').length}</p>
          <p className="text-xs text-gray-400 mt-1">Нээлттэй тикет</p>
        </div>
        <div className="bg-green-900/20 border border-green-900/50 rounded-2xl p-4">
          <p className="text-2xl font-bold text-green-400">{sampleTickets.filter(t => t.status === 'resolved').length}</p>
          <p className="text-xs text-gray-400 mt-1">Шийдэгдсэн</p>
        </div>
        <div className="bg-gray-800/50 border border-gray-800 rounded-2xl p-4">
          <p className="text-2xl font-bold">{tickets.length}</p>
          <p className="text-xs text-gray-400 mt-1">Нийт мессеж</p>
        </div>
        <div className="bg-gray-800/50 border border-gray-800 rounded-2xl p-4">
          <p className="text-2xl font-bold">{feedback.length}</p>
          <p className="text-xs text-gray-400 mt-1">Хүлээгдэж буй засвар</p>
        </div>
      </div>

      {/* Tickets */}
      <div className="bg-gray-800/50 border border-gray-800 rounded-2xl p-5 mb-6">
        <h2 className="font-semibold mb-4">Дэмжлэгийн тикетүүд</h2>
        <div className="space-y-3">
          {sampleTickets.map(t => (
            <div key={t.id} className="flex items-start justify-between py-3 border-b border-gray-800 last:border-0">
              <div className="flex items-start gap-3">
                <div className={`w-2 h-2 rounded-full mt-2 ${priorityColors[t.priority]}`} />
                <div>
                  <p className="text-sm font-medium">{t.subject}</p>
                  <p className="text-xs text-gray-500">{t.org} · {t.time}</p>
                </div>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${statusColors[t.status]}`}>
                {t.status === 'open' ? 'Нээлттэй' : 'Шийдэгдсэн'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Messages from users */}
      <div className="bg-gray-800/50 border border-gray-800 rounded-2xl p-5">
        <h2 className="font-semibold mb-4">Хэрэглэгчдийн мессеж ({tickets.length})</h2>
        {tickets.length === 0 ? (
          <p className="text-gray-500 text-sm py-4 text-center">Мессеж байхгүй</p>
        ) : (
          <div className="space-y-3">
            {tickets.map(t => (
              <div key={t.id} className="py-3 border-b border-gray-800 last:border-0">
                <p className="text-sm">{t.content}</p>
                <p className="text-xs text-gray-600 mt-1">{new Date(t.created_at).toLocaleString('mn-MN')}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
