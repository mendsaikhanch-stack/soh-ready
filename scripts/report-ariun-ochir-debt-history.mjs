// Ариун Очир-69 СӨХ (#1768) — айл бүрийн өрийг БҮХ ЖИЛЭЭР, сар сараар гаргана.
//
// Энэ файл ЗӨВХӨН энэ нэг СӨХ-д зориулсан тайлангийн скрипт (аппын кодыг өөрчлөхгүй).
//
// ⚠️  Гаралт нь оршин суугчийн нэр, утас, өрийн дүн агуулна → `docs/reports/`
//     нь `.gitignore`-д байгаа. Репо public тул гаралтыг git-д БҮҮ ОРУУЛ.
//
// ═══ Эх сурвалж ═══
// Downloads/Ариун очир сөх/Ариун-Очир СӨХ - Тоот тус бүрийн орлогын тайлан 2019-2026.xlsx
//   «Гүйлгээ (тоотоор)» хуудас — Төрийн банкны 31 хуулгаас (2019.12.11–2026.09.11)
//   задлаж, давхардлыг хассан, тоотод оноосон 8,536 орлогын гүйлгээ.
//   Үүнээс Төрөл='СӨХ' гэсэн 8,473 гүйлгээ (347,723,830₮) л энэ тооцоонд орно
//   — граж/зогсоол (858,000₮) ба хаалт/чип (4,154,500₮) СӨХ-ийн хураамж биш.
//
// ═══ Арга ═══
// 1. ТАРИФ (айл тус бүрийн сарын хураамж, сар сараар өөр)
//    Кодтой төлбөрийн утга «…_СӨХ_2026/7» гэж аль сарын хураамжийг төлж байгааг
//    бичдэг. Тэр дүн нь ТУХАЙН САРЫН ХУРААМЖ өөрөө (банкны биллингээс гардаг).
//    → кодтой сар бүрийн хураамж ТОДОРХОЙ. Кодгүй сарын хураамжийг өмнөх
//    тодорхой сараас нь чилээж (байхгүй бол хамгийн эртнийхээс гэдрэг) авна —
//    хураамж блок блокоор л өөрддөг тул энэ нь бодит байдалд нийцнэ.
//    Код огт байхгүй 5 тоотод байрны САР ТУС БҮРИЙН ДУНДАЖ тарифыг оноож,
//    тайланд «тариф дундажаар» гэж тэмдэглэнэ.
// 2. ТӨЛӨЛТ
//    · кодтой төлбөр → шууд тухайн сар руу
//    · кодгүй төлбөр (109.8 сая₮, 31.6%) → хамгийн ЭРТНИЙ төлөгдөөгүй сараас
//      эхлэн дүнгээрээ нөхнө (FIFO). Нэг сард төлөөгүй ч хожим хамт төлсөн бол
//      тэр сар төлөгдсөнд тооцогдоно.
//    · хамтарсан төлбөр (жишээ «64+124+126+…», 11.47 сая₮) нь нэг гүйлгээгээр
//      олон тоотын төлбөрийг төлсөн тул хуваах боломжгүй → гишүүн тоотуудын
//      тарифын хувь тэнцүүлэн хуваарилж, тэдгээрийг «хамтарсан» гэж тэмдэглэв.
// 3. ӨР = сарын тариф − тэр сарт оногдсон төлөлт (сар тус бүрээр).
//
// ═══ Хязгаарлалт (тайлангийн Тайлбар хуудсанд ч бичигдэнэ) ═══
// · Бэлнээр эсвэл өөр дансаар төлсөн төлбөр банкны хуулгад харагдахгүй.
// · Бүх айлын хураамжийг 2019/11-ээс тооцов (156 тоотын 145 нь 2019 онд
//   кодтой төлбөр төлсөн тул байр тэр үед аль хэдийн ажиллаж байсан).
// · 2019.12.11-ээс өмнөх үлдэгдэл өр хуулгад байхгүй тул энд ОРООГҮЙ.
//
// Хяналт: нийт тариф − нийт төлөлт = нийт өр − нийт урьдчилгаа гэсэн тэнцэл,
// мөн төлөлтийн нийлбэр эх гүйлгээний 347,723,830₮-тэй тулгагдаж хэвлэгдэнэ.
//
// Ажиллуулах:
//   node scripts/report-ariun-ochir-debt-history.mjs
//
// Сонголт: FILE=… (эх xlsx), OUT=… (гаралт), FROM=2019/11, TO=2026/09

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = process.env.FILE
  || 'C:/Users/MNG/Downloads/Ариун очир сөх/Ариун-Очир СӨХ - Тоот тус бүрийн орлогын тайлан 2019-2026.xlsx';
