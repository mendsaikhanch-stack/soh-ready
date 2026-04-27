import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { checkAuth } from '@/app/lib/session-token';
import { adminUsersLimiter } from '@/app/lib/rate-limit';

const VALID_STATUS = new Set(['pending', 'contacted', 'contracted', 'declined']);

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown';
  const rl = adminUsersLimiter.check(ip);
  if (!rl.allowed) {
    return NextResponse.json({ error: `Хэт олон хүсэлт. ${rl.retryAfterSec}с хүлээнэ үү` }, { status: 429 });
  }

  const auth = await checkAuth('superadmin');
  if (!auth.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const status = url.searchParams.get('status');

  let q = supabaseAdmin
    .from('sokh_leads')
    .select('*, sokh_organizations(id, name, claim_status), khoroos(name, districts(name))')
    .order('created_at', { ascending: false })
    .limit(500);
  if (status && VALID_STATUS.has(status)) {
    q = q.eq('status', status);
  }

  const { data, error } = await q;
  if (error) {
    console.error('[admin/leads GET]', error.message);
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
  }

  return NextResponse.json({ leads: data || [] });
}

export async function PATCH(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown';
  const rl = adminUsersLimiter.check(ip);
  if (!rl.allowed) {
    return NextResponse.json({ error: `Хэт олон хүсэлт. ${rl.retryAfterSec}с хүлээнэ үү` }, { status: 429 });
  }

  const auth = await checkAuth('superadmin');
  if (!auth.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const adminId = auth.userId ? parseInt(auth.userId, 10) : null;

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Хүсэлт буруу' }, { status: 400 });

  const id = Number(body.id);
  const status = typeof body.status === 'string' ? body.status : '';
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: 'id буруу' }, { status: 400 });
  }
  if (!VALID_STATUS.has(status)) {
    return NextResponse.json({ error: 'status буруу' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('sokh_leads')
    .update({
      status,
      handled_by_admin_id: adminId,
      handled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) {
    console.error('[admin/leads PATCH]', error.message);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
