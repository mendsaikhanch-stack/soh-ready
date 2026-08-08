// ============================================
// Төлбөрийн модулийн нийтийн гарц
//
//   PaymentService  →  PaymentProvider  →  QPay / Wire / Mock
//
// API route-ууд ЗӨВХӨН эндээс импортлоно.
// ⚠️ Сервер талын модуль — client component-д импортлохгүй.
// ============================================

export * from './types';
export * from './provider';
export {
  isPaymentsEnabled,
  activeProviderName,
  siteOrigin,
  MAX_CHARGE_MNT,
  CHARGE_TTL_MINUTES,
} from './config';
export {
  getPayableSummary,
  computePreviousBalance,
  assertResidentOwnsInvoice,
  startPayment,
  handleWebhook,
  syncPaymentStatus,
  type StartPaymentInput,
  type StartPaymentResult,
  type WebhookOutcome,
} from './service';
