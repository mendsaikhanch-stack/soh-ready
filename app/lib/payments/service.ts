// ============================================
// PaymentService — төлбөрийн бүх бизнес логик нэг дор
//
// ⚠️ ЗӨВХӨН СЕРВЕР ТАЛД. Client component-оос ХЭЗЭЭ Ч импортлохгүй
//    (supabaseAdmin = service_role түлхүүр агуулна).
//
// Дүрэм:
//   • Дүнг ХЭЗЭЭ Ч client-ээс авахгүй — үргэлж DB-ээс тооцно
//   • Төлөв солих эрх зөвхөн энд байна
//   • Webhook идемпотент — нэг event нэг л удаа боловсруулагдана
// ============================================

import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { getProvider } from './provider';
import {
  activeProviderName,
  isPaymentsEnabled,
  siteOrigin,
  MAX_CHARGE_MNT,
} from './config';
import {
  PaymentError,
  type ChargeResult,
  type PayableSummary,
  type PaymentStatus,
  type ProviderName,
} from './types';

// ── DB мөрүүдийн хэлбэр (зөвхөн ашиглах баганууд) ────────────

interface InvoiceRow {
  id: number;
  sokh_id: number;
  resident_id: number;
  year: number;
  month: number;
  amount: number;
  previous_balance: number | null;
  total_amount: number | null;
  paid_amount: number | null;
  status: string;
  description: string | null;
}

interface PaymentRow {
  id: number;
  resident_id: number | null;
  sokh_id: number | null;
  invoice_id: number | null;
  amount: number;
  provider: string;
  provider_txn_id: string | null;
  status: string;
}

/** Нэхэмжлэх "нээлттэй" (өр үлдсэн) эсэх */
const OPEN_STATUSES = ['pending', 'overdue', 'partial'];

function unpaidPortion(inv: Pick<InvoiceRow, 'amount' | 'paid_amount'>): number {
  return Math.max(0, Number(inv.amount) - Number(inv.paid_amount || 0));
}

/** Нэхэмжлэхийн нийт төлөх дүн (хуучин мөрд total_amount хоосон байж болно) */
function invoiceTotal(inv: Pick<InvoiceRow, 'amount' | 'previous_balance' | 'total_amount'>): number {
  if (inv.total_amount != null) return Number(inv.total_amount);
  return Number(inv.amount) + Number(inv.previous_balance || 0);
}

// ============================================================
// 1. Өмнөх өр тооцох
// ============================================================
/**
 * Заасан сараас ӨМНӨХ бүх төлөгдөөгүй нэхэмжлэхийн үлдэгдлийн нийлбэр.
 *
 * Сар бүрийн ЗӨВХӨН өөрийн `amount`-ыг тооцно — `total_amount` биш.
 * Учир нь total_amount дотор өмнөх сарын өр аль хэдийн багтсан байдаг
 * тул түүгээр нийлбэр бодвол өр ДАВХАРДАЖ тоологдоно.
 */
export async function computePreviousBalance(
  residentId: number,
  year: number,
  month: number,
): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('invoices')
    .select('id, year, month, amount, paid_amount, status')
    .eq('resident_id', residentId)
    .in('status', OPEN_STATUSES);

  if (error) throw new PaymentError('Өмнөх өр тооцоход алдаа гарлаа', 'db_error', 500);

  const rows = (data || []) as Pick<InvoiceRow, 'id' | 'year' | 'month' | 'amount' | 'paid_amount' | 'status'>[];
  const cutoff = year * 12 + month;

  return rows
    .filter(r => Number(r.year) * 12 + Number(r.month) < cutoff)
    .reduce((sum, r) => sum + unpaidPortion(r), 0);
}

