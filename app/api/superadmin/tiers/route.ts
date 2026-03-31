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
    .from('sokh_tiers')
    .select('*')
    .order('sort_order');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const auth = await requireSuperadmin();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { name, code, per_unit_fee, description, sort_order } = body;

  if (!name || !code) {
    return NextResponse.json({ error: 'Нэр болон код шаардлагатай' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('sokh_tiers')
    .insert({ name, code, per_unit_fee: per_unit_fee || 0, description, sort_order: sort_order || 0 })
    .select()
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
    .from('sokh_tiers')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSuperadmin();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID шаардлагатай' }, { status: 400 });

  // Холбогдсон СӨХ байвал устгахгүй
  const { count } = await supabaseAdmin
    .from('sokh_organizations')
    .select('id', { count: 'exact', head: true })
    .eq('tier_id', id);

  if (count && count > 0) {
    return NextResponse.json({ error: `${count} СӨХ энэ зэрэглэлд холбогдсон байна` }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('sokh_tiers').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
