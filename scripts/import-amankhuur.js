// «Аман хуур дижитал» СӨХ (БЗД 42-р хороо, 33-р байр) — 282 айлыг Excel-ээс бүртгэнэ.
//
// Энэ нь ЗӨВХӨН энэ нэг СӨХ-д зориулсан нэг удаагийн скрипт (аппын кодыг өөрчлөхгүй).
//
// Эх сурвалж (2026-10-20-нд хүлээн авав): `E:\Downloads\Нэгдсэн_бүртгэл.xlsx`, 3 хуудас:
//   «Сууц бүртгэл»       — байр · орц · тоот · талбай · давхар · өмчлөгчийн нэр · утас
//   «10 сар өр төлбөр»   — орц тус бүр хэсэгтэй; Хаалга(3) · Эх.үлд(4) · 10 сарын нэх(5)
//                          · Эц.үлд(9). Эц.үлд нь 2026.10.16-ны хуулгын байдлаар.
//   «төлбөрийн задаргаа» — корпус(1) · хаалга(2) · БҮГД ДҮН(32) = сарын хураамж
//                          (хог + засвар + жижүүр + цэвэрлэгээ + лифт + гарааж + орцны гэрэл)
//
// Онцлог:
//   • Нэг байр (33), 4 орц: А 40 · Б 88 · В 88 · Г 66 тоот. Тоот нь орц бүрд 1-ээс
//     эхэлдэг тул building-г «33А», «33Б»… гэж ЗААВАЛ бичнэ (СӨХ өөрөө ингэж нэрлэдэг) —
//     /register нь тоотоор олон таарвал байраар нь ялгадаг.
//   • Задаргааны хуудсанд орц нь «корпус» дугаараар: 1=А, 3=Б, 4=В, 5=Г.
//   • «Сууц бүртгэл»-ийн 33А/1 мөрийн гарааж/агуулахын багана нь загварын жишээ
//     («Ү11223344») тул ашиглаагүй. Гарааж нь сарын хураамжид (15,000₮) аль хэдийн орсон.
//   • Утасны нүдэнд «99362481эз/99404748тү» гэх мэт олон дугаар бий → «эз»(эзэн)
//     гэж тэмдэглэснийг, үгүй бол эхний 8 оронтой [89]… дугаарыг авна.
//   • 33Г/6 нь бүртгэлд «КОНТОР», задаргаанд «K and T» — хураамжтай, өртэй тул
//     энгийн тоот шиг оруулав (Бадрахын 24/0 шиг СӨХ-ийн өөрийн өрөө БИШ).
//   • Аккаунт үүсгэхгүй — оршин суугчид QR-аар өөрсдөө бүртгүүлэхэд мөрөндөө холбогдоно.
//
// Хяналт: «10 сар өр төлбөр»-ийн нийт мөрүүдтэй тулгана —
//   10 сарын нэхэмжлэл 12,567,914₮ (= задаргааны нийт) · Эц.үлд 25,890,490₮ · 282 айл.
//
// Ажиллуулах:
//   node scripts/import-amankhuur.js             # dry-run: юу ч бичихгүй
//   node scripts/import-amankhuur.js --commit    # бодитоор бичнэ
//
// Дахин ажиллуулахад: байгаа мөрийг давхарлахгүй (байр+тоотоор тулгана),
// харин нэр/утас/талбай/хураамж/өр нь Excel-ээс зөрж байвал ЗАСНА.
//
// Сонголт (орчны хувьсагч):
//   SRC=…        — Excel файлын зам
//   SOKH_ID=1234 — байгаа СӨХ рүү нэмнэ (өгөхгүй бол нэрээр хайж, олдохгүй бол шинээр үүсгэнэ)

const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const ROOT = path.resolve(__dirname, '..');
const COMMIT = process.argv.includes('--commit');
const SRC = process.env.SRC || 'E:/Downloads/Нэгдсэн_бүртгэл.xlsx';

const ORG_NAME = 'Аман хуур дижитал СӨХ';
const ORG_ADDRESS = 'Баянзүрх дүүрэг, 42-р хороо, 33-р байр';
// Даргын утас (PII) репод бичихгүй — `docs/sokh-access.local.md`-д бий. СӨХ аль хэдийн үүссэн тул
// энэ нь зөвхөн дахин шинээр үүсгэх үед хэрэглэгдэнэ.
const ORG_PHONE = process.env.ORG_PHONE || null;
const DISTRICT_ID = 2;          // Баянзүрх
const KHOROO_NAME = '42-р хороо';
const SOKH_ID = process.env.SOKH_ID ? Number(process.env.SOKH_ID) : null;

