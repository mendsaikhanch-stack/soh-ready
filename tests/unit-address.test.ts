import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  ICTOWN_SCHEME, resolveUnitReference, officialUnitLabel, addressNumbers, type UnitResolution,
} from '../app/lib/bank-sms/unit-address.ts';
import {
  processIncomingSms, type BankSmsStore, type DeviceConfig, type MatchPatch, type NewTransaction,
} from '../app/lib/bank-sms/core.ts';

const r = (text: string) => resolveUnitReference(ICTOWN_SCHEME, text);
const keyOf = (x: UnitResolution) =>
  x.status === 'resolved' ? `${x.unit.building_number}-${x.unit.entrance_number}-${x.unit.apartment_number}` : x.status;
const cands = (x: UnitResolution) =>
  'candidates' in x ? x.candidates.map((c) => `${c.building_number}-${c.entrance_number}-${c.apartment_number}`).sort() : [];

// ── Хотол доторх бодит бүртгэл (production, 2026-10-26 шалгасан) ──
// 1-1: 101–107 … 1601–1607   2-1: 01–07   2-2: 08–14
// 3-1: 01–05                 5-1: 01–05   5-2: 06–10
const LAYOUT: { key: string; official: string; short: string; entrance: string; from: number; to: number }[] = [
  { key: '1-1', official: '498-1', short: '1', entrance: '1', from: 1, to: 7 },
  { key: '2-1', official: '498-2', short: '2', entrance: '1', from: 1, to: 7 },
  { key: '2-2', official: '498-2', short: '2', entrance: '2', from: 8, to: 14 },
  { key: '3-1', official: '203', short: '3', entrance: '1', from: 1, to: 5 },
  { key: '5-1', official: '205', short: '5', entrance: '1', from: 1, to: 5 },
  { key: '5-2', official: '205', short: '5', entrance: '2', from: 6, to: 10 },
];
const ALL_UNITS = LAYOUT.flatMap((l) =>
  Array.from({ length: 16 }, (_, f) => f + 1).flatMap((floor) =>
    Array.from({ length: l.to - l.from + 1 }, (_, i) => ({ ...l, apt: String(floor * 100 + l.from + i) }))));

describe('бүх 576 тоот — бичиглэл бүрээр', () => {
  test('нийт тоо Хотолын бүртгэлтэй таарна', () => {
    assert.equal(ALL_UNITS.length, 112 * 3 + 80 * 3);
  });

  test('албан ёсны, хуучин, Хотолын бүх хэлбэр ЯГ тэр айлд очно', () => {
    for (const u of ALL_UNITS) {
      const want = `${u.key}-${u.apt}`;
      const forms = [
        `${u.official}-${u.apt}`,                // 498-2-613 · 203-505 · 205-505
        `${u.official}-${u.entrance}-${u.apt}`.replace(/^498-1-1-/, '498-1-1-'),
        `${u.short}-${u.apt}`,                   // 2-613
        `${u.key}-${u.apt}`,                     // 2-2-613
        `${u.official} байр ${u.apt} тоот`,
        `${u.official.replace('-', '/')}-${u.apt}`, // 498/2-613
      ];
      for (const f of forms) {
        // «498-1-1-1607» нь 498-1 байр + 1-р орц
        assert.equal(keyOf(r(f)), want, `${f} → ${want}`);
      }
    }
  });

  test('498-тоот (дэд дугааргүй) ХЭЗЭЭ Ч автоматаар шийдэгдэхгүй', () => {
    for (const u of ALL_UNITS.filter((x) => x.official.startsWith('498'))) {
      const x = r(`498-${u.apt}`);
      assert.equal(x.status, 'unconfirmed', `498-${u.apt}`);
      assert.ok(cands(x).includes(`${u.key}-${u.apt}`));
    }
  });

  test('дан тоот ХЭЗЭЭ Ч автоматаар шийдэгдэхгүй', () => {
    for (const u of ALL_UNITS) {
      const x = r(`${u.apt} тоот`);
      assert.equal(x.status, 'unconfirmed', u.apt);
      assert.ok(cands(x).includes(`${u.key}-${u.apt}`));
    }
  });
});

