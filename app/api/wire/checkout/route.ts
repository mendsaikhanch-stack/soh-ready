import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { createPaymentIntent, createCheckoutSession, isTestMode, WireError } from '@/app/lib/wire';

export const runtime = 'nodejs';

/**
 * POST /api/wire/checkout
 * Body: { kind: 'invoice'|'utility'|'custom', id?, amount?, description?, residentId?, sokhId? }
 *
 * Дүнг найдвартай байлгахын тулд invoice/utility-ийн дүнг СЕРВЕР талд DB-ээс
 * уншина (client-ийн дүнд найдахгүй). Буцаах: { url } — pay.wire.mn checkout.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const kind: 'invoice' | 'utility' | 'custom' = body.kind || 'custom';

    let amountMnt = 0;
    let description: string = body.description || 'Хотол төлбөр';
    let sokhId: number | null = body.sokhId ?? null;
    let residentId: number | null = body.residentId ?? null;
    let invoiceId: number | null = null;
    let utilityBillId: number | null = null;

    // ── Дүнг СЕРВЕР талд тооцох ──
    if (kind === 'invoice' && body.id) {
      const { data } = await supabaseAdmin
        .from('invoices')
        .select('id, amount, sokh_id, resident_id, status, year, month')
        .eq('id', body.id)
        .single();
      if (!data) return NextResponse.json({ error: 'Нэхэмжлэх олдсонгүй' }, { status: 404 });
      if (data.status === 'paid') return NextResponse.json({ error: 'Аль хэдийн төлөгдсөн' }, { status: 409 });
      amountMnt = Number(data.amount);
      sokhId = data.sokh_id; residentId = data.resident_id; invoiceId = data.id;
      description = `СӨХ хураамж — ${data.year}/${String(data.month).padStart(2, '0')}`;
    } else if (kind === 'utility' && body.id) {
      const { data } = await supabaseAdmin
        .from('utility_bills')
        .select('id, amount, sokh_id, resident_id, status, utility_type, year, month')
        .eq('id', body.id)
        .single();
      if (!data) return NextResponse.json({ error: 'Нэхэмжлэх олдсонгүй' }, { status: 404 });
      if (data.status === 'paid') return NextResponse.json({ error: 'Аль хэдийн төлөгдсөн' }, { status: 409 });
      amountMnt = Number(data.amount);
      sokhId = data.sokh_id; residentId = data.resident_id; utilityBillId = data.id;
      description = `${data.utility_type} — ${data.year}/${String(data.month).padStart(2, '0')}`;
    } else {
      amountMnt = Number(body.amount) || 0;
    }

    if (!amountMnt || amountMnt <= 0) {
      return NextResponse.json({ error: 'Дүн буруу' }, { status: 400 });
    }

    // ── Wire PaymentIntent + Checkout session ──
    const idem = crypto.randomUUID();
    const origin = new URL(request.url).origin;

    const intent = await createPaymentIntent({ amountMnt, description, idempotencyKey: idem });
    const session = await createCheckoutSession({
      paymentIntentId: intent.id,
      successUrl: `${origin}/pay/done`,
      cancelUrl: `${origin}/pay/cancel`,
      idempotencyKey: idem,
    });

    // ── Mapping хадгалах (webhook ирэхэд тулгах) ──
    await supabaseAdmin.from('wire_payments').insert([{
      payment_intent_id: intent.id,
      checkout_session_id: session.id,
      sokh_id: sokhId,
      resident_id: residentId,
      invoice_id: invoiceId,
      utility_bill_id: utilityBillId,
      kind,
      amount: amountMnt,
      description,
      status: 'pending',
      livemode: !isTestMode(),
    }]);

    return NextResponse.json({ url: session.url, payment_intent: intent.id, test: isTestMode() });
  } catch (err) {
    if (err instanceof WireError) {
      return NextResponse.json({ error: err.message, detail: err.body }, { status: 502 });
    }
    const msg = err instanceof Error ? err.message : 'Серверийн алдаа';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
