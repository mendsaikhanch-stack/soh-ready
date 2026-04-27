// Cron: бүх reconciliation тогтмол ажиллуулна
// GET /api/cron/reconcile?key=SECRET&kind=<claims|activation|merges|all>
// Default kind=all

import { NextRequest, NextResponse } from 'next/server';
import { reconcileAllUnclaimedMemberships } from '@/app/lib/directory/reconcile-claims';
import { reconcileAllActivationSummaries } from '@/app/lib/directory/reconcile-activation';
import { reconcileOrphanMerges } from '@/app/lib/directory/reconcile-merges';
import { autoMergeProvisionals } from '@/app/lib/directory/merge-provisional';

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

  return NextResponse.json({ ok: true, kind, ...out });
}
