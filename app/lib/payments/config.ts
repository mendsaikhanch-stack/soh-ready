// ============================================
// Төлбөрийн системийн тохиргоо — ЗӨВХӨН СЕРВЕР ТАЛД
//
// Хоёр тусдаа тумблер байгааг анхаараарай:
//
//   1. app/lib/auth-flags.ts → PAYMENTS_ENABLED  (build-time const)
//      Оршин суугчийн дэлгэц дээрх "Төлөх" ТОВЧ харагдах эсэх.
//
//   2. Энэ файл → PAYMENT_ENABLED (server env)
//      Сервер талд төлбөрийн API-г огт ажиллуулах эсэх.
//
// Товч нуугдсан ч сервер нээлттэй бол хэн нэгэн API-г шууд дуудаж
// болно — тиймээс сервер талын шалгалт нь ЖИНХЭНЭ хаалт. Товчны
// тумблер нь зөвхөн харагдац.
//
// PAYMENT_ENABLED тохируулаагүй үед → УНТРААЛТАЙ (аюулгүй тал руу).
// ============================================

import type { ProviderName } from './types';

export function isPaymentsEnabled(): boolean {
  return process.env.PAYMENT_ENABLED === 'true';
}

/**
 * Идэвхтэй provider. Тохируулаагүй бол 'mock' —
 * бодит мөнгө хөдлөхгүй, аюулгүй анхдагч.
 */
export function activeProviderName(): ProviderName {
  const raw = (process.env.PAYMENT_PROVIDER || 'mock').toLowerCase();
  const allowed: ProviderName[] = ['mock', 'qpay', 'wire'];
  return (allowed as string[]).includes(raw) ? (raw as ProviderName) : 'mock';
}

/** Нэг гүйлгээний дээд хязгаар (₮) — буруу оролтоос хамгаална. */
export const MAX_CHARGE_MNT = 100_000_000;

/** Төлбөрийн хүсэлт хүчинтэй байх хугацаа (минут). */
export const CHARGE_TTL_MINUTES = 30;

/** Апп-ын нийтийн хаяг — provider-ийн callback/return URL зохиоход. */
export function siteOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return 'http://localhost:3000';
}
