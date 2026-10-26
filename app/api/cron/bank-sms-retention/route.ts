// Cron: өдөр бүр банкны SMS-ийн ЭХ ТЕКСТИЙГ хугацаа дуусахад арилгана.
// Задалсан гүйлгээ (bank_transactions) үлдэнэ; хянах шаардлагатай
// (needs_review / failed) SMS-ийг шийдэгдэх хүртэл хадгална.
//
// BANK_SMS_RAW_RETENTION_DAYS (анхдагч 90, доод хязгаар 7 — SQL талд).
// Vercel cron (Authorization: Bearer CRON_SECRET) эсвэл GET ?key=SECRET

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[cron/bank-sms-retention] CRON_SECRET тохируулаагүй байна');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }
  const key =
    request.nextUrl.searchParams.get('key') ||
    request.headers.get('authorization')?.replace('Bearer ', '');
  if (key !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const days = Number(process.env.BANK_SMS_RAW_RETENTION_DAYS || 90);
  const { data, error } = await supabaseAdmin.rpc('bank_sms_purge_raw', {
    p_retention_days: Number.isFinite(days) ? Math.round(days) : 90,
  });
  if (error) {
    console.error('[cron/bank-sms-retention]', error.message);
    return NextResponse.json({ error: 'purge failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, purged: data });
}
