import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeReference, parseBankSms, processIncomingSms, matchTransaction, resolveDevice,
  generateDeviceToken, hashDeviceToken, validatePayload, transactionIdempotencyKey,
  type BankSmsStore, type DeviceConfig, type NewTransaction, type MatchPatch,
  type EventStatus, type OpenInvoice,
} from '../app/lib/bank-sms/core.ts';

// ── Бодит SMS (ХасБанк, 131888, 2026-10-25) ────────────────────
const SMS_613 = 'Таны 5006***029 тоот дансанд 55,000.00MNT ORLOGO орлоо. Uldegdel 61,909.93MNT Ognoo: 2026-10-25; qpay 200000779046929 613toot';
const SMS_403 = 'Таны 5006***029 тоот дансанд 55,000.00MNT ORLOGO орлоо. Uldegdel 116,859.93MNT Ognoo: 2026-10-25; QPAY 200000779047099 203 R BAIR 403 TOOT';
const sms = (ref: string, txn: string, balance = '1,000.00') =>
  `Таны 5006***029 тоот дансанд 55,000.00MNT ORLOGO орлоо. Uldegdel ${balance}MNT Ognoo: 2026-10-25; QPAY ${txn} ${ref}`;

// ── In-memory store: DB-ийн unique index + bank_sms_apply_payment-ийг дуурайна ──
interface Tx extends NewTransaction, Partial<MatchPatch> {
  id: number; reconciliation_status: string; payment_id: number | null;
}

function memoryStore(opts: {
  mappings?: { sokh_id: number; normalized_pattern: string; building_number: string; entrance_number: string | null; apartment_number: string; is_active?: boolean }[];
  residents?: { id: number; sokh_id: number; building: string; apartment: string; floor: string | null; pending_claim?: boolean; debt?: number }[];
  invoices?: (OpenInvoice & { sokh_id: number; resident_id: number })[];
} = {}) {
  const events: { id: number; device_id: number; source_message_id: string; processing_status: EventStatus; transaction_id: number | null; processing_error?: string | null }[] = [];
  const txs: Tx[] = [];
  const payments: { id: number; resident_id: number; amount: number; invoice_id: number | null }[] = [];
  const mappings = (opts.mappings || []).map((m, i) => ({ id: i + 1, is_active: true, ...m }));
  const residents = opts.residents || [];
  const invoices = opts.invoices || [];
  const faults = { insertEvent: 0, insertTransaction: 0 };

  const store: BankSmsStore = {
    async insertEvent(row) {
      if (faults.insertEvent > 0) { faults.insertEvent--; throw new Error('db down'); }
      const dup = events.find((e) => e.device_id === row.device_id && e.source_message_id === row.source_message_id);
      if (dup) return { inserted: false, existing: { id: dup.id, processing_status: dup.processing_status, transaction_id: dup.transaction_id } };
      const id = events.length + 1;
      events.push({ id, device_id: row.device_id, source_message_id: row.source_message_id, processing_status: 'received', transaction_id: null });
      return { inserted: true, id };
    },
    async updateEvent(id, patch) { Object.assign(events.find((e) => e.id === id)!, patch); },
    async insertTransaction(row) {
      if (faults.insertTransaction > 0) { faults.insertTransaction--; throw new Error('db down'); }
      const dup = txs.find((t) => t.sokh_id === row.sokh_id && (
        t.idempotency_key === row.idempotency_key ||
        (row.transaction_reference && t.account_reference === row.account_reference && t.transaction_reference === row.transaction_reference)));
      if (dup) return { inserted: false, existingId: dup.id };
      const id = txs.length + 1;
      txs.push({ ...row, id, reconciliation_status: 'needs_review', payment_id: null });
      return { inserted: true, id };
    },
    async findActiveMapping(sokhId, p) {
      return mappings.find((m) => m.sokh_id === sokhId && m.normalized_pattern === p && m.is_active) || null;
    },
    async findResidents(sokhId, building, apartment) {
      return residents.filter((r) => r.sokh_id === sokhId && r.building === building && r.apartment === apartment)
        .map((r) => ({ id: r.id, floor: r.floor, pending_claim: r.pending_claim ?? false }));
    },
    async findOpenInvoices(sokhId, residentId) {
      return invoices.filter((i) => i.sokh_id === sokhId && i.resident_id === residentId && ['pending', 'overdue', 'partial'].includes(i.status));
    },
    async updateUnresolvedTransaction(id, patch) {
      const t = txs.find((x) => x.id === id)!;
      if (t.reconciliation_status === 'needs_review' && t.payment_id == null) Object.assign(t, patch);
    },
    async applyPayment({ transactionId, residentId, invoiceId, mode }) {
      const t = txs.find((x) => x.id === transactionId);
      if (!t) throw new Error('transaction_not_found');
      if (t.payment_id != null || t.reconciliation_status !== 'needs_review') throw new Error('already_resolved');
      const r = residents.find((x) => x.id === residentId);
      if (!r || r.sokh_id !== t.sokh_id) throw new Error('resident_not_in_sokh');
      const pid = payments.length + 1;
      payments.push({ id: pid, resident_id: residentId, amount: t.amount_mnt, invoice_id: invoiceId });
      if (invoiceId) {
        const inv = invoices.find((i) => i.id === invoiceId)!;
        inv.paid_amount = Number(inv.paid_amount || 0) + t.amount_mnt;
        inv.status = Number(inv.paid_amount) >= Number(inv.amount) ? 'paid' : 'partial';
      }
      r.debt = Math.max(0, (r.debt || 0) - t.amount_mnt);
      t.payment_id = pid;
      t.resident_id = residentId;
      t.reconciliation_status = mode === 'auto' ? 'auto_applied' : 'confirmed';
      return pid;
    },
  };
  return { store, events, txs, payments, invoices, residents, faults };
}

