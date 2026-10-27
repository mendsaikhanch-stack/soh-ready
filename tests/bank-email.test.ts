import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maskAccount, parseBankSms, transactionIdempotencyKey } from '../app/lib/bank-sms/core.ts';

// ХасБанкны имэйл мэдэгдлийн БОДИТ бүтэц (2026-10-27-ны жишээ, Gmail plain text).
// Дансны дугаар, нэр, картын дугаарыг зохиомол утгаар сольсон.
const email = (kind: 'ОРЛОГЫН' | 'ЗАРЛАГЫН', desc: string, amount = '40,000.00', balance = '-107,077.16') => `
${kind} ГҮЙЛГЭЭ
logo
ГҮЙЛГЭЭНИЙ МЭДЭЭЛЭЛ
Эрхэм Харилцагч таны дансанд ${kind.toLowerCase()} гүйлгээ хийгдлээ.
Дэлгэрэнгүй мэдээлэлтэй танилцана уу.
ТӨЛБӨР ХҮЛЭЭН АВАГЧИЙН МЭДЭЭЛЭЛ
Банкны нэр:\tХасБанк-
Дансны дугаар:\t5006123029
Данс эзэмшигчийн нэр:\tТЕСТ ЭЗЭМШИГЧ
Гүйлгээний дүн:\t${amount}
Гүйлгээний валют:\tMNT
Дансны үлдэгдэл:\t${balance}MNT
Гүйлгээний утга:\t${desc}
Гүйлгээ хийсэн огноо:\t2026-10-27

Та энэ үйлчилгээний талаар асууж тодруулах зүйл байвал
1800-1888(энгийн утасны тарифаар) утсанд хандана уу.
Амьдралд - Ашид хамтдаа.
ХасБанк
`;

test('орлогын имэйл задлагдана, данс маскаар хадгалагдана', () => {
  const r = parseBankSms(email('ОРЛОГЫН', 'ШИЛЖҮҮЛЭГЧ БАТ'));
  assert.ok(r.ok);
  assert.equal(r.tx.accountReference, '5006***029');
  assert.equal(r.tx.amountMinor, 4000000);
  assert.equal(r.tx.balanceAfterMinor, -10707716);
  assert.equal(r.tx.transactionDate, '2026-10-27');
  assert.equal(r.tx.description, 'ШИЛЖҮҮЛЭГЧ БАТ');
  assert.equal(r.tx.channel, null);
  assert.equal(r.tx.payerReference, 'ШИЛЖҮҮЛЭГЧ БАТ');
});

test('имэйлийн QPay утгаас reference салгана', () => {
  const r = parseBankSms(email('ОРЛОГЫН', 'QPAY 200000779729503 498/2-1503 TOOT 10SAR SOH', '55,000.00', '1,381,361.93'));
  assert.ok(r.ok);
  assert.equal(r.tx.channel, 'qpay');
  assert.equal(r.tx.transactionReference, '200000779729503');
  assert.equal(r.tx.payerReference, '498/2-1503 TOOT 10SAR SOH');
  assert.equal(r.tx.balanceAfterMinor, 138136193);
  assert.equal(transactionIdempotencyKey(r.tx), 'ref:qpay:5006***029:200000779729503');
});

test('зарлагын имэйл орлого болохгүй', () => {
  const r = parseBankSms(email('ЗАРЛАГЫН', 'POS 70211754 BAYANZURKH DUUREG 49**********0000', '8,500.00'));
  assert.deepEqual(r, { ok: false, reason: 'debit_unverified' });
});

test('валют MNT биш, огноо буруу бол бүртгэхгүй', () => {
  assert.deepEqual(parseBankSms(email('ОРЛОГЫН', 'x').replace('валют:\tMNT', 'валют:\tUSD')), { ok: false, reason: 'unrecognized_format' });
  assert.deepEqual(parseBankSms(email('ОРЛОГЫН', 'x').replace('2026-10-27', '2026-13-45')), { ok: false, reason: 'bad_date' });
  assert.deepEqual(parseBankSms(email('ОРЛОГЫН', 'x', '0.00')), { ok: false, reason: 'bad_amount' });
});

test('maskAccount', () => {
  assert.equal(maskAccount('5006123029'), '5006***029');
  assert.equal(maskAccount('12345'), '12345');
});
