// Ариун Очир-69 СӨХ (#1768) — УДИРДЛАГЫН ЗАРДЛЫГ хүн, албан тушаал, данс тус
// бүрээр задлана (СӨХ дарга / хариуцагч / нягтлан / ажилтан).
//
// Энэ файл ЗӨВХӨН энэ нэг СӨХ-д зориулсан тайлангийн скрипт (аппын кодыг өөрчлөхгүй).
//
// ⚠️  Гаралт нь хүний нэр, дансны дугаар, цалингийн дүн агуулна → `docs/reports/`
//     нь `.gitignore`-д. Репо public тул гаралтыг git-д БҮҮ ОРУУЛ.
//
// ═══ Эх сурвалж ═══
// Downloads/Ариун очир сөх/Ариун-Очир СӨХ - Зарлагын тайлан 2019-2026.xlsx
//   «Гүйлгээ» хуудас (2,662 зарлагын гүйлгээ, Төрийн банкны 31 хуулгаас).
//   Үүнээс Дэд ангилал = «Удирдлага (СӨХ дарга, хариуцагч, нягтлан, ажилтан)»
//   гэсэн 164 гүйлгээ · 69,931,890₮-г задлана.
//
// ═══ Арга ═══
// · АЛБАН ТУШААЛ нь гүйлгээний утгад бичигдсэн байдаг («8-Р САРЫН СӨХ ДАРГА
//   ЦАЛИН», «гэрээт нягтлан», «Сөх хариуцагч цалин»). Утгаас нь шууд уншина.
//   Утгад бичээгүй 20 гүйлгээг тухайн ХҮНИЙ үндсэн албан тушаалаар (түүний
//   бусад гүйлгээнд хамгийн их бичигдсэн тушаал) оноож, «(утгаас биш —
//   хүнийхээр)» гэж тэмдэглэнэ.
// · ХҮН: банкны хуулгад нэр, овог солигдож бичигддэг («АЛТАНЧИМЭГ САМДАН» =
//   «САМДАН АЛТАНЧИМЭГ») тул нэрийн үгсийг эрэмбэлж нэг хүн болгоно. Нэг үгтэй
//   нэр («Энхтуяа») нь зөвхөн ЯГ НЭГ бүтэн нэрийн үгтэй таарвал тэр хүнд
//   нэгдэнэ; хоёрдмол бол тусдаа хэвээр үлдэж, тайланд тэмдэглэгдэнэ.
// · ДАНС: хуулга нэг дансыг заримдаа IBAN-аар («MN480005005024502724»),
//   заримдаа доторх дугаараар («5024502724») бичдэг. Цифрүүдийн СҮҮЛИЙН 10
//   оронгоор нэгтгэж, тааралдсан бүх хэлбэрийг баганад харуулна.
//
// Хяналт: задаргааны нийлбэр эх тайлангийн «Удирдлага» мөрийн 69,931,890₮-тэй
// таарах ёстой. Зөрвөл бичихгүй.
//
// Ажиллуулах:
//   node scripts/report-ariun-ochir-mgmt-payroll.mjs
//
// Сонголт: FILE=… (эх xlsx), OUT=… (гаралт), SUB=… (өөр дэд ангилал задлах)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = process.env.FILE
  || 'C:/Users/MNG/Downloads/Ариун очир сөх/Ариун-Очир СӨХ - Зарлагын тайлан 2019-2026.xlsx';
const TX_SHEET = 'Гүйлгээ';
const SUB = process.env.SUB || 'Удирдлага (СӨХ дарга, хариуцагч, нягтлан, ажилтан)';
const OUT = process.env.OUT
  || path.join(ROOT, 'docs/reports/ariun-ochir-udirdlagyn-zardal-hunees.xlsx');

const money = (n) => Number(Math.round(n)).toLocaleString('en-US');

// Утгаас албан тушаал
const ROLES = [
  ['СӨХ дарга', /дарг/i],
  ['Хариуцагч', /хариуц|хөриуцаг/i],
  ['Нягтлан', /нягтл|нягтaл|нягталан/i],
  ['Ажилтан', /ажилтан/i],
];
const roleFromMemo = (memo) => {
  const hit = ROLES.filter(([, re]) => re.test(memo)).map(([r]) => r);
  return hit.length ? hit.join(' + ') : null;
};

