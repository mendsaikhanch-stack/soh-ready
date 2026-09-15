// Ариун Очир-69 СӨХ (#1768) — өртэй айлуудын төлбөрийг САР САРААР гаргана.
//
// Энэ файл ЗӨВХӨН энэ нэг СӨХ-д зориулсан тайлангийн скрипт (аппын кодыг өөрчлөхгүй).
//
// ⚠️  Гаралт нь оршин суугчийн нэр, утас, өрийн дүн агуулна → `docs/reports/`
//     фолдер `.gitignore`-д байгаа. Репо public тул гаралтыг git-д БҮҮ ОРУУЛ.
//
// Эх сурвалж (2026-09-11-ний Төрийн банкны хуулгаар бодогдсон тайлан):
//   Downloads/Ариун-Очир-СӨХ-2026-оны-8-9-сарын-төлбөр-төлөөгүй-айлууд.xlsx
//   «8-9 сар төлөөгүй» хуудас — 156 айл. Тэр тайлан айл тус бүрээр:
//     · сарын төлбөр
//     · 1–7 сараас ДУТУУ сарууд («1–7», «2–3, 5–7» гэх мэт хүрээ)
//     · 8-р сар төлөөгүй дүн, 9-р сар төлөөгүй дүн, нийт өр
//   гэж хадгалдаг. Энэ скрипт тэр хүрээг сар болгон ЗАДЛАЖ хүснэгт болгоно —
//   шинээр тооцоолохгүй, иймд дүнгүүд эх тайлантай 1₮ хүртэл таарна.
//
// Хяналт: айл бүрийн (дутуу сарын тоо × сарын төлбөр) = эх тайлангийн «1–7
// сарын дутуу дүн», мөн + 8 + 9 сар = «2026 оны нийт өр». Зөрвөл бичихгүй.
//
// Утасны дугаарыг DB-ээс (residents, sokh_id=1768) байр+тоотоор нь холбоно.
//
// Ажиллуулах:
//   node scripts/report-ariun-ochir-unpaid.mjs
//
// Сонголт (орчны хувьсагч):
//   FILE=…    — эх тайлангийн xlsx-ийн зам
//   OUT=…     — гаралтын xlsx-ийн зам

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = process.env.FILE
  || 'C:/Users/MNG/Downloads/Ариун-Очир-СӨХ-2026-оны-8-9-сарын-төлбөр-төлөөгүй-айлууд.xlsx';
const SHEET = '8-9 сар төлөөгүй';
const OUT = process.env.OUT
  || path.join(ROOT, 'docs/reports/ariun-ochir-2026-untulugdsun-sar-saraar.xlsx');
const SOKH_ID = 1768;
const YEAR = 2026;
// 9-р сарын хугацаа хараахан дуусаагүй (олон айл дараа сарын 20–30-нд төлдөг)
// тул «өртэй эсэх»-ийг 1–8 сараар шүүнэ. 9-р сар тусдаа баганаар харагдана.
const DUE_THROUGH = 8;

const money = (n) => Number(n).toLocaleString('en-US');

// «1–7», «2–3, 5–7», «4» → [1,2,…]
function parseMonths(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return [];
  const out = new Set();
  for (const part of s.split(/\s*,\s*/)) {
    const p = part.trim();
    if (!p) continue;
    const range = p.match(/^(\d+)\s*[–\-]\s*(\d+)$/);
    if (range) {
      for (let i = Number(range[1]); i <= Number(range[2]); i++) out.add(i);
    } else if (/^\d+$/.test(p)) {
      out.add(Number(p));
    } else {
      throw new Error(`«дутуу сарууд» баганыг задалж чадсангүй: ${JSON.stringify(part)}`);
    }
  }
  return [...out].sort((a, b) => a - b);
}

