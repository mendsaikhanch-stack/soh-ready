import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { checkAnyAuth } from '@/app/lib/session-token';
import { DEMO_READONLY_MESSAGE } from '@/app/lib/demo-admin';
import { openInvoicesOldestFirst, writeAllocatedPayment } from '@/app/lib/payments/allocate';

// POST /api/admin/payments/record { resident_id, amount, description, force? }
// «Төлбөр & Орлого ▸ Төлбөр бүртгэх» — даргын гараар бүртгэх төлбөр.
//
// Яагаад сервер дээр: өмнө нь клиентээс payments-д invoice_id-гүй мөр нэмдэг байсан тул
// нэхэмжлэх нээлттэй үлдэж, айл төлсөн атлаа өртэй харагддаг байв. Дарга дахин
// бүртгэх, банкны хуулгаар орж ирэхэд давхардал үүсдэг байв (2026-11-08, ICTown:
// 6 ийм төлбөр, нэг нь банкны төлбөрийн давхардал).
//
// Одоо: нээлттэй нэхэмжлэхийг ХУУЧНААС нь эхлэн хаана (110,000₮ → 10 + 11-р сар).
// Нэхэмжлэх бүрд тусдаа payments мөр (payments.invoice_id ганц). Илүү гарсан дүн
// нэхэмжлэхгүй урьдчилгаа болж бичигдэнэ.
// Нэхэмжлэх нь бүгд хаагдсан айлд (ихэвчлэн банкаар аль хэдийн орсон) force-гүйгээр бичихгүй.

export async function POST(req: NextRequest) {
  const a = await checkAnyAuth('admin', 'superadmin');
  if (!a.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sokhId = a.sokhId ? parseInt(a.sokhId, 10) : 0;
  if (!sokhId) return NextResponse.json({ error: 'Session-д СӨХ тодорхойгүй' }, { status: 403 });
  if (a.demo) return NextResponse.json({ error: DEMO_READONLY_MESSAGE }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const residentId = Number(body?.resident_id);
  const amount = Math.round(Number(body?.amount));
  const description = String(body?.description || '').trim().slice(0, 300) || 'Гараар бүртгэсэн төлбөр';
  const force = body?.force === true;
  if (!residentId || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Айл болон дүнгээ зөв оруулна уу' }, { status: 400 });
  }

  const { data: resident } = await supabaseAdmin
    .from('residents').select('id, debt').eq('id', residentId).eq('sokh_id', sokhId).maybeSingle();
  if (!resident) return NextResponse.json({ error: 'Айл олдсонгүй' }, { status: 404 });

  // Давхар даралт: ижил айл, ижил дүн сүүлийн 10 минутад
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: recent } = await supabaseAdmin
    .from('payments').select('id, amount, created_at').eq('resident_id', residentId).gte('created_at', since);
  const recentSum = (recent || []).reduce((s, p) => s + Number(p.amount), 0);
  if (!force && recentSum === amount) {
    return NextResponse.json({
      error: 'duplicate_recent',
      message: `Энэ айлд яг ${amount.toLocaleString()}₮ төлбөр саяхан (10 минутын дотор) бүртгэгдсэн байна.`,
    }, { status: 409 });
  }

  const { count: invCount } = await supabaseAdmin
    .from('invoices').select('id', { count: 'exact', head: true }).eq('resident_id', residentId);
  const open = await openInvoicesOldestFirst(residentId);

  if (!force && (invCount || 0) > 0 && open.length === 0) {
    return NextResponse.json({
      error: 'no_open_invoice',
      message: 'Энэ айлын нэхэмжлэх бүгд төлөгдсөн байна (банкны хуулгаар орсон байж магадгүй). Давхар бичихгүйн тулд шалгана уу.',
    }, { status: 409 });
  }

  let result;
  try {
    result = await writeAllocatedPayment({
      sokhId, residentId, amount, description, provider: 'manual', txnPrefix: `record:${randomUUID()}`, open,
    });
  } catch (e) {
    console.error('[payments/record]', (e as Error).message, { residentId });
    return NextResponse.json({
      error: 'Төлбөр бүрэн бүртгэгдсэнгүй. Жагсаалтыг шинэчилж шалгаад дахин оролдоно уу.',
    }, { status: 500 });
  }

  await supabaseAdmin.from('residents')
    .update({ debt: Math.max(0, Number(resident.debt || 0) - amount) }).eq('id', residentId);

  return NextResponse.json({ ok: true, applied: result.applied, advance: result.advance });
}