// Нэрийг үгсээр эрэмбэлж хүний түлхүүр болгоно
const nameKey = (name) => String(name).trim().toUpperCase()
  .replace(/[^\p{L}\s-]/gu, ' ').split(/\s+/).filter(Boolean).sort().join(' ');

// Дансны цифрүүдийн сүүлийн 10 орон
function acctKey(raw) {
  const d = String(raw ?? '').replace(/\D/g, '');
  if (!d) return '';
  return d.length > 10 ? d.slice(-10) : d;
}

function readTx() {
  if (!fs.existsSync(FILE)) {
    console.error(`❌ Файл олдсонгүй: ${FILE}`);
    process.exit(1);
  }
  const wb = XLSX.readFile(FILE);
  if (!wb.Sheets[TX_SHEET]) {
    console.error(`❌ "${TX_SHEET}" хуудас олдсонгүй. Байгаа: ${wb.SheetNames.join(', ')}`);
    process.exit(1);
  }
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[TX_SHEET], { header: 1, blankrows: false, defval: '' });
  return rows.slice(1).map((r) => ({
    date: String(r[0]).trim(),
    time: String(r[1]).trim(),
    year: String(r[2]).trim(),
    month: Number(r[3]) || null,
    amount: Number(r[4]) || 0,
    group: String(r[5]).trim(),
    sub: String(r[6]).trim(),
    payee: String(r[7]).trim(),
    memo: String(r[8]).trim(),
    account: String(r[9]).trim(),
    bank: String(r[10]).trim(),
    file: String(r[11]).trim(),
  }));
}

// Эх тайлангийн «Жилийн нэгтгэл» дээрх Удирдлага мөрийн дүн — хяналтын тоо
function expectedTotal() {
  const wb = XLSX.readFile(FILE);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['Жилийн нэгтгэл'], { header: 1, blankrows: false, defval: '' });
  const hdr = rows.find((r) => String(r[0]).trim() === 'Бүлэг');
  const row = rows.find((r) => String(r[1]).trim() === SUB);
  if (!hdr || !row) return null;
  const i = hdr.findIndex((h) => String(h).trim() === 'НИЙТ');
  return i < 0 ? null : Number(row[i]) || null;
}

// Нэг үгтэй нэрийг бүтэн нэр рүү нэгтгэнэ (зөвхөн хоёрдмол биш бол)
function resolvePeople(tx) {
  const keys = new Set(tx.map((t) => nameKey(t.payee)).filter(Boolean));
  const multi = [...keys].filter((k) => k.includes(' '));
  const alias = new Map();
  const ambiguous = [];
  for (const k of keys) {
    if (k.includes(' ')) { alias.set(k, k); continue; }
    const owners = multi.filter((m) => m.split(' ').includes(k));
    if (owners.length === 1) alias.set(k, owners[0]);
    else { alias.set(k, k); if (owners.length > 1) ambiguous.push({ k, owners }); }
  }
  return { alias, ambiguous };
}

// Хүний үндсэн албан тушаал = утгад хамгийн их бичигдсэн нь (дүнгээр)
function primaryRoles(tx, alias) {
  const byPerson = new Map();
  for (const t of tx) {
    const p = alias.get(nameKey(t.payee));
    const r = roleFromMemo(t.memo);
    if (!r) continue;
    if (!byPerson.has(p)) byPerson.set(p, new Map());
    const m = byPerson.get(p);
    m.set(r, (m.get(r) || 0) + t.amount);
  }
  const out = new Map();
  for (const [p, m] of byPerson) {
    out.set(p, [...m.entries()].sort((a, b) => b[1] - a[1])[0][0]);
  }
  return out;
}

function years(tx) {
  return [...new Set(tx.map((t) => t.year))].filter(Boolean).sort();
}

