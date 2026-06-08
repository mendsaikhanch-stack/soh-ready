'use client';

import { useState, useEffect, useCallback } from 'react';
import { mkt } from '@/app/lib/marketing-client';
import { groupTypeMeta, priorityMeta } from '@/app/lib/marketing/constants';
import type { FbGroup } from '@/app/lib/marketing/constants';
import GroupsTab from './GroupsTab';
import QueueTab from './QueueTab';
import CampaignsTab from './CampaignsTab';
import LeadsTab from './LeadsTab';

type Tab = 'dashboard' | 'queue' | 'groups' | 'campaigns' | 'leads';

interface DashboardData {
  date: string;
  stats: {
    postedToday: number;
    pendingApproval: number;
    rejected: number;
    leadsToday: number;
    leadsTotal: number;
    totalGroups: number;
    activeGroups: number;
    readyCount: number;
  };
  bestGroups: FbGroup[];
  readyGroups: FbGroup[];
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'dashboard', label: '📊 Хянах самбар' },
  { key: 'queue', label: '📤 Өдрийн дараалал' },
  { key: 'groups', label: '👥 Группүүд' },
  { key: 'campaigns', label: '📣 Кампанит ажил' },
  { key: 'leads', label: '🎯 Лидүүд' },
];

export default function MarketingPage() {
  const [tab, setTab] = useState<Tab>('dashboard');

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-1">📣 Маркетинг / Outreach</h1>
      <p className="text-sm text-gray-500 mb-5">
        Facebook группүүдэд гар аргаар пост түгээх (хагас автомат) удирдлага — групп, ротаци, caption, лид.
      </p>

      <div className="flex flex-wrap gap-1 bg-gray-100 rounded-xl p-1 mb-5">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === t.key ? 'bg-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <Dashboard onGoQueue={() => setTab('queue')} />}
      {tab === 'queue' && <QueueTab />}
      {tab === 'groups' && <GroupsTab />}
      {tab === 'campaigns' && <CampaignsTab />}
      {tab === 'leads' && <LeadsTab />}
    </div>
  );
}

function Dashboard({ onGoQueue }: { onGoQueue: () => void }) {
  const [d, setD] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = (await mkt.dashboard()) as unknown as DashboardData & { error?: string };
    if (!res.error) setD(res);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (loading) return <p className="text-gray-400 text-center py-8">Ачаалж байна...</p>;
  if (!d) return <p className="text-gray-400 text-center py-8">Мэдээлэл ачаалж чадсангүй.</p>;

  const s = d.stats;
  const cards = [
    { label: 'Өнөөдөр постолсон', value: s.postedToday, cls: 'bg-green-50 border-green-200 text-green-700' },
    { label: 'Зөвшөөрөл хүлээж буй', value: s.pendingApproval, cls: 'bg-amber-50 border-amber-200 text-amber-700' },
    { label: 'Татгалзсан', value: s.rejected, cls: 'bg-red-50 border-red-200 text-red-700' },
    { label: 'Өнөөдрийн лид', value: s.leadsToday, cls: 'bg-purple-50 border-purple-200 text-purple-700' },
    { label: 'Нийт лид', value: s.leadsTotal, cls: 'bg-blue-50 border-blue-200 text-blue-700' },
    { label: 'Постонд бэлэн групп', value: s.readyCount, cls: 'bg-teal-50 border-teal-200 text-teal-700' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map((c) => (
          <div key={c.label} className={`rounded-xl border p-4 ${c.cls}`}>
            <p className="text-2xl font-bold">{c.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Best performing */}
        <div className="bg-white border rounded-xl p-4">
          <h2 className="text-sm font-semibold mb-3">🏆 Шилдэг группүүд (лидээр)</h2>
          {d.bestGroups.length === 0 ? (
            <p className="text-gray-400 text-sm py-4 text-center">Одоогоор өгөгдөл алга.</p>
          ) : (
            <div className="space-y-2">
              {d.bestGroups.map((g) => {
                const t = groupTypeMeta(g.group_type);
                return (
                  <div key={g.id} className="flex items-center justify-between text-sm">
                    <div className="min-w-0">
                      <a href={g.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate block">{g.name}</a>
                      <span className="text-xs text-gray-400">{t.icon} {t.label}</span>
                    </div>
                    <div className="text-right whitespace-nowrap ml-2">
                      <span className="text-purple-600 font-medium">{g.leads_count} лид</span>
                      <span className="text-gray-400 text-xs"> · {g.posts_count} пост</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Ready for next posting */}
        <div className="bg-white border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">✅ Дараагийн постонд бэлэн</h2>
            <button onClick={onGoQueue} className="text-xs text-blue-600 hover:underline">Дараалал гаргах →</button>
          </div>
          {d.readyGroups.length === 0 ? (
            <p className="text-gray-400 text-sm py-4 text-center">Бэлэн групп алга — бүгд cooldown-д байна.</p>
          ) : (
            <div className="space-y-2">
              {d.readyGroups.map((g) => {
                const t = groupTypeMeta(g.group_type);
                const p = priorityMeta(g.priority);
                return (
                  <div key={g.id} className="flex items-center justify-between text-sm">
                    <div className="min-w-0">
                      <span className="truncate block">{g.name}</span>
                      <span className="text-xs text-gray-400">{t.icon} {t.label}</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${p.cls} ml-2`}>{g.priority}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