const ICTOWN = 2694;
const device = (over: Partial<DeviceConfig> = {}): DeviceConfig => ({
  id: 1, sokhId: ICTOWN, bank: 'xacbank', allowedSenders: ['131888'], accountMask: '5006***029', autoApply: true, ...over,
});
let seq = 0;
const payload = (body: string, messageId = `msg-${++seq}-abcdef`) =>
  ({ messageId, sender: '131888', body, receivedAt: '2026-10-25T10:00:00Z' });

const SEED_MAPPINGS = [
  { sokh_id: ICTOWN, normalized_pattern: normalizeReference('613тоот'), building_number: '2', entrance_number: '2', apartment_number: '613' },
  { sokh_id: ICTOWN, normalized_pattern: normalizeReference('907 TOOT'), building_number: '1', entrance_number: '1', apartment_number: '907' },
  { sokh_id: ICTOWN, normalized_pattern: normalizeReference('403 TOOT'), building_number: '3', entrance_number: '1', apartment_number: '403' },
  { sokh_id: ICTOWN, normalized_pattern: normalizeReference('203 R BAIR 403 TOOT'), building_number: '3', entrance_number: '1', apartment_number: '403' },
  { sokh_id: ICTOWN, normalized_pattern: normalizeReference('498/1-404'), building_number: '1', entrance_number: '1', apartment_number: '404' },
];
const RESIDENTS = [
  { id: 10, sokh_id: ICTOWN, building: '2-2', apartment: '613', floor: '6', debt: 55000 },
  { id: 11, sokh_id: ICTOWN, building: '1-1', apartment: '907', floor: '9', debt: 55000 },
  { id: 12, sokh_id: ICTOWN, building: '3-1', apartment: '403', floor: '4', debt: 55000 },
  { id: 13, sokh_id: ICTOWN, building: '1-1', apartment: '404', floor: '4', debt: 55000 },
  // Өөр байрны ижил дугаартай тоот — «403» сохроор тааруулбал энд очих аюултай
  { id: 14, sokh_id: ICTOWN, building: '5-1', apartment: '403', floor: '4', debt: 55000 },
];
const inv = (id: number, resident_id: number, amount = 55000) =>
  ({ id, sokh_id: ICTOWN, resident_id, amount, previous_balance: 0, total_amount: amount, paid_amount: 0, status: 'pending' });

/** Нэг гүйлгээний байр-орц-тоотыг «2-2-613» хэлбэрээр */
const unitOf = (t: Tx) => `${t.building_number}-${t.entrance_number}-${t.apartment_number}`;

async function runOne(body: string) {
  const m = memoryStore({ mappings: SEED_MAPPINGS, residents: structuredClone(RESIDENTS) });
  await processIncomingSms(m.store, device({ autoApply: false }), payload(body));
  return m.txs[0];
}

