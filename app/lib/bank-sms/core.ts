// Банкны SMS → гүйлгээ → оршин суугчийн төлбөр. Цэвэр логик.
//
// Энэ файл ЗОРИУДААР зөвхөн node:crypto-оос хамаарна (alias import байхгүй) —
// `node --test tests/` шууд импортлож, DB-гүйгээр бүх дүрмийг шалгана.
// DB-тэй ажиллах хэсэг нь BankSmsStore интерфейсийн цаана (store.ts).
//
// Гурван ойлголтыг салгана:
//   эх SMS (bank_sms_events) → гүйлгээ (bank_transactions) → төлбөр (payments)

import { createHash, randomBytes } from 'node:crypto';
import { UNIT_SCHEMES, resolveUnitReference, type UnitCandidate } from './unit-address.ts';

export const PARSER_VERSION = 'xacbank-v1';

// ============================================================
// 1. SMS задлах
// ============================================================
// Баталгаажсан формат (ХасБанк, илгээгч 131888, 2026-10-25):
//   Таны 5006***029 тоот дансанд 55,000.00MNT ORLOGO орлоо.
//   Uldegdel 61,909.93MNT Ognoo: 2026-10-25; qpay 200000779046929 613toot
//
// ⚠️ Зөвхөн ОРЛОГЫН форматыг танина. Зарлагын SMS-ийн бодит загвар хараахан
//    ирээгүй тул таамгаар задлахгүй — хянах төлөвт оруулна.

export interface ParsedTransaction {
  accountReference: string;
  amountMinor: number; // мөнгө × 100 (float-гүй)
  balanceAfterMinor: number | null;
  currency: 'MNT';
  transactionDate: string; // YYYY-MM-DD
  description: string;
  channel: 'qpay' | null;
  transactionReference: string | null;
  payerReference: string;
}

export type ParseFailure = 'debit_unverified' | 'unrecognized_format' | 'bad_amount' | 'bad_date';

export type ParseResult =
  | { ok: true; tx: ParsedTransaction }
  | { ok: false; reason: ParseFailure };

const MONEY = String.raw`(\d[\d,]*(?:\.\d{1,2})?)`;