const ENTRANCES = ['А', 'Б', 'В', 'Г'];
const CORPUS = { 1: 'А', 3: 'Б', 4: 'В', 5: 'Г' };
const EXPECT = { А: 40, Б: 88, В: 88, Г: 66 };
const EXPECT_CHARGE = 12567914;
const EXPECT_DEBT = 25890490;

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

const money = (n) => `${Math.round(Number(n || 0)).toLocaleString('en-US')}₮`;
const clean = (v) => String(v == null ? '' : v).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
const num = (v) => (v === '' || v == null ? 0 : Math.round(Number(v)));

// «72828487эз.гад/88102737эз/96081368тү» → эзэн гэж тэмдэглэсэн гар утас, үгүй бол эхнийх
function pickPhone(cell) {
  const parts = clean(cell).split(/[,;/]/);
  const found = [];
  for (const part of parts) {
    const m = part.replace(/\s/g, '').match(/([89]\d{7})(.*)$/);
    if (m) found.push({ phone: m[1], owner: /^эз/.test(m[2]) });
  }
  return (found.find((f) => f.owner) || found[0] || {}).phone || null;
}

function sheet(wb, name) {
  if (!wb.Sheets[name]) { console.error(`❌ «${name}» хуудас олдсонгүй`); process.exit(1); }
  return XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' });
}

function readUnits() {
  if (!fs.existsSync(SRC)) { console.error(`❌ Файл олдсонгүй: ${SRC}`); process.exit(1); }
  const wb = XLSX.readFile(SRC);
  const units = new Map(); // «А|1» → unit

  // 1) Сууц бүртгэл
  for (const r of sheet(wb, 'Сууц бүртгэл').slice(2)) {
    if (num(r[0]) !== 33 || !num(r[2])) continue;
    const ent = clean(r[1]).toUpperCase();
    const key = `${ent}|${num(r[2])}`;
    if (units.has(key)) { console.error(`❌ Давхардсан тоот: ${key}`); process.exit(1); }
    units.set(key, {
      entrance: ent,
      building: `33${ent}`,
      apartment: String(num(r[2])),
      area_sqm: Number(r[3]) || null,
      floor: String(num(r[4]) || ''),
      name: clean(r[8]),
      phone: pickPhone(r[9]),
      rawPhone: clean(r[9]),
    });
  }

  // 2) 10 сар өр төлбөр — «33А байр» гэх мэт гарчгаар хэсэглэгдсэн
  let ent = null;
  const debtSeen = new Set();
  for (const r of sheet(wb, '10 сар өр төлбөр')) {
    const h = clean(r[0]).match(/^33\s*([АБВГ])\s*байр/i);
    if (h) { ent = h[1].toUpperCase(); continue; }
    if (!ent || typeof r[3] !== 'number') continue;
    const key = `${ent}|${r[3]}`;
    const u = units.get(key);
    if (!u) { console.error(`❌ Өрийн хуудсанд бүртгэлд байхгүй тоот: ${key}`); process.exit(1); }
    if (debtSeen.has(key)) { console.error(`❌ Өрийн хуудсанд давхардсан: ${key}`); process.exit(1); }
    debtSeen.add(key);
    u.debt = num(r[9]);
    u.charge = num(r[5]);
    u.debtName = clean(r[2]);
  }

  // 3) Төлбөрийн задаргаа — сарын хураамж
  for (const r of sheet(wb, 'төлбөрийн задаргаа').slice(5)) {
    if (num(r[0]) !== 33 || !CORPUS[num(r[1])]) continue;
    const key = `${CORPUS[num(r[1])]}|${num(r[2])}`;
    const u = units.get(key);
    if (!u) { console.error(`❌ Задаргаанд бүртгэлд байхгүй тоот: ${key}`); process.exit(1); }
    u.monthly_fee = num(r[32]);
  }

  return [...units.values()];
}

