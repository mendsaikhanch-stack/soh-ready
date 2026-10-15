// Даргын тал — бүх гишүүдийн хурлын жагсаалт, шинэ хурал (ноорог) үүсгэх.
//
// sokh_id-г клиентээс АВАХГҮЙ, зөвхөн сешнээс. Хүснэгтүүд RLS-ээр хаалттай,
// зөвхөн энэ маршрут service role-оор хандана.

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

export async function GET() {
  const ctx = await requireMeetingAdmin();
  if (ctx instanceof NextResponse) return ctx;

  const { data, error } = await supabaseAdmin
    .from('meetings')
    .select('id, kind, title, scheduled_at, location, status, created_at, meeting_agenda_items(count), meeting_eligible_units(count)')
    .eq('sokh_id', ctx.sokhId)
    .order('scheduled_at', { ascending: false });

  if (error) {
    if (isMissingSchema(error)) return NextResponse.json({ migrated: false, meetings: [] });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const meetings = (data || []).map((m) => {
    const agenda = m.meeting_agenda_items as unknown as { count: number }[] | null;
    const units = m.meeting_eligible_units as unknown as { count: number }[] | null;
    return {
      id: m.id,
      kind: m.kind,
      title: m.title,
      scheduled_at: m.scheduled_at,
      location: m.location,
      status: m.status,
      created_at: m.created_at,
      agenda_count: agenda?.[0]?.count ?? 0,
      unit_count: units?.[0]?.count ?? 0,
    };
  });

  return NextResponse.json({ migrated: true, meetings });
}

export async function POST(req: NextRequest) {
  const ctx = await requireMeetingAdmin();
  if (ctx instanceof NextResponse) return ctx;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = parseMeetingInput(body);
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const agenda = parseAgenda(body.agenda);
  if (agenda.error) return NextResponse.json({ error: agenda.error }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('meetings')
    .insert({
      ...parsed.value,
      sokh_id: ctx.sokhId,
      convened_by_admin_id: ctx.adminId,
      status: 'draft',
    })
    .select('id')
    .single();

  if (error) {
    if (isMissingSchema(error)) return notMigrated();
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (agenda.value?.length) {
    const aErr = await replaceAgenda(data.id, ctx.sokhId, agenda.value);
    if (aErr) return NextResponse.json({ error: aErr.message, id: data.id }, { status: 500 });
  }

  await logMeetingEvent(req, ctx, data.id, 'meeting.created', {
    title: parsed.value!.title,
    scheduled_at: parsed.value!.scheduled_at,
    agenda_count: agenda.value?.length ?? 0,
  });

  return NextResponse.json({ id: data.id });
}