const SHEET = 'Гүйлгээ (тоотоор)';
// СӨХ-ийн ӨӨРИЙН гадна хаалт/чипний төлбөрийн бүртгэл (2025/11-оос, 100,000₮
// тутам). Эдгээр гүйлгээний нэлээд нь банкны утгадаа «69A 8TOOT» гэхээс өөр
// юу ч бичээгүй тул орлогын тайланд СӨХ хураамж гэж ангилагдсан. Хураамж БИШ
// тул энэ бүртгэлээр (тоот + огноо + дүн) таниад тооцооноос хасна.
const GATE_FILE = process.env.GATE_FILE
  || 'C:/Users/MNG/Downloads/Айл-өрхийн-төлсөн-байдал.xlsx';
const GATE_SHEET = 'Sheet2';
const OUT = process.env.OUT
  || path.join(ROOT, 'docs/reports/ariun-ochir-ur-2019-2026-sar-saraar.xlsx');
const SOKH_ID = 1768;
const FROM = process.env.FROM || '2019/11';
const TO = process.env.TO || '2026/09';

const money = (n) => Number(Math.round(n)).toLocaleString('en-US');
const key = (y, m) => `${y}/${String(m).padStart(2, '0')}`;

function monthList(from, to) {
  const [fy, fm] = from.split('/').map(Number);
  const [ty, tm] = to.split('/').map(Number);
  const out = [];
  for (let y = fy, m = fm; y < ty || (y === ty && m <= tm);) {
    out.push(key(y, m));
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}
const MONTHS = monthList(FROM, TO);
const MIDX = new Map(MONTHS.map((m, i) => [m, i]));

// «2026/7», «2026/07» → «2026/07»
function normMonth(raw) {
  const m = String(raw ?? '').trim().match(/^(\d{4})\s*\/\s*(\d{1,2})$/);
  if (!m) return null;
  return key(Number(m[1]), Number(m[2]));
}

function readTx() {
  if (!fs.existsSync(FILE)) {
    console.error(`❌ Файл олдсонгүй: ${FILE}`);
    process.exit(1);
  }
  const wb = XLSX.readFile(FILE);
  if (!wb.Sheets[SHEET]) {
    console.error(`❌ "${SHEET}" хуудас олдсонгүй. Байгаа: ${wb.SheetNames.join(', ')}`);
    process.exit(1);
  }
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[SHEET], { header: 1, blankrows: false, defval: '' });
  return rows.slice(1)
    .filter((r) => String(r[6]).trim() === 'СӨХ')
    .map((r) => ({
      date: String(r[0]).trim(),
      building: String(r[2]).trim(),
      aptRaw: String(r[3]).trim(),
      name: String(r[4]).trim(),
      amount: Number(r[5]) || 0,
      month: normMonth(r[7]),
      method: String(r[8]).trim(),
      memo: String(r[9]).trim(),
    }))
    .filter((t) => t.amount > 0);
}

// Хаалт/чипний төлбөрийн бүртгэлээс «байр|тоот|огноо|дүн» түлхүүр цуглуулна
function readGate() {
  if (!fs.existsSync(GATE_FILE)) {
    console.log(`   ⚠️  Хаалтны бүртгэл олдсонгүй (${GATE_FILE}) — хаалтны төлбөр хураамжид тоологдоно.`);
    return new Map();
  }
  const wb = XLSX.readFile(GATE_FILE);
  if (!wb.Sheets[GATE_SHEET]) return new Map();
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[GATE_SHEET], { header: 1, blankrows: false, defval: '' });
  const out = new Map();
  for (const r of rows.slice(1)) {
    const apt = String(r[1] ?? '').trim();
    const date = String(r[2] ?? '').trim();
    const amt = Number(r[5]) || 0;
    if (!apt || !date || amt <= 0 || amt > 1_000_000) continue;   // >1 сая = нийт дүнгийн мөр
    const m = apt.match(/^69\s*([abАаБб])\s*-\s*(\d+)$/i);
    if (!m) continue;
    const building = /[aА]/i.test(m[1]) ? '69А' : '69Б';
    out.set(`${building}|${m[2]}|${date}|${amt}`, true);
  }
  return out;
}