function displayName(tx, alias, personKey) {
  // Хамгийн олон удаа тааралдсан бичлэгийн хэлбэрийг харуулна
  const counts = new Map();
  for (const t of tx) {
    if (alias.get(nameKey(t.payee)) !== personKey) continue;
    counts.set(t.payee, (counts.get(t.payee) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || personKey;
}

function main() {
  const all = readTx();
  const tx = all.filter((t) => t.sub === SUB);
  if (!tx.length) {
    console.error(`❌ "${SUB}" гэсэн дэд ангилал олдсонгүй.`);
    process.exit(1);
  }
  const total = tx.reduce((s, t) => s + t.amount, 0);
  const expected = expectedTotal();

  console.log(`📥 ${SUB}`);
  console.log(`   Гүйлгээ: ${tx.length} · ${money(total)}₮`);
  console.log('\n🔎 Хяналт:');
  console.log(`   Эх тайлангийн «Жилийн нэгтгэл» дүн: ${expected === null ? '—' : `${money(expected)}₮`}`);
  const ok = expected === null || Math.abs(expected - total) < 1;
  console.log(`   Задаргааны нийлбэр:                 ${money(total)}₮ ${ok ? '✓' : '❌'}`);
  if (!ok) {
    console.error('\n❌ Задаргаа эх тайлантай таарахгүй — тайлан бичихгүй.');
    process.exitCode = 1;
    return;
  }

  const { alias, ambiguous } = resolvePeople(tx);
  const primary = primaryRoles(tx, alias);
  const YS = years(tx);

  // Гүйлгээ бүрд хүн, албан тушаал, дансыг оноох
  const enriched = tx.map((t) => {
    const person = alias.get(nameKey(t.payee));
    const memoRole = roleFromMemo(t.memo);
    return {
      ...t,
      person,
      personName: displayName(tx, alias, person),
      role: memoRole || primary.get(person) || 'Тодорхойгүй',
      roleSource: memoRole ? 'утгаас' : (primary.get(person) ? 'хүнийхээр (утгад бичээгүй)' : 'тодорхойгүй'),
      acct: acctKey(t.account),
    };
  });

  // ── Хүн × данс ──
  const pa = new Map();
  for (const t of enriched) {
    const k = `${t.person}||${t.acct}`;
    if (!pa.has(k)) {
      pa.set(k, {
        person: t.person, personName: t.personName, acct: t.acct,
        raws: new Set(), banks: new Set(), roles: new Map(),
        n: 0, sum: 0, byYear: new Map(), first: t.date, last: t.date,
      });
    }
    const a = pa.get(k);
    a.n++; a.sum += t.amount;
    a.raws.add(t.account || '—');
    if (t.bank) a.banks.add(t.bank);
    a.roles.set(t.role, (a.roles.get(t.role) || 0) + t.amount);
    a.byYear.set(t.year, (a.byYear.get(t.year) || 0) + t.amount);
    if (t.date < a.first) a.first = t.date;
    if (t.date > a.last) a.last = t.date;
  }
  const paRows = [...pa.values()].sort((a, b) => b.sum - a.sum);

  // ── Хүнээр ──
  const per = new Map();
  for (const t of enriched) {
    if (!per.has(t.person)) {
      per.set(t.person, {
        person: t.person, personName: t.personName, accts: new Set(), banks: new Set(),
        roles: new Map(), n: 0, sum: 0, byYear: new Map(), first: t.date, last: t.date,
      });
    }
    const p = per.get(t.person);
    p.n++; p.sum += t.amount;
    p.accts.add(t.acct); if (t.bank) p.banks.add(t.bank);
    p.roles.set(t.role, (p.roles.get(t.role) || 0) + t.amount);
    p.byYear.set(t.year, (p.byYear.get(t.year) || 0) + t.amount);
    if (t.date < p.first) p.first = t.date;
    if (t.date > p.last) p.last = t.date;
  }
  const perRows = [...per.values()].sort((a, b) => b.sum - a.sum);

  // ── Албан тушаалаар ──
  const byRole = new Map();
  for (const t of enriched) {
    if (!byRole.has(t.role)) byRole.set(t.role, { n: 0, sum: 0, byYear: new Map(), people: new Map() });
    const r = byRole.get(t.role);
    r.n++; r.sum += t.amount;
    r.byYear.set(t.year, (r.byYear.get(t.year) || 0) + t.amount);
    r.people.set(t.personName, (r.people.get(t.personName) || 0) + t.amount);
  }
  const roleRows = [...byRole.entries()].sort((a, b) => b[1].sum - a[1].sum);

  const rolesText = (m) => [...m.entries()].sort((a, b) => b[1] - a[1])
    .map(([r, v]) => `${r} (${money(v)}₮)`).join(' · ');

  // ── Дэлгэцэнд ──
  console.log('\n👤 Хүн тус бүрээр:');
  perRows.forEach((p) => console.log(
    `   ${money(p.sum).padStart(12)}₮  ${String(p.n).padStart(3)} гүйлгээ  ${p.personName.padEnd(24)}`
    + ` ${p.accts.size} данс · ${p.first}→${p.last}`));
  console.log('\n🏷  Албан тушаалаар:');
  roleRows.forEach(([r, v]) => console.log(
    `   ${money(v.sum).padStart(12)}₮  ${String(v.n).padStart(3)} гүйлгээ  ${r.padEnd(22)} `
    + `${[...v.people.keys()].length} хүн`));
  console.log('\n🏦 Хүн × данс:');
  paRows.forEach((a) => console.log(
    `   ${money(a.sum).padStart(12)}₮  ${String(a.n).padStart(3)} гүйлгээ  ${a.personName.padEnd(24)}`
    + ` ${(a.acct || '—').padEnd(12)} ${[...a.banks].join('/') || '—'}`));
  if (ambiguous.length) {
    console.log('\n   ⚠️  Хоёрдмол нэр (нэгтгээгүй):');
    ambiguous.forEach((a) => console.log(`      ${a.k} → ${a.owners.join(' / ')}`));
  }

  // ── Excel ──
  const wb = XLSX.utils.book_new();

  const sPerson = XLSX.utils.aoa_to_sheet([
    ['Ариун Очир-69 СӨХ — удирдлагын зардал ХҮН тус бүрээр'],
    [`${SUB} · 2019.12.11 – 2026.09.11 · Төрийн банкны хуулгаар · ₮`],
    [],
    ['№', 'Хүн', 'Албан тушаал (дүнгээр)', 'Дансны тоо', 'Банк', ...YS.map((y) => `${y} он`),
      'НИЙТ (₮)', 'Эзлэх %', 'Гүйлгээ', 'Эхний', 'Сүүлийн'],
    ...perRows.map((p, i) => [
      i + 1, p.personName, rolesText(p.roles), p.accts.size, [...p.banks].join(', ') || '—',
      ...YS.map((y) => p.byYear.get(y) || ''),
      Math.round(p.sum), Number((p.sum / total * 100).toFixed(1)), p.n, p.first, p.last,
    ]),
    ['НИЙТ', '', '', '', '', ...YS.map((y) => perRows.reduce((s, p) => s + (p.byYear.get(y) || 0), 0)),
      Math.round(total), 100, tx.length, '', ''],
  ]);
  sPerson['!cols'] = [{ wch: 4 }, { wch: 24 }, { wch: 46 }, { wch: 11 }, { wch: 22 },
    ...YS.map(() => ({ wch: 13 })), { wch: 14 }, { wch: 9 }, { wch: 9 }, { wch: 12 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, sPerson, 'Хүнээр');

  const sAcct = XLSX.utils.aoa_to_sheet([
    ['Ариун Очир-69 СӨХ — удирдлагын зардал ХҮН × ДАНС тус бүрээр'],
    ['Нэг данс хуулгад IBAN-аар ч, доторх дугаараар ч бичигддэг — цифрийн сүүлийн 10 оронгоор нэгтгэв'],
    [],
    ['№', 'Хүн', 'Албан тушаал (дүнгээр)', 'Данс (нэгтгэсэн)', 'Хуулга дээрх бичлэг', 'Банк',
      ...YS.map((y) => `${y} он`), 'НИЙТ (₮)', 'Гүйлгээ', 'Эхний', 'Сүүлийн'],
    ...paRows.map((a, i) => [
      i + 1, a.personName, rolesText(a.roles), a.acct || '—', [...a.raws].join(' / '),
      [...a.banks].join(', ') || '—',
      ...YS.map((y) => a.byYear.get(y) || ''),
      Math.round(a.sum), a.n, a.first, a.last,
    ]),
    ['НИЙТ', '', '', '', '', '', ...YS.map((y) => paRows.reduce((s, a) => s + (a.byYear.get(y) || 0), 0)),
      Math.round(total), tx.length, '', ''],
  ]);
  sAcct['!cols'] = [{ wch: 4 }, { wch: 24 }, { wch: 40 }, { wch: 16 }, { wch: 46 }, { wch: 18 },
    ...YS.map(() => ({ wch: 13 })), { wch: 14 }, { wch: 9 }, { wch: 12 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, sAcct, 'Хүн × данс');

  const sRole = XLSX.utils.aoa_to_sheet([
    ['Ариун Очир-69 СӨХ — удирдлагын зардал АЛБАН ТУШААЛААР'],
    ['Албан тушаалыг гүйлгээний утгаас уншив; утгад бичээгүйг хүнийхээр оноов'],
    [],
    ['Албан тушаал', ...YS.map((y) => `${y} он`), 'НИЙТ (₮)', 'Эзлэх %', 'Гүйлгээ', 'Хүн', 'Хэн'],
    ...roleRows.map(([r, v]) => [
      r, ...YS.map((y) => v.byYear.get(y) || ''), Math.round(v.sum),
      Number((v.sum / total * 100).toFixed(1)), v.n, v.people.size,
      [...v.people.entries()].sort((a, b) => b[1] - a[1]).map(([n, s]) => `${n} (${money(s)}₮)`).join(' · '),
    ]),
    ['НИЙТ', ...YS.map((y) => roleRows.reduce((s, [, v]) => s + (v.byYear.get(y) || 0), 0)),
      Math.round(total), 100, tx.length, per.size, ''],
  ]);
  sRole['!cols'] = [{ wch: 26 }, ...YS.map(() => ({ wch: 13 })), { wch: 14 }, { wch: 9 },
    { wch: 9 }, { wch: 6 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, sRole, 'Албан тушаалаар');

  const sTx = XLSX.utils.aoa_to_sheet([
    ['Ариун Очир-69 СӨХ — удирдлагын зардлын бүх гүйлгээ'],
    [`${tx.length} гүйлгээ · ${money(total)}₮ · банкнаас мөнгө гарсан огноогоор`],
    [],
    ['№', 'Огноо', 'Цаг', 'Он', 'Сар', 'Дүн (₮)', 'Хүн', 'Албан тушаал', 'Тушаалыг хэрхэн тогтоов',
      'Данс (нэгтгэсэн)', 'Хуулга дээрх данс', 'Банк', 'Гүйлгээний утга', 'Хуулгын файл'],
    ...enriched
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
      .map((t, i) => [i + 1, t.date, t.time, t.year, t.month, Math.round(t.amount),
        t.personName, t.role, t.roleSource, t.acct || '—', t.account || '—', t.bank || '—',
        t.memo, t.file]),
    ['', '', '', '', 'НИЙТ', Math.round(total), '', '', '', '', '', '', '', ''],
  ]);
  sTx['!cols'] = [{ wch: 4 }, { wch: 12 }, { wch: 7 }, { wch: 7 }, { wch: 5 }, { wch: 13 },
    { wch: 24 }, { wch: 20 }, { wch: 26 }, { wch: 16 }, { wch: 24 }, { wch: 18 },
    { wch: 70 }, { wch: 26 }];
  sTx['!freeze'] = { xSplit: 0, ySplit: 4 };
  XLSX.utils.book_append_sheet(wb, sTx, 'Гүйлгээ (дэлгэрэнгүй)');

  // ── Тэдгээр хүмүүсийн дансаар ӨӨР ангиллаар дамжсан төлбөр ──
  // Удирдлагын цалин БИШ, гэхдээ ижил хүн/данс дээр гарсан тул хамт харуулна:
  // «үйлчлэгчийн цалин», «засвар» гэх мэтийг дарга/хариуцагчийн дансаар
  // дамжуулан тараасан байдаг. Хяналтад хэрэгтэй.
  const mgmtKeys = new Set(enriched.map((t) => t.person));
  const through = all.filter((t) => t.sub !== SUB && mgmtKeys.has(alias.get(nameKey(t.payee))));
  const thr = new Map();
  for (const t of through) {
    const person = alias.get(nameKey(t.payee));
    const k = `${person}||${t.sub}`;
    if (!thr.has(k)) {
      thr.set(k, {
        personName: displayName(all.filter((x) => mgmtKeys.has(alias.get(nameKey(x.payee)))), alias, person),
        sub: t.sub, group: t.group, n: 0, sum: 0, byYear: new Map(), accts: new Set(),
      });
    }
    const a = thr.get(k);
    a.n++; a.sum += t.amount;
    a.byYear.set(t.year, (a.byYear.get(t.year) || 0) + t.amount);
    a.accts.add(acctKey(t.account) || '—');
  }
  const thrRows = [...thr.values()].sort((a, b) => b.sum - a.sum);
  const thrTotal = through.reduce((s, t) => s + t.amount, 0);
  const YSA = years(all);

  const sThr = XLSX.utils.aoa_to_sheet([
    ['Ариун Очир-69 СӨХ — удирдлагын хүмүүсийн дансаар ӨӨР ангиллаар дамжсан төлбөр'],
    ['⚠️  Энэ нь тэдний ЦАЛИН БИШ. Үйлчлэгчийн цалин, засвар, материал зэргийг дарга/хариуцагчийн дансаар дамжуулан тараасан байдаг.'],
    [`${through.length} гүйлгээ · ${money(thrTotal)}₮ (удирдлагын цалин ${money(total)}₮-аас ГАДНА)`],
    [],
    ['№', 'Хүн', 'Бүлэг', 'Дэд ангилал', 'Данс', ...YSA.map((y) => `${y} он`), 'НИЙТ (₮)', 'Гүйлгээ'],
    ...thrRows.map((a, i) => [
      i + 1, a.personName, a.group, a.sub, [...a.accts].join(', '),
      ...YSA.map((y) => a.byYear.get(y) || ''), Math.round(a.sum), a.n,
    ]),
    ['НИЙТ', '', '', '', '', ...YSA.map((y) => thrRows.reduce((s, a) => s + (a.byYear.get(y) || 0), 0)),
      Math.round(thrTotal), through.length],
  ]);
  sThr['!cols'] = [{ wch: 4 }, { wch: 24 }, { wch: 26 }, { wch: 46 }, { wch: 26 },
    ...YSA.map(() => ({ wch: 13 })), { wch: 14 }, { wch: 9 }];
  XLSX.utils.book_append_sheet(wb, sThr, 'Дансаар дамжсан бусад');

  console.log(`\n🔁 Мөн тэдгээр хүмүүсийн дансаар ӨӨР ангиллаар дамжсан: ${through.length} гүйлгээ · ${money(thrTotal)}₮`);
  const thrByPerson = new Map();
  for (const t of through) {
    const p = alias.get(nameKey(t.payee));
    thrByPerson.set(p, (thrByPerson.get(p) || 0) + t.amount);
  }
  [...thrByPerson.entries()].sort((a, b) => b[1] - a[1]).forEach(([p, v]) => console.log(
    `   ${money(v).padStart(12)}₮  ${displayName(all, alias, p)}`));

  const notes = [
    ['Ариун Очир-69 СӨХ — удирдлагын зардлын задаргаа: тайлбар ба хяналт'],
    [],
    ['Эх сурвалж', 'Ариун-Очир СӨХ - Зарлагын тайлан 2019-2026.xlsx → «Гүйлгээ» хуудас'],
    ['', '(Төрийн банкны дансны хуулга 2019.12.11 – 2026.09.11, 31 файл)'],
    ['Дэд ангилал', SUB],
    ['Гүйлгээ', tx.length],
    ['Нийт дүн (₮)', Math.round(total)],
    ['Эх тайлангийн «Жилийн нэгтгэл» дүн (₮)', expected === null ? '—' : Math.round(expected)],
    ['Зөрүү (₮)', expected === null ? '—' : Math.round(total - expected)],
    ['Хүн', per.size],
    ['Данс (нэгтгэсэн)', new Set(enriched.map((t) => t.acct)).size],
    [],
    ['ЖИЛЭЭР', 'Дүн (₮)', 'Гүйлгээ'],
    ...YS.map((y) => [`${y} он`,
      enriched.filter((t) => t.year === y).reduce((s, t) => s + t.amount, 0),
      enriched.filter((t) => t.year === y).length]),
    [],
    ['АРГА'],
    ['• Албан тушаалыг гүйлгээний утгаас уншив: «дарга» → СӨХ дарга, «хариуцагч/хөриуцагч» → Хариуцагч, «нягтлан» → Нягтлан, «ажилтан» → Ажилтан.'],
    [`• Утгад албан тушаал бичээгүй ${enriched.filter((t) => t.roleSource !== 'утгаас').length} гүйлгээг тухайн хүний үндсэн албан тушаалаар оноов — «Гүйлгээ (дэлгэрэнгүй)» хуудсын «Тушаалыг хэрхэн тогтоов» баганаас шалгана.`],
    ['• Нэг гүйлгээний утгад хоёр тушаал бичигдсэн бол хоёуланг нь «А + Б» гэж харуулав.'],
    ['• Хүнийг нэрийн үгсийг эрэмбэлж нэгтгэв («АЛТАНЧИМЭГ САМДАН» = «САМДАН АЛТАНЧИМЭГ»).'],
    ['• Нэг үгтэй нэр зөвхөн ЯГ НЭГ бүтэн нэртэй таарвал нэгдэв; хоёрдмол бол тусдаа хэвээр.'],
    ['• Дансыг цифрийн сүүлийн 10 оронгоор нэгтгэв (IBAN ба доторх дугаар нэг данс). Хуулга дээрх бүх бичлэгийг баганад харуулав.'],
    [],
    ['ХЯЗГААРЛАЛТ'],
    ['• Зөвхөн БАНКААР гарсан төлбөр. Кассаас бэлнээр авсан цалин (эх тайлангийн «Бусад» бүлэгт) энд ороогүй.'],
    ['• Хуулгын «харьцсан данс» талбар нь бүх мөрд хүлээн авагчийн данс байдаггүй (заримдаа дамжуулсан/түр данс). Дансаар салгасан хүснэгтийг СӨХ-ийн цалингийн бүртгэлтэй тулгана уу.'],
    ['• Нэг хүн өөр ажилтны цалинг дамжуулан авсан тохиолдол байж болно — хуулгаас тогтоох боломжгүй.'],
    ['• НДШ, татварын шилжүүлэг нь тусдаа ангилалд («2. НДШ, татвар») байгаа тул энд ороогүй.'],
    [],
    ['ДАНСААР ДАМЖСАН БУСАД ТӨЛБӨР'],
    ['• «Дансаар дамжсан бусад» хуудсанд эдгээр 7 хүний дансаар ӨӨР ангиллаар гарсан төлбөрийг цуглуулав — үйлчлэгчийн цалин, засвар, материал г.м.'],
    ['• Энэ нь тэдний цалин БИШ; хараат бус тайланд удирдлагын зардалд нэмж БОЛОХГҮЙ. Гэхдээ мөнгө хэний дансаар дамжсаныг хянахад хэрэгтэй.'],
  ];
  if (ambiguous.length) {
    notes.push([], ['ХОЁРДМОЛ НЭР (нэгтгээгүй)'],
      ...ambiguous.map((a) => [a.k, a.owners.join(' / ')]));
  }
  const sNotes = XLSX.utils.aoa_to_sheet(notes);
  sNotes['!cols'] = [{ wch: 70 }, { wch: 40 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, sNotes, 'Тайлбар ба хяналт');

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  XLSX.writeFile(wb, OUT);
  console.log(`\n✅ Тайлан: ${path.relative(ROOT, OUT)}`);
  console.log('   ⚠️  Хүний нэр, дансны дугаар, цалин — git-д ОРУУЛАХГҮЙ.');
}

main();
