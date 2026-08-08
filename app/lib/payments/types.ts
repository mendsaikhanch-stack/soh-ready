// ============================================
// Төлбөрийн системийн үндсэн төрлүүд
// Provider-ээс хамааралгүй — QPay/Wire/Mock бүгд эдгээрээр ярина.
// ============================================

/** DB-ийн payments.status-тай яг тохирно (payments_status_check). */
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'cancelled' | 'expired';

/** DB-ийн payments.provider-тай яг тохирно (payments_provider_check). */
export type ProviderName = 'manual' | 'mock' | 'qpay' | 'wire';

/** Дүн БҮГД төгрөгөөр (₮), бүхэл тоо. Provider дотроо хөрвүүлнэ. */
export interface ChargeRequest {
  /** Төлөх дүн, ₮ */
  amountMnt: number;
  /** Хэрэглэгчид харагдах тайлбар */
  description: string;
  /** Манай талын давтагдашгүй дугаар — `HOTOL-<paymentId>` */
  reference: string;
  /** Provider төлбөр дууссаны дараа буцаах хаяг */
  returnUrl?: string;
  /** Provider webhook/callback илгээх хаяг */
  callbackUrl?: string;
}

export interface ChargeResult {
  /** Provider талын гүйлгээний ID — payments.provider_txn_id-д хадгална */
  providerTxnId: string;
  status: PaymentStatus;
  /** Хөтчөөр очих төлбөрийн хуудас */
  checkoutUrl?: string;
  /** QR зураг (data: URL) */
  qrImage?: string;
  qrText?: string;
  /** Банкны аппликейшн руу шууд үсрэх холбоосууд */
  deeplinks?: { name: string; logo?: string; link: string }[];
  expiresAt?: string;
}

export interface StatusResult {
  status: PaymentStatus;
  paidAmountMnt?: number;
}

/** Provider-ээс ирсэн webhook-ийг нэгдсэн хэлбэрт хөрвүүлсэн нь. */
export interface WebhookEvent {
  /** Идемпотентын түлхүүр — provider-ийн event ID */
  externalEventId: string;
  eventType: string;
  providerTxnId: string;
  status: PaymentStatus;
  paidAmountMnt?: number;
  /** ChargeRequest.reference буцаж ирсэн бол (нөөц холбоос) */
  reference?: string;
  raw: unknown;
}

export type WebhookVerification = { valid: true } | { valid: false; reason: string };

/** Оршин суугчид харуулах төлбөрийн нэгдсэн зураглал. */
export interface PayableSummary {
  residentId: number;
  sokhId: number | null;
  year: number;
  month: number;
  /** Энэ сарын төлбөр */
  currentAmount: number;
  /** Өмнөх сараас үлдсэн өр */
  previousBalance: number;
  /** Нийт төлөх дүн */
  totalAmount: number;
  /** Энэ сарын нэхэмжлэх (үүсээгүй бол null) */
  invoiceId: number | null;
  /** Энэ сарын нэхэмжлэх төлөгдсөн эсэх */
  isPaid: boolean;
}

export class PaymentError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status = 400) {
    super(message);
    this.name = 'PaymentError';
    this.code = code;
    this.status = status;
  }
}
