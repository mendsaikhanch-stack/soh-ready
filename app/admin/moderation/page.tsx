'use client';

import { useState, useEffect } from 'react';
import { adminFrom } from '@/app/lib/admin-db';
import { getAdminSokhId } from '@/app/lib/admin-config';

interface Report {
  id: number;
  content_type: string;
  content_id: number;
  content_snapshot: string | null;
  content_author: string | null;
  reason: string;
  note: string | null;
  reporter_name: string | null;
  status: string;
  created_at: string;
  reviewed_at: string | null;
}

const reasonMap: Record<string, string> = {
  spam: 'Спам, зар сурталчилгаа',
  harassment: 'Доромжлол, заналхийлэл',
  inappropriate: 'Зохисгүй агуулга',
  scam: 'Залилан, худал мэдээлэл',
  other: 'Бусад',
};

const typeMap: Record<string, { label: string; icon: string }> = {
  chat: { label: 'Хөрш чат', icon: '💬' },
  marketplace: { label: 'Хөрш маркет', icon: '🏪' },
};

const statusOptions = [
  { value: 'pending', label: 'Хүлээгдэж буй', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'removed', label: 'Устгасан', color: 'bg-red-100 text-red-700' },
  { value: 'dismissed', label: 'Зөрчилгүй', color: 'bg-gray-100 text-gray-600' },
];

export default function AdminModeration() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => { fetchReports(); }, []);

  const fetchReports = async () => {
    const sokhId = await getAdminSokhId();
    const { data } = await adminFrom('content_reports')
      .select('*')
      .eq('sokh_id', sokhId)
      .order('created_at', { ascending: false });

    setReports((data as unknown as Report[]) || []);
    setLoading(false);
  };

  // Мэдээлсэн контентыг устгаад, мэдээллийг "Устгасан" болгоно
  const removeContent = async (r: Report) => {
    if (!confirm('Энэ контентыг устгах уу? Буцаах боломжгүй.')) return;
    setBusyId(r.id);

    if (r.content_type === 'chat') {
      await adminFrom('chat_messages').delete().eq('id', r.content_id);
    } else {
      await adminFrom('marketplace_listings').update({ status: 'removed' }).eq('id', r.content_id);
    }

    await adminFrom('content_reports').update({
      status: 'removed',
      reviewed_at: new Date().toISOString(),
    }).eq('id', r.id);

    setBusyId(null);
    await fetchReports();
  };

  const dismiss = async (r: Report) => {
    setBusyId(r.id);
    await adminFrom('content_reports').update({
      status: 'dismissed',
      reviewed_at: new Date().toISOString(),
    }).eq('id', r.id);
    setBusyId(null);
    await fetchReports();
  };

  const filtered = filter === 'all' ? reports : reports.filter(r => r.status === filter);
  const getStatus = (s: string) => statusOptions.find(o => o.value === s) || statusOptions[0];
  const getType = (t: string) => typeMap[t] || typeMap.chat;
  const pendingCount = reports.filter(r => r.status === 'pending').length;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-1">🚩 Мэдээлсэн контент</h1>
      <p className="text-sm text-gray-500 mb-6">
        Оршин суугчид Хөрш чат, Хөрш маркет дээрх зөрчлийг мэдээлсэн жагсаалт
      </p>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">Нийт</p>
          <p className="text-2xl font-bold">{reports.length}</p>
        </div>
        {statusOptions.map(s => (
          <div key={s.value} className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className="text-2xl font-bold">{reports.filter(r => r.status === s.value).length}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-full text-sm ${filter === 'all' ? 'bg-gray-800 text-white' : 'bg-white border'}`}>
          Бүгд ({reports.length})
        </button>
        {statusOptions.map(s => (
          <button key={s.value} onClick={() => setFilter(s.value)}
            className={`px-3 py-1.5 rounded-full text-sm ${filter === s.value ? 'bg-gray-800 text-white' : 'bg-white border'}`}>
            {s.label} ({reports.filter(r => r.status === s.value).length})
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-400 py-8">Ачаалж байна...</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center">
          <p className="text-3xl mb-2">✅</p>
          <p className="text-gray-400">
            {pendingCount === 0 && filter === 'pending'
              ? 'Шалгах шаардлагатай мэдээлэл алга'
              : 'Мэдээлэл алга'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => {
            const st = getStatus(r.status);
            const tp = getType(r.content_type);
            return (
              <div key={r.id} className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-sm font-medium">
                      {tp.icon} {tp.label} · {reasonMap[r.reason] || r.reason}
                    </p>
                    <p className="text-xs text-gray-500">
                      Мэдээлсэн: {r.reporter_name || 'нэргүй'} ·{' '}
                      {new Date(r.created_at).toLocaleString('mn-MN')}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                </div>

                <div className="bg-gray-50 border rounded-lg p-3 mb-2">
                  <p className="text-xs text-gray-400 mb-0.5">{r.content_author || '—'}</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {r.content_snapshot || '(агуулга хадгалагдаагүй)'}
                  </p>
                </div>

                {r.note && (
                  <p className="text-xs text-gray-500 mb-2">Тайлбар: {r.note}</p>
                )}

                {r.status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => dismiss(r)}
                      disabled={busyId === r.id}
                      className="flex-1 py-2 rounded-lg border text-sm disabled:opacity-50"
                    >
                      Зөрчилгүй
                    </button>
                    <button
                      onClick={() => removeContent(r)}
                      disabled={busyId === r.id}
                      className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm disabled:opacity-50"
                    >
                      {busyId === r.id ? '...' : 'Контентыг устгах'}
                    </button>
                  </div>
                )}

                {r.reviewed_at && (
                  <p className="text-[11px] text-gray-400">
                    Шийдвэрлэсэн: {new Date(r.reviewed_at).toLocaleString('mn-MN')}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