describe('тоот таних (1–4)', () => {
  test('1. «613тоот» → 2-2-613', async () => {
    const t = await runOne(SMS_613);
    assert.equal(unitOf(t), '2-2-613');
    assert.equal(t.resident_id, 10);
  });
  test('2. «907 TOOT» → 1-1-907', async () => {
    assert.equal(unitOf(await runOne(sms('907 TOOT', '200000779040001'))), '1-1-907');
  });
  test('3. «203 R BAIR 403 TOOT» → 3-1-403 (5-1-403 биш)', async () => {
    const t = await runOne(SMS_403);
    assert.equal(unitOf(t), '3-1-403');
    assert.equal(t.resident_id, 12);
  });
  test('4. «498/1-404» → 1-1-404', async () => {
    assert.equal(unitOf(await runOne(sms('498/1-404', '200000779040002'))), '1-1-404');
  });
  test('хэвшүүлэлт: зай, том/жижиг үсэг, кирилл/латин, цэг тэмдэг', () => {
    for (const v of ['613тоот', '613 тоот', '613TOOT', '613 toot.', '613-тоот', ' 613  Тоот ']) {
      assert.equal(normalizeReference(v), '613TOOT', v);
    }
    assert.equal(normalizeReference('498 / 1 - 404'), '498/1-404');
    assert.equal(normalizeReference('203 R BAIR 403 TOOT'), '203RBAIR403TOOT');
  });
  test('дан «404 TOOT»-ыг 1-1-404-тэй сохроор тааруулахгүй', async () => {
    const t = await runOne(sms('404 TOOT', '200000779040003'));
    // 404 нь 1-1, 2-1, 3-1, 5-1 бүгдэд байгаа → дугаарлалтын схем ч сонгохгүй
    assert.equal(t.matching_status, 'ambiguous');
    assert.equal(t.review_reason, 'unit_unconfirmed');
    assert.equal(t.resident_id ?? null, null);
  });
});

describe('SMS задлах (5–7, 14)', () => {
  test('5. «55,000.00MNT ORLOGO» → 55000 MNT орлого', () => {
    const r = parseBankSms(SMS_613);
    assert.ok(r.ok);
    assert.equal(r.tx.amountMinor, 5_500_000);
    assert.equal(r.tx.currency, 'MNT');
    assert.equal(r.tx.accountReference, '5006***029');
    assert.equal(r.tx.transactionDate, '2026-10-25');
    assert.equal(r.tx.channel, 'qpay');
    assert.equal(r.tx.transactionReference, '200000779046929');
    assert.equal(r.tx.payerReference, '613toot');
  });
  test('6. «Uldegdel 61,909.93MNT»-ыг дүн гэж андуурахгүй', () => {
    const r = parseBankSms(SMS_613);
    assert.ok(r.ok);
    assert.notEqual(r.tx.amountMinor, 6_190_993);
    assert.equal(r.tx.balanceAfterMinor, 6_190_993);
    // Үлдэгдэл дүнгээс ӨМНӨ бичигдсэн ч андуурахгүй
    const swapped = 'Uldegdel 61,909.93MNT. Таны 5006***029 тоот дансанд 55,000.00MNT ORLOGO орлоо. Ognoo: 2026-10-25; qpay 1234567890 x';
    const r2 = parseBankSms(swapped);
    assert.ok(r2.ok);
    assert.equal(r2.tx.amountMinor, 5_500_000);
  });
  test('формат бага зэрэг өөрчлөгдөхөд тэсвэртэй', () => {
    const r = parseBankSms('таны  5006***029 тоот дансанд 1,250,000.5 MNT orlogo ОРЛОО.\nuldegdel: 2,000.00MNT\nognoo:2026.10.26 ; Qpay#200000779047100   613 тоот');
    assert.ok(r.ok);
    assert.equal(r.tx.amountMinor, 125_000_050);
    assert.equal(r.tx.transactionDate, '2026-10-26');
    assert.equal(r.tx.transactionReference, '200000779047100');
    assert.equal(normalizeReference(r.tx.payerReference), '613TOOT');
  });
  test('7. өөр форматтай SMS унагахгүй → needs_review', async () => {
    for (const body of ['Сайн байна уу, таны картын хугацаа дуусч байна.', 'Таны дансанд мөнгө орлоо', 'x'.repeat(1500), '💸']) {
      assert.equal(parseBankSms(body).ok, false);
    }
    const m = memoryStore();
    const out = await processIncomingSms(m.store, device(), payload('Таны 5006***029 тоот дансанд шинэ мэдэгдэл.'));
    assert.equal(out.status, 'needs_review');
    assert.equal(out.accepted, true);
    assert.equal(m.events.length, 1);
    assert.equal(m.txs.length, 0);
  });
  test('буруу огноо, тэг дүн → гүйлгээ үүсэхгүй', () => {
    assert.deepEqual(parseBankSms(SMS_613.replace('2026-10-25', '2026-13-45')), { ok: false, reason: 'bad_date' });
    assert.equal(parseBankSms(SMS_613.replace('55,000.00', '0.00')).ok, false);
  });
  test('14. зарлагын (баталгаажаагүй) формат орлого гэж бүртгэгдэхгүй', async () => {
    const debit = 'Таны 5006***029 тоот данснаас 55,000.00MNT ZARLAGA гарлаа. Uldegdel 6,909.93MNT Ognoo: 2026-10-25; qpay 200000779046930 613toot';
    assert.deepEqual(parseBankSms(debit), { ok: false, reason: 'debit_unverified' });
    // «ORLOGO» үгтэй хольсон ч орлого болохгүй
    assert.equal(parseBankSms(SMS_613.replace('орлоо', 'орлоо ZARLAGA')).ok, false);
    const m = memoryStore({ mappings: SEED_MAPPINGS, residents: structuredClone(RESIDENTS) });
    const out = await processIncomingSms(m.store, device(), payload(debit));
    assert.equal(out.status, 'needs_review');
    assert.equal(m.txs.length, 0);
    assert.equal(m.payments.length, 0);
  });
});

