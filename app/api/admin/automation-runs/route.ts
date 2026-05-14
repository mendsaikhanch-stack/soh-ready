import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { checkAnyAuth } from '@/app/lib/session-token';

// ============================================================
// /api/admin/automation-runs
// ------------------------------------------------------------
// GET   — review queue listing (filter by reviewed_status / rule_id)
// PATCH — reviewed_status солих (?id=...)
// ============================================================

export type ReviewedStatus =
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'sent_manually';

export type RunStatus = 'pending' | 'success' | 'failed' | 'skipped';

export interface AutomationRunRow {
  id: number;
  rule_id: number;
  sokh_id: number;
  status: RunStatus;
  input_json: Record<string, unknown> | null;
  output_json: Record<string, unknown> | null;
  error_message: string | null;
  idempotency_key: string | null;
  reviewed_status: ReviewedStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  // joined
  rule?: {
    id: number;
    name: string;
    trigger_type: string;
    action_type: string;
  };
}

const ALLOWED_STATUS: ReviewedStatus[] = [
  'pending_review',
  'approved',
  'rejected',
  'sent_manually',
];

// ============================================================
// GET — list
// ============================================================

export async function GET(req: NextRequest) {
  const auth = await checkAnyAuth('admin', 'superadmin');
  if (!auth.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const reviewedStatus = url.searchParams.get('reviewed_status');
  const runStatus = url.searchParams.get('status');
  const ruleIdParam = url.searchParams.get('rule_id');
  const limitParam = url.searchParams.get('limit');
  const limit = Math.min(200, Math.max(1, Number(limitParam) || 50));

  let q = supabaseAdmin
    .from('automation_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (reviewedStatus) q = q.eq('reviewed_status', reviewedStatus);
  if (runStatus) q = q.eq('status', runStatus);
  if (ruleIdParam) {
    const rid = parseInt(ruleIdParam, 10);
    if (Number.isFinite(rid)) q = q.eq('rule_id', rid);
  }

  if (auth.role === 'admin' && auth.sokhId) {
    q = q.eq('sokh_id', parseInt(auth.sokhId, 10));
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const runs = (data || []) as AutomationRunRow[];

  // Rule-ийн нэрийг хамт татна
  const ruleIds = Array.from(new Set(runs.map((r) => r.rule_id))).filter(Boolean);
  if (ruleIds.length > 0) {
    const { data: rules } = await supabaseAdmin
      .from('automation_rules')
      .select('id, name, trigger_type, action_type')
      .in('id', ruleIds);
    const ruleMap = new Map(((rules || []) as AutomationRunRow['rule'][]).map((r) => [r!.id, r!]));
    for (const run of runs) {
      const rule = ruleMap.get(run.rule_id);
      if (rule) run.rule = rule;
    }
  }

  return NextResponse.json({ runs });
}

// ============================================================
// PATCH — review status update
// ============================================================

interface PatchBody {
  reviewed_status?: ReviewedStatus;
}

export async function PATCH(req: NextRequest) {
  const auth = await checkAnyAuth('admin', 'superadmin');
  if (!auth.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const idStr = url.searchParams.get('id');
  const id = idStr ? parseInt(idStr, 10) : NaN;
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'id шаардлагатай' }, { status: 400 });
  }

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.reviewed_status || !ALLOWED_STATUS.includes(body.reviewed_status)) {
    return NextResponse.json({ error: 'reviewed_status буруу' }, { status: 400 });
  }

  let q = supabaseAdmin
    .from('automation_runs')
    .update({
      reviewed_status: body.reviewed_status,
      reviewed_by: auth.userId ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (auth.role === 'admin' && auth.sokhId) {
    q = q.eq('sokh_id', parseInt(auth.sokhId, 10));
  }

  const { data, error } = await q.select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ run: data as AutomationRunRow });
}