function readSource() {
  if (!fs.existsSync(FILE)) {
    console.error(`❌ Файл олдсонгүй: ${FILE}`);
    process.exit(1);
  }
  const wb = XLSX.readFile(FILE);
  if (!wb.Sheets[SHEET]) {
    console.error(`❌ "${SHEET}" хуудас олдсонгүй. Байгаа хуудсууд: ${wb.SheetNames.join(', ')}`);
    process.exit(1);
  }
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[SHEET], { header: 1, blankrows: false, defval: '' });
  // Толгой 3 мөр; өгөгдлийн мөр нь 1-р баганад № (тоо) агуулна
  return rows.slice(3).filter((r) => typeof r[0] === 'number').map((r) => ({
    building: String(r[1]).trim(),
    apartment: String(r[2]).trim(),
    name: String(r[3]).trim(),
    fee: Number(r[4]) || 0,
    lastPaidMonth: String(r[5] ?? '').trim(),
    aug: Number(r[6]) || 0,
    sep: Number(r[7]) || 0,
    paidSoFar: Number(r[9]) || 0,
    paidMonths: String(r[10] ?? '').trim(),
    missingRaw: String(r[11] ?? '').trim(),
    missingAmt: Number(r[12]) || 0,
    total: Number(r[13]) || 0,
    lastPaidDate: String(r[14] ?? '').trim(),
    basis: String(r[15] ?? '').trim(),
    note: String(r[16] ?? '').trim(),
  }));
}

// Эх тайлантай тулгах — задаргаа нь эх дүнг давтаж байгаа эсэх
function verify(units) {
  let bad = 0;
  for (const u of units) {
    const miss = parseMonths(u.missingRaw);
    const calcMissing = miss.length * u.fee;
    const calcTotal = calcMissing + u.aug + u.sep;
    if (calcMissing !== u.missingAmt || calcTotal !== u.total) {
      bad++;
      console.error(`   ❌ ${u.building}-${u.apartment}: дутуу ${money(calcMissing)} ≠ ${money(u.missingAmt)}`
        + ` · нийт ${money(calcTotal)} ≠ ${money(u.total)}`);
    }
    u.missing = miss;
  }
  console.log('🔎 Эх тайлантай тулгах:');
  console.log(`   Айл:            ${units.length}`);
  console.log(`   Дүн зөрсөн айл: ${bad ? `❌ ${bad}` : 'байхгүй ✓'}`);
  return bad === 0;
}

async function phonesFromDb() {
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
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.log('   ⚠️  Supabase тохиргоо алга — утасны багана хоосон гарна.');
    return new Map();
  }
  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await sb
    .from('residents')
    .select('apartment, building, phone, name')
    .eq('sokh_id', SOKH_ID);
  if (error) {
    console.log(`   ⚠️  DB унших алдаа: ${error.message} — утасны багана хоосон гарна.`);
    return new Map();
  }
  const map = new Map();
  for (const r of data || []) {
    map.set(`${String(r.building || '').trim()}|${String(r.apartment).trim()}`, r);
  }
  return map;
}