describe('давхардал (8–9)', () => {
  test('8. ижил SMS дахин ирэхэд (retry, өөр messageId) давхар гүйлгээ, давхар төлбөр үүсэхгүй', async () => {
    const m = memoryStore({ mappings: SEED_MAPPINGS, residents: structuredClone(RESIDENTS), invoices: [inv(100, 10)] });
    const p = payload(SMS_613, 'same-id-123456');
    const a = await processIncomingSms(m.store, device(), p);
    const b = await processIncomingSms(m.store, device(), p); // утас retry
    const c = await processIncomingSms(m.store, device(), payload(SMS_613)); // банк 2 удаа илгээсэн
    assert.equal(a.status, 'processed');
    assert.equal(b.duplicate, true);
    assert.equal(c.status, 'duplicate');
    assert.equal(m.events.length, 2); // retry шинэ мөр үүсгэхгүй, 2 дахь SMS лог-д бий
    assert.equal(m.txs.length, 1);
    assert.equal(m.payments.length, 1);
    assert.equal(m.residents.find((r) => r.id === 10)!.debt, 0);
  });
  test('9. ижил дүнтэй, өөр reference-тэй хоёр бодит төлбөрийг нэгтгэхгүй', async () => {
    const m = memoryStore({ mappings: SEED_MAPPINGS, residents: structuredClone(RESIDENTS) });
    await processIncomingSms(m.store, device({ autoApply: false }), payload(sms('613toot', '200000779050001', '100,000.00')));
    await processIncomingSms(m.store, device({ autoApply: false }), payload(sms('613toot', '200000779050002', '155,000.00')));
    assert.equal(m.txs.length, 2);
  });
  test('reference байхгүй үед үлдэгдлээр ялгана', () => {
    const base = parseBankSms(SMS_613.replace('qpay 200000779046929 ', ''));
    const other = parseBankSms(SMS_613.replace('qpay 200000779046929 ', '').replace('61,909.93', '116,909.93'));
    assert.ok(base.ok && other.ok);
    assert.equal(base.tx.transactionReference, null);
    assert.notEqual(transactionIdempotencyKey(base.tx), transactionIdempotencyKey(other.tx));
    const same = parseBankSms(SMS_613.replace('qpay 200000779046929 ', ''));
    assert.ok(same.ok);
    assert.equal(transactionIdempotencyKey(base.tx), transactionIdempotencyKey(same.tx)); // тогтвортой
  });
});

