import { NextRequest, NextResponse } from 'next/server';
import { checkAnyAuth } from '@/app/lib/session-token';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { VALID_STATUSES, VALID_PRIORITIES } from '@/app/lib/demo-requests/constants';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/mng-ctrl/demo-requests/[id] — дэлгэрэнгүй + харилцсан тэмдэглэлүүд
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const a = await checkAnyAuth('superadmin');
  if (!a.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'id буруу' }, { status: 400 });

  const { data: request, error } = await supabaseAdmin
    .from('soh_demo_requests')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !request) return NextResponse.json({ error: 'Хүсэлт олдсонгүй' }, { status: 404 });

  const { data: notes } = await supabaseAdmin
    .from('soh_demo_request_notes')
    .select('*')
    .eq('request_id', id)
    .order('created_at', { ascending: false });

  return NextResponse.json({ data: request, notes: notes || [] });
}

// PATCH /api/mng-ctrl/demo-requests/[id] — CRM талбар засах
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const a = await checkAnyAuth('superadmin');
  if (!a.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'id буруу' }, { status: 400 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Хүсэлт буруу' }, { status: 400 });

  const patch: Record<string, unknown> = {};

  if ('status' in body) {
    if (!VALID_STATUSES.has(String(body.status) as never)) {
      return NextResponse.json({ error: 'Статус буруу' }, { status: 400 });
    }
    patch.status = body.status;
  }
  if ('priority' in body) {
    if (body.priority !== null && !VALID_PRIORITIES.has(String(body.priority) as never)) {
      return NextResponse.json({ error: 'Чухал зэрэг буруу' }, { status: 400 });
    }
    patch.priority = body.priority || null;
  }

  const textFields = ['internal_notes', 'price_note', 'lost_reason', 'assigned_to'];
  for (const f of textFields) {
    if (f in body) patch[f] = body[f] === '' || body[f] == null ? null : String(body[f]).slice(0, 2000);
  }

  const dateFields = ['last_contacted_at', 'next_follow_up_at'];
  for (const f of dateFields) {
    if (f in body) {
      const v = body[f];
      if (v === '' || v == null) {
        patch[f] = null;
      } else {
        const d = new Date(String(v));
        if (isNaN(d.getTime())) return NextResponse.json({ error: `${f} огноо буруу` }, { status: 400 });
        patch[f] = d.toISOString();
      }
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Өөрчлөх талбар алга' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('soh_demo_requests')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) {
    console.error('[mng-ctrl/demo-requests] PATCH', error.message);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }
  return NextResponse.json({ data });
}