describe('жишээнүүд (даргын тайлбараас)', () => {
  test('498-1', () => {
    assert.equal(keyOf(r('498-1-101')), '1-1-101');
    assert.equal(keyOf(r('498-1-1607')), '1-1-1607');
    assert.equal(keyOf(r('1-1-1607')), '1-1-1607');
  });
  test('498-1607 → 498-1 ба 498-2 хоёулаа боломжтой → шалгана', () => {
    assert.deepEqual(cands(r('498-1607')), ['1-1-1607', '2-1-1607']);
    // 1610 нь зөвхөн 498-2-т байгаа ч баталгаажуулалт заавал
    const x = r('498-1610');
    assert.equal(x.status, 'unconfirmed');
    assert.deepEqual(cands(x), ['2-2-1610']);
  });
  test('498-2: орц хамааралгүй дугаарлалт', () => {
    assert.equal(keyOf(r('498-2-107')), '2-1-107');
    assert.equal(keyOf(r('498-2-108')), '2-2-108');
    assert.equal(keyOf(r('498-2-1614')), '2-2-1614');
    assert.equal(keyOf(r('498-2-2-1614')), '2-2-1614');
    assert.equal(keyOf(r('2-1-1607')), '2-1-1607');
  });
  test('203 (3-1)', () => {
    for (const f of ['3-1-505', '203-505', '203-1-505', '203 R BAIR 505 TOOT', '203-р байр 1-р орц 505 тоот']) {
      assert.equal(keyOf(r(f)), '3-1-505', f);
    }
  });
  test('205 (5-1, 5-2)', () => {
    for (const f of ['205-1-505', '205-505', '5-1-505', '205 р байр 505 тоот']) assert.equal(keyOf(r(f)), '5-1-505', f);
    assert.equal(keyOf(r('205-506')), '5-2-506');
    assert.equal(keyOf(r('205-2-1610')), '5-2-1610');
  });
});

describe('эргэлзээтэй / буруу утга → таамаглахгүй', () => {
  test('орц тоотын дугаартай зөрвөл conflict', () => {
    const x = r('205-2-505');
    assert.equal(x.status, 'conflict');
    assert.deepEqual(cands(x), ['5-1-505']);
    assert.equal(r('498-2-1-613').status, 'conflict');
  });
  test('тэр байранд байхгүй тоот → invalid', () => {
    for (const f of ['203-506', '205-511', '498-1-1608', '498-2-1615', '205-1705', '3-1-005']) {
      assert.equal(r(f).status, 'invalid', f);
    }
  });
  test('танихгүй байр → none', () => {
    for (const f of ['207-505', '498-4-505', '1-2-505', '', 'Бат', '205-505 205-506 x y z']) {
      assert.equal(r(f).status, 'none', f);
    }
  });
  test('498/5, 498-3 — урьд гарсан алдаатай бичиглэл, зөвхөн санал', () => {
    assert.deepEqual(cands(r('498/5-101')), ['5-1-101']);
    assert.equal(r('498/5-101').status, 'unconfirmed');
    assert.deepEqual(cands(r('498-3-505')), ['3-1-505']);
  });
  test('сар, утас, дүн хаягт орохгүй', () => {
    assert.deepEqual(addressNumbers('10 сарын төлбөр 205-505'), ['205', '505']);
    assert.deepEqual(addressNumbers('10-р сар 205-505'), ['205', '505']);
    assert.deepEqual(addressNumbers('11 sariin 205-505'), ['205', '505']);
    assert.deepEqual(addressNumbers('99112233 55000 203-505'), ['203', '505']);
    assert.equal(keyOf(r('10 сарын хураамж 205-505 Бат')), '5-1-505');
    // «3 сар 505» — 3-1-505 гэж БҮҮ ойлго (3 бол сар)
    assert.equal(r('3 сар 505 тоот').status, 'unconfirmed');
    assert.equal(r('4981607').status, 'none'); // зайгүй нийлсэн — таамаглахгүй
  });
});

test('albан ёсны шошго', () => {
  assert.equal(officialUnitLabel(2694, '2-2', '613'), '498-2-613');
  assert.equal(officialUnitLabel(2694, '1-1', '1607'), '498-1-1607');
  assert.equal(officialUnitLabel(2694, '5-2', '506'), '205-506');
  assert.equal(officialUnitLabel(2694, '498/5', '101'), null);
  assert.equal(officialUnitLabel(1, '2-2', '613'), null);
});

// ── Төлбөр болгох урсгалтай холбосон ───────────────────────────
interface Tx extends NewTransaction, Partial<MatchPatch> { id: number; reconciliation_status: string; payment_id: number | null }