describe('нэвтрэлт, оролт (10)', () => {
  const token = generateDeviceToken();
  const devices = new Map([[hashDeviceToken(token), { id: 1, status: 'active' }]]);
  const lookup = async (h: string) => devices.get(h) ?? null;

  test('10. зөвшөөрөлгүй төхөөрөмж хандаж чадахгүй', async () => {
    assert.deepEqual(await resolveDevice(null, lookup), { ok: false, error: 'unauthorized' });
    assert.deepEqual(await resolveDevice('Bearer khsms_' + 'x'.repeat(43), lookup), { ok: false, error: 'unauthorized' });
    assert.deepEqual(await resolveDevice(`Basic ${token}`, lookup), { ok: false, error: 'unauthorized' });
    assert.equal((await resolveDevice(`Bearer ${token}`, lookup)).ok, true);
  });
  test('цуцлагдсан төхөөрөмж → revoked', async () => {
    const t2 = generateDeviceToken();
    const r = await resolveDevice(`Bearer ${t2}`, async () => ({ id: 2, status: 'revoked' }));
    assert.deepEqual(r, { ok: false, error: 'revoked' });
  });
  test('токен DB-д эх утгаараа хадгалагдахгүй', () => {
    assert.notEqual(hashDeviceToken(token), token);
    assert.equal(hashDeviceToken(token).length, 64);
  });
  test('зөвшөөрөгдөөгүй илгээгчийн SMS хадгалагдахгүй', async () => {
    const m = memoryStore();
    const out = await processIncomingSms(m.store, device(), { ...payload(SMS_613), sender: '+97699112233' });
    assert.equal(out.status, 'ignored');
    assert.equal(m.events.length, 0);
  });
  test('OTP / нэвтрэх код хадгалагдахгүй', async () => {
    const m = memoryStore();
    const out = await processIncomingSms(m.store, device(), payload('Таны нэг удаагийн нууц код: 482913'));
    assert.equal(out.status, 'ignored');
    assert.equal(m.events.length, 0);
  });
  test('payload баталгаажуулалт', () => {
    const now = new Date('2026-10-25T12:00:00Z');
    assert.equal(validatePayload({ schemaVersion: 2, messageId: 'abcdefgh', sender: '131888', body: 'x' }, now).ok, false);
    assert.equal(validatePayload({ schemaVersion: 1, messageId: 'bad id!', sender: '131888', body: 'x' }, now).ok, false);
    assert.equal(validatePayload({ schemaVersion: 1, messageId: 'abcdefgh', sender: '131888', body: 'x'.repeat(2001) }, now).ok, false);
    const ok = validatePayload({ schemaVersion: 1, messageId: 'abcdefgh', sender: '131888', body: 'x', receivedAt: '2030-01-01T00:00:00Z' }, now);
    assert.ok(ok.ok);
    assert.equal(ok.value.receivedAt, null); // ирээдүйн цагт итгэхгүй
  });
});

describe('мэдээлэл алдагдахгүй (11–12)', () => {
  test('11. mapping олдохгүй бол event + гүйлгээ бүрэн хадгалагдана (unmatched)', async () => {
    const m = memoryStore({ residents: structuredClone(RESIDENTS) });
    const out = await processIncomingSms(m.store, device(), payload(sms('1205 toot 5-2', '200000779060001')));
    assert.equal(out.status, 'processed');
    const t = m.txs[0];
    assert.equal(t.matching_status, 'unmatched');
    assert.equal(t.reconciliation_status, 'needs_review');
    assert.equal(t.amount_mnt, 55000);
    assert.equal(t.transaction_reference, '200000779060001');
    assert.equal(t.payer_reference, '1205 toot 5-2');
    assert.equal(m.payments.length, 0);
  });
  test('12a. DB тасарвал event хадгалагдахгүй → алдаа шиднэ (утас retry хийнэ), дараа нь нэг л удаа бүртгэгдэнэ', async () => {
    const m = memoryStore({ mappings: SEED_MAPPINGS, residents: structuredClone(RESIDENTS), invoices: [inv(100, 10)] });
    m.faults.insertEvent = 1;
    const p = payload(SMS_613, 'net-fail-0001');
    await assert.rejects(processIncomingSms(m.store, device(), p));
    const ok = await processIncomingSms(m.store, device(), p);
    const again = await processIncomingSms(m.store, device(), p); // хариу хүрээгүй → дахин
    assert.equal(ok.status, 'processed');
    assert.equal(again.duplicate, true);
    assert.equal(m.txs.length, 1);
    assert.equal(m.payments.length, 1);
  });
  test('12b. гүйлгээ бичих үед алдаа гарвал SMS хадгалагдаж, failed төлөвт орно', async () => {
    const m = memoryStore({ mappings: SEED_MAPPINGS, residents: structuredClone(RESIDENTS) });
    m.faults.insertTransaction = 1;
    const out = await processIncomingSms(m.store, device(), payload(SMS_613));
    assert.equal(out.accepted, true);
    assert.equal(out.status, 'failed');
    assert.equal(m.events[0].processing_status, 'failed');
  });
});

