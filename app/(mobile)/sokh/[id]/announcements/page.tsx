'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';

interface Announcement {
  id: number;
  title: string;
  content: string;
  type: string;
  created_at: string;
}

const typeIcons: Record<string, string> = {
  info: 'ℹ️',
  warning: '⚠️',
  urgent: '🚨',
  event: '📅',
};

export default function AnnouncementsPage() {
  const params = useParams();
  const router = useRouter();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('announcements')
        .select('*')
        .eq('sokh_id', params.id)
        .order('created_at', { ascending: false });

      setAnnouncements(data || []);
      setLoading(false);
    };
    fetch();
  }, [params.id]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-yellow-500 text-white px-4 py-4">
        <button onClick={() => router.push(`/sokh/${params.id}`)} className="text-white/80 text-sm mb-1">
          ← Буцах
        </button>
        <h1 className="text-lg font-bold">📢 Зарлал</h1>
      </div>

      <div className="px-4 py-4">
        {loading ? (
          <p className="text-gray-400 text-center py-8">Ачаалж байна...</p>
        ) : announcements.length === 0 ? (
          <div className="bg-white rounded-xl p-6 text-center">
            <p className="text-3xl mb-2">📭</p>
            <p className="text-gray-400">Зарлал байхгүй байна</p>
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map((a) => (
              <div key={a.id} className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-start gap-2">
                  <span className="text-lg">{typeIcons[a.type] || 'ℹ️'}</span>
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm">{a.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{a.content}</p>
                    <p className="text-xs text-gray-400 mt-2">
                      {new Date(a.created_at).toLocaleDateString('mn-MN')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
