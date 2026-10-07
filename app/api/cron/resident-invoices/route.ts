// Cron: өдөр бүр 00:10 (Улаанбаатар) — оршин суугчийн сарын нэхэмжлэх.
//   1) сарын 1-нд тухайн сарын нэхэмжлэх үүснэ (өдөр бүр ажилладаг тул 1-нд
//      алгассан ч дараагийн өдөр нөхнө). Хугацаа (дараа сарын 5) хүртэл өр биш.
//   2) нэхэмжлэх + төлбөрөөр өрийг шинээр тооцно: хугацаа өнгөрсөн, төлөгдөөгүй
//      нэхэмжлэх → «хугацаа хэтэрсэн», residents.debt = тэдгээрийн үлдэгдэл
// Зөвхөн auto_invoice_from бөглөгдсөн СӨХ-д ажиллана (resident-billing/auto-invoices.ts).
//
// Vercel cron (Authorization: Bearer CRON_SECRET) эсвэл GET ?key=SECRET

import { NextRequest, NextResponse } from 'next/server';
import { runResidentInvoices } from '@/app/lib/resident-billing/auto-invoices';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[cron/resident-invoices] CRON_SECRET тохируулаагүй байна');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }
  const key =
    request.nextUrl.searchParams.get('key') ||
    request.headers.get('authorization')?.replace('Bearer ', '');
  if (key !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await runResidentInvoices();
  if (!result.ok) console.error('[cron/resident-invoices]', result.errors.join('; '));
  return NextResponse.json({ ...result, ts: new Date().toISOString() });
}