// ============================================================
// 2. Оршин суугчийн төлбөрийн нэгдсэн зураглал
// ============================================================
export async function getPayableSummary(
  residentId: number,
  period?: { year: number; month: number },
): Promise<PayableSummary> {
  const now = new Date();
  const year = period?.year ?? now.getFullYear();
  const month = period?.month ?? now.getMonth() + 1;

  const { data: resident } = await supabaseAdmin
    .from('residents')
    .select('id, sokh_id')
    .eq('id', residentId)
    .single();

  if (!resident) throw new PaymentError('Оршин суугч олдсонгүй', 'resident_not_found', 404);

  const { data: invRow } = await supabaseAdmin
    .from('invoices')
    .select('id, sokh_id, resident_id, year, month, amount, previous_balance, total_amount, paid_amount, status, description')
    .eq('resident_id', residentId)
    .eq('year', year)
    .eq('month', month)
    .maybeSingle();

  const invoice = invRow as InvoiceRow | null;
  const previousBalance = await computePreviousBalance(residentId, year, month);

  // Энэ сарын нэхэмжлэх үүсээгүй бол 0 — СӨХ-ийн сарын хураамжийг
  // таамаглаж харуулахгүй (нэхэмжлээгүй мөнгө нэхэхгүй).
  const currentAmount = invoice ? unpaidPortion(invoice) : 0;
  const isPaid = invoice ? invoice.status === 'paid' : false;

  return {
    residentId,
    sokhId: (resident.sokh_id as number) ?? null,
    year,
    month,
    currentAmount,
    previousBalance,
    totalAmount: currentAmount + previousBalance,
    invoiceId: invoice?.id ?? null,
    isPaid,
  };
}

// ============================================================
// 3. Эрхийн шалгалт
// ============================================================
export async function assertResidentOwnsInvoice(residentId: number, invoiceId: number): Promise<InvoiceRow> {
  const { data } = await supabaseAdmin
    .from('invoices')
    .select('id, sokh_id, resident_id, year, month, amount, previous_balance, total_amount, paid_amount, status, description')
    .eq('id', invoiceId)
    .single();

  const inv = data as InvoiceRow | null;
  if (!inv) throw new PaymentError('Нэхэмжлэх олдсонгүй', 'invoice_not_found', 404);
  if (Number(inv.resident_id) !== Number(residentId)) {
    // Хэний нэхэмжлэх болохыг задруулахгүй — 404-ээр хариулна
    throw new PaymentError('Нэхэмжлэх олдсонгүй', 'forbidden', 404);
  }
  return inv;
}

// ============================================================
// 4. Төлбөр эхлүүлэх
// ============================================================
export interface StartPaymentInput {
  residentId: number;
  /** Тодорхой нэхэмжлэх төлөх бол. Байхгүй бол нийт өрийг төлнө. */
  invoiceId?: number;
  providerName?: ProviderName;
}

export interface StartPaymentResult extends ChargeResult {
  paymentId: number;
  amountMnt: number;
  provider: ProviderName;
}

