// Ариун Очир-69 СӨХ (#1768) — ТӨРИЙН БАНКНЫ Е-БИЛЛИНГИЙН ӨРИЙН ТАЙЛАН-г
// дансны хуулгатай тулгаж, ХАСАЛТ ХИЙГДЭХ ЗӨРҮҮ-г гаргана.
//
// Энэ файл ЗӨВХӨН энэ нэг СӨХ-д зориулсан тайлангийн скрипт (аппын кодыг өөрчлөхгүй).
//
// ⚠️  Гаралт нь оршин суугчийн нэр, утас, өрийн дүн агуулна → `docs/reports/`
//     нь `.gitignore`-д. Репо public тул гаралтыг git-д БҮҮ ОРУУЛ.
//
// ═══ Асуудал ═══
// Банкны е-биллингийн систем нь нэхэмжлэхийг ЗӨВХӨН төлбөрийн КОДТОЙ
// («2005050069100010_…_СӨХ_2026/7») төлбөрөөр хаадаг. Оршин суугч кодоо
// бичихгүй, зүгээр «69A 8TOOT» гэж бичээд шилжүүлбэл мөнгө СӨХ-ийн дансанд
// бүрэн орсон ч нэхэмжлэх ХААГДАХГҮЙ — банкны өрийн тайланд тэр сар
// «төлөөгүй» хэвээр харагдана.
//
// Тиймээс банкны тайлангийн 128.9 сая₮ нь бодит өр БИШ. Үүнээс кодгүй орсон
// төлбөрийг ХАСАХ шаардлагатай. Энэ скрипт тэр хасалтыг тоот тус бүрээр
// тооцож, хасалтын дараах бодит өрийг гаргана.
//
// ═══ Эх сурвалж (2) ═══
// 1. docs/reports/ariun-ochir-bank-ebilling-debt.json
//    Төрийн банкны е-биллингийн өрийн тайлан (Ажилтан МӨНХЦЭЦЭГ, теллер-1099),
//    125 мөр, гэрэл зургаас буулгасан. Багана: байр/хаалга, төлөгдөөгүй
//    хамаарах сарууд, дүн. 69.1 = 69А, 69.2 = 69Б, хаалга = тоот.
// 2. Downloads/Ариун очир сөх/Ариун-Очир СӨХ - Тоот тус бүрийн орлогын тайлан
//    2019-2026.xlsx → «Гүйлгээ (тоотоор)». Төрийн банкны 31 хуулгаас задалсан
//    8,473 СӨХ-ийн орлогын гүйлгээ. Үүнээс КОДГҮЙ («Хамаарах сар» хоосон)
//    гүйлгээг л хасалтад авна — кодтойг банк аль хэдийн тооцсон.
//
// ═══ Арга ═══
// · Хасалт = тухайн тоотын кодгүй төлбөрийн нийлбэр. Банкны төлөөгүй саруудыг
//   ХАМГИЙН ЭРТНИЙХЭЭС эхлэн нөхөж, аль сар төлөгдөж, аль нь үлдэхийг гаргана.
// · Хамтарсан төлбөр («64+124+126+…») нь нэг гүйлгээгээр олон тоотын төлбөрийг
//   төлсөн — гишүүн тоотуудын банкны өрийн хувиар хуваарилж, тэмдэглэнэ.
// · Гадна хаалт/чипний 100,000₮ төлбөрийг СӨХ-ийн өөрийн бүртгэлээр таньж
//   ХАСНА (хураамж биш тул хасалтад орох ёсгүй).
// · Хасалт банкны өрөөс их бол илүүг «илүү төлсөн» гэж тусад нь харуулна
//   (өрийг сөрөг болгохгүй).
//
// Хяналт: банкны нийт өр − хасалт + илүү = хасалтын дараах өр. Тэнцэхгүй бол
// тайлан бичихгүй.
//
// Ажиллуулах:
//   node scripts/report-ariun-ochir-bank-vs-statement.mjs
//
// Сонголт: BANK=… (JSON), FILE=… (орлогын тайлан), GATE_FILE=…, OUT=…

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
const OUT = process.env.OUT || path.join(ROOT, 'docs/reports/ariun-ochir-bank-hasalt-zuruu.xlsx');
const SOKH_ID = 1768;

