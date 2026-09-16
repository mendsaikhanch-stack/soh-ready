// «Бадрах» СӨХ (#1571, СХД 29-р хороо) — 437 айлыг Excel-ээс бүртгэнэ.
//
// Энэ нь ЗӨВХӨН энэ нэг СӨХ-д зориулсан нэг удаагийн скрипт (аппын кодыг өөрчлөхгүй).
//
// Эх сурвалж (2026-09-15-нд хүлээн авав): `~/Downloads/hotol.xlsx`, «хотол» хуудас.
//   Тэр файл нь сар бүрийн нэхэмжлэлийн загвар — мөр бүр нэг тоот, багана нь
//   халаалт/ус/хог/цэвэрлэгээ гэх мэт задаргаа. Бидэнд хэрэгтэй нь:
//     A(0) байр · C(2) хаалга · E(4) НЭР · L(11) талбай · AL(37) БҮГД ДҮН
//   AL нь задаргааны нийлбэр бөгөөд J «2025-4-р сараас» тарифтай яг тэнцэнэ
//   (438 мөрөөс зөвхөн СӨХ-ийн оффисынх зөрүүтэй) → monthly_fee болгож авав.
//
// Онцлог:
//   • 6 байр: 89, 88 (тус бүр 145 тоот, хаалга 0…144) ба 23, 24, 25, 26
//     (тус бүр 37 тоот, хаалга 0…36). Нийт 438 мөр, давхардал алга.
//   • Байр бүрд «0» тоот байна — бусдаасаа жижиг (89/88-д 10м², 23-26-д 18м²).
//     Эдгээрийг ХАСААГҮЙ: нэртэй, хураамжтай тул бодит тоот гэж үзэв.
//   • 24/0 нь «БАДРАХ СӨХ» өөрөө → ОГТ оруулахгүй (SKIP_KEYS). Үлдсэн
//     437 нь айл өрх — даргын хэлсэн «437 өрх»-тэй яг таарч байна.
//   • Тоот нь байр хооронд давхцана (23/5, 24/5 …) тул building-г ЗААВАЛ
//     бичнэ — /register нь эхлээд тоотоор, олон таарвал байраар нь ялгадаг.
//   • Excel-д УТАС ба ӨР байхгүй → аккаунт үүсгэхгүй, debt=0. Оршин суугчид
//     QR-аар өөрсдөө бүртгүүлэхэд байгаа мөрөндөө холбогдоно.
//   • «Ам бүл» багана бүхэлдээ хоосон тул household_size бичээгүй.
//
// Хяналт: эх файлд нийт дүнгийн мөр БАЙХГҮЙ тул тулгах дүн алга. Оронд нь
// байр тус бүрийн тоо, хаалганы муж, давхардал, хураамжийн нийлбэрийг хэвлэнэ.
//
// Ажиллуулах:
//   node scripts/import-badrakh.js             # dry-run: юу ч бичихгүй
//   node scripts/import-badrakh.js --commit    # бодитоор бичнэ
//
// Дахин ажиллуулахад: байгаа мөрийг давхарлахгүй (байр+тоотоор тулгана),
// харин нэр/талбай/хураамж нь Excel-ээс зөрж байвал ЗАСНА.

const path = require('path');
const fs = require('fs');
const os = require('os');
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const ROOT = path.resolve(__dirname, '..');
const COMMIT = process.argv.includes('--commit');
const SRC = process.env.SRC || path.join(os.homedir(), 'Downloads', 'hotol.xlsx');
const SHEET = 'хотол';

const SOKH_ID = Number(process.env.SOKH_ID || 1571);
const EXPECT_NAME = 'Бадрах';
const EXPECT_KHOROO = 210; // Сонгинохайрхан 29-р хороо
// 24/0 бол СӨХ-ийн өөрийн өрөө (дарга 2026-09-15: «24-ийн 00-д СӨХ байдаг»;
// 23, 25, 26-гийнх нь хүнтэй). Платформ нь `residents`-ийн МӨРӨӨР төлбөр
// тооцдог тул СӨХ өөрийнхөө өрөөнд төлөхгүйн тулд мөрийг нь ОГТ оруулахгүй
// (2026-09-15-нд DB-ээс бас устгав). 89/0, 88/0 хоёр нь хүнтэй тул үлдэнэ.
const SKIP_KEYS = new Set(['24|0']);

// ---- багануудын индекс (0-based) ----
const C_BAIR = 0, C_DOOR = 2, C_NAME = 4, C_AREA = 11, C_FEE = 37;
const FIRST_DATA_ROW = 5; // 0-based; дээр нь 5 мөр толгой

// ---- env ----
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

