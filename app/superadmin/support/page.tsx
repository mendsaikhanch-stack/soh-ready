'use client';

import { useState, useEffect } from 'react';
import { adminFrom } from '@/app/lib/admin-db';

interface SupportTicket {
  id: number;
  content?: string;
  description?: string;
  title?: string;
  status: string;
  priority?: string;
  created_at: string;
  sokh_id?: number;
  source: 'complaint' | 'maintenance' | 'message';
}

export default function SupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      // Гомдол/санал (complaints)
      const { data: complaints } = await adminFrom('complaints')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      // Засварын хүсэлт (maintenance_requests)
      const { data: maintenance } = await adminFrom('maintenance_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      // Нэгтгэж, цаг хугацаагаар эрэмбэлэх
      const all: SupportTicket[] = [
        ...(complaints || []).map((c: any) => ({
          id: c.id,
          content: c.content || c.description,
          title: c.title || c.subject || 'Гомдол/санал',
          status: c.status || 'pending',
          priority: c.priority || 'medium',
          created_at: c.created_at,
          sokh_id: c.sokh_id,
          source: 'complaint' as const,
        })),
        ...(maintenance || []).map((m: any) => ({
          id: m.id,
          content: m.description,
          title: m.title || 'Засварын хүсэлт',
          status: m.status || 'pending',
          priority: m.priority || 'medium',
          created_at: m.created_at,
          sokh_id: m.sokh_id,
          source: 'maintenance' as const,
        })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setTickets(all);
      setLoading(false);
    };
    load();
  }, []);

  const statusColors: Record<string, string> = {
    pending: 'bg-red-900/50 text-red-400',
    open: 'bg-red-900/50 text-red-400',
    in_progress: 'bg-yellow-900/50 text-yellow-400',
    resolved: 'bg-green-900/50 text-green-400',
    completed: 'bg-green-900/50 text-green-400',
    closed: 'bg-gray-800 text-gray-500',
  };

  const statusLabels: Record<string, string> = {
    pending: 'Хүлээгдэж буй',
    open: 'Нээлттэй',
    in_progress: 'Шийдэж байна',
    resolved: 'Шийдэгдсэн',
    completed: 'Дууссан',
    closed: 'Хаагдсан',
  };

  const priorityColors: Record<string, string> = {
    high: 'bg-red-500',
    medium: 'bg-yellow-500',
    low: 'bg-gray-500',
  };

  const openCount = tickets.filter(t => ['pending', 'open', 'in_progress'].includes(t.status)).length;
  const resolvedCount = tickets.filter(t => ['resolved', 'completed', 'closed'].includes(t.status)).length;
  const complaintCount = tickets.filter(t => t.source === 'complaint').length;
  const maintenanceCount = tickets.filter(t => t.source === 'maintenance').length;

  if (loading) return <div className="p-8 text-gray-500">Ачаалж байна...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-2">Дэмжлэг</h1>
      <p className="text-gray-400 text-sm mb-6">СӨХ-үүдээс ирсэн хүсэлт, гомдол, засварын хүсэлтүүд</p>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-red-900/20 border border-red-900/50 rounded-2xl p-4">
          <p className="text-2xl font-bold text-red-400">{openCount}</p>
          <p className="text-xs text-gray-400 mt-1">Нээлттэй</p>
        </div>
        <div className="bg-green-900/20 border border-green-900/50 rounded-2xl p-4">
          <p className="text-2xl font-bold text-green-400">{resolvedCount}</p>
          <p className="text-xs text-gray-400 mt-1">Шийдэгдсэн</p>
        </div>
        <div className="bg-gray-800/50 border border-gray-800 rounded-2xl p-4">
          <p className="text-2xl font-bold">{complaintCount}</p>
          <p className="text-xs text-gray-400 mt-1">Гомдол/санал</p>
        </div>
        <div className="bg-gray-800/50 border border-gray-800 rounded-2xl p-4">
          <p className="text-2xl font-bold">{maintenanceCount}</p>
          <p className="text-xs text-gray-400 mt-1">Засварын хүсэлт</p>
        </div>
      </div>

      {/* Tickets */}
      <div className="bg-gray-800/50 border border-gray-800 rounded-2xl p-5">
        <h2 className="font-semibold mb-4">Бүх тикетүүд ({tickets.length})</h2>
        {tickets.length === 0 ? (
          <p className="text-gray-500 text-sm py-4 text-center">Тикет байхгүй</p>
        ) : (
          <div className="space-y-3">
            {tickets.map(t => (
              <div key={`${t.source}-${t.id}`} className="flex items-start justify-between py-3 border-b border-gray-800 last:border-0">
                <div className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-2 ${priorityColors[t.priority || 'medium']}`} />
                  <div>
                    <p className="text-sm font-medium">{t.title}</p>
                    {t.content && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{t.content}</p>}
                    <p className="text-xs text-gray-600 mt-1">
                      {t.source === 'complaint' ? 'Гомдол' : 'Засвар'}
                      {t.sokh_id ? ` · СӨХ #${t.sokh_id}` : ''}
                      {' · '}
                      {new Date(t.created_at).toLocaleString('mn-MN')}
                    </p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${statusColors[t.status] || statusColors.pending}`}>
                  {statusLabels[t.status] || t.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