function store(residents: { id: number; building: string; apartment: string }[], mappings: { normalized_pattern: string; building_number: string; entrance_number: string; apartment_number: string }[] = []) {
  const txs: Tx[] = [];
  const payments: number[] = [];
  let ev = 0;
  const s: BankSmsStore = {
    async insertEvent() { return { inserted: true, id: ++ev }; },
    async updateEvent() {},
    async insertTransaction(row) { const id = txs.length + 1; txs.push({ ...row, id, reconciliation_status: 'needs_review', payment_id: null }); return { inserted: true, id }; },
    async findActiveMapping(_s, p) { const m = mappings.findIndex((x) => x.normalized_pattern === p); return m < 0 ? null : { id: m + 1, ...mappings[m] }; },
    async findResidents(_s, b, a) { return residents.filter((x) => x.building === b && x.apartment === a).map((x) => ({ id: x.id, floor: '5', pending_claim: false })); },
    async findOpenInvoices(_s, rid) { return [{ id: 1000 + rid, amount: 55000, previous_balance: 0, total_amount: 55000, paid_amount: 0, status: 'pending' }]; },
    async updateUnresolvedTransaction(id, patch) { Object.assign(txs.find((t) => t.id === id)!, patch); },
    async applyPayment({ transactionId, residentId }) {
      const t = txs.find((x) => x.id === transactionId)!;
      t.payment_id = payments.push(residentId); t.resident_id = residentId; t.reconciliation_status = 'auto_applied';
      return t.payment_id;
    },
  };
  return { s, txs, payments };
}
const DEV: DeviceConfig = { id: 1, sokhId: 2694, bank: 'xacbank', allowedSenders: ['131888'], accountMask: '5006***029', autoApply: true };
let n = 0;
const sms = (ref: string) => ({
  messageId: `unit-${++n}-abcdef`, sender: '131888', receivedAt: null,
  body: `Таны 5006***029 тоот дансанд 55,000.00MNT ORLOGO орлоо. Uldegdel 1,000.00MNT Ognoo: 2026-10-25; qpay 2000007790${String(n).padStart(5, '0')} ${ref}`,
});
const RES = [
  { id: 1, building: '5-1', apartment: '505' },
  { id: 2, building: '1-1', apartment: '1607' },
  { id: 3, building: '2-1', apartment: '1607' },
  { id: 4, building: '2-2', apartment: '1610' },
  { id: 5, building: '3-1', apartment: '505' },
];

describe('төлбөрийн урсгал', () => {
  test('«205-505» дүрэмгүйгээр 5-1-505-д автоматаар бүртгэгдэнэ', async () => {
    const m = store(RES);
    await processIncomingSms(m.s, DEV, sms('205-505'));
    assert.equal(m.txs[0].reconciliation_status, 'auto_applied');
    assert.equal(m.txs[0].resident_id, 1);
    assert.equal(m.txs[0].mapping_id, null);
  });
  test('«498 1607» (зайтай) — хоёр айл боломжтой, хэнд ч бүртгэхгүй', async () => {
    const m = store(RES);
    await processIncomingSms(m.s, DEV, sms('498 1607'));
    assert.equal(m.payments.length, 0);
    assert.equal(m.txs[0].review_reason, 'unit_unconfirmed');
    assert.equal(m.txs[0].matching_status, 'ambiguous');
    assert.equal(m.txs[0].resident_id ?? null, null);
  });
  test('«498-1610» — ганц айл санал болгоно, auto_apply асаалттай ч бүртгэхгүй', async () => {
    const m = store(RES);
    await processIncomingSms(m.s, DEV, sms('498-1610'));
    assert.equal(m.payments.length, 0);
    assert.equal(m.txs[0].review_reason, 'unit_unconfirmed');
    assert.equal(m.txs[0].resident_id, 4);
    assert.equal(m.txs[0].suggested_invoice_id, 1004);
  });
  test('дан «505 тоот» (3-1, 5-1 аль аль нь) → бүртгэхгүй', async () => {
    const m = store(RES);
    await processIncomingSms(m.s, DEV, sms('505 тоот'));
    assert.equal(m.payments.length, 0);
    assert.equal(m.txs[0].review_reason, 'unit_unconfirmed');
  });
  test('205-2-505 зөрүүтэй → бүртгэхгүй', async () => {
    const m = store(RES);
    await processIncomingSms(m.s, DEV, sms('205-2-505'));
    assert.equal(m.payments.length, 0);
    assert.equal(m.txs[0].review_reason, 'unit_conflict');
  });
  test('даргын дүрэм схемээс түрүүлнэ («505 тоот» → 3-1-505)', async () => {
    const m = store(RES, [{ normalized_pattern: '505TOOT', building_number: '3', entrance_number: '1', apartment_number: '505' }]);
    await processIncomingSms(m.s, DEV, sms('505 тоот'));
    assert.equal(m.txs[0].resident_id, 5);
    assert.equal(m.txs[0].reconciliation_status, 'auto_applied');
  });
  test('схемгүй СӨХ-д хуучин зан байдал (no_mapping)', async () => {
    const m = store(RES);
    await processIncomingSms(m.s, { ...DEV, sokhId: 9999 }, sms('205-505'));
    assert.equal(m.txs[0].review_reason, 'no_mapping');
  });
});
