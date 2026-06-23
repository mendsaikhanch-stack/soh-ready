import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { verifyWebhook } from '@/app/lib/wire';

export const runtime = 'nodejs';

/**
 * POST /api/wire/webhook
 * Wire `payment_intent.succeeded` зэрэг event-ийг хүлээн авна.
 * ⚠️ Гарын үсгийг ТҮҮХИЙ body дээр шалгана (JSON.parse-аас ӨМНӨ).
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const sig = request.headers.get('WirePayment-Signature');

  const check = verifyWebhook(rawBody, sig);
  if (!check.valid) {
    return NextResponse.json({ error: `Webhook signature: ${check.reason}` }, { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'JSON буруу' }, { status: 400 });
  }

  const type: string = event?.type || '';
  const obj = event?.data?.object || {};
  const piId: string | undefined = obj?.id || event?.data?.payment_intent;

  // Бид зөвхөн амжилттай төлбөрт ажиллана (бусдыг хүлээн авч 200 буцаана)
  if (type !== 'payment_intent.succeeded') {
    return NextResponse.json({ received: true, ignored: type });
  }
  if (!piId) {
    return NextResponse.json({ error: 'payment_intent id алга' }, { status: 400 });
  }

  // Mapping олох
  const { data: wp } = await supabaseAdmin
    .from('wire_payments')
    .select('*')
    .eq('payment_intent_id', piId)
    .single();

  if (!wp) {
    // Манай биш / олдсонгүй — 200 буцааж дахин илгээхийг зогсооно
    return NextResponse.json({ received: true, unmatched: piId });
  }

  // Идемпотент — аль хэдийн боловсруулсан бол давтахгүй
  if (wp.status === 'succeeded' || wp.last_event_id === event.id) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  const nowIso = new Date().toISOString();

  // 1) wire_payments-ийг succeeded болгох
  await supabaseAdmin
    .from('wire_payments')
    .update({ status: 'succeeded', paid_at: nowIso, last_event_id: event.id })
    .eq('id', wp.id);

  // 2) Холбогдсон нэхэмжлэхийг "төлсөн" болгох
  if (wp.invoice_id) {
    await supabaseAdmin
      .from('invoices')
      .update({ status: 'paid', paid_amount: wp.amount, paid_at: nowIso })
      .eq('id', wp.invoice_id);
  }
  if (wp.utility_bill_id) {
    await supabaseAdmin
      .from('utility_bills')
      .update({ status: 'paid', paid_at: nowIso })
      .eq('id', wp.utility_bill_id);
  }

  // 3) Төлбөрийн түүхэнд бичих
  if (wp.resident_id) {
    await supabaseAdmin.from('payments').insert([{
      resident_id: wp.resident_id,
      amount: wp.amount,
      description: `Wire — ${wp.description || 'Төлбөр'}`,
      paid_at: nowIso,
    }]);
  }

  return NextResponse.json({ received: true, processed: piId });
}
