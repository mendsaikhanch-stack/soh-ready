import { NextRequest, NextResponse } from 'next/server';
import { checkAnyAuth } from '@/app/lib/session-token';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import type { LeadStatus } from '@/app/lib/marketing/constants';

const LEAD_STATUSES: LeadStatus[] = ['new', 'contacted', 'converted', 'lost'];

async function auth() {
  return checkAnyAuth('superadmin');
}

// GET /api/admin/marketing/leads
export async function GET() {
  const a = await auth();
  if (!a.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('marketing_leads')
    .select('*, group:marketing_fb_groups(*)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[marketing/leads] GET', error.message);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }
  return NextResponse.json({ data: data || [] });
}

// POST /api/admin/marketing/leads
//   { group_id?, campaign_id?, queue_item_id?, name?, contact?, note? }
export async function POST(req: NextRequest) {
  const a = await auth();
  if (!a.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const groupId = body.group_id != null ? Number(body.group_id) : null;
  const campaignId = body.campaign_id != null ? Number(body.campaign_id) : null;
  const queueItemId = body.queue_item_id != null ? Number(body.queue_item_id) : null;

  const record = {
    group_id: groupId,
    campaign_id: campaignId,
    queue_item_id: queueItemId,
    name: body.name ? String(body.name) : null,
    contact: body.contact ? String(body.contact) : null,
    note: body.note ? String(body.note) : null,
    status: 'new',
  };

  const { data, error } = await supabaseAdmin.from('marketing_leads').insert([record]).select().single();
  if (error) {
    console.error('[marketing/leads] insert', error.message);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }

  // Группийн лидийн тоолуур нэмэх
  if (groupId) {
    const { data: g } = await supabaseAdmin
      .from('marketing_fb_groups')
      .select('leads_count')
      .eq('id', groupId)
      .single();
    await supabaseAdmin
      .from('marketing_fb_groups')
      .update({ leads_count: (g?.leads_count || 0) + 1 })
      .eq('id', groupId);
  }

  // Queue item-ийг "лид ирсэн" болгох
  if (queueItemId) {
    await supabaseAdmin.from('marketing_queue_items').update({ status: 'lead' }).eq('id', queueItemId);
  }

  return NextResponse.json({ data });
}

// PATCH /api/admin/marketing/leads  { id, status?, name?, contact?, note?, follow_up_message? }
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

  const patch: Record<string, unknown> = {};
  if ('status' in body && LEAD_STATUSES.includes(body.status as LeadStatus)) patch.status = body.status;
  for (const k of ['name', 'contact', 'note', 'follow_up_message']) {
    if (k in body) patch[k] = body[k] === '' ? null : body[k];
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Өөрчлөх талбар алга' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('marketing_leads')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) {
    console.error('[marketing/leads] PATCH', error.message);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }
  return NextResponse.json({ data });
}

// DELETE /api/admin/marketing/leads?id=123
export async function DELETE(req: NextRequest) {
  const a = await auth();
  if (!a.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = Number(new URL(req.url).searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'id шаардлагатай' }, { status: 400 });

  const { error } = await supabaseAdmin.from('marketing_leads').delete().eq('id', id);
  if (error) {
    console.error('[marketing/leads] DELETE', error.message);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