export async function startPayment(input: StartPaymentInput): Promise<StartPaymentResult> {
  if (!isPaymentsEnabled()) {
    throw new PaymentError('Төлбөрийн үйлчилгээ идэвхгүй байна', 'payments_disabled', 503);
  }

  const providerName = input.providerName ?? activeProviderName();
  const provider = getProvider(providerName);
  if (!provider) {
    throw new PaymentError('Төлбөрийн үйлчилгээ бэлэн бус байна', 'provider_missing', 503);
  }
  if (!provider.isConfigured()) {
    throw new PaymentError(`${provider.displayName} тохируулаагүй байна`, 'provider_unconfigured', 503);
  }

  // ── Дүнг СЕРВЕР талд тооцно. Client-ийн дүнд ХЭЗЭЭ Ч найдахгүй ──
  let amountMnt: number;
  let invoiceId: number | null = null;
  let sokhId: number | null = null;
  let description: string;

  if (input.invoiceId) {
    const inv = await assertResidentOwnsInvoice(input.residentId, input.invoiceId);
    if (inv.status === 'paid') {
      throw new PaymentError('Энэ нэхэмжлэх аль хэдийн төлөгдсөн байна', 'already_paid', 409);
    }
    if (inv.status === 'cancelled') {
      throw new PaymentError('Энэ нэхэмжлэх цуцлагдсан байна', 'invoice_cancelled', 409);
    }
    amountMnt = invoiceTotal(inv) - Number(inv.paid_amount || 0);
    invoiceId = inv.id;
    sokhId = inv.sokh_id;
    description = `СӨХ төлбөр — ${inv.year}/${String(inv.month).padStart(2, '0')}`;
  } else {
    const summary = await getPayableSummary(input.residentId);
    amountMnt = summary.totalAmount;
    invoiceId = summary.invoiceId;
    sokhId = summary.sokhId;
    description = 'СӨХ төлбөр';
  }

  amountMnt = Math.round(amountMnt);
  if (amountMnt <= 0) {
    throw new PaymentError('Төлөх төлбөр байхгүй байна', 'nothing_to_pay', 400);
  }
  if (amountMnt > MAX_CHARGE_MNT) {
    throw new PaymentError('Дүн хэт их байна', 'amount_too_large', 400);
  }

  // ── 1) Эхлээд DB-д pending мөр үүсгэнэ ──
  // Provider дуудахаас ӨМНӨ бичих нь чухал: гүйлгээ үүссэн ч манай
  // талд мөр байхгүй бол webhook ирэхэд тулгах юмгүй болно.
  const { data: created, error: insErr } = await supabaseAdmin
    .from('payments')
    .insert({
      resident_id: input.residentId,
      sokh_id: sokhId,
      invoice_id: invoiceId,
      amount: amountMnt,
      provider: providerName,
      status: 'pending',
      description,
    })
    .select('id')
    .single();

  if (insErr || !created) {
    throw new PaymentError('Төлбөр эхлүүлэхэд алдаа гарлаа', 'db_error', 500);
  }

  const paymentId = Number(created.id);
  const reference = `HOTOL-${paymentId}`;
  const origin = siteOrigin();

  // ── 2) Provider-ээс гүйлгээ үүсгэнэ ──
  let charge: ChargeResult;
  try {
    charge = await provider.createCharge({
      amountMnt,
      description,
      reference,
      returnUrl: `${origin}/pay/done?ref=${reference}`,
      callbackUrl: `${origin}/api/payments/webhook/${providerName}`,
    });
  } catch (err) {
    await supabaseAdmin
      .from('payments')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', paymentId);
    const msg = err instanceof Error ? err.message : 'тодорхойгүй алдаа';
    console.error('[payments] createCharge амжилтгүй:', msg);
    throw new PaymentError('Төлбөрийн үйлчилгээтэй холбогдож чадсангүй', 'provider_error', 502);
  }

  // ── 3) Provider-ийн гүйлгээний ID-г холбоно ──
  await supabaseAdmin
    .from('payments')
    .update({ provider_txn_id: charge.providerTxnId, updated_at: new Date().toISOString() })
    .eq('id', paymentId);

  return { ...charge, paymentId, amountMnt, provider: providerName };
}

// ============================================================
// 5. Амжилттай төлбөрийг бүртгэх (дотоод)
// ============================================================
/**
 * Төлбөрийг "төлсөн" болгож, нэхэмжлэх болон өрийг шинэчилнэ.
 * Аль хэдийн төлөгдсөн бол юу ч хийхгүй (идемпотент).
 */
