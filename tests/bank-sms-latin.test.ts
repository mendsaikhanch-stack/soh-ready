import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBankSms } from '../app/lib/bank-sms/core.ts';
import { ICTOWN_SCHEME, resolveUnitReference } from '../app/lib/bank-sms/unit-address.ts';

// ХасБанк 131888-ийн БОДИТ SMS латин үсгээр ирдэг (2026-10-25/26-ны дэлгэцийн зургаас).
// Нэр, утасны дугаарыг хассан.
const sms = (desc: string, amount = '55,000.00', balance = '61,909.93') =>
  `Tany 5006***029 toot dansand ${amount}MNT ORLOGO orloo. Uldegdel ${balance}MNT Ognoo: 2026-10-25; ${desc}`;

test('бодит латин орлогын SMS задлагдана', () => {
  const r = parseBankSms(sms('qpay 200000779046929 613toot'));
  assert.ok(r.ok);
  assert.equal(r.tx.accountReference, '5006***029');
  assert.equal(r.tx.amountMinor, 5500000);
  assert.equal(r.tx.balanceAfterMinor, 6190993);
  assert.equal(r.tx.transactionDate, '2026-10-25');
  assert.equal(r.tx.channel, 'qpay');
  assert.equal(r.tx.transactionReference, '200000779046929');
  assert.equal(r.tx.payerReference, '613toot');
});

test('бодит латин зарлагын SMS орлого болохгүй', () => {
  const r = parseBankSms('Tany 5006***029 toot dansnaas 1,000.00MNT ZARLAGA garlaa. Uldegdel 335,809.93MNT Ognoo: 2026-10-25; ShILJUULEGCh');
  assert.deepEqual(r, { ok: false, reason: 'debit_unverified' });
});

test('бодит латин утгуудаас тоот танигдана', () => {
  const cases: [string, string][] = [
    ['QPAY 200000779047099 203 R BAIR 403 TOOT', '203-403'],
    ['QPAY 200000779077359 498/1-404', '498-1-404'],
    ['QPAY 200000779079073 498/1-1 1604', '498-1-1604'],
    ['QPAY 200000779082267 5-R BAIR 2-R ORTs 1408 TOOT', '205-1408'],
    ['QPAY 200000779107331 2-2-610TOOT', '498-2-610'],
    ['QPAY 200000779163715 2-R BAIR 1-R ORTS 803 TOOT', '498-2-803'],
    ['QPAY 200000779169423 203-1203', '203-1203'],
    ['QPAY 200000779330431 2BLOK 1R ORTs 1306TOOT', '498-2-1306'],
    ['498-2-910TOOT', '498-2-910'],
    ['3-BAIR 305 TOOT', '203-305'],
    ['QPAY 200000779588073 205 BAIR 1509 TOOT', '205-1509'],
  ];
  for (const [desc, official] of cases) {
    const p = parseBankSms(sms(desc));
    assert.ok(p.ok, desc);
    const u = resolveUnitReference(ICTOWN_SCHEME, p.tx.payerReference);
    assert.equal(u.status === 'resolved' ? u.unit.official : u.status, official, desc);
  }
  // Дан тоот — таамаглахгүй, даргын шалгалт руу
  const p = parseBankSms(sms('QPAY 200000779209483 1602'));
  assert.ok(p.ok);
  assert.equal(resolveUnitReference(ICTOWN_SCHEME, p.tx.payerReference).status, 'unconfirmed');
});
