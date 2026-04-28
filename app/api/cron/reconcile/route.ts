// Cron: бүх reconciliation тогтмол ажиллуулна
// GET /api/cron/reconcile?key=SECRET&kind=<claims|activation|merges|all>
// Default kind=all

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { reconcileAllUnclaimedMemberships } from '@/app/lib/directory/reconcile-claims';
import { reconcileAllActivationSummaries } from '@/app/lib/directory/reconcile-activation';
import { reconcileOrphanMerges } from '@/app/lib/directory/reconcile-merges';
import { autoMergeProvisionals } from '@/app/lib/directory/merge-provisional';
import { enqueueRepair } from '@/app/lib/jobs/dispatch';

export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }
  const key = request.nextUrl.searchParams.get('key') || request.headers.get('authorization')?.replace('Bearer ', '');
  if (key !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const kind = request.nextUrl.searchParams.get('kind') || 'all';
  const out: Record<string, unknown> = { ts: new Date().toISOString() };

  if (kind === 'claims' || kind === 'all') {
    out.claims = await reconcileAllUnclaimedMemberships({ limit: 200 });
  }
  if (kind === 'activation' || kind === 'all') {
    out.activation = await reconcileAllActivationSummaries({ limit: 500 });
  }
  if (kind === 'merges' || kind === 'all') {
    out.merges = await reconcileOrphanMerges({ limit: 100 });
  }
  if (kind === 'auto-merge' || kind === 'all') {
    out.autoMerge = await autoMergeProvisionals({ limit: 50, mergedBy: 'cron:reconcile' });
  }

  if (kind === 'notifications' || kind === 'all') {
    // Failed notif байгаа бүх sokh-д retry job нэгийг enqueue (idempotency-той)
    const { data: stuck } = await supabaseAdmin
      .from('scheduled_notifications')
      .select('sokh_id')
      .eq('status', 'failed');
    const sokhIds = Array.from(new Set((stuck || []).map(r => r.sokh_id as number)));
    const minute = Math.floor(Date.now() / 60_000);
    let enqueued = 0;
    for (const sokhId of sokhIds) {
      await enqueueRepair('retry_notification_delivery', { sokhId }, {
        idempotencyKey: `notif-retry:${sokhId}:${minute}`,
      });
      enqueued++;
    }
    out.notifications = { failedSokhs: sokhIds.length, enqueued };
  }

  return NextResponse.json({ ok: true, kind, ...out });
}