function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const i = Math.floor(s.length / 2);
  return s.length % 2 ? s[i] : Math.round((s[i - 1] + s[i]) / 2);
}

function buildUnits(tx) {
  const units = new Map();   // "69А|12" → unit
  const joints = [];         // хамтарсан төлбөр

  const get = (building, apt, name) => {
    const k = `${building}|${apt}`;
    if (!units.has(k)) {
      units.set(k, {
        k, building, apartment: apt, name,
        tariff: new Map(),        // сар → тодорхой тариф (кодоос)
        paid: new Map(),          // сар → кодоор оногдсон төлөлт
        loose: 0,                 // кодгүй төлбөрийн нийт дүн
        looseTx: 0,
        jointAmt: 0,              // хамтарсан гүйлгээнээс оногдсон хувь
        jointTx: 0,
        firstDate: t_date(building, apt),
      });
    }
    const u = units.get(k);
    if (!u.name && name) u.name = name;
    return u;
  };
  function t_date() { return null; }

  for (const t of tx) {
    if (t.aptRaw.includes('+')) { joints.push(t); continue; }
    const u = get(t.building, t.aptRaw, t.name);
    if (!u.firstDate || t.date < u.firstDate) u.firstDate = t.date;
    if (t.month && MIDX.has(t.month)) {
      // Кодтой: тухайн сарын хураамжийг төлж байна
      u.tariff.set(t.month, Math.max(u.tariff.get(t.month) || 0, t.amount));
      u.paid.set(t.month, (u.paid.get(t.month) || 0) + t.amount);
    } else {
      u.loose += t.amount;
      u.looseTx++;
    }
  }
  return { units, joints };
}

// Сар тус бүрийн байрны дундаж тариф (код огт байхгүй тоотод хэрэглэнэ)
function tariffIndex(units) {
  const idx = new Map();
  for (const m of MONTHS) {
    const vals = [];
    for (const u of units.values()) if (u.tariff.has(m)) vals.push(u.tariff.get(m));
    idx.set(m, median(vals));
  }
  // Хоосон сарыг хөрш сараар нөхнө
  let last = 0;
  for (const m of MONTHS) { if (idx.get(m)) last = idx.get(m); else idx.set(m, last); }
  let next = 0;
  for (const m of [...MONTHS].reverse()) { if (idx.get(m)) next = idx.get(m); else idx.set(m, next); }
  return idx;
}

// Айлын тарифын цоорхойг байрны тарифын индексээр нөхнө.
//
// Хураамж нь айлын хэмжээгээр (айл тус бүр өөр) БОЛОН цаг хугацаагаар (тариф
// шинэчлэгдэхэд бүх айлд нэгэн зэрэг) өөрддөг. Иймд айл бүрийн «индексээс
// хэдээр зөрөх» хэмжээ (offset) харьцангуй тогтвортой:
//     тариф[айл][сар] ≈ индекс[сар] + offset[айл]
// Тодорхой (кодтой) сарыг байгаагаар авч, бусад сарыг индекс + offset-оор
// тооцно. Энэ нь «сүүлчийн мэдэгдэх дүнг чилээх»-ээс зөв — эс тэгвэл 2021-оос
// төлөөгүй айлын хураамж 2021 оны түвшинд хөшиж, өр дутуу гарна.
function fillTariff(u, idx) {
  const known = [...u.tariff.keys()].filter((m) => MIDX.has(m));
  u.tariffEstimated = known.length === 0;
  u.offset = u.tariffEstimated
    ? 0
    : median(known.map((m) => u.tariff.get(m) - idx.get(m)));
  const full = new Map();
  for (const m of MONTHS) {
    full.set(m, u.tariff.has(m)
      ? u.tariff.get(m)
      : Math.max(0, idx.get(m) + u.offset));
  }
  u.full = full;
  return full;
}