// Нэрийг эмхэлнэ: «Б.ОЮУНБИЛЭГ» / «Д ДАВААДОРЖ» → илүү зайг арилгана.
function cleanName(v) {
  return String(v || '').replace(/\s+/g, ' ').trim();
}

function readRows() {
  if (!fs.existsSync(SRC)) { console.error(`❌ Файл олдсонгүй: ${SRC}`); process.exit(1); }
  const wb = XLSX.readFile(SRC);
  if (!wb.Sheets[SHEET]) { console.error(`❌ «${SHEET}» хуудас алга. Байгаа нь: ${wb.SheetNames.join(', ')}`); process.exit(1); }
  const raw = XLSX.utils.sheet_to_json(wb.Sheets[SHEET], { header: 1, raw: true, defval: '' });

  const out = [];
  const bad = [];
  const skipped = [];
  for (let i = FIRST_DATA_ROW; i < raw.length; i++) {
    const r = raw[i];
    const bair = r[C_BAIR], door = r[C_DOOR];
    if (bair === '' || bair === undefined) continue;          // хоосон сүүл
    const name = cleanName(r[C_NAME]);
    const fee = Number(r[C_FEE]) || 0;
    const area = Number(r[C_AREA]) || 0;
    if (door === '' || door === undefined || !name) {
      bad.push({ row: i + 1, bair, door, name });
      continue;
    }
    const building = String(bair).trim();
    const apartment = String(door).trim();
    if (SKIP_KEYS.has(`${building}|${apartment}`)) { skipped.push(`${building}/${apartment}`); continue; }
    out.push({ excelRow: i + 1, building, apartment, name, area_sqm: area, monthly_fee: fee });
  }
  return { rows: out, bad, skipped };
}

