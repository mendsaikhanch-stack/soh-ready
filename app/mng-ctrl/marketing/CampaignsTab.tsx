'use client';

import { useState, useEffect, useCallback } from 'react';
import { mkt } from '@/app/lib/marketing-client';
import type { Campaign } from '@/app/lib/marketing/constants';

export default function CampaignsTab() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [mainText, setMainText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  const load = useCallback(async () => {
    const res = await mkt.campaigns.list();
    setCampaigns(res.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const reset = () => {
    setTitle(''); setMainText(''); setLinkUrl(''); setEditId(null); setShowForm(false); setErr('');
  };

  const save = async () => {
    if (!mainText) return;
    setSaving(true); setErr('');
    const res = editId
      ? await mkt.campaigns.update(editId, { title: title || undefined, main_text: mainText, link_url: linkUrl || null })
      : await mkt.campaigns.create({ title: title || undefined, main_text: mainText, link_url: linkUrl || undefined });
    setSaving(false);
    if (res.error) { setErr(res.error); return; }
    reset();
    await load();
  };

  const edit = (c: Campaign) => {
    setEditId(c.id); setTitle(c.title); setMainText(c.main_text); setLinkUrl(c.link_url || '');
    setShowForm(true);
  };

  const toggleArchive = async (c: Campaign) => {
    await mkt.campaigns.update(c.id, { status: c.status === 'active' ? 'archived' : 'active' });
    await load();
  };

  const remove = async (id: number) => {
    if (!confirm('Кампанит ажлыг устгах уу? (Холбоотой постын дараалал арилна)')) return;
    await mkt.campaigns.remove(id);
    await load();
  };

  return (
    <div>
      <button onClick={() => { reset(); setShowForm(true); }}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 mb-4">
        + Кампанит ажил үүсгэх
      </button>

      {err && <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-xl mb-3">{err}</div>}

      {showForm && (
        <div className="bg-white border rounded-xl p-4 mb-4">
          <h3 className="font-semibold text-sm mb-3">{editId ? 'Кампанит ажил засах' : 'Шинэ кампанит ажил'}</h3>
          <div className="space-y-3">
            <input placeholder="Гарчиг (заавал биш — хоосон бол текстээс үүснэ)" value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
            <textarea placeholder="Үндсэн пост текст — энэ текстээс групп бүрт арай өөр caption үүснэ"
              value={mainText} onChange={(e) => setMainText(e.target.value)} rows={6}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
            <input placeholder="Линк (заавал биш) — жнь: https://khotol.com" value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={reset} className="px-4 py-2 rounded-lg border text-sm">Цуцлах</button>
            <button onClick={save} disabled={saving || !mainText}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm disabled:opacity-50">
              {saving ? '...' : editId ? 'Хадгалах' : 'Үүсгэх'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-gray-400 text-center py-8">Ачаалж байна...</p>
      ) : campaigns.length === 0 ? (
        <p className="text-gray-400 text-center py-8">Кампанит ажил байхгүй. Дээрээс үүсгэнэ үү.</p>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <div key={c.id} className={`bg-white border rounded-xl p-4 ${c.status === 'archived' ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm">{c.title}</h3>
                    {c.status === 'archived' && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Архивласан</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap line-clamp-4">{c.main_text}</p>
                  {c.link_url && <p className="text-xs text-blue-500 mt-1">🔗 {c.link_url}</p>}
                  <p className="text-xs text-gray-400 mt-1">{new Date(c.created_at).toLocaleDateString('mn-MN')}</p>
                </div>
                <div className="flex flex-col items-end gap-1 whitespace-nowrap">
                  <button onClick={() => edit(c)} className="text-xs text-blue-500 hover:underline">Засах</button>
                  <button onClick={() => toggleArchive(c)} className="text-xs text-gray-500 hover:underline">
                    {c.status === 'active' ? 'Архивлах' : 'Сэргээх'}
                  </button>
                  <button onClick={() => remove(c.id)} className="text-xs text-red-400 hover:underline">Устгах</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