// Хамтарсан төлбөрийг гишүүн тоотуудын тарифын хувиар хуваарилна
function splitJoints(joints, units) {
  const unsplit = [];
  for (const j of joints) {
    const members = j.aptRaw.split('+').map((s) => s.trim())
      .map((a) => units.get(`${j.building}|${a}`))
      .filter(Boolean);
    if (!members.length) { unsplit.push({ ...j, reason: 'гишүүн тоот олдсонгүй' }); continue; }
    const weights = members.map((u) => u.full.get(TO) || median([...u.full.values()]) || 1);
    const sum = weights.reduce((a, b) => a + b, 0);
    members.forEach((u, i) => {
      const share = (j.amount * weights[i]) / sum;
      u.jointAmt += share;
      u.jointTx++;
      u.hasJoint = true;
    });
  }
  return unsplit;
}

// Кодгүй + хамтарсан дүнг хамгийн эртний төлөгдөөгүй сараас нөхнө (FIFO)
function allocate(u) {
  const covered = new Map();
  for (const m of MONTHS) covered.set(m, u.paid.get(m) || 0);

  let pool = u.loose + u.jointAmt;
  for (const m of MONTHS) {
    const due = u.full.get(m) - covered.get(m);
    if (due <= 0 || pool <= 0) continue;
    const take = Math.min(due, pool);
    covered.set(m, covered.get(m) + take);
    pool -= take;
  }
  u.covered = covered;
  u.prepaid = pool;                 // үлдсэн нь урьдчилгаа
  u.debtByMonth = new Map();
  u.debtTotal = 0;
  u.unpaidMonths = 0;
  for (const m of MONTHS) {
    const d = Math.round(u.full.get(m) - covered.get(m));
    if (d > 0) { u.debtByMonth.set(m, d); u.debtTotal += d; u.unpaidMonths++; }
  }
  u.billed = MONTHS.reduce((s, m) => s + u.full.get(m), 0);
  u.paidTotal = MONTHS.reduce((s, m) => s + (u.paid.get(m) || 0), 0) + u.loose + u.jointAmt;
}

function years() {
  const ys = [...new Set(MONTHS.map((m) => m.slice(0, 4)))];
  return ys;
}

function sheetByMonth(debtors) {
  const header = ['№', 'Байр', 'Тоот', 'Нэр', 'Утас', 'Банканд бүртгэлтэй нэр',
    'Төлөөгүй сар', 'НИЙТ ӨР (₮)', ...MONTHS, 'Тэмдэглэл'];
  const rows = debtors.map((u, i) => [
    i + 1, u.building, Number(u.apartment), u.name, u.phone || '', u.bankName || '',
    u.unpaidMonths, u.debtTotal,
    ...MONTHS.map((m) => u.debtByMonth.get(m) ?? ''),
    u.flags.join('; '),
  ]);
  const totals = ['НИЙТ', '', '', '', '', '',
    debtors.reduce((s, u) => s + u.unpaidMonths, 0),
    debtors.reduce((s, u) => s + u.debtTotal, 0),
    ...MONTHS.map((m) => debtors.reduce((s, u) => s + (u.debtByMonth.get(m) || 0), 0)),
    ''];

  const aoa = [
    ['Ариун Очир-69 СӨХ — айл бүрийн төлөгдөөгүй СӨХ хураамж, БҮХ ЖИЛЭЭР сар сараар'],
    [`${FROM} – ${TO} · Төрийн банкны 31 хуулгаар (2026.09.11 хүртэл) · зөвхөн ӨРТЭЙ айл · ₮`],
    ['Нүдний дүн = тэр сарын төлөгдөөгүй хураамж. Хоосон нүд = тэр сар ТӨЛӨГДСӨН.'],
    [],
    header,
    ...rows,
    totals,
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 5 }, { wch: 6 }, { wch: 6 }, { wch: 22 }, { wch: 10 }, { wch: 22 },
    { wch: 12 }, { wch: 13 }, ...MONTHS.map(() => ({ wch: 9 })), { wch: 40 }];
  ws['!freeze'] = { xSplit: 8, ySplit: 4 };
  return ws;
}