const CREDIT_RE = new RegExp(
  String.raw`(\d{2,8}\*{2,}\d{2,8})\s*(?:тоот|toot)\s+(?:дансанд|dansand)\s+` +
    MONEY + String.raw`\s*MNT\s+(?:ORLOGO|орлого)\s+(?:орлоо|orloo)`,
  'iu',
);
const BALANCE_RE = new RegExp(String.raw`(?:Uldegdel|Үлдэгдэл)\s*:?\s*(-?)` + MONEY + String.raw`\s*MNT`, 'iu');
const DATE_RE = /(?:Ognoo|Огноо)\s*:?\s*(\d{4})[-./](\d{2})[-./](\d{2})/iu;
const DEBIT_RE = /(ZARLAGA|зарлага|гарлаа|garlaa|хасагдлаа|xasagdlaa)/iu;
const QPAY_RE = /^(qpay)\s*[:#]?\s*(\d{8,24})(?:\s+|$)(.*)$/iu;

function clean(body: string): string {
  return body.replace(/[   \t\r\n]+/g, ' ').replace(/ {2,}/g, ' ').trim();
}

/** «55,000.00» → 5500000. Таслалыг мянгатын тусгаарлагч гэж үзнэ. */
export function parseMoneyMinor(text: string): number | null {
  const s = text.replace(/,/g, '');
  const m = /^(\d{1,12})(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  const minor = Number(m[1]) * 100 + Number((m[2] || '').padEnd(2, '0'));
  return Number.isSafeInteger(minor) ? minor : null;
}

function validDate(y: string, mo: string, d: string): string | null {
  const iso = `${y}-${mo}-${d}`;
  const t = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(t.getTime()) || t.toISOString().slice(0, 10) !== iso) return null;
  return iso;
}

export function parseBankSms(rawBody: string): ParseResult {
  const body = clean(rawBody);

  // Зарлага гэж харагдвал орлого болгож хэзээ ч бүртгэхгүй
  if (DEBIT_RE.test(body)) return { ok: false, reason: 'debit_unverified' };

  const credit = CREDIT_RE.exec(body);
  if (!credit) return { ok: false, reason: 'unrecognized_format' };

  const amountMinor = parseMoneyMinor(credit[2]);
  if (!amountMinor || amountMinor <= 0) return { ok: false, reason: 'bad_amount' };

  // Үлдэгдлийг ЗӨВХӨН «Uldegdel»-ийн араас уншина — дүнтэй андуурахгүй
  const bal = BALANCE_RE.exec(body);
  const balanceAbs = bal ? parseMoneyMinor(bal[2]) : null;
  const balanceAfterMinor = balanceAbs == null ? null : bal![1] === '-' ? -balanceAbs : balanceAbs;

  const dm = DATE_RE.exec(body);
  if (!dm) return { ok: false, reason: 'bad_date' };
  const transactionDate = validDate(dm[1], dm[2], dm[3]);
  if (!transactionDate) return { ok: false, reason: 'bad_date' };

  const description = body
    .slice(dm.index + dm[0].length)
    .replace(/^[\s;,.:]+/, '')
    .trim()
    .slice(0, 300);

  let channel: 'qpay' | null = null;
  let transactionReference: string | null = null;
  let payerReference = description;
  const q = QPAY_RE.exec(description);
  if (q) {
    channel = 'qpay';
    transactionReference = q[2];
    payerReference = q[3].trim();
  }

  return {
    ok: true,
    tx: {
      accountReference: credit[1],
      amountMinor,
      balanceAfterMinor,
      currency: 'MNT',
      transactionDate,
      description,
      channel,
      transactionReference,
      payerReference,
    },
  };
}

/** OTP / нэвтрэх код мэт SMS — гүйлгээ биш бол хадгалахгүй, дамжуулахгүй. */
export function looksLikeSecretCode(body: string): boolean {
  // JS-ийн \b нь кирилл үсгийг танихгүй тул \p{L}-ээр хил тогтооно
  return /(OTP|нууц\s*код|баталгаажуулах\s*код|нэг\s*удаагийн|verification|passcode|(?<!\p{L})(?:code|код|kod)(?!\p{L}))/iu.test(body);
}

// ============================================================
// 2. Гүйлгээний утгыг хэвшүүлэх → тоот таних
// ============================================================

const CYR: Record<string, string> = {
  а: 'A', б: 'B', в: 'V', г: 'G', д: 'D', е: 'E', ё: 'YO', ж: 'J', з: 'Z', и: 'I', й: 'I',
  к: 'K', л: 'L', м: 'M', н: 'N', о: 'O', ө: 'U', п: 'P', р: 'R', с: 'S', т: 'T', у: 'U',
  ү: 'U', ф: 'F', х: 'KH', ц: 'TS', ч: 'CH', ш: 'SH', щ: 'SH', ъ: '', ы: 'Y', ь: '', э: 'E',
  ю: 'YU', я: 'YA',
};

/**
 * «613 тоот», «613toot», «613-TOOT.» → «613TOOT». «498/1-404» → «498/1-404».
 * Том/жижиг үсэг, кирилл/латин, зай, цэг тэмдгийг үл хамаарна. «/» болон «-»
 * нь зөвхөн хоёр цифрийн ДУНД байвал үлдэнэ (498/1-404-ийн бүтэц хадгалагдана).
 */
export function normalizeReference(text: string): string {
  const latin = Array.from(text.toLowerCase(), (ch) => CYR[ch] ?? ch).join('').toUpperCase();
  return latin
    .replace(/(\d)\s*([-/])\s*(?=\d)/g, '$1$2')
    .replace(/[^A-Z0-9/-]/g, '')
    .replace(/(?<!\d)[-/]+|[-/]+(?!\d)/g, '');
}

export interface MappingRow {
  id: number;
  building_number: string;
  entrance_number: string | null;
  apartment_number: string;
}

/** residents.building нь «блок-орц» (2-2) хэлбэртэй. */
export function residentBuildingKey(m: Pick<MappingRow, 'building_number' | 'entrance_number'>): string {
  return m.entrance_number ? `${m.building_number}-${m.entrance_number}` : m.building_number;
}

export interface ResidentCandidate {
  id: number;
  floor: string | number | null;
  pending_claim: boolean | null;
}

export type ResidentPick =
  | { status: 'matched'; residentId: number }
  | { status: 'mapped_no_resident' }
  | { status: 'ambiguous'; count: number };

/**
 * Нэг тоотод олон мөр байж болно (гэр бүлийн гишүүн өөрөө бүртгүүлсэн г.м.).
 * Даргын импортолсон мөр (floor бөглөгдсөн) нэхэмжлэх авдаг тул түүнийг сонгоно
 * (create-ictown-invoices-2026-10.mjs-тэй ижил дүрэм). Тодорхойгүй бол сонгохгүй.
 */
export function pickResident(cands: ResidentCandidate[]): ResidentPick {
  const confirmed = cands.filter((c) => !c.pending_claim);
  if (confirmed.length === 0) return { status: 'mapped_no_resident' };
  if (confirmed.length === 1) return { status: 'matched', residentId: confirmed[0].id };
  const owners = confirmed.filter((c) => c.floor != null && String(c.floor).trim() !== '');
  if (owners.length === 1) return { status: 'matched', residentId: owners[0].id };
  return { status: 'ambiguous', count: confirmed.length };
}

export interface OpenInvoice {
  id: number;
  amount: number | string;
  previous_balance: number | string | null;
  total_amount: number | string | null;
  paid_amount: number | string | null;
  status: string;
}

export function invoiceRemainingMinor(inv: OpenInvoice): number {
  const total = inv.total_amount != null
    ? Number(inv.total_amount)
    : Number(inv.amount) + Number(inv.previous_balance || 0);
  return Math.round((total - Number(inv.paid_amount || 0)) * 100);
}

export type ReviewReason =
  | 'no_mapping'
  | 'mapped_no_resident'
  | 'ambiguous_resident'
  | 'no_open_invoice'
  | 'multiple_open_invoices'
  | 'amount_mismatch'
  | 'auto_apply_disabled'
  | 'apply_failed'
  /** Дугаарлалтын схемээр тоот олдсон ч байр баталгаагүй (дан тоот, «498-1607») */
  | 'unit_unconfirmed'
  /** Бичсэн орц тоотын дугаартай зөрсөн (205-2-505) */
  | 'unit_conflict'
  /** Байр танигдсан ч ийм тоот тэр байранд байхгүй */
  | 'unit_invalid';

/**
 * Автоматаар төлбөр болгох эсэх. Бүх нөхцөл ЯГ таарвал л 'apply' — эргэлзээтэй
 * бүх тохиолдол даргын шалгалт руу. Санал болгох нэхэмжлэхийг хадгална.
 */
export function decideReconciliation(
  amountMinor: number,
  openInvoices: OpenInvoice[],
  autoApply: boolean,
): { action: 'apply'; invoiceId: number } | { action: 'review'; reason: ReviewReason; suggestedInvoiceId: number | null } {
  if (openInvoices.length === 0) return { action: 'review', reason: 'no_open_invoice', suggestedInvoiceId: null };
  const exact = openInvoices.filter((i) => invoiceRemainingMinor(i) === amountMinor);
  if (openInvoices.length > 1) {
    return { action: 'review', reason: 'multiple_open_invoices', suggestedInvoiceId: exact.length === 1 ? exact[0].id : null };
  }
  const inv = openInvoices[0];
  if (exact.length !== 1) return { action: 'review', reason: 'amount_mismatch', suggestedInvoiceId: inv.id };
  if (!autoApply) return { action: 'review', reason: 'auto_apply_disabled', suggestedInvoiceId: inv.id };
  return { action: 'apply', invoiceId: inv.id };
}

// ============================================================
// 3. Давхардлын түлхүүр
// ============================================================

export function sha256Hex(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

/**
 * Банкны reference байвал түүгээр. Байхгүй бол дансны маск + огноо + дүн +
 * ҮЛДЭГДЭЛ + утгаар — ижил дүнтэй хоёр бодит төлбөр үлдэгдлээрээ ялгарна.
 */
export function transactionIdempotencyKey(tx: ParsedTransaction): string {
  if (tx.transactionReference) {
    return `ref:${tx.channel || 'bank'}:${tx.accountReference}:${tx.transactionReference}`;
  }
  return 'h:' + sha256Hex([
    tx.accountReference, tx.transactionDate, tx.amountMinor, tx.balanceAfterMinor ?? '',
    normalizeReference(tx.description),
  ].join('|'));
}

// ============================================================
// 4. Төхөөрөмжийн токен, payload баталгаажуулалт
// ============================================================

export const DEVICE_TOKEN_PREFIX = 'khsms_';

export function generateDeviceToken(): string {
  return DEVICE_TOKEN_PREFIX + randomBytes(32).toString('base64url');
}

export function hashDeviceToken(token: string): string {
  return sha256Hex(token);
}

export function bearerToken(header: string | null): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(\S{20,200})$/.exec(header.trim());
  return m && m[1].startsWith(DEVICE_TOKEN_PREFIX) ? m[1] : null;
}

/**
 * Authorization header → идэвхтэй төхөөрөмж. Токен буруу/байхгүй → 'unauthorized',
 * цуцлагдсан → 'revoked'. lookup нь SHA-256-аар хайна (эх токен DB-д байхгүй).
 */
export async function resolveDevice<T extends { status: string }>(
  authorization: string | null,
  lookupByHash: (hash: string) => Promise<T | null>,
): Promise<{ ok: true; device: T } | { ok: false; error: 'unauthorized' | 'revoked' }> {
  const token = bearerToken(authorization);
  if (!token) return { ok: false, error: 'unauthorized' };
  const device = await lookupByHash(hashDeviceToken(token));
  if (!device) return { ok: false, error: 'unauthorized' };
  if (device.status !== 'active') return { ok: false, error: 'revoked' };
  return { ok: true, device };
}

/** «+131888», «131 888» → «131888». Үсэгтэй нэрийг том үсгээр. */
export function normalizeSender(s: string): string {
  const t = s.trim();
  if (/^[+\d\s()-]+$/.test(t)) return t.replace(/\D/g, '');
  return t.toUpperCase().replace(/\s+/g, '');
}

export function senderAllowed(sender: string, allowed: string[]): boolean {
  const n = normalizeSender(sender);
  return n !== '' && allowed.some((a) => normalizeSender(a) === n);
}

export const MAX_REQUEST_BYTES = 16 * 1024;
const MAX_BODY_CHARS = 2000;

export interface SmsPayload {
  messageId: string;
  sender: string;
  body: string;
  receivedAt: string | null;
}

export function validatePayload(input: unknown, now: Date = new Date()): { ok: true; value: SmsPayload } | { ok: false; error: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'invalid_json' };
  const o = input as Record<string, unknown>;
  if (o.schemaVersion !== 1) return { ok: false, error: 'unsupported_schema_version' };
  if (typeof o.messageId !== 'string' || !/^[A-Za-z0-9_.:-]{8,128}$/.test(o.messageId)) {
    return { ok: false, error: 'invalid_message_id' };
  }
  if (typeof o.sender !== 'string' || o.sender.trim().length === 0 || o.sender.length > 32) {
    return { ok: false, error: 'invalid_sender' };
  }
  if (typeof o.body !== 'string' || o.body.trim().length === 0 || o.body.length > MAX_BODY_CHARS) {
    return { ok: false, error: 'invalid_body' };
  }
  // Утасны цагт бүрэн итгэхгүй — боломжгүй утга бол хаяна (серверийн цаг тусдаа)
  let receivedAt: string | null = null;
  if (typeof o.receivedAt === 'string') {
    const t = Date.parse(o.receivedAt);
    const skew = t - now.getTime();
    if (Number.isFinite(t) && skew < 10 * 60_000 && skew > -400 * 86_400_000) {
      receivedAt = new Date(t).toISOString();
    }
  }
  return { ok: true, value: { messageId: o.messageId, sender: o.sender, body: o.body, receivedAt } };
}