async function applySuccessfulPayment(payment: PaymentRow, paidAmountMnt: number): Promise<void> {
  const nowIso = new Date().toISOString();

  // Идемпотент хамгаалалт: зөвхөн pending мөрийг paid болгоно.
  // Хэрэв өөр процесс аль хэдийн шинэчилсэн бол 0 мөр өөрчлөгдөнө.
  const { data: updated } = await supabaseAdmin
    .from('payments')
    .update({ status: 'paid', paid_at: nowIso, updated_at: nowIso })
    .eq('id', payment.id)
    .neq('status', 'paid')
    .select('id');

  if (!updated || updated.length === 0) return; // өөр процесс хийчихсэн

  // ── Нэхэмжлэх шинэчлэх ──
  if (payment.invoice_id) {
    const { data: invData } = await supabaseAdmin
      .from('invoices')
      .select('id, amount, previous_balance, total_amount, paid_amount, status')
      .eq('id', payment.invoice_id)
      .single();

    const inv = invData as Pick<InvoiceRow, 'id' | 'amount' | 'previous_balance' | 'total_amount' | 'paid_amount' | 'status'> | null;
    if (inv) {
      const newPaid = Number(inv.paid_amount || 0) + paidAmountMnt;
      const total = invoiceTotal(inv);
      await supabaseAdmin
        .from('invoices')
        .update({
          paid_amount: newPaid,
          status: newPaid >= total ? 'paid' : 'partial',
          paid_at: newPaid >= total ? nowIso : null,
          updated_at: nowIso,
        })
        .eq('id', inv.id);
    }
  }

  // ── residents.debt-ийг буулгах ──
  // Хуучин олон дэлгэц энэ талбараас уншдаг тул тэдгээрийг үнэн байлгана.
  if (payment.resident_id) {
    const { data: resData } = await supabaseAdmin
      .from('residents')
      .select('id, debt')
      .eq('id', payment.resident_id)
      .single();
    if (resData) {
      const newDebt = Math.max(0, Number(resData.debt || 0) - paidAmountMnt);
      await supabaseAdmin.from('residents').update({ debt: newDebt }).eq('id', payment.resident_id);
    }
  }
}

// ============================================================
// 6. Webhook боловсруулах — ИДЕМПОТЕНТ
// ============================================================
export interface WebhookOutcome {
  ok: boolean;
  duplicate?: boolean;
  ignored?: boolean;
  paymentId?: number;
  reason?: string;
}

