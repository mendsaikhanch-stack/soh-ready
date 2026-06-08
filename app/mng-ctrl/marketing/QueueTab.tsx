'use client';

import { useState, useEffect, useCallback } from 'react';
import { mkt } from '@/app/lib/marketing-client';
import { groupTypeMeta, priorityMeta, queueStatusMeta, QUEUE_DEFAULT } from '@/app/lib/marketing/constants';
import type { Campaign, QueueItem } from '@/app/lib/marketing/constants';

export default function QueueTab({ onChanged }: { onChanged?: () => void }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignId, setCampaignId] = useState<number | null>(null);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [limit, setLimit] = useState(QUEUE_DEFAULT);
  const [info, setInfo] = useState('');
  const [err, setErr] = useState('');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [leadForId, setLeadForId] = useState<number | null>(null);
  const [leadName, setLeadName] = useState('');
  const [leadContact, setLeadContact] = useState('');
  const [leadNote, setLeadNote] = useState('');

  const init = useCallback(async () => {
    const [cRes, qRes] = await Promise.all([mkt.campaigns.list(), mkt.queue.today()]);
    const active = (cRes.data || []).filter((c) => c.status === 'active');
    setCampaigns(active);
    if (active.length > 0) setCampaignId(active[0].id);
    setItems(qRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    init();
  }, [init]);

  const reloadQueue = async () => {
    const qRes = await mkt.queue.today();
    setItems(qRes.data || []);
  };

  const generate = async (enhance: boolean) => {
    if (!campaignId) { setErr('Эхлээд кампанит ажил сонгоно уу'); return; }
    setGenerating(true); setErr(''); setInfo('');
    const res = await mkt.queue.generate(campaignId, { limit, enhance });
    setGenerating(false);
    if (res.error) { setErr(res.error); return; }
    setItems((res.data as QueueItem[]) || []);
    const added = (res as { added?: number }).added ?? 0;
    const aiOn = (res as { aiEnhanced?: boolean }).aiEnhanced;
    const warn = (res as { warning?: string }).warning;
    setInfo(`${added} групп нэмэгдлээ${aiOn ? ' · AI-аар найруулсан 🧠' : ''}${warn ? ` · ${warn}` : ''}`);
    onChanged?.();
  };

  const copyCaption = async (item: QueueItem) => {
    try {
      await navigator.clipboard.writeText(item.caption);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId((c) => (c === item.id ? null : c)), 1500);
    } catch {
      setErr('Хуулж чадсангүй');
    }
  };

  const setStatus = async (id: number, action: 'mark_posted' | 'pending' | 'rejected' | 'requeue') => {
    await mkt.queue.setStatus(id, action);
    await reloadQueue();
    onChanged?.();
  };

  const openLeadForm = (id: number) => {
    setLeadForId(id); setLeadName(''); setLeadContact(''); setLeadNote('');
  };

  const submitLead = async (item: QueueItem) => {
    await mkt.leads.create({
      group_id: item.group_id,
      campaign_id: item.campaign_id,
      queue_item_id: item.id,
      name: leadName || null,
      contact: leadContact || null,
      note: leadNote || null,
    });
    setLeadForId(null);
    await reloadQueue();
    onChanged?.();
  };

  const todayLabel = new Date().toLocaleDateString('mn-MN', { year: 'numeric', month: 'long', day: 'numeric' });
  const queued = items.filter((i) => i.status === 'queued');

  return (
    <div>
      {/* Controls */}
      <div className="bg-white border rounded-xl p-4 mb-4">
        <p className="text-xs text-gray-500 mb-2">📅 {todayLabel} — өдрийн постын дараалал</p>
        <div className="flex flex-wrap items-center gap-2">
          <select value={campaignId ?? ''} onChange={(e) => setCampaignId(Number(e.target.value))}
            className="border rounded-lg px-3 py-2 text-sm min-w-[200px]">
            {campaigns.length === 0 && <option value="">Кампанит ажил байхгүй</option>}
            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <label className="text-sm text-gray-500 flex items-center gap-1">
            Тоо:
            <input type="number" min={10} max={15} value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="border rounded-lg px-2 py-1.5 text-sm w-16" />
          </label>
          <button onClick={() => generate(false)} disabled={generating || !campaignId}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {generating ? 'Үүсгэж байна...' : 'Дараалал гаргах'}
          </button>
          <button onClick={() => generate(true)} disabled={generating || !campaignId}
            title="AI-аар групп бүрт caption-ийг дахин найруулна (ANTHROPIC_API_KEY шаардлагатай)"
            className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
            🧠 AI-аар гаргах
          </button>
        </div>
        {info && <p className="text-xs text-green-600 mt-2">{info}</p>}
        {err && <p className="text-xs text-red-500 mt-2">{err}</p>}
        <p className="text-[11px] text-gray-400 mt-2">
          Сонголт: cooldown-д ороогүй, сүүлийн 7 хоногт постлоогүй, A зэрэг түрүүлсэн, төрлүүд холилдсон группүүд.
          Постлох ажлыг та өөрөө гүйцэтгэнэ — энэ зөвхөн дараалал, caption бэлтгэнэ.
        </p>
      </div>

      {loading ? (
        <p className="text-gray-400 text-center py-8">Ачаалж байна...</p>
      ) : items.length === 0 ? (
        <p className="text-gray-400 text-center py-8">
          Өнөөдрийн дараалал хоосон байна. Дээрээс кампанит ажил сонгоод &quot;Дараалал гаргах&quot; дарна уу.
        </p>
      ) : (
        <>
          <p className="text-sm text-gray-500 mb-2">
            Нийт {items.length} · Хүлээгдэж буй {queued.length} · Постолсон {items.filter((i) => i.status === 'posted').length}
          </p>
          <div className="space-y-3">
            {items.map((item) => {
              const g = item.group;
              const t = g ? groupTypeMeta(g.group_type) : null;
              const p = g ? priorityMeta(g.priority) : null;
              const st = queueStatusMeta(item.status);
              const done = item.status !== 'queued';
              return (
                <div key={item.id} className={`bg-white border rounded-xl p-4 ${done ? 'opacity-80' : ''}`}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{g?.name || 'Групп'}</span>
                        {t && <span className="text-xs text-gray-500">{t.icon} {t.label}</span>}
                        {p && <span className={`text-xs px-2 py-0.5 rounded-full ${p.cls}`}>{g?.priority}</span>}
                        {item.ai_enhanced && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">🧠 AI</span>}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${st.cls}`}>{st.label}</span>
                  </div>

                  <div className="bg-gray-50 border rounded-lg p-3 text-sm whitespace-pre-wrap text-gray-700 mb-3">
                    {item.caption}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {g && (
                      <a href={g.url} target="_blank" rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg border text-sm hover:bg-gray-50">
                        ↗ Групп нээх
                      </a>
                    )}
                    <button onClick={() => copyCaption(item)}
                      className="px-3 py-1.5 rounded-lg border text-sm hover:bg-gray-50">
                      {copiedId === item.id ? '✓ Хууллаа' : '📋 Caption хуулах'}
                    </button>
                    <button onClick={() => setStatus(item.id, 'mark_posted')}
                      className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700">
                      ✓ Постолсон
                    </button>
                    <button onClick={() => setStatus(item.id, 'pending')}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-sm hover:bg-amber-600">
                      ⏳ Зөвшөөрөл хүлээж буй
                    </button>
                    <button onClick={() => setStatus(item.id, 'rejected')}
                      className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-sm hover:bg-red-600">
                      ✕ Татгалзсан
                    </button>
                    <button onClick={() => openLeadForm(item.id)}
                      className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-sm hover:bg-purple-700">
                      🎯 Лид ирсэн
                    </button>
                    {done && (
                      <button onClick={() => setStatus(item.id, 'requeue')}
                        className="px-3 py-1.5 rounded-lg border text-sm text-gray-500 hover:bg-gray-50">
                        ↺ Дахин дараалалд
                      </button>
                    )}
                  </div>

                  {/* Lead capture form */}
                  {leadForId === item.id && (
                    <div className="mt-3 border-t pt-3">
                      <p className="text-xs font-semibold text-purple-700 mb-2">Лидийн мэдээлэл (заавал биш)</p>
                      <div className="grid grid-cols-3 gap-2">
                        <input placeholder="Нэр" value={leadName} onChange={(e) => setLeadName(e.target.value)}
                          className="border rounded-lg px-3 py-2 text-sm" />
                        <input placeholder="Утас / FB холбоо" value={leadContact} onChange={(e) => setLeadContact(e.target.value)}
                          className="border rounded-lg px-3 py-2 text-sm" />
                        <input placeholder="Тэмдэглэл" value={leadNote} onChange={(e) => setLeadNote(e.target.value)}
                          className="border rounded-lg px-3 py-2 text-sm" />
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => setLeadForId(null)} className="px-3 py-1.5 rounded-lg border text-sm">Цуцлах</button>
                        <button onClick={() => submitLead(item)}
                          className="px-4 py-1.5 rounded-lg bg-purple-600 text-white text-sm">Лид хадгалах</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
