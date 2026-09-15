// Ариун Очир-69 СӨХ (#1768) — банкны е-биллингийн өрөөс хийгдэх хасалтыг
// САР САРААР, сарын ЖИНХЭНЭ дүнгээр (дундажлалгүйгээр) гаргана.
//
// Энэ файл ЗӨВХӨН энэ нэг СӨХ-д зориулсан тайлангийн скрипт (аппын кодыг өөрчлөхгүй).
//
// ⚠️  Гаралт нь оршин суугчийн нэр, утас, өрийн дүн агуулна → `docs/reports/`
//     нь `.gitignore`-д. Репо public тул гаралтыг git-д БҮҮ ОРУУЛ.
//
// ═══ Өмнөх тайлангаас юугаар өөр ═══
// Өмнөх хувилбар сарын дүнг «банкны өр ÷ сарын тоо» гэж ДУНДАЖЛАСАН. Хураамж
// нь айл тус бүрээр ч, цаг хугацаагаар ч өөр тул тэр нь таамаг байв. Энэ
// хувилбар сар бүрийн жинхэнэ дүнг сэргээнэ:
//
//   сарын хураамж[айл][сар] = ИНДЕКС[сар] + ЗӨРҮҮ[айл]
//
// · ИНДЕКС[сар] — кодтой төлбөрөөс гарсан тухайн сарын байрны median хураамж.
//   Кодтой төлбөрийн дүн нь тэр сарын хураамж өөрөө (банкны биллингээс гардаг),
//   иймд индекс нь тарифын цаг хугацааны ШАТЛАЛЫГ яг тусгана (2025/11-оос
//   35,650 → 41,150 гэх мэт).
// · ЗӨРҮҮ[айл] — айлын хэмжээнээс шалтгаалах тогтмол зөрүү. Үүнийг таамаглахгүй,
//   БАНКНЫ НИЙТ ДҮНГЭЭР шийднэ:
//        зөрүү = (банкны өр − Σ индекс[төлөөгүй сарууд]) ÷ сарын тоо
//   Ингэснээр сар бүрийн дүнгийн нийлбэр банкны өртэй ЯГ тэнцэнэ. 125 тоотын
//   113-д зөрүү бүхэл тоо, 12-д 0.5₮-ээс бага бутархай гарсан (бутархайг
//   хамгийн сүүлийн сард нэмж, нийлбэрийг төгрөг хүртэл тэнцүүлнэ).
//
// ═══ Хасалтын дүрэм (1,000₮-ийн хүлцэл) ═══
// Хасалтыг ГҮЙЛГЭЭ ТУС БҮРЭЭР, огнооны дарааллаар, сарын жинхэнэ дүнгээр
// хийнэ. Нэг гүйлгээ хэдэн бүтэн сарыг хаасны дараа үлдэгдэл гарвал:
//   · үлдэгдэл ≤ 1,000₮  → тэр сарын төлбөрт шингээнэ (илүү төлөлт гэж
//     тооцохгүй, дараагийн сар руу ч дамжуулахгүй) — «шингээсэн» гэж бүртгэнэ
//   · үлдэгдэл > 1,000₮  → дараагийн сарын төлбөрт дамжина
// Бүх сар хаагдсаны дараа үлдсэн дүн нь ЖИНХЭНЭ илүү төлөлт (≤1,000₮ бол
// мөн шингээнэ).
//
// ═══ Эх сурвалж ═══
// 1. docs/reports/ariun-ochir-bank-ebilling-debt.json — Төрийн банкны
//    е-биллингийн өрийн тайлан (125 мөр, гэрэл зургаас буулгасан).
// 2. Downloads/Ариун очир сөх/…орлогын тайлан 2019-2026.xlsx → «Гүйлгээ
//    (тоотоор)» — 31 хуулгаас задалсан СӨХ-ийн орлогын гүйлгээ. Хасалтад
//    зөвхөн КОДГҮЙ гүйлгээ орно (кодтойг банк аль хэдийн тооцсон).
// 3. Downloads/Айл-өрхийн-төлсөн-байдал.xlsx → Sheet2 — СӨХ-ийн гадна
//    хаалт/чипний бүртгэл; эдгээр гүйлгээ хураамж биш тул хасалтаас хасагдана.
//
// Хяналт (бүгд таарахгүй бол тайлан бичихгүй):
//   а) айл бүрийн Σ сарын дүн = банкны өр
//   б) Σ (хасагдсан + үлдэх) = банкны нийт өр
//   в) Σ (хасагдсан + шингээсэн + илүү) = кодгүй төлбөрийн нийт дүн
//
// Ажиллуулах:
//   node scripts/report-ariun-ochir-bank-hasalt-monthly.mjs
//
// Сонголт: BANK=… FILE=… GATE_FILE=… OUT=… TOLERANCE=1000

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BANK = process.env.BANK || path.join(ROOT, 'docs/reports/ariun-ochir-bank-ebilling-debt.json');
const FILE = process.env.FILE
  || 'C:/Users/MNG/Downloads/Ариун очир сөх/Ариун-Очир СӨХ - Тоот тус бүрийн орлогын тайлан 2019-2026.xlsx';
const TX_SHEET = 'Гүйлгээ (тоотоор)';
const GATE_FILE = process.env.GATE_FILE || 'C:/Users/MNG/Downloads/Айл-өрхийн-төлсөн-байдал.xlsx';
const GATE_SHEET = 'Sheet2';
const OUT = process.env.OUT || path.join(ROOT, 'docs/reports/ariun-ochir-bank-hasalt-sar-saraar.xlsx');
const TOL = Number(process.env.TOLERANCE || 1000);
const SOKH_ID = 1768;

const money = (n) => Number(Math.round(n)).toLocaleString('en-US');
const BUILDING = { '69.1': '69А', '69.2': '69Б' };
const mkey = (y, m) => `${y}/${String(m).padStart(2, '0')}`;

