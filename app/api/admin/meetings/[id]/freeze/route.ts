// Хурал зарлах — дүрэм, огноо, хэлэлцэх асуудлыг хөлдөөж, санал өгөх эрхтэй
// сууцны жагсаалтыг оршин суугчийн бүртгэлээс хуулбарлана.
//
// Бүх ажил DB-ийн meeting_freeze() функцэд НЭГ транзакцаар явна: хагас
// хөлдсөн төлөв үүсэхгүй, хоёр удаа дарахад давхардахгүй.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { requireMeetingAdmin, isMissingSchema, notMigrated } from '@/app/lib/meetings/server';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireMeetingAdmin();
  if (ctx instanceof NextResponse) return ctx;
  const id = Number((await params).id);
  if (!id) return NextResponse.json({ error: 'Буруу хүсэлт' }, { status: 400 });

  const { data, error } = await supabaseAdmin.rpc('meeting_freeze', {
    p_meeting_id: id,
    p_sokh_id: ctx.sokhId,
    p_admin_id: ctx.adminId,
  });

  if (error) {
    if (isMissingSchema(error)) return notMigrated();
    // RAISE EXCEPTION-ий монгол тайлбарыг шууд харуулна (P0002 = олдсонгүй, 23514 = нөхцөл биелээгүй)
    const status = error.code === 'P0002' ? 404 : error.code === '23514' ? 409 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  // meeting_events-д функц өөрөө бичсэн
  return NextResponse.json({ ok: true, summary: data });
}