// ============================================================
// 5. Боловсруулах урсгал
// ============================================================

export interface DeviceConfig {
  id: number;
  sokhId: number;
  bank: string;
  allowedSenders: string[];
  accountMask: string | null;
  autoApply: boolean;
}

export type EventStatus = 'received' | 'processed' | 'duplicate' | 'needs_review' | 'failed';

export interface StoredEvent {
  id: number;
  processing_status: EventStatus;
  transaction_id: number | null;
}

export interface NewTransaction {
  sokh_id: number;
  device_id: number;
  bank: string;
  account_reference: string;
  transaction_reference: string | null;
  payment_channel: string | null;
  idempotency_key: string;
  transaction_type: 'credit';
  amount_mnt: number;
  balance_after_mnt: number | null;
  currency: 'MNT';
  transaction_date: string;
  transaction_description: string;
  payer_reference: string;
  normalized_reference: string;
  source_sms_event_id: number;
}

export interface TransactionForMatching {
  id: number;
  sokh_id: number;
  amount_mnt: number | string;
  normalized_reference: string | null;
  /** Эх утга — дугаарлалтын схемд хэрэгтэй (хэвшүүлэхэд «498 1607» → «4981607» болно) */
  payer_reference?: string | null;
  reconciliation_status: string;
  payment_id: number | null;
}

