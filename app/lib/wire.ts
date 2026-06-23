// Wire.mn төлбөрийн helper — REST + Node crypto (SDK хамааралгүй).
//
// Урсгал: createPaymentIntent → createCheckoutSession → хэрэглэгчийг
// session.url (pay.wire.mn) руу гадаад хөтчид чиглүүлнэ → төлбөр амжилттай
// бол Wire `payment_intent.succeeded` webhook илгээнэ.
//
// Env (.env.local + Vercel):
//   WIRE_SECRET_KEY      = sk_test_... (эсвэл sk_live_...)
//   WIRE_WEBHOOK_SECRET  = whsec_...
//
// Amount нь Wire-д minor units (₮ × 100). Энэ модуль гадагшаа ₮-өөр ажиллана.

import crypto from 'crypto';

const WIRE_BASE = 'https://api.wire.mn/v1';

function secretKey(): string {
  const k = process.env.WIRE_SECRET_KEY;
  if (!k) throw new Error('WIRE_SECRET_KEY тохируулаагүй байна (.env.local)');
  return k;
}

/** sk_test_ → sandbox горим */
export function isTestMode(): boolean {
  return secretKey().startsWith('sk_test_');
}

export class WireError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'WireError';
    this.status = status;
    this.body = body;
  }
}

async function wireFetch(
  path: string,
  opts: { method?: string; body?: Record<string, unknown>; idempotencyKey?: string } = {},
): Promise<any> {
  const { method = 'POST', body, idempotencyKey } = opts;
  const res = await fetch(WIRE_BASE + path, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new WireError(
      (data as any)?.error?.message || (data as any)?.message || `Wire API алдаа (${res.status})`,
      res.status,
      data,
    );
  }
  return data;
}

/** ₮-ийн дүнгээр PaymentIntent үүсгэнэ. */
export async function createPaymentIntent(params: {
  amountMnt: number;
  description?: string;
  idempotencyKey?: string;
}): Promise<{ id: string; status: string; livemode?: boolean }> {
  return wireFetch('/payment_intents', {
    body: {
      amount: Math.round(params.amountMnt * 100), // ₮ → minor units
      currency: 'MNT',
      // Test mode-д sandbox оператор руу чиглүүлнэ; live-д Wire идэвхтэй
      // операторуудыг автоматаар сонгоно.
      ...(isTestMode() ? { allowed_operators: ['sandbox'] } : {}),
      ...(params.description ? { description: params.description } : {}),
    },
    idempotencyKey: params.idempotencyKey,
  });
}

/** Hosted checkout session — буцаах url нь pay.wire.mn хуудас. */
export async function createCheckoutSession(params: {
  paymentIntentId: string;
  successUrl?: string;
  cancelUrl?: string;
  idempotencyKey?: string;
}): Promise<{ id: string; url: string; status?: string }> {
  return wireFetch('/checkout/sessions', {
    body: {
      payment_intent: params.paymentIntentId,
      ...(params.successUrl ? { success_url: params.successUrl } : {}),
      ...(params.cancelUrl ? { cancel_url: params.cancelUrl } : {}),
    },
    idempotencyKey: params.idempotencyKey,
  });
}

/**
 * Webhook гарын үсгийг шалгана.
 * Header: `WirePayment-Signature: t=<ts>,v1=<sig>`
 * sig = HMAC_SHA256(secret, `${t}.${rawBody}`) (hex).
 * ⚠️ rawBody нь parse хийгдээгүй ТҮҮХИЙ body байх ёстой.
 */
export function verifyWebhook(
  rawBody: string,
  signatureHeader: string | null,
  opts: { toleranceSec?: number } = {},
): { valid: boolean; reason?: string } {
  const secret = process.env.WIRE_WEBHOOK_SECRET;
  if (!secret) return { valid: false, reason: 'WIRE_WEBHOOK_SECRET тохируулаагүй' };
  if (!signatureHeader) return { valid: false, reason: 'Signature header алга' };

  const parts = Object.fromEntries(
    signatureHeader.split(',').map((kv) => {
      const i = kv.indexOf('=');
      return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()];
    }),
  );
  const t = parts['t'];
  const v1 = parts['v1'];
  if (!t || !v1) return { valid: false, reason: 'Signature формат буруу' };

  // Timestamp шинэлэг эсэх (replay-аас сэргийлэх)
  const tolerance = opts.toleranceSec ?? 300;
  const ts = parseInt(t, 10);
  if (Number.isFinite(ts) && Math.abs(Date.now() / 1000 - ts) > tolerance) {
    return { valid: false, reason: 'Signature хугацаа хэтэрсэн' };
  }

  const expected = crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  // Тогтмол хугацааны харьцуулалт
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  const valid = a.length === b.length && crypto.timingSafeEqual(a, b);
  return valid ? { valid: true } : { valid: false, reason: 'Signature таарахгүй' };
}
