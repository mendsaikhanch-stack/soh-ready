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
    .from('ebarimt_configs')
    .select('*, sokh_organizations(name)')
    .order('entity_type');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const formatted = (data || []).map((c: Record<string, unknown>) => ({
    ...c,
    entity_name: (c.sokh_organizations as Record<string, unknown>)?.name || null,
    sokh_organizations: undefined,
    // client_secret маскалах
    client_secret: c.client_secret ? '••••••••' : '',
  }));

  return NextResponse.json(formatted);
}

export async function POST(req: NextRequest) {
  const auth = await requireSuperadmin();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { entity_type, entity_id, merchant_tin, pos_no, branch_id, client_id, client_secret, auth_url, api_url } = body;

  if (!entity_type || !merchant_tin || !client_id || !client_secret) {
    return NextResponse.json({ error: 'Төрөл, ТТД, client_id, client_secret шаардлагатай' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('ebarimt_configs')
    .upsert({
      entity_type,
      entity_id: entity_id || null,
      merchant_tin,
      pos_no: pos_no || '',
      branch_id: branch_id || '',
      client_id,
      client_secret,
      auth_url: auth_url || 'https://auth.itc.gov.mn/auth/realms/Production/protocol/openid-connect/token',
      api_url: api_url || 'https://api.ebarimt.mn',
      is_active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'entity_type,entity_id' })
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
    .from('ebarimt_configs')
    .update({ is_active: false })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
