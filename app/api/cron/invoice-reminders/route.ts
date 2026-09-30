// Cron: өдөр бүр 09:30 (Улаанбаатар) Хотолын төлбөрийн өдөр тутмын ажил:
//   1) сарын нэхэмжлэх — үнэгүй хугацаа дууссан СӨХ-ийн нэхэмжлэхгүй сар
//      бүрд «төлөгдөөгүй» нэхэмжлэх үүсгэнэ (monthly-invoices.ts)
//   2) сануулга — төлөх хугацаа дөхсөн / болсон / хэтэрсэн шатанд даргад
//      SMS + имэйл (invoice-reminders.ts)
// Дараалал чухал: эхлээд нэхэмжлэх үүсч байж сануулах юмтай болно.
//
// Vercel cron (Authorization: Bearer CRON_SECRET) эсвэл GET ?key=SECRET

import { NextRequest, NextResponse } from 'next/server';
import { runInvoiceReminders } from '@/app/lib/platform-billing/invoice-reminders';
import { generateMonthlyInvoices } from '@/app/lib/platform-billing/monthly-invoices';

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

  const invoices = await generateMonthlyInvoices();
  if (!invoices.ok) console.error('[cron/invoice-reminders] нэхэмжлэх:', invoices.errors.join('; '));
  if (invoices.created.length) {
    console.log(`[cron/invoice-reminders] ${invoices.created.length} сарын нэхэмжлэх үүсгэв`);
  }

  const result = await runInvoiceReminders();
  if (!result.ok) console.error('[cron/invoice-reminders]', result.errors.join('; '));
  return NextResponse.json({ ...result, invoices, ts: new Date().toISOString() });
}