(async () => {
  console.log(`Горим: ${COMMIT ? 'COMMIT (DB-д бичнэ)' : 'DRY-RUN (юу ч бичихгүй)'}`);
  console.log(`Эх файл: ${SRC}`);

  const { rows, bad, skipped } = readRows();

  // ---- эх файлын хяналт ----
  const byBuilding = new Map();
  for (const r of rows) {
    const g = byBuilding.get(r.building) || [];
    g.push(r);
    byBuilding.set(r.building, g);
  }
  console.log(`\n=== EXCEL ===`);
  console.log(`  Нийт мөр: ${rows.length}${bad.length ? `  (алдаатай ${bad.length})` : ''}`);
  if (skipped.length) console.log(`  Зориуд оруулаагүй (СӨХ-ийн өрөө): ${skipped.join(', ')}`);
  for (const [b, g] of byBuilding) {
    const doors = g.map(x => Number(x.apartment));
    console.log(`  байр ${b.padEnd(3)} ${String(g.length).padStart(3)} тоот  (${Math.min(...doors)}…${Math.max(...doors)})  хураамж ${money(g.reduce((s, x) => s + x.monthly_fee, 0))}₮`);
  }
  const keys = rows.map(r => `${r.building}|${r.apartment}`);
  const dup = keys.filter((k, i) => keys.indexOf(k) !== i);
  if (dup.length) { console.error(`\n❌ Давхардсан байр+тоот: ${[...new Set(dup)].join(', ')}`); process.exit(1); }
  const noFee = rows.filter(r => !r.monthly_fee);
  if (noFee.length) console.log(`  ⚠️  хураамжгүй ${noFee.length} тоот: ${noFee.slice(0, 5).map(r => r.building + '/' + r.apartment).join(', ')}`);
  console.log(`  Сарын нийт хураамж: ${money(rows.reduce((s, r) => s + r.monthly_fee, 0))}₮`);
  if (bad.length) bad.slice(0, 5).forEach(b => console.log(`  ⚠️  ${b.row}-р мөр алгасав (байр=${b.bair} хаалга=${b.door} нэр="${b.name}")`));

  // ---- СӨХ шалгах ----
  const { data: org, error: orgErr } = await sb
    .from('sokh_organizations')
    .select('id, name, khoroo_id, unit_count, claim_status')
    .eq('id', SOKH_ID).single();
  if (orgErr || !org) { console.error(`❌ СӨХ #${SOKH_ID} олдсонгүй`); process.exit(1); }
  if (org.name !== EXPECT_NAME || org.khoroo_id !== EXPECT_KHOROO) {
    console.error(`❌ #${SOKH_ID} хүлээгдэж буй СӨХ биш: "${org.name}" (khoroo ${org.khoroo_id})`);
    process.exit(1);
  }
  console.log(`\n=== СӨХ ===\n  #${org.id} ${org.name} · ${org.claim_status} · unit_count=${org.unit_count}`);

  // ---- одоо байгаа оршин суугчид ----
  const existing = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from('residents')
      .select('id, name, apartment, building, area_sqm, monthly_fee, debt, phone, auth_user_id, unit_kind')
      .eq('sokh_id', SOKH_ID).order('id').range(from, from + 999);
    if (error) { console.error('❌ residents унших алдаа:', error.message); process.exit(1); }
    if (!data.length) break;
    existing.push(...data);
    if (data.length < 1000) break;
  }
  const norm = v => String(v ?? '').trim().toLowerCase();
  const byKey = new Map(existing.map(e => [`${norm(e.building)}|${norm(e.apartment)}`, e]));
  console.log(`  DB-д одоо: ${existing.length} мөр`);

  // ---- төлөвлөгөө ----
  const toInsert = [], toUpdate = [], same = [];
  for (const r of rows) {
    const kind = 'household';
    const cur = byKey.get(`${norm(r.building)}|${norm(r.apartment)}`);
    if (!cur) { toInsert.push({ ...r, unit_kind: kind }); continue; }
    const patch = {};
    // Оршин суугч өөрөө нэвтэрсэн бол нэрийг нь ДАРАХГҮЙ (өөрийн нэрээ бичсэн байж болно)
    if (!cur.auth_user_id && cleanName(cur.name) !== r.name) patch.name = r.name;
    if (Number(cur.area_sqm || 0) !== r.area_sqm) patch.area_sqm = r.area_sqm;
    if (Number(cur.monthly_fee || 0) !== r.monthly_fee) patch.monthly_fee = r.monthly_fee;
    if (cur.unit_kind !== kind) patch.unit_kind = kind;
    if (Object.keys(patch).length) toUpdate.push({ id: cur.id, ref: r, patch });
    else same.push(r);
  }
  const orphans = existing.filter(e => !rows.some(r => norm(r.building) === norm(e.building) && norm(r.apartment) === norm(e.apartment)));

  console.log(`\n=== ТӨЛӨВЛӨГӨӨ ===`);
  console.log(`  Шинээр нэмэх:   ${toInsert.length}`);
  console.log(`  Засах:          ${toUpdate.length}`);
  console.log(`  Хэвээр:         ${same.length}`);
  console.log(`  Excel-д алга (DB-д үлдэнэ): ${orphans.length}`);
  toUpdate.slice(0, 10).forEach(u => {
    const p = Object.entries(u.patch).map(([k, v]) => `${k}→${v}`).join(', ');
    console.log(`    ${u.ref.building}/${u.ref.apartment} ${u.ref.name}: ${p}`);
  });
  if (toUpdate.length > 10) console.log(`    … бас ${toUpdate.length - 10}`);
  orphans.slice(0, 10).forEach(o => console.log(`    ⚠️  DB-д байгаа ч Excel-д алга: байр ${o.building || '—'} тоот ${o.apartment}`));

  if (!COMMIT) {
    console.log(`\nDRY-RUN — DB-д юу ч бичээгүй.\nБичихдээ: node scripts/import-badrakh.js --commit`);
    return;
  }

  // ---- бичих ----
  console.log(`\n=== БИЧИЖ БАЙНА ===`);
  let ins = 0;
  const payload = toInsert.map(r => ({
    sokh_id: SOKH_ID,
    name: r.name,
    apartment: r.apartment,
    building: r.building,
    area_sqm: r.area_sqm,
    monthly_fee: r.monthly_fee,
    debt: 0,
    unit_kind: r.unit_kind,
    pending_claim: false,
  }));
  for (let i = 0; i < payload.length; i += 50) {
    const chunk = payload.slice(i, i + 50);
    const { error } = await sb.from('residents').insert(chunk);
    if (error) console.error(`   ❌ ${chunk[0].building}/${chunk[0].apartment}…: ${error.message}`);
    else ins += chunk.length;
  }
  let upd = 0;
  for (const u of toUpdate) {
    const { error } = await sb.from('residents').update(u.patch).eq('id', u.id);
    if (error) console.error(`   ❌ ${u.ref.building}/${u.ref.apartment}: ${error.message}`);
    else upd++;
  }
  console.log(`  Нэмсэн: ${ins} · Засав: ${upd}`);

  // ---- unit_count (айл өрх = business-г тооцохгүй) ----
  const households = rows.length;
  if (Number(org.unit_count) !== households) {
    const { error } = await sb.from('sokh_organizations').update({ unit_count: households }).eq('id', SOKH_ID);
    if (error) console.error('   ❌ unit_count:', error.message);
    else console.log(`  unit_count: ${org.unit_count} → ${households}`);
  }

  const { count } = await sb.from('residents').select('id', { count: 'exact', head: true }).eq('sokh_id', SOKH_ID);
  console.log(`\n✅ Дууслаа. #${SOKH_ID}-д нийт ${count} мөр.`);
})().catch(e => { console.error(e); process.exit(1); });
