// Admin system health endpoint
// GET — нийт төлвийн агрегат + сүүлийн dead/failed job-ууд
// PATCH — DEAD job-ыг retry болгох

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { checkAuth } from '@/app/lib/session-token';
import { retryDeadJob } from '@/app/lib/jobs/worker';
import { acknowledgeAlert } from '@/app/lib/alerts';

export async function GET() {
  const auth = await checkAuth('superadmin');
  if (!auth.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Параллел тоолуурууд
  const counts = async (status: string) => {
    const { count } = await supabaseAdmin
      .from('system_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', status);
    return count ?? 0;
  };

  const [pending, running, failed, dead, succeeded24h] = await Promise.all([
    counts('PENDING'),
    counts('RUNNING'),
    counts('FAILED'),
    counts('DEAD'),
    (async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count } = await supabaseAdmin
        .from('system_jobs')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'SUCCEEDED')
        .gte('updated_at', since);
      return count ?? 0;
    })(),
  ]);

  // Сүүлийн 20 dead/last-failed
  const { data: deadJobs } = await supabaseAdmin
    .from('system_jobs')
    .select('id, job_type, attempts, max_attempts, last_error, created_at, updated_at, payload, idempotency_key')
    .eq('status', 'DEAD')
    .order('updated_at', { ascending: false })
    .limit(20);

  const { data: pendingRetries } = await supabaseAdmin
    .from('system_jobs')
    .select('id, job_type, attempts, available_at, last_error')
    .eq('status', 'PENDING')
    .gt('attempts', 0)
    .order('available_at', { ascending: true })
    .limit(20);

  // Activation summary mismatch (хэт хэр зөрсөн нь)
  const { data: summaries } = await supabaseAdmin
    .from('hoa_activation_summaries')
    .select('id, directory_id, provisional_hoa_id, interest_count');

  // Нэг query-гээр тоолно (өмнө нь summary бүрд тусдаа count — 200 хүртэл N+1 query)
  // PostgREST нэг хүсэлтэд 1000 мөр буцаадаг тул хуудаслана
  const requestKeys: { directory_id: number | null; provisional_hoa_id: number | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data: page } = await supabaseAdmin
      .from('hoa_activation_requests')
      .select('directory_id, provisional_hoa_id')
      .order('id')
      .range(from, from + 999);
    requestKeys.push(...(page || []));
    if (!page || page.length < 1000) break;
  }
  const realCounts = new Map<string, number>();
  for (const r of requestKeys) {
    if (r.directory_id) {
      const k = `d:${r.directory_id}`;
      realCounts.set(k, (realCounts.get(k) ?? 0) + 1);
    }
    if (r.provisional_hoa_id) {
      const k = `p:${r.provisional_hoa_id}`;
      realCounts.set(k, (realCounts.get(k) ?? 0) + 1);
    }
  }

  let mismatches = 0;
  for (const s of (summaries || []).slice(0, 200)) {
    const key = s.directory_id ? `d:${s.directory_id}` : s.provisional_hoa_id ? `p:${s.provisional_hoa_id}` : null;
    if (!key) continue;
    if ((realCounts.get(key) ?? 0) !== Number(s.interest_count)) mismatches++;
  }

  // Unclaimed memberships
  const { count: unclaimedMemberships } = await supabaseAdmin
    .from('resident_memberships')
    .select('id', { count: 'exact', head: true })
    .is('user_id', null);

  // Pending provisional merges
  const { count: pendingProvisionals } = await supabaseAdmin
    .from('hoa_provisional')
    .select('id', { count: 'exact', head: true })
    .in('status', ['PENDING', 'MATCH_CANDIDATE', 'HAS_DEMAND']);

  // Идэвхтэй (ack хийгдээгүй) алертууд
  const { data: alerts } = await supabaseAdmin
    .from('system_alerts')
    .select('id, severity, source, message, payload, created_at')
    .is('acknowledged_at', null)
    .order('created_at', { ascending: false })
    .limit(50);

  return NextResponse.json({
    jobs: { pending, running, failed, dead, succeeded24h },
    deadJobs: deadJobs || [],
    pendingRetries: pendingRetries || [],
    alerts: alerts || [],
    drift: {
      activationSummaryMismatches: mismatches,
      unclaimedMemberships: unclaimedMemberships ?? 0,
      pendingProvisionals: pendingProvisionals ?? 0,
    },
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await checkAuth('superadmin');
  if (!auth.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null) as { id?: number; action?: string } | null;
  if (!body?.id || !body.action) {
    return NextResponse.json({ error: 'id болон action заавал' }, { status: 400 });
  }

  if (body.action === 'retry') {
    const ok = await retryDeadJob(body.id);
    if (!ok) return NextResponse.json({ error: 'Retry амжилтгүй' }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (body.action === 'ack') {
    const ok = await acknowledgeAlert(body.id, auth.userId ? `superadmin:${auth.userId}` : 'superadmin');
    if (!ok) return NextResponse.json({ error: 'Acknowledge амжилтгүй' }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
