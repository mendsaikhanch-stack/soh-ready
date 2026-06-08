import { NextResponse } from 'next/server';
import { checkAnyAuth } from '@/app/lib/session-token';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { isEligible } from '@/app/lib/marketing/selection';
import type { FbGroup } from '@/app/lib/marketing/constants';

function todayStr(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ulaanbaatar',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

// GET /api/admin/marketing/dashboard
export async function GET() {
  const a = await checkAnyAuth('admin', 'superadmin');
  if (!a.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const date = todayStr();
  const now = new Date();

  const [groupsRes, queueRes, leadsRes] = await Promise.all([
    supabaseAdmin.from('marketing_fb_groups').select('*'),
    supabaseAdmin.from('marketing_queue_items').select('status, queue_date').eq('queue_date', date),
    supabaseAdmin.from('marketing_leads').select('id, created_at'),
  ]);

  if (groupsRes.error || queueRes.error || leadsRes.error) {
    console.error('[marketing/dashboard]', groupsRes.error?.message || queueRes.error?.message || leadsRes.error?.message);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }

  const groups = (groupsRes.data || []) as FbGroup[];
  const todayQueue = queueRes.data || [];
  const leads = leadsRes.data || [];

  const postedToday = todayQueue.filter((q) => q.status === 'posted').length;
  const pendingApproval = todayQueue.filter((q) => q.status === 'pending_approval').length;
  const rejected = todayQueue.filter((q) => q.status === 'rejected').length;
  const leadsToday = todayQueue.filter((q) => q.status === 'lead').length;

  const leadsTotal = leads.length;
  const leadsTodayTotal = leads.filter((l) => String(l.created_at).slice(0, 10) === date).length;

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
      pendingApproval,
      rejected,
      leadsToday: leadsTodayTotal || leadsToday,
      leadsTotal,
      totalGroups: groups.length,
      activeGroups: groups.filter((g) => g.status === 'active').length,
      readyCount: readyGroups.length,
    },
    bestGroups,
    readyGroups: readyGroups.slice(0, 12),
  });
}
