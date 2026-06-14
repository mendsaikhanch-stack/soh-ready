import { NextRequest, NextResponse } from 'next/server';
import { checkAnyAuth } from '@/app/lib/session-token';
import { supabaseAdmin } from '@/app/lib/supabase-admin';

async function auth() {
  return checkAnyAuth('superadmin');
}

// GET /api/admin/marketing/campaigns
export async function GET() {
  const a = await auth();
  if (!a.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('marketing_campaigns')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[marketing/campaigns] GET', error.message);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }
  return NextResponse.json({ data: data || [] });
}

// POST /api/admin/marketing/campaigns  { title, main_text, link_url? }
export async function POST(req: NextRequest) {
  const a = await auth();
  if (!a.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const main_text = String(body.main_text || '').trim();
  if (!main_text) {
    return NextResponse.json({ error: 'Үндсэн текст шаардлагатай' }, { status: 400 });
  }
  // Гарчиг заавал биш — хоосон бол үндсэн текстийн эхний мөрөөс дотоод нэр гаргана
  let title = String(body.title || '').trim();
  if (!title) {
    title = main_text.split('\n')[0].trim().slice(0, 40) || 'Шинэ кампанит ажил';
  }

  const record = {
    title,
    main_text,
    link_url: body.link_url ? String(body.link_url).trim() : null,
    status: 'active',
  };

  const { data, error } = await supabaseAdmin.from('marketing_campaigns').insert([record]).select().single();
  if (error) {
    console.error('[marketing/campaigns] insert', error.message);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }
  return NextResponse.json({ data });
}

// PATCH /api/admin/marketing/campaigns  { id, title?, main_text?, link_url?, status? }
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

  const allowed = ['title', 'main_text', 'link_url', 'status'];
  const patch: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in body) patch[k] = body[k] === '' ? null : body[k];
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Өөрчлөх талбар алга' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('marketing_campaigns')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) {
    console.error('[marketing/campaigns] PATCH', error.message);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }
  return NextResponse.json({ data });
}

// DELETE /api/admin/marketing/campaigns?id=123
export async function DELETE(req: NextRequest) {
  const a = await auth();
  if (!a.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = Number(new URL(req.url).searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'id шаардлагатай' }, { status: 400 });

  const { error } = await supabaseAdmin.from('marketing_campaigns').delete().eq('id', id);
  if (error) {
    console.error('[marketing/campaigns] DELETE', error.message);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
