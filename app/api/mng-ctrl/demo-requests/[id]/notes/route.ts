import { NextRequest, NextResponse } from 'next/server';
import { checkAnyAuth } from '@/app/lib/session-token';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { VALID_CONTACT_METHODS } from '@/app/lib/demo-requests/constants';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/mng-ctrl/demo-requests/[id]/notes — харилцсан тэмдэглэл нэмэх
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const a = await checkAnyAuth('superadmin');
  if (!a.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'id буруу' }, { status: 400 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Хүсэлт буруу' }, { status: 400 });

  const note = typeof body.note === 'string' ? body.note.trim() : '';
  if (note.length < 1) return NextResponse.json({ error: 'Тэмдэглэл хоосон байна' }, { status: 400 });
  if (note.length > 4000) return NextResponse.json({ error: 'Тэмдэглэл хэт урт' }, { status: 400 });

  const cm = typeof body.contact_method === 'string' ? body.contact_method : '';
  const contact_method = VALID_CONTACT_METHODS.has(cm as never) ? cm : null;

  // Хүсэлт байгаа эсэхийг шалгана
  const { data: parent } = await supabaseAdmin
    .from('soh_demo_requests')
    .select('id')
    .eq('id', id)
    .maybeSingle();
  if (!parent) return NextResponse.json({ error: 'Хүсэлт олдсонгүй' }, { status: 404 });

  const { data, error } = await supabaseAdmin
    .from('soh_demo_request_notes')
    .insert([{ request_id: id, note, contact_method, created_by: a.userId || 'superadmin' }])
    .select()
    .single();
  if (error) {
    console.error('[mng-ctrl/demo-requests notes] POST', error.message);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }

  // Тэмдэглэл нэмэхэд last_contacted_at-г шинэчилнэ (тухайн агшинд)
  await supabaseAdmin
    .from('soh_demo_requests')
    .update({ last_contacted_at: new Date().toISOString() })
    .eq('id', id);

  return NextResponse.json({ data });
}
