// Cron: өглөө бүр (09:00 Улаанбаатар) өдрийн постын дараалал автоматаар үүсгэнэ.
//
// Яагаад: постлохгүй байгаагийн гол шалтгаан нь «нээх → кампанит ажил сонгох →
// товч дарах» гэсэн 3 алхам. Өглөө нээхэд дараалал бэлэн байвал зөвхөн
// хуулж тавих ажил үлдэнэ.
//
// Vercel cron (Authorization: Bearer CRON_SECRET) эсвэл GET ?key=SECRET

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { generateDailyQueue, ubDateStr } from '@/app/lib/marketing/generate';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[cron/marketing-daily] CRON_SECRET тохируулаагүй байна');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }
  const key =
    request.nextUrl.searchParams.get('key') ||
    request.headers.get('authorization')?.replace('Bearer ', '');
  if (key !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const date = ubDateStr();
  const enhance = request.nextUrl.searchParams.get('enhance') === '1';

  // Өнөөдөр аль хэдийн дараалал үүссэн бол дахин үүсгэхгүй —
  // гараар үүсгэсэн/постолсон ажлыг дарж бичихгүйн тулд.
  const { count } = await supabaseAdmin
    .from('marketing_queue_items')
    .select('id', { count: 'exact', head: true })
    .eq('queue_date', date);

  if ((count || 0) > 0) {
    return NextResponse.json({
      ok: true,
      date,
      skipped: `Өнөөдрийн дараалал аль хэдийн бэлэн (${count})`,
    });
  }

  // Кампанит ажлыг групп бүрийн төрлөөр generateDailyQueue өөрөө сонгоно
  const res = await generateDailyQueue({ enhance });

  if (!res.ok) {
    if (res.error === 'Идэвхтэй кампанит ажил алга') {
      return NextResponse.json({ ok: true, date, skipped: res.error });
    }
    console.error('[cron/marketing-daily] generate', res.error);
    return NextResponse.json({ error: res.error }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    date,
    campaigns: res.campaignTitles,
    added: res.added,
    eligibleCount: res.eligibleCount,
    warning: res.warning,
    ts: new Date().toISOString(),
  });
}
