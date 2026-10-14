// «Бадрах» СӨХ (#1571) — банкны төлөгдөөгүй нэхэмжлэлийн тайлангаас өр +
// сарын хураамжийг шинэчилнэ.
//
// Энэ нь ЗӨВХӨН энэ нэг СӨХ-д зориулсан нэг удаагийн скрипт (аппын кодыг өөрчлөхгүй).
//
// Эх сурвалж: `~/Downloads/10-2-бадрах.xlsx`, «contor-598» хуудас — тооцооны
// системийн тайлан, «Хэвлэсэн огноо 2026/10/02». Мөр бүр НЭГ ТООТЫН НЭГ
// ТӨЛӨГДӨӨГҮЙ САР: B «Байр / Хаалга» (жишээ «22.1 / 0004 - 0»), C «Огноо»
// («2025/7»), X «Мөнгөн дүн». Задаргааны баганууд X-тэй тэнцдэггүй (дулаан
// зэрэг багана тайланд гараагүй) тул ЗӨВХӨН X-г ашиглана.
//
// Байрны код → бодит хаяг (rename-badrakh-buildings.js-ийн банкны кодтой нийцнэ):
//   22.1=22А · 22.2=22Б · 23.0=23А · 23.2=23Б · 23.3=23В · 23.4=23Г
//   Тоо нь таарна (145/145/37/37/37/37), 23.2/0 = СӨХ-ийн өрөө (24/0) → алгасна.
//
// Өрийн дүрэм (project_resident_auto_invoice): M сарын нэхэмжлэх M+1/5 хүртэл
// өр БИШ. 2026-10-14-ний байдлаар 9-р сар хүртэлх нь өр, 10-р сарынх нь
// «энэ сарын төлбөр» → debt = Огноо < CUTOFF мөрүүдийн нийлбэр.
// 10-р сарын мөр нь бүх 438 тоотод байгаа тул түүнийг monthly_fee болгоно
// (23В-ийн 9…36 тоотод 10,000₮ лифтний хураамж нэмэгдсэн).
//
// ⚠️ Тайлан 10/02-ны байдлаар — түүнээс хойш төлсөн айлын өр илүү гарна.
//
// Ажиллуулах:
//   node scripts/update-badrakh-debt.js            # dry-run
//   node scripts/update-badrakh-debt.js --commit   # бодитоор бичнэ

const path = require('path');
const fs = require('fs');
const os = require('os');
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const ROOT = path.resolve(__dirname, '..');
const COMMIT = process.argv.includes('--commit');
const SRC = process.env.SRC || path.join(os.homedir(), 'Downloads', '10-2-бадрах.xlsx');
const SHEET = 'contor-598';
const SOKH_ID = 1571;
const EXPECT_NAME = 'Бадрах';
const CUTOFF = [2026, 10]; // энэ сар ба түүнээс хойших нь өр биш
const BUILDING = { '22.1': '22А', '22.2': '22Б', '23.0': '23А', '23.2': '23Б', '23.3': '23В', '23.4': '23Г' };
const SKIP_KEYS = new Set(['23Б|0']); // СӨХ-ийн өрөө
const C_UNIT = 1, C_PERIOD = 2, C_AMOUNT = 23;

for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!process.env[m[1]]) process.env[m[1]] = v;
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const money = n => Number(n || 0).toLocaleString('en-US');

function readUnits() {
  if (!fs.existsSync(SRC)) { console.error(`❌ Файл олдсонгүй: ${SRC}`); process.exit(1); }
  const wb = XLSX.readFile(SRC);
  if (!wb.Sheets[SHEET]) { console.error(`❌ «${SHEET}» хуудас алга: ${wb.SheetNames.join(', ')}`); process.exit(1); }
  const raw = XLSX.utils.sheet_to_json(wb.Sheets[SHEET], { header: 1, raw: true, defval: '' });

  const units = new Map();
  let rowCount = 0, rowSum = 0;
  for (let i = 0; i < raw.length; i++) {
    const r = raw[i];
    if (typeof r[0] !== 'number') continue; // толгой, хоосон, «Тайланг гаргасан»
    const m = String(r[C_UNIT]).match(/^(\d+\.\d+) \/ (\d+) - 0$/);
    const p = String(r[C_PERIOD]).match(/^(\d{4})\/(\d{1,2})$/);
    const amount = Number(r[C_AMOUNT]);
    if (!m || !p || !Number.isFinite(amount)) { console.error(`❌ ${i + 1}-р мөр танигдсангүй: ${JSON.stringify(r.slice(0, 4))}`); process.exit(1); }
    const building = BUILDING[m[1]];
    if (!building) { console.error(`❌ Үл мэдэх байрны код ${m[1]} (${i + 1}-р мөр)`); process.exit(1); }
    const apartment = String(Number(m[2]));
    const key = `${building}|${apartment}`;
    const y = Number(p[1]), mo = Number(p[2]);
    const isDebt = y < CUTOFF[0] || (y === CUTOFF[0] && mo < CUTOFF[1]);
    const isCurrent = y === CUTOFF[0] && mo === CUTOFF[1];
    const u = units.get(key) || { building, apartment, debt: 0, months: 0, fee: null };
    if (isDebt) { u.debt += amount; u.months++; }
    else if (isCurrent) u.fee = amount;
    else { console.error(`❌ Ирээдүйн сар ${r[C_PERIOD]} (${i + 1}-р мөр)`); process.exit(1); }
    units.set(key, u);
    rowCount++; rowSum += amount;
  }
  return { units, rowCount, rowSum };
}

