// Даргын тал — нэг хурлын дэлгэрэнгүй, ноорог засах, цуцлах, ноорог устгах.
//
// Хурал зарлагдсаны (хөлдсөний) дараа дүрэм, огноо, хэлэлцэх асуудлыг DB-ийн
// trigger өөрөө хориглодог. Энд мөн урьдчилан шалгаж ойлгомжтой алдаа өгнө.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import {
  requireMeetingAdmin,
  isMissingSchema,
  notMigrated,
  logMeetingEvent,
  parseMeetingInput,
  parseAgenda,
  replaceAgenda,
} from '@/app/lib/meetings/server';

type Ctx = { params: Promise<{ id: string }> };

async function loadMeeting(id: number, sokhId: number) {
  return supabaseAdmin.from('meetings').select('*').eq('id', id).eq('sokh_id', sokhId).maybeSingle();
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const ctx = await requireMeetingAdmin();
  if (ctx instanceof NextResponse) return ctx;
  const id = Number((await params).id);
  if (!id) return NextResponse.json({ error: 'Буруу хүсэлт' }, { status: 400 });

  const { data: meeting, error } = await loadMeeting(id, ctx.sokhId);
  if (error) {
    if (isMissingSchema(error)) return notMigrated();
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!meeting) return NextResponse.json({ error: 'Хурал олдсонгүй' }, { status: 404 });

  const [agenda, events] = await Promise.all([
    supabaseAdmin
      .from('meeting_agenda_items')
      .select('*')
      .eq('meeting_id', id)
      .eq('sokh_id', ctx.sokhId)
      .order('position'),
    supabaseAdmin
      .from('meeting_events')
      .select('id, actor_type, action, payload, created_at')
      .eq('meeting_id', id)
      .eq('sokh_id', ctx.sokhId)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  // Хөлдөөсөн сууцны жагсаалт — 1000 мөрийн хязгаараас давж уншина
  const units: Record<string, unknown>[] = [];
  if (meeting.status !== 'draft') {
    for (let from = 0; ; from += 1000) {
      const { data, error: uErr } = await supabaseAdmin
        .from('meeting_eligible_units')
        .select('id, building, apartment, owner_name, phone_snapshot, area_sqm_snapshot, weight, owner_confirmed, owner_count')
        .eq('meeting_id', id)
        .eq('sokh_id', ctx.sokhId)
        .order('unit_key')
        .range(from, from + 999);
      if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });
      units.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
  }

  return NextResponse.json({
    meeting,
    agenda: agenda.data || [],
    units,
    events: events.data || [],
  });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const ctx = await requireMeetingAdmin();
  if (ctx instanceof NextResponse) return ctx;
  const id = Number((await params).id);
  if (!id) return NextResponse.json({ error: 'Буруу хүсэлт' }, { status: 400 });

  const { data: meeting, error } = await loadMeeting(id, ctx.sokhId);
  if (error) {
    if (isMissingSchema(error)) return notMigrated();
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!meeting) return NextResponse.json({ error: 'Хурал олдсонгүй' }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  // ===== Цуцлах =====
  if (body.action === 'cancel') {
    if (meeting.status === 'cancelled' || meeting.status === 'archived' || meeting.status === 'closed') {
      return NextResponse.json({ error: 'Энэ хурлыг цуцлах боломжгүй' }, { status: 409 });
    }
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : '';
    if (meeting.status !== 'draft' && !reason) {
      return NextResponse.json({ error: 'Зарласан хурлыг цуцлах шалтгааныг бичнэ үү' }, { status: 400 });
    }
    const { error: uErr } = await supabaseAdmin
      .from('meetings')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancel_reason: reason || null })
      .eq('id', id)
      .eq('sokh_id', ctx.sokhId);
    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });
    await logMeetingEvent(req, ctx, id, 'meeting.cancelled', { from_status: meeting.status, reason });
    return NextResponse.json({ ok: true });
  }

  // ===== Ноорог засах =====
  if (meeting.status !== 'draft') {
    return NextResponse.json({ error: 'Хурал зарлагдсан тул засах боломжгүй' }, { status: 409 });
  }

  const parsed = parseMeetingInput(body);
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const agenda = parseAgenda(body.agenda);
  if (agenda.error) return NextResponse.json({ error: agenda.error }, { status: 400 });

  const { error: uErr } = await supabaseAdmin
    .from('meetings')
    .update(parsed.value!)
    .eq('id', id)
    .eq('sokh_id', ctx.sokhId)
    .eq('status', 'draft');
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });

  if (agenda.value) {
    const aErr = await replaceAgenda(id, ctx.sokhId, agenda.value);
    if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });
  }

  await logMeetingEvent(req, ctx, id, 'meeting.updated', {
    title: parsed.value!.title,
    scheduled_at: parsed.value!.scheduled_at,
    agenda_count: agenda.value?.length,
  });
  return NextResponse.json({ ok: true });
}

// Зөвхөн ноорог устгана. Зарласан хурлыг DB trigger ч хамгаална — цуцлана.
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const ctx = await requireMeetingAdmin();
  if (ctx instanceof NextResponse) return ctx;
  const id = Number((await params).id);
  if (!id) return NextResponse.json({ error: 'Буруу хүсэлт' }, { status: 400 });

  const { data: meeting, error } = await loadMeeting(id, ctx.sokhId);
  if (error) {
    if (isMissingSchema(error)) return notMigrated();
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!meeting) return NextResponse.json({ error: 'Хурал олдсонгүй' }, { status: 404 });
  if (meeting.status !== 'draft') {
    return NextResponse.json({ error: 'Зарласан хурлыг устгах боломжгүй — цуцлана уу' }, { status: 409 });
  }

  const { error: dErr } = await supabaseAdmin
    .from('meetings')
    .delete()
    .eq('id', id)
    .eq('sokh_id', ctx.sokhId)
    .eq('status', 'draft');
  if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 });

  await logMeetingEvent(req, ctx, id, 'meeting.draft_deleted', { title: meeting.title });
  return NextResponse.json({ ok: true });
}