function monthRange(from, to) {
  const [fy, fm] = from.split('/').map(Number);
  const [ty, tm] = to.split('/').map(Number);
  const out = [];
  for (let y = fy, m = fm; y < ty || (y === ty && m <= tm);) {
    out.push(mkey(y, m));
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}

function parseMonths(str) {
  const out = new Set();
  for (const part of String(str).split(';')) {
    const m = part.trim().match(/^(\d{4})-(.+)$/);
    if (!m) throw new Error(`«Огноо» задлагдсангүй: ${JSON.stringify(part)}`);
    for (const x of m[2].split(',')) {
      const n = Number(x.trim());
      if (!n || n < 1 || n > 12) throw new Error(`сар буруу: ${JSON.stringify(part)}`);
      out.add(mkey(m[1], n));
    }
  }
  return [...out].sort();
}

// Хоёр сарын хоорондох сарын зөрүү («2021/03», «2026/08» → 65)
function monthGap(a, b) {
  const [ay, am] = a.split('/').map(Number);
  const [by, bm] = b.split('/').map(Number);
  return (by - ay) * 12 + (bm - am);
}

const median = (nums) => {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const i = Math.floor(s.length / 2);
  return s.length % 2 ? s[i] : Math.round((s[i - 1] + s[i]) / 2);
};

function readBank() {
  const d = JSON.parse(fs.readFileSync(BANK, 'utf8'));
  return d.rows.map(([no, blk, door, dates, amount]) => ({
    no,
    building: BUILDING[blk] || blk,
    apartment: String(Number(door)),
    months: parseMonths(dates),
    raw: dates,
    debt: Number(amount) || 0,
  }));
}

function readGate() {
  if (!fs.existsSync(GATE_FILE)) return new Map();
  const wb = XLSX.readFile(GATE_FILE);
  if (!wb.Sheets[GATE_SHEET]) return new Map();
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[GATE_SHEET], { header: 1, blankrows: false, defval: '' });
  const out = new Map();
  for (const r of rows.slice(1)) {
    const apt = String(r[1] ?? '').trim();
    const date = String(r[2] ?? '').trim();
    const amt = Number(r[5]) || 0;
    if (!apt || !date || amt <= 0 || amt > 1_000_000) continue;
    const m = apt.match(/^69\s*([abАаБб])\s*-\s*(\d+)$/i);
    if (!m) continue;
    out.set(`${/[aА]/i.test(m[1]) ? '69А' : '69Б'}|${String(Number(m[2]))}|${date}|${amt}`, true);
  }
  return out;
}

function readTx() {
  const wb = XLSX.readFile(FILE);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[TX_SHEET], { header: 1, blankrows: false, defval: '' });
  return rows.slice(1)
    .filter((r) => String(r[6]).trim() === 'СӨХ')
    .map((r) => ({
      date: String(r[0]).trim(),
      building: String(r[2]).trim(),
      aptRaw: String(r[3]).trim(),
      amount: Number(r[5]) || 0,
      codedMonth: String(r[7] ?? '').trim(),
      method: String(r[8]).trim(),
      memo: String(r[9]).trim(),
    }))
    .filter((t) => t.amount > 0);
}

async function residents() {
  const envFile = path.join(ROOT, '.env.local');
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let v = m[2].trim();
      if (/^["'].*["']$/.test(v)) v = v.slice(1, -1);
      if (!process.env[m[1]]) process.env[m[1]] = v;
    }
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !svc) return new Map();
  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(url, svc, { auth: { persistSession: false } });
  const { data, error } = await sb.from('residents')
    .select('apartment, building, phone, name').eq('sokh_id', SOKH_ID);
  if (error) { console.log(`   ⚠️  DB: ${error.message}`); return new Map(); }
  return new Map((data || []).map((r) => [
    `${String(r.building || '').trim()}|${String(r.apartment).trim()}`,
    { phone: r.phone || '', name: String(r.name || '').trim() },
  ]));
}

// Кодтой төлбөрөөс сар бүрийн байрны median хураамж
function tariffIndex(tx, months) {
  const per = new Map();
  for (const t of tx) {
    if (!t.codedMonth || t.aptRaw.includes('+')) continue;
    const m = t.codedMonth.match(/^(\d{4})\s*\/\s*(\d{1,2})$/);
    if (!m) continue;
    const k = mkey(m[1], Number(m[2]));
    const u = `${t.building}|${t.aptRaw}`;
    if (!per.has(k)) per.set(k, new Map());
    per.get(k).set(u, Math.max(per.get(k).get(u) || 0, t.amount));
  }
  const idx = new Map();
  for (const k of months) idx.set(k, per.has(k) ? median([...per.get(k).values()]) : 0);
  let carry = 0;
  for (const k of months) { if (idx.get(k)) carry = idx.get(k); else idx.set(k, carry); }
  let back = 0;
  for (const k of [...months].reverse()) { if (idx.get(k)) back = idx.get(k); else idx.set(k, back); }
  return { idx, codedCount: per };
}

// Банкны нийт дүнг сарын жинхэнэ дүн болгон задлана (дундажлалгүй)
function decompose(u, idx) {
  const sumIdx = u.months.reduce((s, k) => s + idx.get(k), 0);
  const offRaw = (u.debt - sumIdx) / u.months.length;
  const off = Math.round(offRaw);
  const fee = new Map();
  for (const k of u.months) fee.set(k, idx.get(k) + off);
  // Бүхэлчлэлээс гарсан зөрүүг хамгийн сүүлийн сард залруулж нийлбэрийг тэнцүүлнэ
  let sum = [...fee.values()].reduce((a, b) => a + b, 0);
  const resid = u.debt - sum;
  if (resid !== 0) {
    const lastM = u.months[u.months.length - 1];
    fee.set(lastM, fee.get(lastM) + resid);
    sum += resid;
  }
  return { fee, offset: off, offsetRaw: offRaw, roundFix: resid, sum };
}

