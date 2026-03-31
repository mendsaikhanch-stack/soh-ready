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
    .from('platform_bank_accounts')
    .select('*')
    .eq('is_active', true)
    .order('is_primary', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const auth = await requireSuperadmin();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { bank_name, account_number, account_holder, is_primary, notes } = body;

  if (!bank_name || !account_number || !account_holder) {
    return NextResponse.json({ error: 'Банкны нэр, дансны дугаар, эзэмшигч шаардлагатай' }, { status: 400 });
  }

  // Хэрэв primary тохируулж байвал бусдыг унтраах
  if (is_primary) {
    await supabaseAdmin
      .from('platform_bank_accounts')
      .update({ is_primary: false })
      .eq('is_primary', true);
  }

  const { data, error } = await supabaseAdmin
    .from('platform_bank_accounts')
    .insert({ bank_name, account_number, account_holder, is_primary: is_primary || false, notes })
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

  if (updates.is_primary) {
    await supabaseAdmin
      .from('platform_bank_accounts')
      .update({ is_primary: false })
      .eq('is_primary', true);
  }

  const { data, error } = await supabaseAdmin
    .from('platform_bank_accounts')
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

  const { error } = await supabaseAdmin
    .from('platform_bank_accounts')
    .update({ is_active: false })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