function verify(units) {
  let ok = true;
  console.log('🔎 Эх баримттай тулгах:');
  for (const e of ENTRANCES) {
    const n = units.filter((u) => u.entrance === e).length;
    if (n !== EXPECT[e]) ok = false;
    console.log(`   33${e}: ${String(n).padStart(3)} тоот (хүлээгдэж буй ${EXPECT[e]}) ${n === EXPECT[e] ? '✓' : '❌'}`);
  }
  const noDebt = units.filter((u) => u.debt == null);
  const noFee = units.filter((u) => u.monthly_fee == null);
  const feeMismatch = units.filter((u) => u.monthly_fee != null && u.charge != null && u.monthly_fee !== u.charge);
  const charge = units.reduce((s, u) => s + (u.charge || 0), 0);
  const debt = units.reduce((s, u) => s + (u.debt || 0), 0);
  const fee = units.reduce((s, u) => s + (u.monthly_fee || 0), 0);
  console.log(`   Өрийн хуудсанд байхгүй:   ${noDebt.length ? `❌ ${noDebt.map((u) => u.building + '/' + u.apartment).join(', ')}` : '0 ✓'}`);
  console.log(`   Задаргаанд байхгүй:       ${noFee.length ? `❌ ${noFee.map((u) => u.building + '/' + u.apartment).join(', ')}` : '0 ✓'}`);
  console.log(`   10 сарын нэхэмжлэл:       ${money(charge)} (баримтад ${money(EXPECT_CHARGE)}) ${charge === EXPECT_CHARGE ? '✓' : '❌'}`);
  console.log(`   Сарын хураамжийн нийлбэр: ${money(fee)} ${fee === EXPECT_CHARGE ? '✓' : '❌'}`);
  console.log(`   Эцсийн үлдэгдэл (өр):     ${money(debt)} (баримтад ${money(EXPECT_DEBT)}) ${debt === EXPECT_DEBT ? '✓' : '❌'}`);
  if (feeMismatch.length) {
    console.log(`   ⚠️  Хураамж ≠ 10 сарын нэхэмжлэл: ${feeMismatch.map((u) => `${u.building}/${u.apartment} ${money(u.monthly_fee)}≠${money(u.charge)}`).join(', ')}`);
  }
  if (noDebt.length || noFee.length || charge !== EXPECT_CHARGE || debt !== EXPECT_DEBT || fee !== EXPECT_CHARGE) ok = false;
  return ok;
}

async function ensureKhoroo() {
  const { data } = await sb.from('khoroos').select('id, name').eq('district_id', DISTRICT_ID).eq('name', KHOROO_NAME);
  if (data && data.length) return data[0].id;
  console.log(`\n📍 БЗД «${KHOROO_NAME}» DB-д алга → шинээр үүсгэнэ`);
  if (!COMMIT) return null;
  const { data: k, error } = await sb.from('khoroos').insert([{ district_id: DISTRICT_ID, name: KHOROO_NAME }]).select('id').single();
  if (error) { console.error(`❌ Хороо үүсгэж чадсангүй: ${error.message}`); process.exit(1); }
  console.log(`   ✓ Үүсгэв: khoroo #${k.id}`);
  return k.id;
}

const ORG_COLS = 'id, name, khoroo_id, address, phone, claim_status, unit_count, monthly_fee';

