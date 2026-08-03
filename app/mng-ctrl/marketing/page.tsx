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
    queuedToday: number;
    pendingApproval: number;
    rejected: number;
    leadsToday: number;
    leadsTotal: number;
    totalGroups: number;
    activeGroups: number;
    readyCount: number;
    postedLast14: number;
    activeDays14: number;
  };
  yesterday: {
    date: string;
    posted: number;
    queued: number;
    leads: number;
    demoRequests: number;
  };
  last14: { date: string; posted: number; leads: number }[];
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
    // Маркетинг модуль цайвар загвартай (цагаан карт) — /mng-ctrl-ийн хар
    // дэвсгэр/text-white-ийг дарж, бие даасан цайвар хэсэг болгоно.
    <div className="p-6 min-h-screen bg-gray-50 text-gray-900">
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

/**
 * Өдрийн ажлын банner — «өнөөдөр юу хийх вэ» гэдгийг нэг харцаар.
 * Дараалал өглөө 09:00-д cron-оор автоматаар үүсдэг тул ихэвчлэн бэлэн байна.
 */
function TodayBanner({
  stats,
  onGoQueue,
}: {
  stats: DashboardData['stats'];
  onGoQueue: () => void;
}) {
  const { queuedToday, postedToday, readyCount } = stats;

  // 1. Хүлээгдэж буй пост байна — гол дуудлага
  if (queuedToday > 0) {
    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-lg font-bold text-blue-900">
            📤 Өнөөдөр {queuedToday} пост хүлээгдэж байна
          </p>
          <p className="text-sm text-blue-700 mt-0.5">
            Бичвэр нь бэлэн — хуулж тавиад «Постолсон» дарахад л болно. Ойролцоогоор{' '}
            {Math.max(5, queuedToday)} минутын ажил.
            {postedToday > 0 && ` Өнөөдөр аль хэдийн ${postedToday} тавьсан 👏`}
          </p>
        </div>
        <button
          onClick={onGoQueue}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 whitespace-nowrap"
        >
          Эхлэх →
        </button>
      </div>
    );
  }

  // 2. Бүгдийг тавьчихсан
  if (postedToday > 0) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-5">
        <p className="text-lg font-bold text-green-900">
          ✅ Өнөөдрийн ажил дууссан — {postedToday} пост
        </p>
        <p className="text-sm text-green-700 mt-0.5">
          Маргааш өглөө 09:00-д шинэ дараалал өөрөө үүснэ.
        </p>
      </div>
    );
  }

  // 3. Дараалал хоосон, гэхдээ тэнцэх групп бий
  if (readyCount > 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-lg font-bold text-amber-900">
            ⏳ Өнөөдрийн дараалал үүсээгүй байна
          </p>
          <p className="text-sm text-amber-700 mt-0.5">
            {readyCount} групп постонд бэлэн. Автомат үүсгэлт өглөө 09:00-д ажилладаг —
            хүсвэл яг одоо гараар үүсгэ.
          </p>
        </div>
        <button
          onClick={onGoQueue}
          className="bg-amber-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-amber-700 whitespace-nowrap"
        >
          Дараалал гаргах →
        </button>
      </div>
    );
  }

  // 4. Бүх групп cooldown-д
  return (
    <div className="rounded-xl border bg-white p-5">
      <p className="text-lg font-bold text-gray-700">😴 Өнөөдөр постлох групп алга</p>
      <p className="text-sm text-gray-500 mt-0.5">
        Бүгд 7 хоногийн завсарлагад байна. Шинэ групп нэмбэл ажил нэмэгдэнэ.
      </p>
    </div>
  );
}

/** Өглөөний тайлан — өчигдөр юу болсныг тоогоор, дээр нь 14 хоногийн зурвас */
function YesterdayReport({
  y,
  last14,
  postedLast14,
  activeDays14,
}: {
  y: DashboardData['yesterday'];
  last14: DashboardData['last14'];
  postedLast14: number;
  activeDays14: number;
}) {
  const maxPosted = Math.max(1, ...last14.map((d) => d.posted));

  return (
    <div className="bg-white border rounded-xl p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <h2 className="text-sm font-semibold">🌅 Өглөөний тайлан</h2>
        <span className="text-xs text-gray-400">Өчигдөр — {y.date}</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div>
          <p className="text-2xl font-bold text-gray-800">{y.posted}</p>
          <p className="text-xs text-gray-500">пост тавьсан</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-purple-600">{y.leads}</p>
          <p className="text-xs text-gray-500">лид ирсэн</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-blue-600">{y.demoRequests}</p>
          <p className="text-xs text-gray-500">demo хүсэлт</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-800">{y.queued}</p>
          <p className="text-xs text-gray-500">тавилгүй үлдсэн</p>
        </div>
      </div>

      {/* 14 хоногийн зурвас — тогтвортой ажиллаж байгаа эсэх нэг харцаар */}
      <div className="border-t pt-3">
        <div className="flex items-end gap-1 h-16">
          {last14.map((d) => {
            const isToday = d === last14[last14.length - 1];
            const h = d.posted === 0 ? 3 : Math.round((d.posted / maxPosted) * 56) + 4;
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center justify-end gap-1" title={`${d.date}: ${d.posted} пост, ${d.leads} лид`}>
                <div
                  className={`w-full rounded-sm ${
                    d.posted === 0 ? 'bg-gray-200' : isToday ? 'bg-blue-500' : 'bg-green-500'
                  }`}
                  style={{ height: `${h}px` }}
                />
                <span className="text-[10px] text-gray-400">{d.date.slice(8)}</span>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Сүүлийн 14 хоногт <span className="font-semibold text-gray-700">{postedLast14} пост</span>
          {' · '}
          <span className="font-semibold text-gray-700">{activeDays14}/14 өдөр</span> идэвхтэй
          {activeDays14 < 7 && <span className="text-amber-600"> — тогтвортой байдал сул</span>}
        </p>
      </div>
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
      <TodayBanner stats={s} onGoQueue={onGoQueue} />
      <YesterdayReport y={d.yesterday} last14={d.last14} postedLast14={s.postedLast14} activeDays14={s.activeDays14} />
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