function sheetByYear(debtors) {
  const YS = years();
  const header = ['№', 'Байр', 'Тоот', 'Нэр', 'Утас', 'Төлөөгүй сар', 'НИЙТ ӨР (₮)',
    ...YS.map((y) => `${y} он`), 'Нэхэмжилсэн (₮)', 'Төлсөн (₮)', 'Урьдчилгаа (₮)', 'Тэмдэглэл'];
  const yearDebt = (u, y) => MONTHS.filter((m) => m.startsWith(y))
    .reduce((s, m) => s + (u.debtByMonth.get(m) || 0), 0);
  const rows = debtors.map((u, i) => [
    i + 1, u.building, Number(u.apartment), u.name, u.phone || '',
    u.unpaidMonths, u.debtTotal,
    ...YS.map((y) => yearDebt(u, y) || ''),
    Math.round(u.billed), Math.round(u.paidTotal), Math.round(u.prepaid) || '',
    u.flags.join('; '),
  ]);
  const totals = ['НИЙТ', '', '', '', '',
    debtors.reduce((s, u) => s + u.unpaidMonths, 0),
    debtors.reduce((s, u) => s + u.debtTotal, 0),
    ...YS.map((y) => debtors.reduce((s, u) => s + yearDebt(u, y), 0)),
    Math.round(debtors.reduce((s, u) => s + u.billed, 0)),
    Math.round(debtors.reduce((s, u) => s + u.paidTotal, 0)),
    Math.round(debtors.reduce((s, u) => s + u.prepaid, 0)),
    ''];
  const aoa = [
    ['Ариун Очир-69 СӨХ — өртэй айл, ЖИЛЭЭР (хурдан харах хүснэгт)'],
    [`${FROM} – ${TO} · ₮`],
    [],
    header, ...rows, totals,
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 5 }, { wch: 6 }, { wch: 6 }, { wch: 20 }, { wch: 10 }, { wch: 12 },
    { wch: 14 }, ...YS.map(() => ({ wch: 12 })), { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 40 }];
  ws['!freeze'] = { xSplit: 7, ySplit: 4 };
  return ws;
}