async function run() {
  const units = readUnits();
  if (!verify(units)) {
    console.error('\n❌ Өгөгдөл эх баримттай таарахгүй байна — засах хүртэл бичихгүй.');
    process.exitCode = 1;
    return;
  }

  const withDebt = units.filter((u) => u.debt > 0);
  const prepaid = units.filter((u) => u.debt < 0);
  console.log('\n📊 Өр (2026.10.16-ны байдлаар):');
  console.log(`   Өртэй:   ${withDebt.length} айл · ${money(withDebt.reduce((s, u) => s + u.debt, 0))}`);
  if (prepaid.length) console.log(`   Илүү төлөлттэй: ${prepaid.map((u) => `${u.building}/${u.apartment} ${money(u.debt)}`).join(', ')}`);
  console.log(`   Төлсөн:  ${units.length - withDebt.length - prepaid.length} айл`);
  const top = [...withDebt].sort((a, b) => b.debt - a.debt).slice(0, 5);
  console.log(`   Хамгийн их: ${top.map((u) => `${u.building}/${u.apartment} ${money(u.debt)}`).join(' · ')}`);
  console.log(`   Утастай: ${units.filter((u) => u.phone).length} · утасгүй: ${units.filter((u) => !u.phone).map((u) => `${u.building}/${u.apartment}`).join(', ')}`);

  const khorooId = await ensureKhoroo();

  // 1) СӨХ
  let org = null;
  if (SOKH_ID) {
    ({ data: org } = await sb.from('sokh_organizations').select(ORG_COLS).eq('id', SOKH_ID).maybeSingle());
  } else {
    const { data } = await sb.from('sokh_organizations').select(ORG_COLS).eq('name', ORG_NAME);
    org = (data || [])[0] || null;
  }
  if (org) {
    console.log(`\n🏢 Байгаа СӨХ: #${org.id} — ${org.name} (${org.claim_status}, хороо ${org.khoroo_id ?? '—'})`);
  } else {
    console.log(`\n🏢 СӨХ шинээр үүсгэнэ: "${ORG_NAME}" · ${ORG_ADDRESS} · утас ${ORG_PHONE || '—'}`);
    if (COMMIT) {
      const { data, error } = await sb.from('sokh_organizations').insert([{
        name: ORG_NAME,
        address: ORG_ADDRESS,
        phone: ORG_PHONE,
        khoroo_id: khorooId,
        unit_count: units.length,
        claim_status: 'pending',
      }]).select(ORG_COLS).single();
      if (error) { console.error(`❌ СӨХ үүсгэж чадсангүй: ${error.message}`); process.exitCode = 1; return; }
      org = data;
      console.log(`   ✓ Үүсгэв: #${org.id}`);
    }
  }

  // 2) Айлууд
  const byKey = new Map();
  if (org) {
    const { data: existing, error } = await sb.from('residents')
      .select('id, building, apartment, name, phone, area_sqm, debt, monthly_fee, auth_user_id')
      .eq('sokh_id', org.id);
    if (error) { console.error(`❌ DB унших алдаа: ${error.message}`); process.exitCode = 1; return; }
    (existing || []).forEach((r) => byKey.set(`${r.building}|${r.apartment}`, r));
    console.log(`   Одоо DB-д: ${byKey.size} айл`);
  }

  const rowOf = (u) => ({
    name: u.name || `${u.building}-${u.apartment} тоот`,
    phone: u.phone,
    building: u.building,
    entrance: u.entrance,
    apartment: u.apartment,
    floor: u.floor || null,
    area_sqm: u.area_sqm,
    monthly_fee: u.monthly_fee,
    debt: u.debt,
    unit_kind: 'household',
  });

  const toCreate = units.filter((u) => !byKey.has(`${u.building}|${u.apartment}`));
  const toFix = [];
  for (const u of units) {
    const cur = byKey.get(`${u.building}|${u.apartment}`);
    if (!cur) continue;
    const want = rowOf(u);
    const patch = {};
    for (const k of ['name', 'phone', 'area_sqm', 'monthly_fee', 'debt']) {
      if (k === 'name' || k === 'phone') { if (cur.auth_user_id) continue; } // бүртгүүлсэн хүний нэр/утсыг хөндөхгүй
      if (String(cur[k] ?? '') !== String(want[k] ?? '') && Number(cur[k]) !== Number(want[k])) patch[k] = want[k];
    }
    if (Object.keys(patch).length) toFix.push({ id: cur.id, u, patch });
  }

  console.log(`\n🧭 Төлөвлөгөө (${COMMIT ? 'COMMIT' : 'DRY-RUN'}):`);
  console.log(`   Шинээр үүсгэх айл: ${toCreate.length}`);
  console.log(`   Засах айл:         ${toFix.length}`);
  toFix.forEach(({ u, patch }) => console.log(`      ${u.building}/${u.apartment}: ${JSON.stringify(patch)}`));
  console.log('   Аккаунт:           үүсгэхгүй (QR-аар өөрсдөө бүртгүүлнэ)');

  if (!COMMIT) {
    console.log('\n🔍 DRY-RUN — юу ч бичсэнгүй. Бичихдээ: node scripts/import-amankhuur.js --commit');
    return;
  }

  let ok = 0;
  const payload = toCreate.map((u) => ({ ...rowOf(u), sokh_id: org.id }));
  for (let i = 0; i < payload.length; i += 50) {
    const chunk = payload.slice(i, i + 50);
    const { error } = await sb.from('residents').insert(chunk);
    if (error) console.error(`   ❌ ${chunk[0].building}/${chunk[0].apartment}…: ${error.message}`);
    else ok += chunk.length;
  }
  let fixed = 0;
  for (const { id, u, patch } of toFix) {
    const { error } = await sb.from('residents').update(patch).eq('id', id);
    if (error) console.error(`   ❌ ${u.building}/${u.apartment}: ${error.message}`);
    else fixed++;
  }
  if (org.unit_count !== units.length) {
    await sb.from('sokh_organizations').update({ unit_count: units.length }).eq('id', org.id);
  }

  console.log(`\n✅ Шинэ ${ok}/${payload.length} · засварласан ${fixed}/${toFix.length}. СӨХ #${org.id}`);
  console.log('\n   Дараагийн алхам:');
  console.log(`     1. Даргын эрх нээх → node scripts/activate-sokh.js --id=${org.id} --commit`);
  console.log(`     2. QR хэвлүүлэх   → node scripts/make-sokh-qr.mjs ${org.id}`);
}

run().catch((e) => { console.error(e); process.exitCode = 1; });