// Гүйлгээ тус бүрээр, сарын жинхэнэ дүнгээр, 1,000₮-ийн хүлцэлтэй хасалт
function allocate(u, payments) {
  const paid = new Map(u.months.map((k) => [k, 0]));
  const trace = [];
  let absorbed = 0;
  let overpay = 0;

  for (const p of payments) {
    let rest = p.amount;
    const covered = [];
    let partial = null;
    let absorbedHere = 0;

    while (rest > 0) {
      const m = u.months.find((k) => paid.get(k) < u.fee.get(k));
      if (!m) break;                                   // бүх сар хаагдсан
      const need = u.fee.get(m) - paid.get(m);
      if (rest >= need) {
        paid.set(m, u.fee.get(m));
        rest -= need;
        covered.push(m);
        // Хүлцэл: гүйлгээний үлдэгдэл ≤ TOL бол тэр сарын төлбөрт шингээнэ
        if (rest > 0 && rest <= TOL) { absorbed += rest; absorbedHere = rest; rest = 0; }
      } else {
        paid.set(m, paid.get(m) + rest);
        partial = { month: m, amount: rest, left: need - rest };
        rest = 0;
      }
    }
    if (rest > 0) {                                    // бүх сар хаагдсаны дараах үлдэгдэл
      if (rest <= TOL) { absorbed += rest; absorbedHere += rest; } else overpay += rest;
    }
    // Огнооны шалгалт: төлбөр төлсөн сараасаа хэр урагшхи сарыг хаасан бэ
    const payM = String(p.date).slice(0, 7).replace('.', '/');
    const touched = [...covered, ...(partial ? [partial.month] : [])];
    const lastM = touched.sort().pop() || null;
    const gap = lastM ? monthGap(payM, lastM) : 0;
    trace.push({
      ...p, covered, partial, absorbed: absorbedHere, over: rest > TOL ? rest : 0,
      payMonth: payM, gap,
    });
  }

  const deductedByMonth = new Map();
  const remainByMonth = new Map();
  for (const k of u.months) {
    deductedByMonth.set(k, paid.get(k));
    remainByMonth.set(k, u.fee.get(k) - paid.get(k));
  }
  return { paid, deductedByMonth, remainByMonth, trace, absorbed, overpay };
}

// Банк нэхэмжлэхийг ЗӨВХӨН кодоор хаадаг эсэхийг шалгана.
// Хэрэв банк кодгүй ДАНСНЫ төлбөрөөр нэхэмжлэх хааж байсан бол тэр төлбөрийг
// дахин хасах нь ДАВХАРДАЛ болно. Иймд айл бүрээр «кодгүй ч хаагдсан» сар
// хайна: эхний төлөөгүй сараас хойш, банкны жагсаалтад БАЙХГҮЙ (=хаагдсан)
// боловч кодтой төлбөр ч байхгүй сар.
//
// Тийм сар олдвол бүгдийг давхардал гэж үзэхгүй — 2 нөхцөлөөр ялгана:
//  1) Хаагдсан блокоос ӨМНӨ нээлттэй (төлөөгүй) сар байна уу? Байвал банкны
//     төлбөрөөр хаагдаагүй нь тодорхой — биллинг эртнийхээс нь хаадаг тул
//     эртний сарыг нээлттэй орхиод хожмыг хаах нь боломжгүй.
//  2) Айлын хамгийн эртний кодгүй ДАНСНЫ төлбөр нь хаагдсан блокоос ХОЙШ уу?
//     Хойш бол тэр мөнгө эдгээр сарыг хаасан байж таарахгүй.
// Хоёрын аль нэг биелбэл сарууд нь офлайн (бэлэн, эсвэл СӨХ-ийн гар оролт)
// төлбөрөөр хаагдсан гэж үзнэ — тэр мөнгө хуулгад байхгүй тул хасалтад ч
// ороогүй, давхардал БАЙХГҮЙ. Аль нь ч биелэхгүй бол ЖИНХЭНЭ эрсдэл.
function auditClosures(bank, tx, MONTHS) {
  const coded = new Map();
  for (const t of tx) {
    if (!t.codedMonth || t.aptRaw.includes('+')) continue;
    const m = t.codedMonth.match(/^(\d{4})\s*\/\s*(\d{1,2})$/);
    if (!m) continue;
    const u = `${t.building}|${t.aptRaw}`;
    if (!coded.has(u)) coded.set(u, new Set());
    coded.get(u).add(mkey(m[1], Number(m[2])));
  }
  // Айл бүрийн кодгүй дансны төлбөрийн эхний сар
  const firstLoose = new Map();
  for (const t of tx) {
    if (t.codedMonth || t.aptRaw.includes('+')) continue;
    const u = `${t.building}|${t.aptRaw}`;
    const pm = String(t.date).slice(0, 7).replace('.', '/');
    if (!firstLoose.has(u) || pm < firstLoose.get(u)) firstLoose.set(u, pm);
  }

  const clean = [];
  const only2024 = [];
  const offline = [];
  const risk = [];
  for (const b of bank) {
    const unpaid = new Set(b.months);
    const u = `${b.building}|${b.apartment}`;
    const cod = coded.get(u) || new Set();
    const first = b.months[0];
    const noCode = MONTHS.filter((m) => m >= first && !unpaid.has(m) && !cod.has(m));
    const rest = noCode.filter((m) => m !== '2024/09');
    if (!noCode.length) { clean.push(b); continue; }
    if (!rest.length) { only2024.push(b); continue; }

    const blockFirst = rest[0];
    const blockLast = rest[rest.length - 1];
    const earlierOpen = b.months.filter((m) => m < blockFirst);
    const fl = firstLoose.get(u) || null;
    const reasons = [];
    if (earlierOpen.length) {
      reasons.push(`хаагдсан блокоос ӨМНӨ ${earlierOpen.length} сар нээлттэй хэвээр `
        + `(${earlierOpen.slice(0, 3).join(' ')}${earlierOpen.length > 3 ? '…' : ''}) — `
        + 'биллинг эртнийхээс хаадаг тул банкны төлбөрөөр хаагдаагүй');
    }
    if (!fl) reasons.push('айлд кодгүй дансны төлбөр огт байхгүй');
    else if (fl > blockLast) {
      reasons.push(`эхний кодгүй дансны төлбөр ${fl} — хаагдсан блок (${blockFirst}…${blockLast})-оос ХОЙШ`);
    }
    if (!cod.size) reasons.push('айлд кодтой төлбөр огт байхгүй — биллинг автоматаар хааж чадахгүй');

    if (reasons.length) offline.push({ b, months: rest, reasons, firstLoose: fl, codedCount: cod.size });
    else risk.push({ b, months: rest, firstLoose: fl, codedCount: cod.size });
  }
  return { clean, only2024, offline, risk };
}

