import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { getAuthRole } from '@/app/lib/session-token';

async function requireSuperadmin() {
  const auth = await getAuthRole();
  if (!auth || auth.role !== 'superadmin') return null;
  return auth;
}

export async function GET() {
  const auth = await requireSuperadmin();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('sokh_subscriptions')
    .select('*, platform_plans(*), sokh_organizations(name)')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const formatted = (data || []).map((s: Record<string, unknown>) => ({
    ...s,
    plan: s.platform_plans,
    sokh_name: (s.sokh_organizations as Record<string, unknown>)?.name,
    platform_plans: undefined,
    sokh_organizations: undefined,
  }));

  return NextResponse.json(formatted);
}

export async function POST(req: NextRequest) {
  const auth = await requireSuperadmin();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { sokh_id, plan_id, status, trial_ends_at, custom_pricing, notes } = body;

  if (!sokh_id || !plan_id) {
    return NextResponse.json({ error: 'СӨХ болон багц сонгоно уу' }, { status: 400 });
  }

  // Одоо байгаа идэвхтэй захиалгыг цуцлах
  await supabaseAdmin
    .from('sokh_subscriptions')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('sokh_id', sokh_id)
    .in('status', ['active', 'trial']);

  const { data, error } = await supabaseAdmin
    .from('sokh_subscriptions')
    .insert({
      sokh_id,
      plan_id,
      status: status || 'active',
      trial_ends_at: trial_ends_at || null,
      custom_pricing: custom_pricing || {},
      notes: notes || null,
    })
    .select('*, platform_plans(*)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest) {
  const auth = await requireSuperadmin();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: 'ID шаардлагатай' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('sokh_subscriptions')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