(async () => {
  console.log(`Горим: ${COMMIT ? 'COMMIT (DB-д бичнэ)' : 'DRY-RUN (юу ч бичихгүй)'}`);
  console.log(`Эх файл: ${SRC}`);
  const { units, rowCount, rowSum } = readUnits();

  // ---- тулгалт: тоотуудын нийлбэр = мөрүүдийн нийлбэр ----
  const all = [...units.values()];
  const debtSum = all.reduce((s, u) => s + u.debt, 0);
  const feeSum = all.reduce((s, u) => s + (u.fee || 0), 0);
  console.log(`\n=== EXCEL ===`);
  console.log(`  Мөр: ${rowCount} · Тоот: ${units.size} · Нийт: ${money(rowSum)}₮`);
  console.log(`  Өр (${CUTOFF[0]}/${CUTOFF[1]}-өөс өмнөх): ${money(debtSum)}₮ · ${all.filter(u => u.debt > 0).length} айл`);
  console.log(`  ${CUTOFF[0]}/${CUTOFF[1]}-р сарын хураамж: ${money(feeSum)}₮`);
  if (debtSum + feeSum !== rowSum) { console.error(`❌ Тулгалт зөрлөө: ${debtSum} + ${feeSum} ≠ ${rowSum}`); process.exit(1); }
  const noFee = all.filter(u => u.fee == null);
  if (noFee.length) { console.error(`❌ ${CUTOFF[1]}-р сарын мөргүй тоот: ${noFee.map(u => u.building + '/' + u.apartment).join(', ')}`); process.exit(1); }
  for (const b of Object.values(BUILDING)) {
    const g = all.filter(u => u.building === b);
    console.log(`  ${b.padEnd(4)} ${String(g.length).padStart(3)} тоот · өр ${money(g.reduce((s, u) => s + u.debt, 0)).padStart(11)}₮ · өртэй ${g.filter(u => u.debt > 0).length}`);
  }

  // ---- СӨХ ба оршин суугчид ----
  const { data: org } = await sb.from('sokh_organizations').select('id, name').eq('id', SOKH_ID).single();
  if (!org || org.name !== EXPECT_NAME) { console.error(`❌ #${SOKH_ID} нь «${EXPECT_NAME}» биш`); process.exit(1); }
  const { data: residents, error } = await sb
    .from('residents').select('id, building, apartment, debt, monthly_fee').eq('sokh_id', SOKH_ID);
  if (error) { console.error('❌', error.message); process.exit(1); }
  const byKey = new Map();
  for (const r of residents) {
    const k = `${String(r.building || '').trim()}|${String(r.apartment).trim()}`;
    if (byKey.has(k)) { console.error(`❌ DB-д давхардсан ${k}`); process.exit(1); }
    byKey.set(k, r);
  }

  const updates = [], missing = [], skipped = [];
  for (const [k, u] of units) {
    if (SKIP_KEYS.has(k)) { skipped.push(`${k} (өр ${money(u.debt)}₮)`); continue; }
    const cur = byKey.get(k);
    if (!cur) { missing.push(k); continue; }
    const patch = {};
    if (Number(cur.debt || 0) !== u.debt) patch.debt = u.debt;
    if (Number(cur.monthly_fee || 0) !== u.fee) patch.monthly_fee = u.fee;
    if (Object.keys(patch).length) updates.push({ id: cur.id, key: k, cur, patch });
  }
  const notInExcel = residents.filter(r => !units.has(`${String(r.building || '').trim()}|${String(r.apartment).trim()}`));

  console.log(`\n=== ТӨЛӨВЛӨГӨӨ ===`);
  console.log(`  DB-д: ${residents.length} · Засах: ${updates.length} · Алгассан: ${skipped.join(', ') || '—'}`);
  if (missing.length) { console.error(`❌ Excel-д байгаа ч DB-д алга: ${missing.join(', ')}`); process.exit(1); }
  if (notInExcel.length) console.log(`  ⚠️  DB-д байгаа ч Excel-д алга (хөндөхгүй): ${notInExcel.map(r => r.building + '/' + r.apartment).join(', ')}`);
  const feeChanges = updates.filter(u => 'monthly_fee' in u.patch);
  console.log(`  Хураамж өөрчлөгдөх: ${feeChanges.length}`);
  feeChanges.slice(0, 5).forEach(u => console.log(`    ${u.key}: ${money(u.cur.monthly_fee)} → ${money(u.patch.monthly_fee)}`));
  const top = [...all].sort((a, b) => b.debt - a.debt).slice(0, 8);
  console.log(`  Хамгийн их өр:`);
  top.forEach(u => console.log(`    ${u.building}/${u.apartment}: ${money(u.debt)}₮ (${u.months} сар)`));
  const expectDb = all.filter(u => !SKIP_KEYS.has(`${u.building}|${u.apartment}`)).reduce((s, u) => s + u.debt, 0);
  console.log(`  Бичигдсэний дараах нийт өр: ${money(expectDb)}₮`);

  if (!COMMIT) { console.log(`\nDRY-RUN — юу ч бичээгүй. Бичихдээ: node scripts/update-badrakh-debt.js --commit`); return; }

  let ok = 0;
  for (const u of updates) {
    const { error: e } = await sb.from('residents').update(u.patch).eq('id', u.id).eq('sokh_id', SOKH_ID);
    if (e) console.error(`   ❌ ${u.key}: ${e.message}`); else ok++;
  }
  const { data: after } = await sb.from('residents').select('debt').eq('sokh_id', SOKH_ID);
  const total = after.reduce((s, r) => s + Number(r.debt || 0), 0);
  console.log(`\n✅ Засав: ${ok}/${updates.length} · DB-ийн нийт өр: ${money(total)}₮ ${total === expectDb ? '(таарлаа)' : '❌ ЗӨРЛӨӨ'}`);
})().catch(e => { console.error(e); process.exit(1); });