export interface MatchPatch {
  mapping_id: number | null;
  building_number: string | null;
  entrance_number: string | null;
  apartment_number: string | null;
  resident_id: number | null;
  suggested_invoice_id: number | null;
  matching_status: 'matched' | 'unmatched' | 'mapped_no_resident' | 'ambiguous';
  review_reason: ReviewReason | null;
}

export interface BankSmsStore {
  /** (device_id, source_message_id) давхардвал байгаа мөрийг буцаана */
  insertEvent(row: {
    sokh_id: number; device_id: number; source_message_id: string; sender: string;
    received_at: string | null; body_sha256: string; raw_body: string; parser_version: string;
  }): Promise<{ inserted: true; id: number } | { inserted: false; existing: StoredEvent }>;
  updateEvent(id: number, patch: { processing_status: EventStatus; processing_error?: string | null; transaction_id?: number | null }): Promise<void>;
  /** (sokh_id, idempotency_key) давхардвал байгаа гүйлгээний id-г буцаана */
  insertTransaction(row: NewTransaction): Promise<{ inserted: true; id: number } | { inserted: false; existingId: number }>;
  findActiveMapping(sokhId: number, normalizedPattern: string): Promise<MappingRow | null>;
  findResidents(sokhId: number, building: string, apartment: string): Promise<ResidentCandidate[]>;
  findOpenInvoices(sokhId: number, residentId: number): Promise<OpenInvoice[]>;
  /** Зөвхөн payment_id хоосон, needs_review мөрийг шинэчилнэ */
  updateUnresolvedTransaction(id: number, patch: MatchPatch): Promise<void>;
  applyPayment(args: { transactionId: number; residentId: number; invoiceId: number | null; adminId: number | null; mode: 'auto' | 'manual'; note?: string | null }): Promise<number>;
}

