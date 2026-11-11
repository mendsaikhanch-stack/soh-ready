import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { checkAnyAuth } from '@/app/lib/session-token';
import { DEMO_READONLY_MESSAGE } from '@/app/lib/demo-admin';

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

const OPEN = ['pending', 'overdue', 'partial'];

interface InvoiceRow {
  id: number;
  amount: number;
  previous_balance: number | null;
  total_amount: number | null;
  paid_amount: number | null;
  status: string;
  year: number;
  month: number;
}

const invTotal = (i: InvoiceRow) => Number(i.total_amount ?? Number(i.amount) + Number(i.previous_balance || 0));
const invLeft = (i: InvoiceRow) => Math.max(0, invTotal(i) - Number(i.paid_amount || 0));

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

  const { data: invData } = await supabaseAdmin
    .from('invoices')
    .select('id, amount, previous_balance, total_amount, paid_amount, status, year, month')
    .eq('resident_id', residentId);
  const invoices = (invData || []) as InvoiceRow[];
  const open = invoices
    .filter((i) => OPEN.includes(i.status) && invLeft(i) > 0)
    .sort((x, y) => x.year - y.year || x.month - y.month || x.id - y.id);

  if (!force && invoices.length > 0 && open.length === 0) {
    return NextResponse.json({
      error: 'no_open_invoice',
      message: 'Энэ айлын нэхэмжлэх бүгд төлөгдсөн байна (банкны хуулгаар орсон байж магадгүй). Давхар бичихгүйн тулд шалгана уу.',
    }, { status: 409 });
  }

  const nowIso = new Date().toISOString();
  const batch = randomUUID();
  let left = amount;
  const applied: { invoice_id: number | null; month: string | null; amount: number; payment_id: number }[] = [];

  const insertPayment = async (invoiceId: number | null, amt: number, label: string) => {
    const { data, error } = await supabaseAdmin.from('payments').insert({
      resident_id: residentId,
      sokh_id: sokhId,
      invoice_id: invoiceId,
      amount: amt,
      description: label,
      provider: 'manual',
      provider_txn_id: `record:${batch}:${invoiceId ?? 'advance'}`,
      status: 'paid',
      paid_at: nowIso,
      updated_at: nowIso,
    }).select('id').single();
    if (error || !data) throw new Error(error?.message || 'payment insert');
    return data.id as number;
  };

  try {
    for (const inv of open) {
      if (left <= 0) break;
      const part = Math.min(left, invLeft(inv));
      const label = open.length > 1 || part < amount ? `${description} (${inv.month}-р сар)` : description;
      const pid = await insertPayment(inv.id, part, label);
      const newPaid = Number(inv.paid_amount || 0) + part;
      const full = newPaid >= invTotal(inv);
      await supabaseAdmin.from('invoices').update({
        paid_amount: newPaid, status: full ? 'paid' : 'partial', paid_at: full ? nowIso : null, updated_at: nowIso,
      }).eq('id', inv.id);
      applied.push({ invoice_id: inv.id, month: `${inv.year}-${String(inv.month).padStart(2, '0')}`, amount: part, payment_id: pid });
      left -= part;
    }
    // Нэхэмжлэхгүй СӨХ, эсвэл илүү төлсөн дүн → урьдчилгаа
    if (left > 0) {
      const pid = await insertPayment(null, left, open.length ? `${description} (урьдчилгаа)` : description);
      applied.push({ invoice_id: null, month: null, amount: left, payment_id: pid });
    }
  } catch (e) {
    console.error('[payments/record]', (e as Error).message, { residentId, applied });
    return NextResponse.json({
      error: 'Төлбөр бүрэн бүртгэгдсэнгүй. Жагсаалтыг шинэчилж шалгаад дахин оролдоно уу.',
      applied,
    }, { status: 500 });
  }

  await supabaseAdmin.from('residents')
    .update({ debt: Math.max(0, Number(resident.debt || 0) - amount) }).eq('id', residentId);

  return NextResponse.json({ ok: true, applied, advance: left > 0 ? left : 0 });
}