function build(units, phones) {
  const monthCols = [];
  for (let m = 1; m <= 12; m++) monthCols.push(m);

  const debtors = units
    .map((u) => {
      const unpaid = new Map();               // сар → дүн
      for (const m of u.missing) unpaid.set(m, u.fee);
      if (u.aug > 0) unpaid.set(8, u.aug);
      const due = [...unpaid.keys()].filter((m) => m <= DUE_THROUGH).sort((a, b) => a - b);
      const dueAmt = due.reduce((s, m) => s + unpaid.get(m), 0);
      const db = phones.get(`${u.building}|${u.apartment}`);
      return { ...u, unpaid, due, dueAmt, phone: db?.phone || '', dbName: db?.name || '' };
    })
    .filter((u) => u.dueAmt > 0)
    .sort((a, b) => b.dueAmt - a.dueAmt
      || a.building.localeCompare(b.building)
      || Number(a.apartment) - Number(b.apartment));

  const head1 = [`Ариун Очир-69 СӨХ — ${YEAR} оны төлөгдөөгүй СӨХ төлбөр, сар сараар`];
  const head2 = ['2026.09.11-ний Төрийн банкны хуулгаар · зөвхөн ӨРТЭЙ айл'
    + ` · 1–${DUE_THROUGH}-р сараар шүүсэн (9-р сарын хугацаа дуусаагүй) · ₮`];
  const header = [
    '№', 'Байр', 'Тоот', 'Нэр', 'Утас', 'Сарын төлбөр',
    ...monthCols.slice(0, DUE_THROUGH).map((m) => `${m}-р сар`),
    `Төлөөгүй сар (1–${DUE_THROUGH})`, `1–${DUE_THROUGH} САРЫН ӨР`,
    '9-р сар (хугацаа дуусаагүй)', 'НИЙТ (1–9 сар)',
    'Сүүлд төлсөн сар', 'Сүүлд төлсөн огноо', 'Тооцооны үндэс', 'Тайлбар',
  ];

  const rows = debtors.map((u, i) => [
    i + 1, u.building, Number(u.apartment), u.name, u.phone, u.fee,
    ...monthCols.slice(0, DUE_THROUGH).map((m) => u.unpaid.get(m) ?? ''),
    u.due.length, u.dueAmt,
    u.sep || '', u.dueAmt + (u.sep || 0),
    u.lastPaidMonth, u.lastPaidDate, u.basis, u.note,
  ]);

  // Нийт мөр
  const perMonth = monthCols.slice(0, DUE_THROUGH)
    .map((m) => debtors.reduce((s, u) => s + (u.unpaid.get(m) || 0), 0));
  const totalDue = debtors.reduce((s, u) => s + u.dueAmt, 0);
  const totalSep = debtors.reduce((s, u) => s + (u.sep || 0), 0);
  const totalRow = [
    `НИЙТ: ${debtors.length} айл`, '', '', '', '', '',
    ...perMonth,
    debtors.reduce((s, u) => s + u.due.length, 0), totalDue,
    totalSep, totalDue + totalSep,
    '', '', '', '',
  ];

  const aoa = [head1, head2, [], header, ...rows, totalRow, [],
    [`• Нүдэнд бичсэн дүн = тэр сарын төлөгдөөгүй төлбөр. Хоосон нүд = тэр сарыг ТӨЛСӨН.`],
    ['• Нэг сард төлөөгүй ч хожим хамт төлсөн бол тэр сарыг төлсөнд тооцсон.'],
    ['• Зөвхөн СӨХ-ийн төлбөр. Граж/зогсоол, хаалт/чип, засварын төлбөр энд ОРООГҮЙ.'],
    ['• Бэлнээр эсвэл өөр дансаар төлсөн төлбөр банкны хуулгад харагдахгүй тул энд орохгүй.'],
    ['• «Тооцоолсон (дүнгээр)» = кодгүй төлдөг айл; төлсөн сарыг дүнгээс тооцоолсон → СӨХ-ийн бүртгэлтэй тулгана уу.'],
    [`• 9-р сарыг ямар ч айл төлөөгүй (хугацаа дуусаагүй) тул «өртэй» шүүлтэд ороогүй — тусдаа баганаар харуулав.`],
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [
    { wch: 5 }, { wch: 6 }, { wch: 6 }, { wch: 20 }, { wch: 10 }, { wch: 11 },
    ...monthCols.slice(0, DUE_THROUGH).map(() => ({ wch: 9 })),
    { wch: 15 }, { wch: 14 }, { wch: 13 }, { wch: 14 },
    { wch: 12 }, { wch: 13 }, { wch: 20 }, { wch: 34 },
  ];
  ws['!freeze'] = { xSplit: 4, ySplit: 4 };

  return { ws, debtors, perMonth, totalDue, totalSep, monthCols };
}

function summarySheet(units, r) {
  const paidFull = units.length - r.debtors.length;
  const rows = [
    ['Ариун Очир-69 СӨХ — 2026 оны төлбөрийн товч дүн'],
    ['2026.09.11-ний Төрийн банкны хуулгаар'],
    [],
    ['Бүртгэлтэй айл', units.length],
    [`1–${DUE_THROUGH}-р сард ӨРТЭЙ айл`, r.debtors.length],
    [`1–${DUE_THROUGH}-р сарын нийт өр (₮)`, r.totalDue],
    [`1–${DUE_THROUGH}-р сарыг бүрэн төлсөн айл`, paidFull],
    [],
    ['9-р сар төлөөгүй айл (хугацаа дуусаагүй)', units.filter((u) => u.sep > 0).length],
    ['9-р сарын дүн (₮)', units.reduce((s, u) => s + u.sep, 0)],
    [],
    ['2026 оны нийт өр (1–9 сар), бүх айл (₮)', units.reduce((s, u) => s + u.total, 0)],
    [],
    ['Сар', 'Төлөөгүй айл', 'Төлөөгүй дүн (₮)'],
    ...r.monthCols.slice(0, DUE_THROUGH).map((m, i) => [
      `${m}-р сар`,
      r.debtors.filter((u) => (u.unpaid.get(m) || 0) > 0).length,
      r.perMonth[i],
    ]),
    ['9-р сар', units.filter((u) => u.sep > 0).length, units.reduce((s, u) => s + u.sep, 0)],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 42 }, { wch: 14 }, { wch: 18 }];
  return ws;
}