export interface ProcessOutcome {
  /** Утас энэ хариуг хүлээж авбал дарааллаас хасна */
  accepted: boolean;
  status: EventStatus | 'ignored';
  reason?: string;
  eventId?: number;
  transactionId?: number;
  duplicate?: boolean;
}

function unitFields(c: UnitCandidate): Pick<MappingRow, 'building_number' | 'entrance_number' | 'apartment_number'> {
  return { building_number: c.building_number, entrance_number: c.entrance_number, apartment_number: c.apartment_number };
}

/**
 * Схемээр тоот олдсон ч баталгаагүй — ХЭЗЭЭ Ч автоматаар бүртгэхгүй (auto_apply
 * асаалттай байсан ч). Ганц хувилбартай бол даргад айл, нэхэмжлэхийг санал болгоно.
 */
async function suggestUnit(
  store: BankSmsStore,
  tx: TransactionForMatching,
  empty: MatchPatch,
  candidates: UnitCandidate[],
  reason: 'unit_unconfirmed' | 'unit_conflict' | 'unit_invalid',
): Promise<{ matching: MatchPatch['matching_status']; applied: false; reason: ReviewReason }> {
  if (candidates.length !== 1) {
    const matching = candidates.length > 1 ? 'ambiguous' : 'unmatched';
    await store.updateUnresolvedTransaction(tx.id, { ...empty, matching_status: matching, review_reason: reason });
    return { matching, applied: false, reason };
  }
  const c = unitFields(candidates[0]);
  const patch: MatchPatch = { ...empty, ...c, matching_status: 'ambiguous', review_reason: reason };
  const pick = pickResident(await store.findResidents(tx.sokh_id, residentBuildingKey(c), c.apartment_number));
  if (pick.status === 'matched') {
    patch.resident_id = pick.residentId;
    const invoices = await store.findOpenInvoices(tx.sokh_id, pick.residentId);
    const d = decideReconciliation(Math.round(Number(tx.amount_mnt) * 100), invoices, false);
    patch.suggested_invoice_id = d.action === 'review' ? d.suggestedInvoiceId : null;
  }
  await store.updateUnresolvedTransaction(tx.id, patch);
  return { matching: 'ambiguous', applied: false, reason };
}

