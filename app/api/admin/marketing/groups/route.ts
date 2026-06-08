import { NextRequest, NextResponse } from 'next/server';
import { checkAnyAuth } from '@/app/lib/session-token';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import type { GroupType, GroupPriority, GroupStatus } from '@/app/lib/marketing/constants';

const TYPES: GroupType[] = ['hoa_mgmt', 'resident', 'apartment', 'general'];
const PRIOS: GroupPriority[] = ['A', 'B', 'C'];
const STATUSES: GroupStatus[] = ['active', 'paused', 'banned'];

const URL_RE = /(https?:\/\/[^\s|,]+)/i;

async function auth() {
  return checkAnyAuth('superadmin');
}

// GET /api/admin/marketing/groups — бүх группүүд
export async function GET() {
  const a = await auth();
  if (!a.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('marketing_fb_groups')
    .select('*')
    .order('priority', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[marketing/groups] GET', error.message);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }
  return NextResponse.json({ data: data || [] });
}

// POST /api/admin/marketing/groups
//   { mode: 'single', name, url, group_type, priority, status, member_count?, notes? }
//   { mode: 'bulk', text, group_type?, priority? }   ← мөр бүрд нэг групп
export async function POST(req: NextRequest) {
  const a = await auth();
  if (!a.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const mode = body.mode === 'bulk' ? 'bulk' : 'single';

  if (mode === 'bulk') {
    const text = String(body.text || '');
    const defType = TYPES.includes(body.group_type as GroupType) ? (body.group_type as GroupType) : 'general';
    const defPrio = PRIOS.includes(body.priority as GroupPriority) ? (body.priority as GroupPriority) : 'B';

    const rows: { name: string; url: string; group_type: GroupType; priority: GroupPriority; status: GroupStatus }[] = [];
    const seen = new Set<string>();
    for (const rawLine of text.split('\n')) {
      const line = rawLine.trim();
      if (!line) continue;
      const m = URL_RE.exec(line);
      if (!m) continue;
      const url = m[1].replace(/[).,]+$/, '');
      if (seen.has(url)) continue;
      seen.add(url);
      // "Нэр | URL" эсвэл "Нэр - URL" хэлбэрийг дэмжих
      let name = line.replace(m[1], '').replace(/[|\-–—\t]+/g, ' ').trim();
      if (!name) {
        // URL-аас нэр гаргах
        const slug = url.split('/').filter(Boolean).pop() || url;
        name = decodeURIComponent(slug).replace(/[-_]+/g, ' ').slice(0, 80);
      }
      rows.push({ name, url, group_type: defType, priority: defPrio, status: 'active' });
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: 'URL агуулсан мөр олдсонгүй' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('marketing_fb_groups')
      .upsert(rows, { onConflict: 'url', ignoreDuplicates: true })
      .select();

    if (error) {
      console.error('[marketing/groups] bulk', error.message);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }
    return NextResponse.json({ data: data || [], inserted: data?.length || 0, parsed: rows.length });
  }

  // single
  const name = String(body.name || '').trim();
  const url = String(body.url || '').trim();
  if (!name || !url) {
    return NextResponse.json({ error: 'Нэр болон URL шаардлагатай' }, { status: 400 });
  }
  const record = {
    name,
    url,
    group_type: TYPES.includes(body.group_type as GroupType) ? body.group_type : 'general',
    priority: PRIOS.includes(body.priority as GroupPriority) ? body.priority : 'B',
    status: STATUSES.includes(body.status as GroupStatus) ? body.status : 'active',
    member_count: body.member_count != null && body.member_count !== '' ? Number(body.member_count) : null,
    notes: body.notes ? String(body.notes) : null,
  };

  const { data, error } = await supabaseAdmin.from('marketing_fb_groups').insert([record]).select().single();
  if (error) {
    console.error('[marketing/groups] insert', error.message);
    const msg = error.message.includes('duplicate') ? 'Энэ URL аль хэдийн нэмэгдсэн байна' : 'DB error';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ data });
}

// PATCH /api/admin/marketing/groups  { id, ...fields }
export async function PATCH(req: NextRequest) {
  const a = await auth();
  if (!a.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const id = Number(body.id);
  if (!id) return NextResponse.json({ error: 'id шаардлагатай' }, { status: 400 });

  const allowed = ['name', 'url', 'group_type', 'priority', 'status', 'member_count', 'notes'];
  const patch: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in body) patch[k] = body[k] === '' ? null : body[k];
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Өөрчлөх талбар алга' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('marketing_fb_groups')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) {
    console.error('[marketing/groups] PATCH', error.message);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }
  return NextResponse.json({ data });
}

// DELETE /api/admin/marketing/groups?id=123
export async function DELETE(req: NextRequest) {
  const a = await auth();
  if (!a.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = Number(new URL(req.url).searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'id шаардлагатай' }, { status: 400 });

  const { error } = await supabaseAdmin.from('marketing_fb_groups').delete().eq('id', id);
  if (error) {
    console.error('[marketing/groups] DELETE', error.message);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