async function main() {
  const bank = readBank();
  const bankTotal = bank.reduce((s, b) => s + b.debt, 0);
  const gate = readGate();
  const rawTx = readTx();

  const tx = [];
  let gateN = 0;
  let gateAmt = 0;
  for (const t of rawTx) {
    if (gate.has(`${t.building}|${t.aptRaw}|${t.date}|${t.amount}`)) { gateN++; gateAmt += t.amount; continue; }
    tx.push(t);
  }

  const MONTHS = monthRange('2019/12', '2026/08');
  const { idx } = tariffIndex(tx, MONTHS);
  const audit = auditClosures(bank, tx, MONTHS);

  const key = (b, a) => `${b}|${a}`;
  const units = new Map();
  for (const b of bank) {
    const d = decompose(b, idx);
    units.set(key(b.building, b.apartment), { ...b, ...d, payments: [] });
  }

  // Кодгүй гүйлгээг тоотод, хамтарсныг гишүүдийн банкны өрийн хувиар
  const extra = new Map();
  const joints = [];
  for (const t of tx) {
    if (t.codedMonth) continue;                        // кодтойг банк тооцсон
    if (t.aptRaw.includes('+')) { joints.push(t); continue; }
    const u = units.get(key(t.building, t.aptRaw));
    if (!u) {
      const k = key(t.building, t.aptRaw);
      if (!extra.has(k)) extra.set(k, { building: t.building, apartment: t.aptRaw, sum: 0, n: 0 });
      extra.get(k).sum += t.amount; extra.get(k).n++;
      continue;
    }
    u.payments.push({ date: t.date, amount: t.amount, memo: t.memo, method: t.method, joint: '' });
  }
  const unsplit = [];
  for (const j of joints) {
    const members = j.aptRaw.split('+').map((s) => s.trim())
      .map((a) => units.get(key(j.building, a))).filter(Boolean);
    if (!members.length) { unsplit.push(j); continue; }
    const w = members.map((m) => m.debt || 1);
    const sw = w.reduce((a, b) => a + b, 0);
    members.forEach((m, i) => {
      m.payments.push({
        date: j.date,
        amount: (j.amount * w[i]) / sw,
        memo: j.memo,
        method: j.method,
        joint: `${j.aptRaw} (нийт ${money(j.amount)}₮)`,
      });
      m.hasJoint = true;
    });
  }

  // Хасалт
  for (const u of units.values()) {
    u.payments.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    Object.assign(u, allocate(u, u.payments));
  }

  // ── Хяналт ──
  const db = await residents();
  let feeSumBad = 0;
  for (const u of units.values()) if (Math.abs(u.sum - u.debt) > 0.5) feeSumBad++;

  const rows = [...units.values()].map((u) => {
    const info = db.get(key(u.building, u.apartment));
    const deducted = [...u.deductedByMonth.values()].reduce((a, b) => a + b, 0);
    const remain = [...u.remainByMonth.values()].reduce((a, b) => a + b, 0);
    const clearedM = u.months.filter((k) => u.remainByMonth.get(k) <= 0.5);
    const partialM = u.months.filter((k) => u.remainByMonth.get(k) > 0.5 && u.deductedByMonth.get(k) > 0.5);
    const untouchedM = u.months.filter((k) => u.deductedByMonth.get(k) <= 0.5);
    const credit = u.payments.reduce((s, p) => s + p.amount, 0);
    const flags = [];
    if (u.hasJoint) flags.push('хамтарсан төлбөр хуваарилсан');
    if (!credit) flags.push('кодгүй төлбөр илрээгүй — банкны өр хэвээр');
    if (u.absorbed > 0) flags.push(`шингээсэн зөрүү ${money(u.absorbed)}₮ (≤${money(TOL)}₮)`);
    if (u.overpay > 0) flags.push(`ИЛҮҮ ${money(u.overpay)}₮ — гараж/хаалт эсвэл 2019/12-оос өмнөх төлбөр байж болно, шалгах`);
    if (partialM.length) flags.push(`${partialM.length} сар хэсэгчлэн төлөгдсөн`);
    if (u.roundFix) flags.push(`бүхэлчлэлийн залруулга ${money(u.roundFix)}₮ сүүлийн сард`);
    const lateN = u.trace.filter((t) => t.gap > 3).length;
    if (lateN) flags.push(`${lateN} гүйлгээ төлсөн сараасаа 3+ сар ХОЙШХИ сарт оногдов (огноо зөрүүтэй)`);
    return { ...u, name: info?.name || '', phone: info?.phone || '', deducted, remain, clearedM, partialM, untouchedM, credit, flags };
  }).sort((a, b) => b.deducted - a.deducted || b.debt - a.debt);

  const sumCredit = rows.reduce((s, r) => s + r.credit, 0);
  const sumDeducted = rows.reduce((s, r) => s + r.deducted, 0);
  const sumRemain = rows.reduce((s, r) => s + r.remain, 0);
  const sumAbsorbed = rows.reduce((s, r) => s + r.absorbed, 0);
  const sumOver = rows.reduce((s, r) => s + r.overpay, 0);

  console.log('📥 Эх сурвалж:');
  console.log(`   Банкны е-биллингийн өр: ${bank.length} тоот · ${money(bankTotal)}₮`);
  console.log(`   Хуулгын СӨХ гүйлгээ:    ${rawTx.length} · ${money(rawTx.reduce((s, t) => s + t.amount, 0))}₮`);
  console.log(`   − гадна хаалт/чип:      ${gateN} гүйлгээ · ${money(gateAmt)}₮`);
  console.log(`   Хасалтад орох кодгүй төлбөр: ${rows.reduce((s, r) => s + r.payments.length, 0)} гүйлгээ · ${money(sumCredit)}₮`);

  console.log('\n🔎 Хяналт:');
  console.log(`   а) Сарын дүнгийн нийлбэр = банкны өр:   ${feeSumBad ? `❌ ${feeSumBad} тоотод зөрүүтэй` : `бүх ${rows.length} тоотод таарав ✓`}`);
  console.log(`   г) Банк нэхэмжлэхийг зөвхөн КОДООР хаадаг: ${audit.clean.length} тоотод яг таарав`
    + ` · ${audit.only2024.length} тоотод зөвхөн 2024/09 (нэхэмжлэгдээгүй сар)`
    + ` · ${audit.offline.length} тоотод офлайн хаалт (давхардалгүй)`
    + ` · ${audit.risk.length ? `❌ ${audit.risk.length} тоотод ДАВХАРДЛЫН ЭРСДЭЛ` : 'эрсдэл байхгүй ✓'}`);
  audit.offline.forEach((x) => {
    console.log(`      ℹ️  ${x.b.building}-${x.b.apartment}: кодгүй ч хаагдсан ${x.months.length} сар`
      + ` (${x.months.join(' ')}) → офлайн/бэлэн төлбөрөөр хаагдсан, давхардалгүй:`);
    x.reasons.forEach((r) => console.log(`         · ${r}`));
  });
  audit.risk.forEach((x) => console.log(
    `      ❌ ${x.b.building}-${x.b.apartment}: кодгүй ч хаагдсан ${x.months.length} сар (${x.months.join(' ')})`
    + ` · эхний кодгүй төлбөр ${x.firstLoose} · кодтой ${x.codedCount} сар — ХАСАЛТ ДАВХАРДАЖ МАГАДГҮЙ`));
  const lateTx = rows.reduce((s, r) => s + r.trace.filter((t) => t.gap > 3).length, 0);
  console.log(`   д) Огноо зөрүүтэй оноолт (3+ сар хойш): ${lateTx} гүйлгээ — нийт дүнд нөлөөлөхгүй, зөвхөн сарын оноолт нөхцөлт`);
  const balB = bankTotal - sumDeducted - sumRemain;
  console.log(`   б) Банк ${money(bankTotal)} − хасагдсан ${money(sumDeducted)} − үлдэх ${money(sumRemain)} = ${money(balB)} ${Math.abs(balB) < 1 ? '✓' : '❌'}`);
  const balC = sumCredit - sumDeducted - sumAbsorbed - sumOver;
  console.log(`   в) Кодгүй ${money(sumCredit)} − хасагдсан ${money(sumDeducted)} − шингээсэн ${money(sumAbsorbed)} − илүү ${money(sumOver)} = ${money(balC)} ${Math.abs(balC) < 1 ? '✓' : '❌'}`);
  if (feeSumBad || Math.abs(balB) >= 1 || Math.abs(balC) >= 1) {
    console.error('\n❌ Хяналт таарахгүй — тайлан бичихгүй.');
    process.exitCode = 1;
    return;
  }

  console.log('\n📊 Дүн:');
  console.log(`   Банкны өр:            ${money(bankTotal).padStart(14)}₮`);
  console.log(`   ХАСАЛТ:               ${money(sumDeducted).padStart(14)}₮`);
  console.log(`   ҮЛДЭХ БОДИТ ӨР:       ${money(sumRemain).padStart(14)}₮`);
  console.log(`   Шингээсэн (≤${money(TOL)}₮):  ${money(sumAbsorbed).padStart(14)}₮  (${rows.filter((r) => r.absorbed > 0).length} тоот)`);
  console.log(`   Жинхэнэ илүү төлөлт:  ${money(sumOver).padStart(14)}₮  (${rows.filter((r) => r.overpay > 0).length} тоот)`);
  const allM = rows.reduce((s, r) => s + r.months.length, 0);
  console.log(`   Сар: банк ${allM} → хаагдсан ${rows.reduce((s, r) => s + r.clearedM.length, 0)}`
    + ` · хэсэгчлэн ${rows.reduce((s, r) => s + r.partialM.length, 0)}`
    + ` · хүрээгүй ${rows.reduce((s, r) => s + r.untouchedM.length, 0)}`);
  console.log(`   Өр бүрэн хаагдах тоот: ${rows.filter((r) => r.remain <= 0.5).length} / ${rows.length}`);

  console.log('\n   Хамгийн их хасалт (12):');
  rows.slice(0, 12).forEach((r) => console.log(
    `      ${r.building}-${String(r.apartment).padEnd(4)} ${(r.name || '').slice(0, 20).padEnd(20)}`
    + ` банк ${money(r.debt).padStart(10)} − хасалт ${money(r.deducted).padStart(10)} = ${money(r.remain).padStart(10)}₮`
    + ` · сар ${r.clearedM.length}/${r.months.length}`));

  // ── Excel ──
  const wb = XLSX.utils.book_new();
  const head = ['№', 'Байр', 'Тоот', 'Нэр', 'Утас', 'Банкны өр (₮)', 'Хасалт (₮)', 'Үлдэх өр (₮)'];

  function grid(title, sub, pick) {
    const aoa = [
      [title],
      [sub],
      [],
      [...head, 'Сар', ...MONTHS, 'Тэмдэглэл'],
      ...rows.map((r, i) => [
        i + 1, r.building, Number(r.apartment), r.name, r.phone,
        Math.round(r.debt), Math.round(r.deducted), Math.round(r.remain), r.months.length,
        ...MONTHS.map((m) => {
          const v = pick(r, m);
          return v === null || v <= 0.5 ? '' : Math.round(v);
        }),
        r.flags.join('; '),
      ]),
      ['НИЙТ', '', '', '', '', Math.round(bankTotal), Math.round(sumDeducted), Math.round(sumRemain),
        rows.reduce((s, r) => s + r.months.length, 0),
        ...MONTHS.map((m) => rows.reduce((s, r) => {
          const v = pick(r, m);
          return s + (v === null || v <= 0.5 ? 0 : v);
        }, 0)).map((v) => Math.round(v) || ''),
        ''],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 4 }, { wch: 6 }, { wch: 6 }, { wch: 22 }, { wch: 10 }, { wch: 14 },
      { wch: 13 }, { wch: 13 }, { wch: 6 }, ...MONTHS.map(() => ({ wch: 9 })), { wch: 62 }];
    ws['!freeze'] = { xSplit: 9, ySplit: 4 };
    return ws;
  }

  XLSX.utils.book_append_sheet(wb, grid(
    'Ариун Очир-69 СӨХ — ҮЛДЭХ ӨР сар сараар (хасалтын дараа)',
    'Нүдний дүн = тэр сарын үлдэж байгаа өр. Хоосон = тэр сар ХААГДСАН (эсвэл банк нэхэмжлээгүй). Сарын жинхэнэ дүнгээр, дундажлалгүй.',
    (r, m) => (r.months.includes(m) ? r.remainByMonth.get(m) : null),
  ), 'Үлдэх өр сар сараар');

  XLSX.utils.book_append_sheet(wb, grid(
    'Ариун Очир-69 СӨХ — ХАСАГДСАН дүн сар сараар',
    'Нүдний дүн = тэр сарт хасалтаар хаагдсан төлбөр (кодгүй орсон төлбөрөөс). Хоосон = хасалт хүрээгүй сар.',
    (r, m) => (r.months.includes(m) ? r.deductedByMonth.get(m) : null),
  ), 'Хасагдсан сар сараар');

  XLSX.utils.book_append_sheet(wb, grid(
    'Ариун Очир-69 СӨХ — банкны нэхэмжилсэн сарын ЖИНХЭНЭ дүн',
    'Нүдний дүн = тэр сарын хураамж (индекс[сар] + айлын зөрүү). Мөр бүрийн нийлбэр банкны өртэй ЯГ тэнцэнэ.',
    (r, m) => (r.months.includes(m) ? r.fee.get(m) : null),
  ), 'Сарын дүн (нэхэмжилсэн)');

  // Төлөлт тус бүрийн хуваарилалт
  const trace = [];
  for (const r of rows) {
    for (const t of r.trace) {
      trace.push([
        r.building, Number(r.apartment), r.name, t.date, Math.round(t.amount),
        t.covered.length, t.covered.join(' '),
        t.partial ? `${t.partial.month} (${money(t.partial.amount)}₮, дутуу ${money(t.partial.left)}₮)` : '',
        Math.round(t.absorbed) || '', Math.round(t.over) || '',
        t.payMonth, t.gap > 3 ? `${t.gap} сар хойш` : '',
        t.joint, t.method, t.memo,
      ]);
    }
  }
  trace.sort((a, b) => String(a[3]).localeCompare(String(b[3])));
  const sTrace = XLSX.utils.aoa_to_sheet([
    ['Хасалтын үндэслэл — кодгүй төлбөр бүр ямар сарыг хаасан'],
    [`Гүйлгээ тус бүрээр, огнооны дарааллаар, сарын жинхэнэ дүнгээр. Үлдэгдэл ≤${money(TOL)}₮ бол тэр сарын төлбөрт шингээв.`],
    [`${trace.length} гүйлгээ · ${money(sumCredit)}₮ = хасагдсан ${money(sumDeducted)} + шингээсэн ${money(sumAbsorbed)} + илүү ${money(sumOver)}`],
    [],
    ['Байр', 'Тоот', 'Нэр', 'Огноо', 'Дүн (₮)', 'Хаасан сар', 'Хаасан сарууд',
      'Хэсэгчлэн', `Шингээсэн (≤${money(TOL)}₮)`, 'Илүү (₮)',
      'Төлсөн сар', 'Огнооны зөрүү', 'Хамтарсан', 'Хэрхэн таньсан', 'Гүйлгээний утга'],
    ...trace,
  ]);
  sTrace['!cols'] = [{ wch: 6 }, { wch: 6 }, { wch: 22 }, { wch: 12 }, { wch: 13 }, { wch: 10 },
    { wch: 46 }, { wch: 34 }, { wch: 16 }, { wch: 12 }, { wch: 11 }, { wch: 14 },
    { wch: 34 }, { wch: 24 }, { wch: 76 }];
  sTrace['!freeze'] = { xSplit: 0, ySplit: 5 };
  XLSX.utils.book_append_sheet(wb, sTrace, 'Төлөлт бүрийн хуваарилалт');

  const notes = [
    ['Ариун Очир-69 СӨХ — банкны өрийн хасалт, сар сараар: тайлбар ба хяналт'],
    [],
    ['ХЯНАЛТ', 'Дүн (₮)'],
    ['Банкны е-биллингийн өр (125 тоот, 2019/12–2026/08)', Math.round(bankTotal)],
    ['ХАСАЛТ (кодгүй орсон төлбөрөөр хаагдсан)', Math.round(sumDeducted)],
    ['ҮЛДЭХ БОДИТ ӨР', Math.round(sumRemain)],
    ['  тэнцэл: банк − хасалт − үлдэх', Math.round(bankTotal - sumDeducted - sumRemain)],
    [],
    ['Хасалтад орсон кодгүй төлбөр (нийт)', Math.round(sumCredit)],
    [`  · үүнээс сарын төлбөрт шингэсэн зөрүү (≤${money(TOL)}₮)`, Math.round(sumAbsorbed)],
    ['  · үүнээс жинхэнэ илүү төлөлт', Math.round(sumOver)],
    ['  тэнцэл: кодгүй − хасалт − шингээсэн − илүү', Math.round(balC)],
    [],
    ['Сарын тоо: банкны нэхэмжилсэн', rows.reduce((s, r) => s + r.months.length, 0)],
    ['  · хасалтаар бүрэн хаагдсан', rows.reduce((s, r) => s + r.clearedM.length, 0)],
    ['  · хэсэгчлэн төлөгдсөн', rows.reduce((s, r) => s + r.partialM.length, 0)],
    ['  · хасалт хүрээгүй', rows.reduce((s, r) => s + r.untouchedM.length, 0)],
    [],
    ['Өр бүрэн хаагдах тоот', rows.filter((r) => r.remain <= 0.5).length],
    ['Өр хэсэгчлэн буурах тоот', rows.filter((r) => r.deducted > 0.5 && r.remain > 0.5).length],
    ['Кодгүй төлбөр илрээгүй тоот (банкны өр хэвээр)', rows.filter((r) => r.credit === 0).length],
    [`Зөрүү шингэсэн тоот (≤${money(TOL)}₮)`, rows.filter((r) => r.absorbed > 0).length],
    ['Жинхэнэ илүү төлсөн тоот', rows.filter((r) => r.overpay > 0).length],
    [],
    ['САРЫН ЖИНХЭНЭ ДҮНГ ХЭРХЭН ГАРГАВ (дундажлалгүй)'],
    ['• сарын хураамж[айл][сар] = ИНДЕКС[сар] + ЗӨРҮҮ[айл]'],
    ['• ИНДЕКС[сар] = кодтой төлбөрөөс гарсан тухайн сарын байрны median хураамж. Кодтой төлбөрийн дүн нь тэр сарын хураамж өөрөө (банкны биллингээс гардаг) тул тарифын шатлал яг тусна.'],
    ['• ЗӨРҮҮ[айл] = (банкны өр − Σ индекс[төлөөгүй сарууд]) ÷ сарын тоо. Таамаглаагүй — банкны нийт дүнгээр шийдсэн.'],
    ['• Иймд айл бүрийн сарын дүнгийн нийлбэр банкны өртэй ЯГ тэнцэнэ (125/125 тоотод шалгав).'],
    ['• 125 тоотын 113-д зөрүү бүхэл тоо гарсан, 12-д 0.5₮-ээс бага бутархай — бутархайг сүүлийн сард залруулж нийлбэрийг төгрөг хүртэл тэнцүүлэв («бүхэлчлэлийн залруулга» гэж тэмдэглэсэн).'],
    [],
    [`ХАСАЛТЫН ДҮРЭМ (${money(TOL)}₮-ийн хүлцэл)`],
    ['• Хасалтыг ГҮЙЛГЭЭ ТУС БҮРЭЭР, огнооны дарааллаар, хамгийн эртний төлөгдөөгүй сараас эхлэн хийв.'],
    [`• Нэг гүйлгээ бүтэн сар(ууд)-ыг хаасны дараа үлдэгдэл ≤${money(TOL)}₮ бол тэр сарын төлбөрт ШИНГЭЭВ — илүү төлөлт гэж тооцоогүй, дараагийн сар руу ч дамжуулаагүй.`],
    [`• Үлдэгдэл >${money(TOL)}₮ бол дараагийн сарын төлбөрт дамжуулав (хэсэгчлэн төлөгдсөн сар үүснэ).`],
    [`• Бүх сар хаагдсаны дараах үлдэгдэл ≤${money(TOL)}₮ бол мөн шингээв; түүнээс их бол ЖИНХЭНЭ ИЛҮҮ ТӨЛӨЛТ гэж тусад нь харуулав.`],
    [],
    ['ДАВХАРДЛЫН ШАЛГАЛТ — «банк зөвхөн кодоор хаадаг» гэдэг нь батлагдсан'],
    ['• Хасалтын нийт дүн зөв байх нөхцөл: банк нэхэмжлэхийг ЗӨВХӨН кодтой төлбөрөөр хаадаг байх. Эс тэгвэл кодгүй төлбөрийг дахин хасах нь давхардал болно.'],
    [`• Айл бүрээр шалгав: эхний төлөөгүй сараас хойш, банкны жагсаалтад байхгүй (=хаагдсан) боловч кодтой төлбөр ч байхгүй сар байна уу?`],
    [`   · ${audit.clean.length} тоотод тийм сар БАЙХГҮЙ — яг таарав`],
    [`   · ${audit.only2024.length} тоотод зөвхөн 2024/09 — тэр сарыг банк огт нэхэмжлээгүй тул хамаагүй`],
    [`   · ${audit.offline.length} тоотод бусад сар бий — офлайн (бэлэн/гар оролт) төлбөрөөр хаагдсан нь батлагдсан, ДАВХАРДАЛГҮЙ:`],
    ...audit.offline.map((x) => [
      `      ${x.b.building}-${x.b.apartment}: ${x.months.join(' ')}`,
      x.reasons.join(' | '),
    ]),
    [`   · ${audit.risk.length} тоотод жинхэнэ давхардлын эрсдэл${audit.risk.length ? `: ${audit.risk.map((x) => `${x.b.building}-${x.b.apartment} (${x.months.join(' ')})`).join('; ')} — гараар шалга` : ' ✓'}`],
    ['• Офлайн хаалтын логик: биллинг нэхэмжлэхийг ЭРТНИЙХЭЭС нь хаадаг. Хаагдсан блокоос өмнө нээлттэй сар үлдсэн, эсвэл айлын эхний кодгүй дансны төлбөр тэр блокоос хойш байвал — тэр саруудыг дансны төлбөр хааж байгаагүй. Өөрөөр хэлбэл мөнгө нь хуулгад БАЙХГҮЙ (бэлэн эсвэл СӨХ-ийн гар оролт) тул хасалтад ч ороогүй.'],
    ['• Мөн бүтцийн батламж: хасалтыг ЗӨВХӨН банкны төлөөгүй сарын жагсаалтад орсон сарууд дээр хийдэг. Кодгүй ч хаагдсан сар тэр жагсаалтад байхгүй тул түүнд мөнгө огт оногддоггүй — давхардал үүсэх боломжгүй.'],
    ['• Иймд: бодит өр = банкны өр − кодгүй орсон БҮХ төлбөр. Энэ тэнцэл нь төлбөрийг аль сард оноосноос ҮЛ ХАМААРНА.'],
    [],
    ['ТӨЛБӨРИЙН ОГНООНЫ ЗӨРҮҮ (сарын оноолт)'],
    ['• Кодгүй төлбөрт «аль сарын хураамж» гэсэн заалт байхгүй тул хамгийн эртний төлөгдөөгүй сараас эхлэн оноов.'],
    ['• Зарим айлын эртний кодгүй төлбөр нь банкны жагсаалтад зөвхөн ХОЖМЫН сар үлдсэн байхад тохиолддог — тэр үед төлбөр хожмын сарт оногдоно. НИЙТ дүн зөв хэвээр, зөвхөн сарын оноолт нөхцөлт.'],
    ['• «Төлөлт бүрийн хуваарилалт» хуудасны «Огнооны зөрүү» баганад 3+ сар хойшхи оноолтыг тэмдэглэсэн — тэдгээр айлын тооцоог СӨХ-ийн бүртгэлтэй тулгавал сайн.'],
    [],
    ['ЯАГААД ХАСАЛТ ХЭРЭГТЭЙ ВЭ'],
    ['• Банкны е-биллинг нэхэмжлэхийг ЗӨВХӨН төлбөрийн кодтой («…_СӨХ_2026/7») гүйлгээгээр хаадаг.'],
    ['• Оршин суугч кодоо бичихгүй, «69A 8TOOT» гэж бичээд шилжүүлбэл мөнгө СӨХ-ийн дансанд бүрэн орно, гэхдээ нэхэмжлэх хаагдахгүй → банкны тайланд «төлөөгүй» хэвээр харагдана.'],
    ['• Хасалт бүрийн үндэслэл «Төлөлт бүрийн хуваарилалт» хуудсанд огноо, дүн, хаасан сар, гүйлгээний утгын хамт бий.'],
    [],
    ['ХЯЗГААРЛАЛТ'],
    ['• Банкны тайланг гэрэл зургаас ГАРААР буулгасан — «Банкны тайлан (буулгасан)» хуудсыг эх хуудастай нэг удаа тулгана уу.'],
    ['• Банк 2024 оны 9-р сарыг НЭХЭМЖЛЭЭГҮЙ (125 мөрийн аль нь ч 2024-9-г агуулаагүй).'],
    ['• 2026 оны 9-р сар хараахан нэхэмжлэгдээгүй.'],
    [`• Гадна хаалт/чипний ${gateN} гүйлгээ (${money(gateAmt)}₮) СӨХ-ийн бүртгэлээр танигдаж хасалтаас хасагдсан — хураамж биш.`],
    ['• Бэлнээр эсвэл өөр дансаар төлсөн төлбөр хуулгад харагдахгүй тул хасалтад орохгүй.'],
    ['• «Жинхэнэ илүү төлөлт» нь граж/зогсоол, хаалт/чип эсвэл 2019/12-оос өмнөх өрийн төлбөр байж болно — гараар шалгана уу.'],
  ];
  const extraRows = [...extra.values()].filter((e) => e.sum > 0);
  if (extraRows.length) {
    notes.push([], ['БАНКНЫ ТАЙЛАНД БАЙХГҮЙ (ӨРГҮЙ) ТООТУУД — хуулгаар кодгүй төлбөр бий (хасах өр байхгүй)'],
      ['Байр', 'Тоот', 'Кодгүй төлбөр (₮)', 'Гүйлгээ'],
      ...extraRows.sort((a, b) => b.sum - a.sum).map((e) => [e.building, Number(e.apartment), Math.round(e.sum), e.n]));
  }
  if (unsplit.length) {
    notes.push([], ['ХУВААГДААГҮЙ ХАМТАРСАН ТӨЛБӨР — гараар шалга'],
      ...unsplit.map((j) => [j.date, j.aptRaw, Math.round(j.amount), j.memo]));
  }
  const sNotes = XLSX.utils.aoa_to_sheet(notes);
  sNotes['!cols'] = [{ wch: 82 }, { wch: 20 }, { wch: 20 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, sNotes, 'Тайлбар ба хяналт');

  const sBank = XLSX.utils.aoa_to_sheet([
    ['Төрийн банкны е-биллингийн өрийн тайлан — гэрэл зургаас буулгасан эх өгөгдөл'],
    ['Тайланг гаргасан: Ажилтан МӨНХЦЭЦЭГ · Төрийн банк теллер-1099 · 69.1 = 69А, 69.2 = 69Б, «Хаалга» = тоот'],
    [],
    ['№', 'Байр / Хаалга', 'Байр', 'Тоот', 'Огноо (төлөгдөөгүй сарууд)', 'Сарын тоо', 'Мөнгөн дүн (₮)',
      'Задаргааны нийлбэр (₮)', 'Зөрүү', 'Айлын зөрүү (offset)'],
    ...bank.map((b) => {
      const u = units.get(key(b.building, b.apartment));
      return [b.no, `${b.building === '69А' ? '69.1' : '69.2'} / ${String(b.apartment).padStart(4, '0')} - 0`,
        b.building, Number(b.apartment), b.raw, b.months.length, b.debt,
        Math.round(u.sum), Math.round(u.sum - b.debt), u.offset];
    }),
    ['', '', '', '', 'НИЙТ', bank.reduce((s, b) => s + b.months.length, 0), Math.round(bankTotal),
      Math.round([...units.values()].reduce((s, u) => s + u.sum, 0)), 0, ''],
  ]);
  sBank['!cols'] = [{ wch: 5 }, { wch: 18 }, { wch: 6 }, { wch: 6 }, { wch: 96 }, { wch: 10 },
    { wch: 15 }, { wch: 18 }, { wch: 9 }, { wch: 18 }];
  sBank['!freeze'] = { xSplit: 0, ySplit: 4 };
  XLSX.utils.book_append_sheet(wb, sBank, 'Банкны тайлан (буулгасан)');

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  XLSX.writeFile(wb, OUT);
  console.log(`\n✅ Тайлан: ${path.relative(ROOT, OUT)}`);
  console.log('   ⚠️  Нэр, утас, өрийн дүн — git-д ОРУУЛАХГҮЙ.');
}

main();