/**
 * Гүйлгээг тоотын дүрмээр айлтай тааруулж, боломжтой бол төлбөр болгоно.
 * Шийдэгдсэн (auto_applied/confirmed/ignored) гүйлгээнд ХҮРЭХГҮЙ — дахин
 * боловсруулахад өөр айлд санамсаргүй холбогдохгүй.
 */
export async function matchTransaction(
  store: BankSmsStore,
  tx: TransactionForMatching,
  autoApply: boolean,
): Promise<{ matching: MatchPatch['matching_status'] | 'skipped'; applied: boolean; reason: ReviewReason | null }> {
  if (tx.payment_id != null || tx.reconciliation_status !== 'needs_review') {
    return { matching: 'skipped', applied: false, reason: null };
  }

  const empty: MatchPatch = {
    mapping_id: null, building_number: null, entrance_number: null, apartment_number: null,
    resident_id: null, suggested_invoice_id: null, matching_status: 'unmatched', review_reason: 'no_mapping',
  };

  // 1) Даргын баталгаажуулсан дүрэм (бүтэн утга ЯГ таарах) — хамгийн түрүүнд.
  // 2) Дүрэм байхгүй бол СӨХ-ийн дугаарлалтын схем (unit-address.ts).
  const mapping = tx.normalized_reference
    ? await store.findActiveMapping(tx.sokh_id, tx.normalized_reference)
    : null;
  let target: Pick<MatchPatch, 'mapping_id'> & Pick<MappingRow, 'building_number' | 'entrance_number' | 'apartment_number'>;
  if (mapping) {
    target = {
      mapping_id: mapping.id,
      building_number: mapping.building_number,
      entrance_number: mapping.entrance_number,
      apartment_number: mapping.apartment_number,
    };
  } else {
    const scheme = UNIT_SCHEMES[tx.sokh_id];
    const res = scheme ? resolveUnitReference(scheme, tx.payer_reference) : ({ status: 'none' } as const);
    if (res.status === 'none') {
      await store.updateUnresolvedTransaction(tx.id, empty);
      return { matching: 'unmatched', applied: false, reason: 'no_mapping' };
    }
    if (res.status !== 'resolved') {
      return suggestUnit(store, tx, empty, res.status === 'invalid' ? [] : res.candidates, `unit_${res.status}`);
    }
    target = { mapping_id: null, ...unitFields(res.unit) };
  }

  const unit: MatchPatch = { ...empty, ...target };

  const pick = pickResident(await store.findResidents(tx.sokh_id, residentBuildingKey(target), target.apartment_number));
  if (pick.status !== 'matched') {
    const reason: ReviewReason = pick.status === 'ambiguous' ? 'ambiguous_resident' : 'mapped_no_resident';
    await store.updateUnresolvedTransaction(tx.id, { ...unit, matching_status: pick.status, review_reason: reason });
    return { matching: pick.status, applied: false, reason };
  }

  const amountMinor = Math.round(Number(tx.amount_mnt) * 100);
  const invoices = await store.findOpenInvoices(tx.sokh_id, pick.residentId);
  const decision = decideReconciliation(amountMinor, invoices, autoApply);
  const matched: MatchPatch = { ...unit, resident_id: pick.residentId, matching_status: 'matched' };

  if (decision.action === 'review') {
    await store.updateUnresolvedTransaction(tx.id, {
      ...matched, suggested_invoice_id: decision.suggestedInvoiceId, review_reason: decision.reason,
    });
    return { matching: 'matched', applied: false, reason: decision.reason };
  }

  await store.updateUnresolvedTransaction(tx.id, { ...matched, suggested_invoice_id: decision.invoiceId, review_reason: null });
  try {
    await store.applyPayment({
      transactionId: tx.id, residentId: pick.residentId, invoiceId: decision.invoiceId, adminId: null, mode: 'auto',
    });
    return { matching: 'matched', applied: true, reason: null };
  } catch {
    await store.updateUnresolvedTransaction(tx.id, {
      ...matched, suggested_invoice_id: decision.invoiceId, review_reason: 'apply_failed',
    });
    return { matching: 'matched', applied: false, reason: 'apply_failed' };
  }
}

