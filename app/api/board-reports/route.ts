import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { boardReportMemberLimiter } from '@/app/lib/rate-limit';
import { resolveCouncil } from '@/app/lib/council';
import { listReportsWithFiles } from '@/app/lib/board-reports';

// /api/board-reports — оршин суугчийн апп.
// Зөвхөн дарга оршин суугчдын жагсаалтаас ТУЗ / Хяналт гэж тэмдэглэсэн
// оршин суугч харна (app/lib/council.ts). Бусдад { member:false } л буцна.

function rateLimited(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rl = boardReportMemberLimiter.check(ip);
  return rl.allowed ? null : NextResponse.json({ error: `Хэт олон хүсэлт. ${rl.retryAfterSec}с хүлээнэ үү` }, { status: 429 });
}

// GET ?sokhId=1            → { member, council, reports[] (signed URL-тэй, read флагтай) }
// GET ?sokhId=1&summary=1  → { member, unread }  (нүүр хуудсанд)
export async function GET(req: NextRequest) {
  const limited = rateLimited(req);
  if (limited) return limited;

  const sokhId = parseInt(req.nextUrl.searchParams.get('sokhId') || '', 10);
  if (!sokhId) return NextResponse.json({ error: 'sokhId шаардлагатай' }, { status: 400 });

  try {
    const member = await resolveCouncil(req, sokhId);
    if (member === 'unauth') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!member) return NextResponse.json({ member: false });

    if (req.nextUrl.searchParams.get('summary')) {
      const { data: reports } = await supabaseAdmin
        .from('board_reports').select('id').eq('sokh_id', sokhId).order('created_at', { ascending: false }).limit(50);
      const ids = (reports || []).map((r) => r.id as number);
      let unread = 0;
      if (ids.length > 0) {
        const { data: reads } = await supabaseAdmin
          .from('board_report_reads').select('report_id').eq('resident_id', member.residentId).in('report_id', ids);
        unread = ids.length - (reads || []).length;
      }
      return NextResponse.json({ member: true, council: member.council, unread });
    }

    const reports = await listReportsWithFiles(sokhId);
    const ids = reports.map((r) => r.id);
    const readSet = new Set<number>();
    if (ids.length > 0) {
      const { data: reads } = await supabaseAdmin
        .from('board_report_reads').select('report_id').eq('resident_id', member.residentId).in('report_id', ids);
      for (const r of reads || []) readSet.add(r.report_id as number);
    }
    return NextResponse.json({
      member: true,
      council: member.council,
      name: member.name,
      reports: reports.map((r) => ({ ...r, read: readSet.has(r.id) })),
    });
  } catch (err) {
    // board_members/board_reports хүснэгт үүсээгүй үед — гишүүн биш гэж үзнэ
    console.error('[board-reports] member GET', err instanceof Error ? err.message : err);
    return NextResponse.json({ member: false });
  }
}

// POST { sokhId, reportIds: number[] } → уншсанд тэмдэглэх
export async function POST(req: NextRequest) {
  const limited = rateLimited(req);
  if (limited) return limited;
  try {
    const body = await req.json();
    const sokhId = parseInt(String(body.sokhId), 10);
    const reportIds = (Array.isArray(body.reportIds) ? body.reportIds : [])
      .map((x: unknown) => parseInt(String(x), 10))
      .filter((x: number) => x > 0)
      .slice(0, 100) as number[];
    if (!sokhId || reportIds.length === 0) return NextResponse.json({ ok: true });

    const member = await resolveCouncil(req, sokhId);
    if (member === 'unauth') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!member) return NextResponse.json({ error: 'Хандах эрхгүй' }, { status: 403 });

    // Зөвхөн энэ СӨХ-ийн тайлан
    const { data: own } = await supabaseAdmin
      .from('board_reports').select('id').eq('sokh_id', sokhId).in('id', reportIds);
    const rows = (own || []).map((r) => ({ report_id: r.id, resident_id: member.residentId }));
    if (rows.length > 0) {
      await supabaseAdmin.from('board_report_reads').upsert(rows, { onConflict: 'report_id,resident_id', ignoreDuplicates: true });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[board-reports] member POST', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Серверийн алдаа' }, { status: 500 });
  }
}
