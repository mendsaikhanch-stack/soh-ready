import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { checkAnyAuth } from '@/app/lib/session-token';

// ============================================================
// /api/admin/workflows
// ------------------------------------------------------------
// GET   — current SOH-ийн автомат дүрмийн жагсаалт
// POST  — шинэ дүрэм үүсгэх (анх үргэлж draft)
// PATCH — статус солих (?id=... body { status })
// ============================================================

export type TriggerType =
  | 'monthly_date'
  | 'unpaid_after_day'
  | 'issue_overdue'
  | 'manual';

export type ActionType =
  | 'create_reminder_draft'
  | 'create_notification_draft'
  | 'create_report_draft'
  | 'alert_admin'
  | 'create_invoice_batch_draft';

export type RuleStatus = 'draft' | 'active' | 'paused';

export interface AutomationRule {
  id: number;
  sokh_id: number;
  name: string;
  description: string | null;
  trigger_type: TriggerType;
  condition_json: Record<string, unknown>;
  action_type: ActionType;
  action_json: Record<string, unknown>;
  status: RuleStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const TRIGGERS: TriggerType[] = [
  'monthly_date',
  'unpaid_after_day',
  'issue_overdue',
  'manual',
];

const ACTIONS: ActionType[] = [
  'create_reminder_draft',
  'create_notification_draft',
  'create_report_draft',
  'alert_admin',
  'create_invoice_batch_draft',
];

// ============================================================
// GET — list
// ============================================================

export async function GET(req: NextRequest) {
  const auth = await checkAnyAuth('admin', 'superadmin');
  if (!auth.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const sokhParam = url.searchParams.get('sokh_id');

  let q = supabaseAdmin
    .from('automation_rules')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (status) q = q.eq('status', status);

  // Superadmin нь бүх СӨХ-г харж болно (sokh_id query param-аар filter)
  // Энгийн admin нь зөвхөн өөрийн session-ийн sokh_id-аар хязгаарлагдана
  if (auth.role === 'admin' && auth.sokhId) {
    q = q.eq('sokh_id', parseInt(auth.sokhId, 10));
  } else if (sokhParam) {
    const sokhId = parseInt(sokhParam, 10);
    if (Number.isFinite(sokhId)) q = q.eq('sokh_id', sokhId);
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ rules: (data as AutomationRule[]) || [] });
}

// ============================================================
// POST — create (always as draft)
// ============================================================

interface CreateBody {
  sokh_id?: number;
  name: string;
  description?: string;
  trigger_type: TriggerType;
  condition_json?: Record<string, unknown>;
  action_type: ActionType;
  action_json?: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  const auth = await checkAnyAuth('admin', 'superadmin');
  if (!auth.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.name || typeof body.name !== 'string') {
    return NextResponse.json({ error: 'name дутуу' }, { status: 400 });
  }
  if (!TRIGGERS.includes(body.trigger_type)) {
    return NextResponse.json({ error: 'trigger_type буруу' }, { status: 400 });
  }
  if (!ACTIONS.includes(body.action_type)) {
    return NextResponse.json({ error: 'action_type буруу' }, { status: 400 });
  }

  // sokh_id: admin өөрийн sokhId-аас гарна; superadmin body-аас өгч болно
  let sokhId: number | null = null;
  if (auth.role === 'admin') {
    const fromSession = auth.sokhId ? parseInt(auth.sokhId, 10) : 0;
    if (!Number.isFinite(fromSession) || fromSession <= 0) {
      return NextResponse.json(
        { error: 'Админ session-д sokh_id байхгүй' },
        { status: 400 },
      );
    }
    sokhId = fromSession;
  } else if (auth.role === 'superadmin') {
    sokhId = Number.isFinite(body.sokh_id) ? (body.sokh_id as number) : null;
    if (!sokhId) {
      return NextResponse.json(
        { error: 'Superadmin sokh_id заавал заах ёстой' },
        { status: 400 },
      );
    }
  }

  const { data, error } = await supabaseAdmin
    .from('automation_rules')
    .insert({
      sokh_id: sokhId,
      name: body.name,
      description: body.description ?? null,
      trigger_type: body.trigger_type,
      condition_json: body.condition_json ?? {},
      action_type: body.action_type,
      action_json: body.action_json ?? {},
      status: 'draft',
      created_by: auth.userId ?? null,
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ rule: data as AutomationRule });
}

// ============================================================
// PATCH — status солих
// ============================================================

interface PatchBody {
  status?: RuleStatus;
}

export async function PATCH(req: NextRequest) {
  const auth = await checkAnyAuth('admin', 'superadmin');
  if (!auth.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const idStr = url.searchParams.get('id');
  const id = idStr ? parseInt(idStr, 10) : NaN;
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'id заавал шаардлагатай' }, { status: 400 });
  }

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.status || !['draft', 'active', 'paused'].includes(body.status)) {
    return NextResponse.json({ error: 'status буруу' }, { status: 400 });
  }

  let q = supabaseAdmin
    .from('automation_rules')
    .update({ status: body.status })
    .eq('id', id);

  if (auth.role === 'admin' && auth.sokhId) {
    q = q.eq('sokh_id', parseInt(auth.sokhId, 10));
  }

  const { data, error } = await q.select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ rule: data as AutomationRule });
}