/**
 * Хадгалсан эх SMS-ийг задлаад гүйлгээ үүсгэж, тааруулна. Шинэ SMS болон
 * «дахин боловсруулах» хоёулаа үүгээр явна. Давхардсан гүйлгээ дахин
 * үүсэхгүй — unique index-ийн мөргөлдөөнийг 'duplicate' гэж тэмдэглэнэ.
 */
export async function processStoredEvent(
  store: BankSmsStore,
  device: DeviceConfig,
  eventId: number,
  rawBody: string,
): Promise<ProcessOutcome> {
  const parsed = parseBankSms(rawBody);
  if (!parsed.ok) {
    await store.updateEvent(eventId, { processing_status: 'needs_review', processing_error: parsed.reason });
    return { accepted: true, status: 'needs_review', reason: parsed.reason, eventId };
  }
  const p = parsed.tx;

  if (device.accountMask && device.accountMask.replace(/\s/g, '') !== p.accountReference) {
    await store.updateEvent(eventId, { processing_status: 'needs_review', processing_error: 'account_mismatch' });
    return { accepted: true, status: 'needs_review', reason: 'account_mismatch', eventId };
  }

  const ins = await store.insertTransaction({
    sokh_id: device.sokhId,
    device_id: device.id,
    bank: device.bank,
    account_reference: p.accountReference,
    transaction_reference: p.transactionReference,
    payment_channel: p.channel,
    idempotency_key: transactionIdempotencyKey(p),
    transaction_type: 'credit',
    amount_mnt: p.amountMinor / 100,
    balance_after_mnt: p.balanceAfterMinor == null ? null : p.balanceAfterMinor / 100,
    currency: 'MNT',
    transaction_date: p.transactionDate,
    transaction_description: p.description,
    payer_reference: p.payerReference,
    normalized_reference: normalizeReference(p.payerReference),
    source_sms_event_id: eventId,
  });

  if (!ins.inserted) {
    await store.updateEvent(eventId, { processing_status: 'duplicate', transaction_id: ins.existingId, processing_error: null });
    return { accepted: true, status: 'duplicate', eventId, transactionId: ins.existingId, duplicate: true };
  }

  await store.updateEvent(eventId, { processing_status: 'processed', transaction_id: ins.id, processing_error: null });

  // Гүйлгээ аль хэдийн хадгалагдсан. Тааруулалт унавал needs_review хэвээр
  // үлдэж, дарга «дахин тааруулах»-аар ажиллуулна — SMS алдагдахгүй.
  let reason: string | undefined;
  try {
    const m = await matchTransaction(store, {
      id: ins.id, sokh_id: device.sokhId, amount_mnt: p.amountMinor / 100,
      normalized_reference: normalizeReference(p.payerReference),
      payer_reference: p.payerReference,
      reconciliation_status: 'needs_review', payment_id: null,
    }, device.autoApply);
    reason = m.reason ?? undefined;
  } catch {
    reason = 'match_error';
  }

  return { accepted: true, status: 'processed', eventId, transactionId: ins.id, reason };
}