describe('tenant тусгаарлалт (13)', () => {
  test('13. ICTown-ий дүрэм, оршин суугч өөр СӨХ-ийн гүйлгээнд хэрэглэгдэхгүй', async () => {
    const m = memoryStore({ mappings: SEED_MAPPINGS, residents: structuredClone(RESIDENTS) });
    const other = device({ id: 2, sokhId: 9999 });
    await processIncomingSms(m.store, other, payload(SMS_613));
    await processIncomingSms(m.store, device(), payload(SMS_613));
    const [mine, theirs] = [m.txs.find((t) => t.sokh_id === ICTOWN)!, m.txs.find((t) => t.sokh_id === 9999)!];
    assert.equal(m.txs.length, 2); // ижил reference ч өөр СӨХ — тусдаа
    assert.equal(theirs.matching_status, 'unmatched');
    assert.equal(theirs.resident_id ?? null, null);
    assert.equal(mine.resident_id, 10);
  });
});

describe('төлбөртэй холбох (9-р хэсэг)', () => {
  test('бүх нөхцөл таарвал автоматаар төлбөр болно', async () => {
    const m = memoryStore({ mappings: SEED_MAPPINGS, residents: structuredClone(RESIDENTS), invoices: [inv(100, 10)] });
    await processIncomingSms(m.store, device(), payload(SMS_613));
    assert.equal(m.txs[0].reconciliation_status, 'auto_applied');
    assert.equal(m.payments[0].invoice_id, 100);
    assert.equal(m.invoices[0].status, 'paid');
  });
  test('auto_apply унтраалттай бол санал болгоод хүлээнэ', async () => {
    const m = memoryStore({ mappings: SEED_MAPPINGS, residents: structuredClone(RESIDENTS), invoices: [inv(100, 10)] });
    await processIncomingSms(m.store, device({ autoApply: false }), payload(SMS_613));
    assert.equal(m.txs[0].review_reason, 'auto_apply_disabled');
    assert.equal(m.txs[0].suggested_invoice_id, 100);
    assert.equal(m.payments.length, 0);
  });
  test('дүн нэхэмжлэхтэй зөрвөл автоматаар баталгаажуулахгүй', async () => {
    const m = memoryStore({ mappings: SEED_MAPPINGS, residents: structuredClone(RESIDENTS), invoices: [inv(100, 10, 60000)] });
    await processIncomingSms(m.store, device(), payload(SMS_613));
    assert.equal(m.txs[0].review_reason, 'amount_mismatch');
    assert.equal(m.payments.length, 0);
  });
  test('нэг тоотод хоёр баталгаажсан айл → ambiguous, холбохгүй', async () => {
    const residents = [...structuredClone(RESIDENTS), { id: 20, sokh_id: ICTOWN, building: '2-2', apartment: '613', floor: '6', debt: 0 }];
    const m = memoryStore({ mappings: SEED_MAPPINGS, residents });
    await processIncomingSms(m.store, device(), payload(SMS_613));
    assert.equal(m.txs[0].matching_status, 'ambiguous');
    assert.equal(m.payments.length, 0);
  });
  test('гэр бүлийн гишүүн (floor хоосон) байвал даргын мөрийг сонгоно', async () => {
    const residents = [...structuredClone(RESIDENTS), { id: 21, sokh_id: ICTOWN, building: '2-2', apartment: '613', floor: null, debt: 0 }];
    const m = memoryStore({ mappings: SEED_MAPPINGS, residents, invoices: [inv(100, 10)] });
    await processIncomingSms(m.store, device(), payload(SMS_613));
    assert.equal(m.txs[0].resident_id, 10);
  });
  test('шийдэгдсэн гүйлгээг дахин тааруулахад өөр айлд шилжихгүй', async () => {
    const m = memoryStore({ mappings: SEED_MAPPINGS, residents: structuredClone(RESIDENTS), invoices: [inv(100, 10)] });
    await processIncomingSms(m.store, device(), payload(SMS_613));
    const t = m.txs[0];
    t.normalized_reference = '203RBAIR403TOOT'; // дүрэм/утга өөрчлөгдсөн гэж үзье
    const r = await matchTransaction(m.store, t, true);
    assert.equal(r.matching, 'skipped');
    assert.equal(t.resident_id, 10);
    assert.equal(m.payments.length, 1);
    await assert.rejects(m.store.applyPayment({ transactionId: t.id, residentId: 12, invoiceId: null, adminId: 1, mode: 'manual' }), /already_resolved/);
  });
});
