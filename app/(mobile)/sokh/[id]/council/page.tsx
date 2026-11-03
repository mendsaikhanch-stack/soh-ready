'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ChatPanel, { type ChatMessage } from '@/app/components/council/ChatPanel';
import { councilFetch, FinanceTab, IssuesTab, ProposalsTab, ReportsTab } from '@/app/components/council/CouncilTabs';

// «🏛 Зөвлөл» — ТУЗ / Хяналтын зөвлөлийн гишүүдэд зориулсан хэсэг.
// ТУЗ: бүгдийг харна + санал өгнө + чатад бичнэ. Хяналт: зөвхөн харна.

type Tab = 'reports' | 'proposals' | 'finance' | 'issues' | 'chat';
const TABS: { key: Tab; label: string }[] = [
  { key: 'reports', label: '📑 Тайлан' },
  { key: 'proposals', label: '🗳 Санал' },
  { key: 'finance', label: '💰 Санхүү' },
  { key: 'issues', label: '📝 Гомдол/Засвар' },
  { key: 'chat', label: '💬 Чат' },
];

interface Summary { member: boolean; council?: 'board' | 'audit'; name?: string; can_act?: boolean; unread_reports?: number; pending_votes?: number }

export default function CouncilPage() {
  const params = useParams();
  const router = useRouter();
  const sokhId = Number(params.id);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [myResidentId, setMyResidentId] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>('reports');
  useEffect(() => {
    const run = () => {
      const t = new URLSearchParams(window.location.search).get('tab') as Tab | null;
      if (t && TABS.some((x) => x.key === t)) setTab(t);
    };
    run();
  }, []);

  const loadSummary = useCallback(async () => {
    const { ok, data } = await councilFetch(`/api/council?sokhId=${sokhId}&view=summary`);
    setSummary(ok ? data : { member: false });
  }, [sokhId]);
  useEffect(() => {
    const run = async () => { await loadSummary(); };
    run();
  }, [loadSummary]);

  const chooseTab = (t: Tab) => {
    setTab(t);
    window.history.replaceState(null, '', `?tab=${t}`);
  };

  const loadChat = useCallback(async (after: number): Promise<ChatMessage[] | null> => {
    const { ok, data } = await councilFetch(`/api/council?sokhId=${sokhId}&view=chat${after ? `&after=${after}` : ''}`);
    if (!ok) return null;
    if (data.my_resident_id) setMyResidentId(data.my_resident_id);
    return data.messages || [];
  }, [sokhId]);

  const sendChat = useCallback(async (text: string): Promise<ChatMessage | string> => {
    const { ok, data } = await councilFetch('/api/council', { method: 'POST', body: JSON.stringify({ sokhId, action: 'chat', body: text }) });
    return ok ? data.message : data.error || 'Илгээж чадсангүй';
  }, [sokhId]);

  const isAudit = summary?.council === 'audit';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-slate-800 text-white px-4 pt-4 pb-3 sticky top-0 z-10">
        <button onClick={() => router.push(`/sokh/${params.id}`)} className="text-white/80 text-sm mb-1">← Буцах</button>
        <h1 className="text-lg font-bold">🏛 Зөвлөл</h1>
        {summary?.member && (
          <p className="text-xs text-white/70 mt-0.5">
            {summary.name} · {isAudit ? 'Хяналтын зөвлөлийн гишүүн (зөвхөн харах)' : 'ТУЗ-ийн гишүүн'}
          </p>
        )}
        {summary?.member && (
          <div className="flex gap-1 mt-3 overflow-x-auto -mx-1 px-1 pb-0.5">
            {TABS.map((t) => {
              const badge = t.key === 'reports' ? summary.unread_reports : t.key === 'proposals' ? summary.pending_votes : 0;
              return (
                <button key={t.key} onClick={() => chooseTab(t.key)}
                  className={`relative shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold ${tab === t.key ? 'bg-white text-slate-800' : 'bg-white/10 text-white/80'}`}>
                  {t.label}
                  {!!badge && <span className="ml-1 bg-red-500 text-white text-[10px] px-1.5 rounded-full">{badge}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="p-4">
        {!summary ? (
          <p className="text-center text-gray-400 py-10">Ачаалж байна...</p>
        ) : !summary.member ? (
          <div className="bg-white rounded-xl border p-6 text-center text-sm text-gray-500">
            Энэ хэсгийг зөвхөн ТУЗ болон Хяналтын зөвлөлийн гишүүд харна.
            <br />Гишүүн бол СӨХ-ийн даргад хандаж, оршин суугчдын жагсаалтад «Зөвлөл» гэж тэмдэглүүлнэ үү.
          </div>
        ) : tab === 'reports' ? (
          <ReportsTab sokhId={sokhId} onRead={loadSummary} />
        ) : tab === 'proposals' ? (
          <ProposalsTab sokhId={sokhId} canAct={!!summary.can_act} onVoted={loadSummary} />
        ) : tab === 'finance' ? (
          <FinanceTab sokhId={sokhId} />
        ) : tab === 'issues' ? (
          <IssuesTab sokhId={sokhId} />
        ) : (
          <ChatPanel
            load={loadChat}
            send={sendChat}
            canWrite={!!summary.can_act}
            isMine={(m) => myResidentId != null && m.resident_id === myResidentId}
            readOnlyNote="Хяналтын зөвлөлийн гишүүн чатыг уншина, бичих эрхгүй."
            heightClass="h-[65vh]"
          />
        )}
      </div>
    </div>
  );
}