async function main() {
  const units = readSource();
  if (!verify(units)) {
    console.error('\n❌ Задаргаа эх тайлангийн дүнтэй таарахгүй — тайлан бичихгүй.');
    process.exitCode = 1;
    return;
  }

  const phones = await phonesFromDb();
  const matched = units.filter((u) => phones.has(`${u.building}|${u.apartment}`)).length;
  console.log(`   DB-тэй холбогдсон: ${matched}/${units.length} айл (утасны багана)`);

  const r = build(units, phones);

  console.log('\n📊 2026 оны төлбөр (2026.09.11-ний хуулгаар):');
  console.log(`   1–${DUE_THROUGH} сард өртэй:   ${String(r.debtors.length).padStart(3)} айл · ${money(r.totalDue)}₮`);
  console.log(`   1–${DUE_THROUGH} бүрэн төлсөн: ${String(units.length - r.debtors.length).padStart(3)} айл`);
  console.log(`   9-р сар (дуусаагүй): ${String(units.filter((u) => u.sep > 0).length).padStart(3)} айл · ${money(units.reduce((s, u) => s + u.sep, 0))}₮`);
  console.log(`   2026 нийт өр:        ${money(units.reduce((s, u) => s + u.total, 0))}₮`);

  console.log('\n   Сар бүрийн төлөгдөөгүй дүн:');
  r.monthCols.slice(0, DUE_THROUGH).forEach((m, i) => {
    const n = r.debtors.filter((u) => (u.unpaid.get(m) || 0) > 0).length;
    console.log(`      ${String(m).padStart(2)}-р сар: ${String(n).padStart(3)} айл · ${money(r.perMonth[i]).padStart(12)}₮`);
  });

  console.log('\n   Хамгийн их өртэй 10 айл:');
  r.debtors.slice(0, 10).forEach((u) => {
    console.log(`      ${u.building}-${String(u.apartment).padEnd(4)} ${u.name.padEnd(18)} ${money(u.dueAmt).padStart(10)}₮ · ${u.due.length} сар`);
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, r.ws, 'Өртэй айл сар сараар');
  XLSX.utils.book_append_sheet(wb, summarySheet(units, r), 'Товч дүн');
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  XLSX.writeFile(wb, OUT);
  console.log(`\n✅ Тайлан: ${path.relative(ROOT, OUT)}`);
  console.log('   ⚠️  Нэр, утас, өрийн дүн бүхий PII — git-д ОРУУЛАХГҮЙ (docs/reports/ нь .gitignore-д).');
}

main();