function sheetNotes(all, debtors, joints, unsplit, checks) {
  const YS = years();
  const aoa = [
    ['Ариун Очир-69 СӨХ — өрийн тайлангийн тайлбар ба хяналт'],
    [],
    ['Эх сурвалж', 'Төрийн банкны дансны хуулга 2019.12.11 – 2026.09.11 (31 файл)'],
    ['Хугацаа', `${FROM} – ${TO} (${MONTHS.length} сар)`],
    ['Бүртгэлтэй айл', all.length],
    ['Өртэй айл', debtors.length],
    ['Өргүй / бүрэн төлсөн айл', all.length - debtors.length],
    [],
    ['ХЯНАЛТ', 'Дүн (₮)'],
    ['Нэхэмжилсэн (тариф × сар), бүх айл', Math.round(checks.billed)],
    ['Төлсөн (эх гүйлгээнээс)', Math.round(checks.paid)],
    ['  · үүнээс кодтой', Math.round(checks.coded)],
    ['  · үүнээс кодгүй (дүнгээр нөхсөн)', Math.round(checks.loose)],
    ['  · үүнээс хамтарсан төлбөр (хувь тэнцүүлэн хуваарилсан)', Math.round(checks.joint)],
    ['Нийт өр', Math.round(checks.debt)],
    ['Нийт урьдчилгаа (илүү төлсөн)', Math.round(checks.prepaid)],
    ['Тэнцэл: нэхэмжилсэн − төлсөн − өр + урьдчилгаа (0 байх ёстой)',
      Math.round(checks.billed - checks.paid - checks.debt + checks.prepaid)],
    [],
    ['ӨР ЖИЛЭЭР', 'Дүн (₮)', 'Өртэй айл'],
    ...YS.map((y) => [`${y} он`,
      debtors.reduce((s, u) => s + MONTHS.filter((m) => m.startsWith(y))
        .reduce((a, m) => a + (u.debtByMonth.get(m) || 0), 0), 0),
      debtors.filter((u) => MONTHS.filter((m) => m.startsWith(y))
        .some((m) => (u.debtByMonth.get(m) || 0) > 0)).length]),
    [],
    ['АРГА'],
    ['• Тариф: кодтой төлбөрийн утга («…_СӨХ_2026/7») аль сарын хураамжийг төлж байгааг бичдэг; тэр дүн нь тухайн сарын хураамж өөрөө.'],
    ['• Кодгүй сарын хураамжийг өмнөх тодорхой сараас чилээж авав (хураамж блокоор өөрддөг).'],
    [`• Код огт байхгүй ${checks.estimatedUnits} тоотод байрны сар тус бүрийн дундаж тарифыг оноов — «тариф дундажаар» гэж тэмдэглэсэн.`],
    ['• Кодгүй төлбөрийг хамгийн эртний төлөгдөөгүй сараас эхлэн дүнгээрээ нөхсөн (FIFO). Нэг сард төлөөгүй ч хожим хамт төлсөн бол тэр сар ТӨЛӨГДСӨН.'],
    ['• Хамтарсан төлбөр (нэг гүйлгээгээр олон тоот) — гишүүн тоотуудын тарифын хувиар хуваарилав; тэдгээр айлыг «хамтарсан төлбөртэй» гэж тэмдэглэсэн.'],
    ['• Зөвхөн СӨХ-ийн хураамж. Граж/зогсоол (858,000₮) ба хаалт/чип (4,154,500₮) ОРООГҮЙ.'],
    [],
    ['ХЯЗГААРЛАЛТ'],
    ['• Бэлнээр эсвэл өөр дансаар төлсөн төлбөр банкны хуулгад харагдахгүй тул «төлөөгүй» гэж гарна.'],
    ['• 2019.12.11-ээс өмнөх үлдэгдэл өр хуулгад байхгүй тул энд ороогүй.'],
    ['• Бүх айлын хураамжийг 2019/11-ээс тооцов (156 тоотын 145 нь 2019 онд кодтой төлбөр төлсөн).'],
    ['• «Тариф дундажаар» ба «хамтарсан төлбөртэй» айлуудын дүнг СӨХ-ийн бүртгэлтэй тулгана уу.'],
    [],
    ['ХАМТАРСАН ТӨЛБӨР (хуваах боломжгүй нэг гүйлгээгээр олон тоот)'],
    ['Огноо', 'Байр', 'Тоотууд', 'Дүн (₮)', 'Гүйлгээний утга'],
    ...joints.map((j) => [j.date, j.building, j.aptRaw, j.amount, j.memo]),
  ];
  if (unsplit.length) {
    aoa.push([], ['ХУВААГДААГҮЙ ХАМТАРСАН ТӨЛБӨР — гараар шалга'],
      ...unsplit.map((j) => [j.date, j.building, j.aptRaw, j.amount, j.reason]));
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 62 }, { wch: 18 }, { wch: 26 }, { wch: 14 }, { wch: 60 }];
  return ws;
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
  const raw = readTx();
  const gate = readGate();
  const tx = [];
  let gateN = 0;
  let gateAmt = 0;
  for (const t of raw) {
    if (gate.has(`${t.building}|${t.aptRaw}|${t.date}|${t.amount}`)) {
      gateN++; gateAmt += t.amount; continue;
    }
    tx.push(t);
  }
  console.log(`📥 СӨХ гэж ангилагдсан гүйлгээ: ${raw.length} · ${money(raw.reduce((s, t) => s + t.amount, 0))}₮`);
  console.log(`   − гадна хаалт/чип (СӨХ-ийн бүртгэлээр таньсан): ${gateN} гүйлгээ · ${money(gateAmt)}₮`);
  console.log(`   = хураамжид тооцох: ${tx.length} гүйлгээ · ${money(tx.reduce((s, t) => s + t.amount, 0))}₮`);

  const { units, joints } = buildUnits(tx);
  const idx = tariffIndex(units);
  for (const u of units.values()) fillTariff(u, idx);
  const unsplit = splitJoints(joints, units);
  for (const u of units.values()) allocate(u);

  const phones = await phonesFromDb();
  const all = [...units.values()];
  for (const u of all) {
    const db = phones.get(u.k);
    u.phone = db?.phone || '';
    // Банкны бүртгэлийн нэр нь эх файлд Ү/Ө тэмдэгт гээгдсэн («П?РЭВХ?РЭЛ»)
    // тул аппын бүртгэлийн нэрийг эрхэмлэнэ; хоёуланг нь баганаар харуулна.
    u.bankName = u.name || '';
    u.name = db?.name || u.name || '';
    u.flags = [];
    if (u.tariffEstimated) u.flags.push('тариф дундажаар (кодтой төлбөр байхгүй)');
    if (u.hasJoint) u.flags.push(`хамтарсан төлбөртэй (${u.jointTx} гүйлгээ, ${money(u.jointAmt)}₮ оногдов)`);
    if (u.looseTx) u.flags.push(`кодгүй ${u.looseTx} гүйлгээ (${money(u.loose)}₮) дүнгээр нөхсөн`);
    if (u.prepaid > 0) u.flags.push(`урьдчилгаа ${money(u.prepaid)}₮`);
  }

  const checks = {
    billed: all.reduce((s, u) => s + u.billed, 0),
    paid: all.reduce((s, u) => s + u.paidTotal, 0),
    coded: all.reduce((s, u) => s + MONTHS.reduce((a, m) => a + (u.paid.get(m) || 0), 0), 0),
    loose: all.reduce((s, u) => s + u.loose, 0),
    joint: all.reduce((s, u) => s + u.jointAmt, 0),
    debt: all.reduce((s, u) => s + u.debtTotal, 0),
    prepaid: all.reduce((s, u) => s + u.prepaid, 0),
    estimatedUnits: all.filter((u) => u.tariffEstimated).length,
  };

  const debtors = all.filter((u) => u.debtTotal > 0)
    .sort((a, b) => b.debtTotal - a.debtTotal
      || a.building.localeCompare(b.building)
      || Number(a.apartment) - Number(b.apartment));

  console.log('\n🔎 Хяналт:');
  console.log(`   Нэхэмжилсэн:   ${money(checks.billed).padStart(14)}₮`);
  console.log(`   Төлсөн:        ${money(checks.paid).padStart(14)}₮  (кодтой ${money(checks.coded)} + кодгүй ${money(checks.loose)} + хамтарсан ${money(checks.joint)})`);
  console.log(`   Өр:            ${money(checks.debt).padStart(14)}₮`);
  console.log(`   Урьдчилгаа:    ${money(checks.prepaid).padStart(14)}₮`);
  const balance = checks.billed - checks.paid - checks.debt + checks.prepaid;
  console.log(`   Тэнцэл:        ${money(balance).padStart(14)}₮ ${Math.abs(balance) < all.length + 5 ? '✓' : '❌'}`);
  const srcTotal = tx.reduce((s, t) => s + t.amount, 0);
  console.log(`   Эх гүйлгээтэй: ${money(checks.paid)} vs ${money(srcTotal)} ${Math.abs(checks.paid - srcTotal) < 5 ? '✓' : '❌'}`);
  if (unsplit.length) console.log(`   ⚠️  Хуваагдаагүй хамтарсан төлбөр: ${unsplit.length}`);

  console.log(`\n📊 Өртэй: ${debtors.length} / ${all.length} айл · ${money(checks.debt)}₮`);
  console.log('\n   Өр жилээр:');
  for (const y of years()) {
    const d = debtors.reduce((s, u) => s + MONTHS.filter((m) => m.startsWith(y))
      .reduce((a, m) => a + (u.debtByMonth.get(m) || 0), 0), 0);
    const n = debtors.filter((u) => MONTHS.filter((m) => m.startsWith(y))
      .some((m) => (u.debtByMonth.get(m) || 0) > 0)).length;
    console.log(`      ${y}: ${money(d).padStart(12)}₮ · ${String(n).padStart(3)} айл`);
  }

  console.log('\n   Хамгийн их өртэй 15 айл:');
  debtors.slice(0, 15).forEach((u) => console.log(
    `      ${u.building}-${String(u.apartment).padEnd(4)} ${(u.name || '').padEnd(20)} ${money(u.debtTotal).padStart(11)}₮ · ${String(u.unpaidMonths).padStart(2)} сар`));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheetByMonth(debtors), 'Өр сар сараар');
  XLSX.utils.book_append_sheet(wb, sheetByYear(debtors), 'Өр жилээр');
  XLSX.utils.book_append_sheet(wb, sheetNotes(all, debtors, joints, unsplit, checks), 'Тайлбар ба хяналт');
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  XLSX.writeFile(wb, OUT);
  console.log(`\n✅ Тайлан: ${path.relative(ROOT, OUT)}`);
  console.log('   ⚠️  Нэр, утас, өр бүхий PII — git-д ОРУУЛАХГҮЙ.');
}

main();
