import { NextResponse } from 'next/server';
import { checkAnyAuth } from '@/app/lib/session-token';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { isEligible } from '@/app/lib/marketing/selection';
import { ubDateStr, ubDateStrAgo } from '@/app/lib/marketing/generate';
import type { FbGroup } from '@/app/lib/marketing/constants';

const HISTORY_DAYS = 14;

// GET /api/admin/marketing/dashboard
export async function GET() {
  const a = await checkAnyAuth('superadmin');
  if (!a.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const date = ubDateStr();
  const yesterday = ubDateStrAgo(1);
  const since = ubDateStrAgo(HISTORY_DAYS - 1);
  const now = new Date();

  const [groupsRes, histRes, leadsRes, demoRes] = await Promise.all([
    supabaseAdmin.from('marketing_fb_groups').select('*'),
    // Сүүлийн 14 хоногийн бүх queue item (өнөөдрийнх бас багтана)
    supabaseAdmin
      .from('marketing_queue_items')
      .select('status, queue_date')
      .gte('queue_date', since),
    supabaseAdmin.from('marketing_leads').select('id, created_at'),
    // Өчигдрийн demo хүсэлт — маркетингийн бодит үр дүнг харуулна
    supabaseAdmin.from('soh_demo_requests').select('id, created_at').gte('created_at', `${since}T00:00:00`),
  ]);

  if (groupsRes.error || histRes.error || leadsRes.error) {
    console.error(
      '[marketing/dashboard]',
      groupsRes.error?.message || histRes.error?.message || leadsRes.error?.message,
    );
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }

  const groups = (groupsRes.data || []) as FbGroup[];
  const history = histRes.data || [];
  const leads = leadsRes.data || [];
  // demo_requests унавал зүгээр л 0 болно — самбар бүхэлдээ унахгүй
  const demoReqs = demoRes.error ? [] : demoRes.data || [];

  const todayQueue = history.filter((q) => q.queue_date === date);
  const yQueue = history.filter((q) => q.queue_date === yesterday);

  const postedToday = todayQueue.filter((q) => q.status === 'posted').length;
  const queuedToday = todayQueue.filter((q) => q.status === 'queued').length;
  const pendingApproval = todayQueue.filter((q) => q.status === 'pending_approval').length;
  const rejected = todayQueue.filter((q) => q.status === 'rejected').length;

  const leadsTotal = leads.length;
  const leadsOn = (d: string) => leads.filter((l) => String(l.created_at).slice(0, 10) === d).length;
  const demoOn = (d: string) => demoReqs.filter((r) => String(r.created_at).slice(0, 10) === d).length;

  // Сүүлийн 14 хоног — өдөр тутмын постын тоо (хуучнаас шинэ рүү)
  const last14: { date: string; posted: number; leads: number }[] = [];
  for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
    const d = ubDateStrAgo(i);
    last14.push({
      date: d,
      posted: history.filter((q) => q.queue_date === d && q.status === 'posted').length,
      leads: leadsOn(d),
    });
  }

  const postedLast14 = last14.reduce((s, d) => s + d.posted, 0);
  // Идэвхтэй өдөр = ядаж 1 пост тавьсан өдөр
  const activeDays14 = last14.filter((d) => d.posted > 0).length;

  // Шилдэг группүүд — лид → пост тоогоор
  const bestGroups = [...groups]
    .filter((g) => g.posts_count > 0 || g.leads_count > 0)
    .sort((a, b) => b.leads_count - a.leads_count || b.posts_count - a.posts_count)
    .slice(0, 6);

  // Дараагийн постонд бэлэн группүүд
  const readyGroups = groups.filter((g) => isEligible(g, now));

  return NextResponse.json({
    date,
    stats: {
      postedToday,
      queuedToday,
      pendingApproval,
      rejected,
      leadsToday: leadsOn(date),
      leadsTotal,
      totalGroups: groups.length,
      activeGroups: groups.filter((g) => g.status === 'active').length,
      readyCount: readyGroups.length,
      postedLast14,
      activeDays14,
    },
    yesterday: {
      date: yesterday,
      posted: yQueue.filter((q) => q.status === 'posted').length,
      queued: yQueue.filter((q) => q.status === 'queued').length,
      leads: leadsOn(yesterday),
      demoRequests: demoOn(yesterday),
    },
    last14,
    bestGroups,
    readyGroups: readyGroups.slice(0, 12),
  });
}
