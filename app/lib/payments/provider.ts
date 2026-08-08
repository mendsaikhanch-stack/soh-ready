// ============================================
// PaymentProvider — төлбөрийн үйлчилгээ үзүүлэгчийн нэгдсэн гэрээ
//
//   PaymentService  →  PaymentProvider  →  QPayProvider / WireProvider / MockProvider
//
// UI болон API route нь ЭНЭ интерфейсээс цааш юу байгааг мэдэхгүй.
// Шинэ provider нэмэхэд энэ файлыг өөрчлөх шаардлагагүй.
// ============================================

import type {
  ChargeRequest,
  ChargeResult,
  ProviderName,
  StatusResult,
  WebhookEvent,
  WebhookVerification,
} from './types';

export interface PaymentProvider {
  /** DB-д хадгалагдах нэр */
  readonly name: ProviderName;

  /** Хэрэглэгчид харагдах нэр — Монголоор, товчийн шошго болно */
  readonly displayName: string;

  /**
   * Шаардлагатай тохиргоо (env credential) бүрэн эсэх.
   * false бол PaymentService энэ provider-ыг сонгохгүй.
   */
  isConfigured(): boolean;

  /** Төлбөр эхлүүлж, хэрэглэгчийг чиглүүлэх мэдээллийг буцаана. */
  createCharge(req: ChargeRequest): Promise<ChargeResult>;

  /** Гүйлгээний одоогийн төлвийг provider-ээс шууд асуух. */
  checkStatus(providerTxnId: string): Promise<StatusResult>;

  /**
   * Webhook-ийн гарын үсгийг ТҮҮХИЙ body дээр шалгана.
   * ⚠️ JSON.parse хийхээс ӨМНӨ дуудна.
   */
  verifyWebhook(rawBody: string, headers: Headers): WebhookVerification;

  /**
   * Түүхий webhook-ийг нэгдсэн хэлбэрт хөрвүүлнэ.
   * Бидэнд хамаагүй event бол null буцаана.
   */
  parseWebhook(rawBody: string): WebhookEvent | null;

  /** Заавал биш — дэмждэг provider дээр гүйлгээ цуцлах. */
  cancelCharge?(providerTxnId: string): Promise<boolean>;
}

/** Provider бүртгэл — PHASE 3-т mock, PHASE 9-т qpay бүртгэгдэнэ. */
const registry = new Map<ProviderName, PaymentProvider>();

export function registerProvider(provider: PaymentProvider): void {
  registry.set(provider.name, provider);
}

export function getProvider(name: ProviderName): PaymentProvider | null {
  return registry.get(name) ?? null;
}

export function listProviders(): PaymentProvider[] {
  return [...registry.values()];
}
