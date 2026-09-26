// Cron: өдөр бүр 09:30 (Улаанбаатар) Хотолын төлөгдөөгүй нэхэмжлэхийг шалгаж,
// төлөх хугацаа дөхсөн / болсон / хэтэрсэн шатанд даргад автомат сануулга илгээнэ.
// Логик: app/lib/platform-billing/invoice-reminders.ts
//
// Vercel cron (Authorization: Bearer CRON_SECRET) эсвэл GET ?key=SECRET

import { NextRequest, NextResponse } from 'next/server';
import { runInvoiceReminders } from '@/app/lib/platform-billing/invoice-reminders';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[cron/invoice-reminders] CRON_SECRET тохируулаагүй байна');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }
  const key =
    request.nextUrl.searchParams.get('key') ||
    request.headers.get('authorization')?.replace('Bearer ', '');
  if (key !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await runInvoiceReminders();
  if (!result.ok) console.error('[cron/invoice-reminders]', result.errors.join('; '));
  return NextResponse.json({ ...result, ts: new Date().toISOString() });
}
