import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { finalizeIfNeeded } from '@/app/lib/board-server';

// Хугацаа дууссан идэвхтэй санал асуулгуудыг тогтмол шийдвэрлэх cron.
// - auto_approve_on_timeout=true бол хариу өгөөгүй гишүүдийг "Зөвшөөрсөн" болгоно
// - босго хувиар passed/rejected гэж шийднэ
//
// Wiring (Vercel cron) — vercel.ts дотор:
//   crons: [{ path: '/api/cron/finalize-proposals', schedule: '*/15 * * * *' }]
// Аюулгүй байдал: CRON_SECRET env тавьж, гараар дуудахад ашиглана.
// Vercel-ийн cron нь автоматаар 'x-vercel-cron' толгойтой ирдэг.

export async function GET(req: NextRequest) {
  const isVercelCron = req.headers.get('x-vercel-cron') !== null;
  const secret = process.env.CRON_SECRET;
  const authOk =
    isVercelCron ||
    (!!secret && req.headers.get('authorization') === `Bearer ${secret}`);

  if (!authOk) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const nowIso = new Date().toISOString();
  const { data: expired, error } = await supabaseAdmin
    .from('proposals')
    .select('id, status, expires_at, pass_threshold_percentage, auto_approve_on_timeout, sokh_id')
    .eq('status', 'active')
    .lte('expires_at', nowIso)
    .limit(500);

  if (error) {
    console.error('[cron/finalize]', error.message);
    return NextResponse.json({ error: 'query failed' }, { status: 500 });
  }

  let finalized = 0;
  for (const p of expired || []) {
    const status = await finalizeIfNeeded(p);
    if (status !== 'active') finalized++;
  }

  return NextResponse.json({ scanned: expired?.length || 0, finalized });
}