/** Утаснаас ирсэн нэг SMS. */
export async function processIncomingSms(
  store: BankSmsStore,
  device: DeviceConfig,
  payload: SmsPayload,
): Promise<ProcessOutcome> {
  // Зөвшөөрөөгүй илгээгч / нууц код — ХАДГАЛАХГҮЙ (хувийн мэдээлэл)
  if (!senderAllowed(payload.sender, device.allowedSenders)) {
    return { accepted: true, status: 'ignored', reason: 'sender_not_allowed' };
  }
  if (looksLikeSecretCode(payload.body) && !CREDIT_RE.test(clean(payload.body))) {
    return { accepted: true, status: 'ignored', reason: 'secret_code' };
  }

  const ev = await store.insertEvent({
    sokh_id: device.sokhId,
    device_id: device.id,
    source_message_id: payload.messageId,
    sender: payload.sender.trim().slice(0, 32),
    received_at: payload.receivedAt,
    body_sha256: sha256Hex(clean(payload.body)),
    raw_body: payload.body,
    parser_version: PARSER_VERSION,
  });

  // Утас retry хийсэн — өмнөх үр дүнг буцаана, дахин боловсруулахгүй
  if (!ev.inserted) {
    return {
      accepted: true,
      status: ev.existing.processing_status,
      eventId: ev.existing.id,
      transactionId: ev.existing.transaction_id ?? undefined,
      duplicate: true,
    };
  }

  try {
    return await processStoredEvent(store, device, ev.id, payload.body);
  } catch (e) {
    // SMS аль хэдийн хадгалагдсан — алдсангүй. Дарга «дахин боловсруулах»-аар ажиллуулна.
    const msg = e instanceof Error ? e.message.slice(0, 200) : 'unknown';
    await store.updateEvent(ev.id, { processing_status: 'failed', processing_error: msg }).catch(() => {});
    return { accepted: true, status: 'failed', reason: 'processing_error', eventId: ev.id };
  }
}
