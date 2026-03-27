'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { adminFrom } from '@/app/lib/admin-db';
import { getAdminSokhId } from '@/app/lib/admin-config';

interface Announcement { id: number; title: string; content: string; type: string; created_at: string; }

export default function AdminAnnouncements() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState('info');
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchItems(); }, []);

  const fetchItems = async () => {
    const sokhId = await getAdminSokhId();
    const { data } = await supabase.from('announcements').select('*').eq('sokh_id', sokhId).order('created_at', { ascending: false });
    setItems(data || []);
    setLoading(false);
  };

  const createAnnouncement = async () => {
    if (!title) return;
    setSaving(true);
    const sokhId = await getAdminSokhId();
    await adminFrom('announcements').insert([{ sokh_id: sokhId, title, content, type }]);

    // Push notification илгээх
    try {
      await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `📢 ${title}`,
          body: content || 'Шинэ зарлал нийтлэгдлээ',
          url: `/sokh/${sokhId}/announcements`,
          sokh_id: sokhId,
        }),
      });
    } catch {}

    setShowForm(false);
    setTitle(''); setContent(''); setType('info');
    setSaving(false);
    await fetchItems();
  };

  const deleteItem = async (id: number) => {
    if (!confirm('Устгах уу?')) return;
    await adminFrom('announcements').delete().eq('id', id);
    await fetchItems();
  };

  const typeLabels: Record<string, string> = { info: 'ℹ️ Мэдээлэл', warning: '⚠️ Анхааруулга', urgent: '🚨 Яаралтай', event: '📅 Арга хэмжээ' };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">📢 Зарлал</h1>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm hover:bg-yellow-600">
          + Шинэ зарлал
        </button>
      </div>

      {showForm && (
        <div className="bg-white border rounded-xl p-4 mb-6">
          <h3 className="font-semibold mb-3">Шинэ зарлал нийтлэх</h3>
          <input placeholder="Гарчиг" value={title} onChange={e => setTitle(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm mb-2" />
          <textarea placeholder="Агуулга..." value={content} onChange={e => setContent(e.target.value)} rows={3} className="w-full border rounded-lg px-3 py-2 text-sm mb-2" />
          <select value={type} onChange={e => setType(e.target.value)} className="border rounded-lg px-3 py-2 text-sm mb-3">
            <option value="info">ℹ️ Мэдээлэл</option>
            <option value="warning">⚠️ Анхааруулга</option>
            <option value="urgent">🚨 Яаралтай</option>
            <option value="event">📅 Арга хэмжээ</option>
          </select>
          <div className="flex gap-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg text-sm">Цуцлах</button>
            <button onClick={createAnnouncement} disabled={saving} className="px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm disabled:opacity-50">
              {saving ? 'Нийтэлж байна...' : 'Нийтлэх'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-gray-400 text-center py-8">Ачаалж байна...</p>
      ) : items.length === 0 ? (
        <p className="text-gray-400 text-center py-8">Зарлал байхгүй</p>
      ) : (
        <div className="space-y-3">
          {items.map(a => (
            <div key={a.id} className="bg-white border rounded-xl p-4 flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full">{typeLabels[a.type] || a.type}</span>
                  <span className="text-xs text-gray-400">{new Date(a.created_at).toLocaleDateString('mn-MN')}</span>
                </div>
                <h3 className="font-semibold text-sm">{a.title}</h3>
                {a.content && <p className="text-sm text-gray-500 mt-1">{a.content}</p>}
              </div>
              <button onClick={() => deleteItem(a.id)} className="text-red-400 text-sm hover:underline ml-4">Устгах</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