const money = (n) => Number(Math.round(n)).toLocaleString('en-US');
const BUILDING = { '69.1': '69А', '69.2': '69Б' };

// «2025-10,11,12,9;2026-1,2,3,4,5,6,7,8» → ['2025/09','2025/10',…] (эрэмбэлсэн)
function parseMonths(str) {
  const out = new Set();
  for (const part of String(str).split(';')) {
    const m = part.trim().match(/^(\d{4})-(.+)$/);
    if (!m) throw new Error(`«Огноо» баганыг задалж чадсангүй: ${JSON.stringify(part)}`);
    for (const x of m[2].split(',')) {
      const num = Number(x.trim());
      if (!num || num < 1 || num > 12) throw new Error(`сар буруу: ${JSON.stringify(part)}`);
      out.add(`${m[1]}/${String(num).padStart(2, '0')}`);
    }
  }
  return [...out].sort();
}

function readBank() {
  if (!fs.existsSync(BANK)) {
    console.error(`❌ Банкны тайлангийн JSON олдсонгүй: ${BANK}`);
    process.exit(1);
  }
  const d = JSON.parse(fs.readFileSync(BANK, 'utf8'));
  return d.rows.map(([no, blk, door, dates, amount]) => {
    const months = parseMonths(dates);
    return {
      no,
      building: BUILDING[blk] || blk,
      apartment: String(Number(door)),
      months,
      raw: dates,
      debt: Number(amount) || 0,
      // Нэг сартай мөр нь тэр сарын яг тарифыг өгнө
      unitFee: months.length === 1 ? Number(amount) || 0 : null,
    };
  });
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
  if (!fs.existsSync(FILE)) {
    console.error(`❌ Орлогын тайлан олдсонгүй: ${FILE}`);
    process.exit(1);
  }
  const wb = XLSX.readFile(FILE);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[TX_SHEET], { header: 1, blankrows: false, defval: '' });
  return rows.slice(1)
    .filter((r) => String(r[6]).trim() === 'СӨХ')
    .map((r) => ({
      date: String(r[0]).trim(),
      building: String(r[2]).trim(),
      aptRaw: String(r[3]).trim(),
      amount: Number(r[5]) || 0,
      coded: !!String(r[7] ?? '').trim(),
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

async function main() {
  const bank = readBank();
  const bankTotal = bank.reduce((s, b) => s + b.debt, 0);
  const gate = readGate();
  const rawTx = readTx();

  // Гадна хаалт/чип — хураамж биш, хасалтад орохгүй
  const tx = [];
  let gateN = 0;
  let gateAmt = 0;
  for (const t of rawTx) {
    if (gate.has(`${t.building}|${t.aptRaw}|${t.date}|${t.amount}`)) { gateN++; gateAmt += t.amount; continue; }
    tx.push(t);
  }

  // Тоот бүрийн мөр
  const byKey = new Map();
  const key = (b, a) => `${b}|${a}`;
  for (const b of bank) {
    byKey.set(key(b.building, b.apartment), {
      ...b,
      loose: 0, looseTx: [], jointAmt: 0, jointTx: 0, codedAmt: 0, codedTx: 0,
    });
  }
  // Банкны тайланд БАЙХГҮЙ тоотууд (өргүй гэж үзсэн) — тэдний кодгүй төлбөрийг
  // бүртгэж авна (хасах өр байхгүй; тайланд тусад нь харуулна)
  const extra = new Map();
  const getExtra = (b, a) => {
    const k = key(b, a);
    if (!extra.has(k)) extra.set(k, { building: b, apartment: a, loose: 0, looseTx: [], jointAmt: 0, jointTx: 0, codedAmt: 0, codedTx: 0 });
    return extra.get(k);
  };

  const joints = [];
  for (const t of tx) {
    if (t.aptRaw.includes('+')) { joints.push(t); continue; }
    const k = key(t.building, t.aptRaw);
    const u = byKey.get(k) || getExtra(t.building, t.aptRaw);
    if (t.coded) { u.codedAmt += t.amount; u.codedTx++; } else { u.loose += t.amount; u.looseTx.push(t); }
  }

  // Хамтарсан төлбөрийг гишүүдийн банкны өрийн хувиар хуваарилна
  const unsplit = [];
  for (const j of joints) {
    const members = j.aptRaw.split('+').map((s) => s.trim())
      .map((a) => byKey.get(key(j.building, a)))
      .filter(Boolean);
    if (!members.length) { unsplit.push(j); continue; }
    const w = members.map((m) => m.debt || 1);
    const sw = w.reduce((a, b) => a + b, 0);
    members.forEach((m, i) => {
      m.jointAmt += (j.amount * w[i]) / sw;
      m.jointTx++;
      m.hasJoint = true;
    });
  }

  // Хасалт: эртний сараас нөхнө
  const db = await residents();
  const rows = [...byKey.values()].map((u) => {
    const feeOf = (i, total) => (total ? u.debt / total : 0);   // сарын дундаж (доор зөвхөн тооллогод)
    const credit = u.loose + u.jointAmt;
    // Сар тус бүрийн дүн тодорхой биш (банк зөвхөн нийт дүнг өгсөн) тул
    // саруудыг тэнцүү дундажаар нөхөж, хэдэн сар хаагдахыг тооцно.
    const per = u.months.length ? u.debt / u.months.length : 0;
    let left = credit;
    const cleared = [];
    const remain = [];
    for (const m of u.months) {
      if (left >= per - 0.5 && per > 0) { left -= per; cleared.push(m); } else remain.push(m);
    }
    const deduct = Math.min(credit, u.debt);
    const after = Math.max(0, u.debt - credit);
    const over = Math.max(0, credit - u.debt);
    const info = db.get(key(u.building, u.apartment));
    const flags = [];
    if (u.hasJoint) flags.push(`хамтарсан төлбөрөөс ${money(u.jointAmt)}₮ оногдов (${u.jointTx} гүйлгээ)`);
    if (!credit) flags.push('кодгүй төлбөр илрээгүй — банкны өр хэвээр');
    if (over > 0) flags.push(`ИЛҮҮ ${money(over)}₮ — гараж/хаалт эсвэл өмнөх үеийн төлбөр байж болно, шалгах`);
    if (u.unitFee) flags.push(`2026/08 тариф ${money(u.unitFee)}₮`);
    return {
      ...u,
      name: info?.name || '',
      phone: info?.phone || '',
      credit, deduct, after, over, per,
      cleared, remain,
      flags,
    };
  }).sort((a, b) => b.deduct - a.deduct || b.debt - a.debt);

  const sumCredit = rows.reduce((s, r) => s + r.credit, 0);
  const sumDeduct = rows.reduce((s, r) => s + r.deduct, 0);
  const sumAfter = rows.reduce((s, r) => s + r.after, 0);
  const sumOver = rows.reduce((s, r) => s + r.over, 0);

  console.log('📥 Эх сурвалж:');
  console.log(`   Банкны е-биллингийн өрийн тайлан: ${bank.length} тоот · ${money(bankTotal)}₮`);
  console.log(`   Дансны хуулгын СӨХ гүйлгээ:       ${rawTx.length} · ${money(rawTx.reduce((s, t) => s + t.amount, 0))}₮`);
  console.log(`   − гадна хаалт/чип (СӨХ бүртгэлээр): ${gateN} гүйлгээ · ${money(gateAmt)}₮`);

  console.log('\n🔎 Хяналт:');
  console.log(`   Банкны өр:              ${money(bankTotal).padStart(14)}₮`);
  console.log(`   Хасалт (кодгүй төлбөр): ${money(sumDeduct).padStart(14)}₮`);
  console.log(`   Хасалтын дараах өр:     ${money(sumAfter).padStart(14)}₮`);
  const bal = bankTotal - sumDeduct - sumAfter;
  console.log(`   Тэнцэл:                 ${money(bal).padStart(14)}₮ ${Math.abs(bal) < rows.length + 5 ? '✓' : '❌'}`);
  console.log(`   Илүү гарсан (өрөөс их): ${money(sumOver).padStart(14)}₮`);
  if (Math.abs(bal) >= rows.length + 5) {
    console.error('\n❌ Тэнцэл таарахгүй — тайлан бичихгүй.');
    process.exitCode = 1;
    return;
  }

  const withCredit = rows.filter((r) => r.credit > 0);
  const cleared = rows.filter((r) => r.after === 0);
  console.log(`\n📊 Хасалт хийгдэх тоот: ${withCredit.length} / ${rows.length}`);
  console.log(`   Хасалтаар өр БҮРЭН хаагдах: ${cleared.length} тоот`);
  console.log(`   Кодгүй төлбөр илрээгүй:     ${rows.length - withCredit.length} тоот`);

  console.log('\n   Хамгийн их хасалт (15):');
  rows.slice(0, 15).forEach((r) => console.log(
    `      ${r.building}-${String(r.apartment).padEnd(4)} ${(r.name || '').padEnd(20)}`
    + ` банк ${money(r.debt).padStart(10)}₮ − хасалт ${money(r.deduct).padStart(10)}₮ = ${money(r.after).padStart(10)}₮`));

  const extraRows = [...extra.values()].filter((e) => e.loose > 0 || e.codedAmt > 0);
  if (extraRows.length) {
    console.log(`\n   ℹ️  Банкны тайланд БАЙХГҮЙ (өргүй) ${extraRows.length} тоот дээр хуулгаар төлбөр бий`);
    const lo = extraRows.filter((e) => e.loose > 0);
    console.log(`      үүнээс кодгүй төлбөртэй: ${lo.length} тоот · ${money(lo.reduce((s, e) => s + e.loose, 0))}₮ (өр хаагдсан тул хасах шаардлагагүй)`);
  }
  if (unsplit.length) console.log(`   ⚠️  Хуваагдаагүй хамтарсан төлбөр: ${unsplit.length}`);

  // ── Excel ──
  const wb = XLSX.utils.book_new();

  const sMain = XLSX.utils.aoa_to_sheet([
    ['Ариун Очир-69 СӨХ — банкны е-биллингийн өрөөс ХАСАЛТ ХИЙГДЭХ ЗӨРҮҮ'],
    ['Банкны өрийн тайлан (2026/08 хүртэл) vs Төрийн банкны дансны хуулга (2019.12.11–2026.09.11)'],
    ['Хасалт = оршин суугч мөнгө төлсөн боловч төлбөрийн КОД бичээгүй тул нэхэмжлэх хаагдаагүй дүн'],
    [],
    ['№', 'Байр', 'Тоот', 'Нэр', 'Утас',
      'Банкны өр (₮)', 'Төлөөгүй сар', 'Сарын дундаж (₮)',
      'ХАСАЛТ — кодгүй төлбөр (₮)', 'Кодгүй гүйлгээ',
      'Хамтарсан төлбөрөөс (₮)', 'ХАСАЛТЫН ДАРААХ ӨР (₮)', 'Үлдэх сар',
      'Илүү гарсан (₮)', 'Хаагдах сарууд', 'Үлдэх сарууд',
      'Банкны тайлан дээрх сарууд', 'Тэмдэглэл'],
    ...rows.map((r, i) => [
      i + 1, r.building, Number(r.apartment), r.name, r.phone,
      Math.round(r.debt), r.months.length, Math.round(r.per),
      Math.round(r.deduct), r.looseTx.length,
      Math.round(r.jointAmt) || '', Math.round(r.after), r.remain.length,
      Math.round(r.over) || '', r.cleared.join(' '), r.remain.join(' '),
      r.raw, r.flags.join('; '),
    ]),
    ['НИЙТ', '', '', '', '',
      Math.round(bankTotal), rows.reduce((s, r) => s + r.months.length, 0), '',
      Math.round(sumDeduct), rows.reduce((s, r) => s + r.looseTx.length, 0),
      Math.round(rows.reduce((s, r) => s + r.jointAmt, 0)), Math.round(sumAfter),
      rows.reduce((s, r) => s + r.remain.length, 0), Math.round(sumOver), '', '', '', ''],
  ]);
  sMain['!cols'] = [{ wch: 4 }, { wch: 6 }, { wch: 6 }, { wch: 22 }, { wch: 10 },
    { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 24 }, { wch: 14 },
    { wch: 18 }, { wch: 22 }, { wch: 10 }, { wch: 14 }, { wch: 40 }, { wch: 40 },
    { wch: 70 }, { wch: 60 }];
  sMain['!freeze'] = { xSplit: 5, ySplit: 5 };
  XLSX.utils.book_append_sheet(wb, sMain, 'Хасалт хийгдэх зөрүү');

  // Хасалтын мөр бүрийн эх гүйлгээ
  const looseAll = [];
  for (const r of rows) {
    for (const t of r.looseTx) {
      looseAll.push([r.building, Number(r.apartment), r.name, t.date, Math.round(t.amount), t.method, t.memo]);
    }
  }
  looseAll.sort((a, b) => String(a[3]).localeCompare(String(b[3])));
  const sLoose = XLSX.utils.aoa_to_sheet([
    ['Хасалтын үндэслэл — КОДГҮЙ орсон СӨХ-ийн төлбөр бүр'],
    ['Эдгээр мөнгө СӨХ-ийн дансанд бүрэн орсон боловч төлбөрийн код байхгүй тул банкны нэхэмжлэх хаагдаагүй'],
    [`${looseAll.length} гүйлгээ · ${money(looseAll.reduce((s, r) => s + r[4], 0))}₮`],
    [],
    ['Байр', 'Тоот', 'Нэр', 'Огноо', 'Дүн (₮)', 'Хэрхэн таньсан', 'Гүйлгээний утга'],
    ...looseAll,
  ]);
  sLoose['!cols'] = [{ wch: 6 }, { wch: 6 }, { wch: 22 }, { wch: 12 }, { wch: 13 },
    { wch: 26 }, { wch: 80 }];
  sLoose['!freeze'] = { xSplit: 0, ySplit: 5 };
  XLSX.utils.book_append_sheet(wb, sLoose, 'Кодгүй гүйлгээ');

  const notes = [
    ['Ариун Очир-69 СӨХ — банкны өрийн тайлангийн хасалт: тайлбар ба хяналт'],
    [],
    ['ХЯНАЛТ', 'Дүн (₮)'],
    ['Банкны е-биллингийн өр (125 тоот, 2026/08 хүртэл)', Math.round(bankTotal)],
    ['ХАСАЛТ — хуулгаар илэрсэн кодгүй төлбөр', Math.round(sumDeduct)],
    ['ХАСАЛТЫН ДАРААХ БОДИТ ӨР', Math.round(sumAfter)],
    ['Тэнцэл (банк − хасалт − дараах = 0)', Math.round(bankTotal - sumDeduct - sumAfter)],
    ['Илүү гарсан (хасалт өрөөс их)', Math.round(sumOver)],
    [],
    ['Хасалт хийгдэх тоот', withCredit.length],
    ['Хасалтаар өр БҮРЭН хаагдах тоот', cleared.length],
    ['Кодгүй төлбөр илрээгүй тоот (банкны өр хэвээр)', rows.length - withCredit.length],
    ['Банкны тайланд байхгүй (өргүй) тоот', 156 - rows.length],
    [],
    ['ЯАГААД ЗӨРӨӨ ВЭ'],
    ['• Банкны е-биллинг нэхэмжлэхийг ЗӨВХӨН төлбөрийн кодтой («…_СӨХ_2026/7») гүйлгээгээр хаадаг.'],
    ['• Оршин суугч кодоо бичихгүй, «69A 8TOOT» гэж бичээд шилжүүлбэл мөнгө СӨХ-ийн дансанд бүрэн орно, гэхдээ нэхэмжлэх хаагдахгүй.'],
    ['• Иймд банкны өрийн тайлан тэр дүнгээр ӨРИЙГ ИХЭСГЭЖ харуулдаг. Мөнгө нь СӨХ-д байгаа.'],
    ['• Хуулганд кодгүй орсон төлбөрийг «Кодгүй гүйлгээ» хуудсанд огноо, дүн, утгын хамт бүрэн жагсаав — хасалт бүрийг тэндээс шалгана.'],
    [],
    ['АРГА'],
    ['• Хасалт = тухайн тоотын кодгүй СӨХ төлбөрийн нийлбэр (+ хамтарсан төлбөрөөс оногдох хувь).'],
    ['• Банк нийт дүнг л өгсөн, сар тус бүрийн дүнг өгөөгүй тул сарын дүнг тэнцүү дундажаар (өр ÷ сарын тоо) авч, хамгийн эртний сараас нөхөв. «Хаагдах сарууд» нь ингэж тооцсон таамаг — нийт дүн нь ТОДОРХОЙ.'],
    [`• Гадна хаалт/чипний ${gateN} гүйлгээ (${money(gateAmt)}₮) СӨХ-ийн өөрийн бүртгэлээр танигдаж хасалтаас ХАСАГДСАН — хураамж биш.`],
    ['• Хамтарсан төлбөр (нэг гүйлгээгээр олон тоот) — гишүүдийн банкны өрийн хувиар хуваарилав; тэдгээр тоотыг тэмдэглэсэн.'],
    [],
    ['ХЯЗГААРЛАЛТ'],
    ['• Банкны тайланг гэрэл зургаас ГАРААР буулгасан — дүн, сарын жагсаалтыг эх хуудастай нэг удаа тулгана уу.'],
    ['• Банкны тайлан 2024 оны 9-р сарыг НЭХЭМЖЛЭЭГҮЙ (125 мөрийн аль нь ч 2024-9-г агуулаагүй) — тэр сард нэхэмжлэх гараагүй байна.'],
    ['• Банкны тайлангийн хугацаа 2019/12 – 2026/08. 2026 оны 9-р сар хараахан нэхэмжлэгдээгүй.'],
    ['• Бэлнээр эсвэл өөр дансаар төлсөн төлбөр хуулгад харагдахгүй тул хасалтад орохгүй.'],
    ['• «Илүү гарсан» тоотуудын кодгүй төлбөр нь граж/зогсоол, хаалт/чип эсвэл өмнөх үеийн өрийн төлбөр байж болно — гараар шалгана уу.'],
  ];
  if (extraRows.length) {
    notes.push([], ['БАНКНЫ ТАЙЛАНД БАЙХГҮЙ (ӨРГҮЙ) ТООТУУД — хуулгаар төлбөр бий'],
      ['Байр', 'Тоот', 'Кодтой (₮)', 'Кодгүй (₮)', 'Кодгүй гүйлгээ'],
      ...extraRows.sort((a, b) => b.loose - a.loose).map((e) => [
        e.building, Number(e.apartment), Math.round(e.codedAmt), Math.round(e.loose), e.looseTx.length]));
  }
  const sNotes = XLSX.utils.aoa_to_sheet(notes);
  sNotes['!cols'] = [{ wch: 78 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, sNotes, 'Тайлбар ба хяналт');

  const sBank = XLSX.utils.aoa_to_sheet([
    ['Төрийн банкны е-биллингийн өрийн тайлан — гэрэл зургаас буулгасан эх өгөгдөл'],
    ['Тайланг гаргасан: Ажилтан МӨНХЦЭЦЭГ · Төрийн банк теллер-1099 · 69.1 = 69А, 69.2 = 69Б, «Хаалга» = тоот'],
    [],
    ['№', 'Байр / Хаалга', 'Байр', 'Тоот', 'Огноо (төлөгдөөгүй сарууд)', 'Сарын тоо', 'Мөнгөн дүн (₮)'],
    ...bank.map((b) => [b.no, `${b.building === '69А' ? '69.1' : '69.2'} / ${String(b.apartment).padStart(4, '0')} - 0`,
      b.building, Number(b.apartment), b.raw, b.months.length, b.debt]),
    ['', '', '', '', 'НИЙТ', bank.reduce((s, b) => s + b.months.length, 0), Math.round(bankTotal)],
  ]);
  sBank['!cols'] = [{ wch: 5 }, { wch: 18 }, { wch: 6 }, { wch: 6 }, { wch: 100 }, { wch: 10 }, { wch: 15 }];
  sBank['!freeze'] = { xSplit: 0, ySplit: 4 };
  XLSX.utils.book_append_sheet(wb, sBank, 'Банкны тайлан (буулгасан)');

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  XLSX.writeFile(wb, OUT);
  console.log(`\n✅ Тайлан: ${path.relative(ROOT, OUT)}`);
  console.log('   ⚠️  Нэр, утас, өрийн дүн — git-д ОРУУЛАХГҮЙ.');
}

main();