export async function handleWebhook(
  providerName: ProviderName,
  rawBody: string,
  headers: Headers,
): Promise<WebhookOutcome> {
  const provider = getProvider(providerName);
  if (!provider) throw new PaymentError('Танигдаагүй үйлчилгээ', 'provider_missing', 404);

  // ── 1) Гарын үсэг — ТҮҮХИЙ body дээр, parse хийхээс ӨМНӨ ──
  const verification = provider.verifyWebhook(rawBody, headers);
  if (!verification.valid) {
    throw new PaymentError(`Webhook гарын үсэг: ${verification.reason}`, 'bad_signature', 400);
  }

  const event = provider.parseWebhook(rawBody);
  if (!event) return { ok: true, ignored: true, reason: 'Бидэнд хамааралгүй event' };

  // ── 2) Идемпотентын түгжээ ──
  // UNIQUE(provider, external_event_id) дээрх мөргөлдөөн нь
  // "энэ event аль хэдийн боловсруулагдсан" гэсэн үг.
  const { error: evtErr } = await supabaseAdmin.from('payment_webhook_events').insert({
    provider: providerName,
    external_event_id: event.externalEventId,
    event_type: event.eventType,
    payload: event.raw as Record<string, unknown>,
  });

  if (evtErr) {
    if (evtErr.code === '23505') return { ok: true, duplicate: true };
    console.error('[payments] webhook event бичихэд алдаа:', evtErr.message);
    throw new PaymentError('Webhook бүртгэхэд алдаа гарлаа', 'db_error', 500);
  }

  // ── 3) Холбогдох төлбөрийг олох ──
  let payment: PaymentRow | null = null;

  const { data: byTxn } = await supabaseAdmin
    .from('payments')
    .select('id, resident_id, sokh_id, invoice_id, amount, provider, provider_txn_id, status')
    .eq('provider', providerName)
    .eq('provider_txn_id', event.providerTxnId)
    .maybeSingle();
  payment = byTxn as PaymentRow | null;

  // Нөөц зам: provider гүйлгээний ID-г эргүүлж илгээгээгүй бол
  // өөрсдийн reference (`HOTOL-<id>`)-ээр олно.
  if (!payment && event.reference) {
    const m = /^HOTOL-(\d+)$/.exec(event.reference);
    if (m) {
      const { data: byRef } = await supabaseAdmin
        .from('payments')
        .select('id, resident_id, sokh_id, invoice_id, amount, provider, provider_txn_id, status')
        .eq('id', Number(m[1]))
        .maybeSingle();
      payment = byRef as PaymentRow | null;
    }
  }

  if (!payment) {
    await markEventProcessed(providerName, event.externalEventId, null, 'Тохирох төлбөр олдсонгүй');
    return { ok: true, ignored: true, reason: 'Тохирох төлбөр олдсонгүй' };
  }

  // ── 4) Төлөв тохируулах ──
  if (event.status === 'paid') {
    const paid = Math.round(event.paidAmountMnt ?? Number(payment.amount));

    // Дүн дутуу ирсэн бол итгэхгүй — гараар шалгуулна
    if (paid < Number(payment.amount)) {
      console.error('[payments] дүн тохирохгүй', {
        paymentId: payment.id, expected: payment.amount, received: paid,
      });
      await markEventProcessed(providerName, event.externalEventId, payment.id, 'Дүн тохирохгүй');
      return { ok: false, paymentId: payment.id, reason: 'Дүн тохирохгүй' };
    }

    await applySuccessfulPayment(payment, paid);
  } else {
    const next: PaymentStatus = event.status;
    await supabaseAdmin
      .from('payments')
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq('id', payment.id)
      .eq('status', 'pending');
  }

  await markEventProcessed(providerName, event.externalEventId, payment.id, null);
  return { ok: true, paymentId: payment.id };
}

async function markEventProcessed(
  provider: ProviderName,
  externalEventId: string,
  paymentId: number | null,
  error: string | null,
): Promise<void> {
  await supabaseAdmin
    .from('payment_webhook_events')
    .update({
      processed: true,
      processed_at: new Date().toISOString(),
      payment_id: paymentId,
      error,
    })
    .eq('provider', provider)
    .eq('external_event_id', externalEventId);
}

// ============================================================
// 7. Төлөв шалгах (polling нөөц зам)
// ============================================================
/**
 * Webhook ирээгүй тохиолдолд provider-ээс шууд асууж тулгана.
 * Webhook-той ижил идемпотент хамгаалалттай.
 */
export async function syncPaymentStatus(paymentId: number): Promise<PaymentStatus> {
  const { data } = await supabaseAdmin
    .from('payments')
    .select('id, resident_id, sokh_id, invoice_id, amount, provider, provider_txn_id, status')
    .eq('id', paymentId)
    .single();

  const payment = data as PaymentRow | null;
  if (!payment) throw new PaymentError('Төлбөр олдсонгүй', 'payment_not_found', 404);
  if (payment.status !== 'pending') return payment.status as PaymentStatus;
  if (!payment.provider_txn_id) return 'pending';

  const provider = getProvider(payment.provider as ProviderName);
  if (!provider) return 'pending';

  const result = await provider.checkStatus(payment.provider_txn_id);

  if (result.status === 'paid') {
    const paid = Math.round(result.paidAmountMnt ?? Number(payment.amount));
    if (paid < Number(payment.amount)) return 'pending';
    await applySuccessfulPayment(payment, paid);
    return 'paid';
  }

  if (result.status !== 'pending') {
    await supabaseAdmin
      .from('payments')
      .update({ status: result.status, updated_at: new Date().toISOString() })
      .eq('id', payment.id)
      .eq('status', 'pending');
  }

  return result.status;
}
