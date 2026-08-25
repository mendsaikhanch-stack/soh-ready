// "Гринланд-687" СӨХ (#2690) — 129 айлыг өрийн үлдэгдэлтэй нь бүртгэнэ.
//
// Энэ файл ЗӨВХӨН энэ нэг СӨХ-д зориулсан нэг удаагийн скрипт (аппын кодыг өөрчлөхгүй).
//
// Эх сурвалж: даргын өгсөн «Greenland 687 suh-20260825.xlsx» — тооцооны
// системээс (contor-22922) гаргасан ӨРИЙН тайлан, 2026-08-25.
//
// ⚠️ Эх файл нь БҮРЭН ЖАГСААЛТ БИШ — зөвхөн ӨРТЭЙ 78 айл бичигдсэн.
//    Тоот нь 1-ээс 129 хүртэл дараалсан, ГЭХДЭЭ «8 тоот» гэж БАЙХГҮЙ
//    (дарга 2026-08-25-нд баталгаажуулав) → нийт 128 айл.
//    Тайланд байхгүй 50 айлыг өргүй (0₮) гэж үзнэ — дарга «төлбөрөө төлсөн
//    учир тайланд гараагүй» гэж хэлсэн.
//
// Даргын залруулга (2026-08-25):
//   • 8 тоот байхгүй — жагсаалтаас хасав.
//   • 90 тоот: Excel дээр 155,006₮ гэж бичигдсэнийг 155,000₮ болгов.
//   • 92 тоот: ГАРААЖТАЙ тул сарын хураамж нь өндөр — 112,500₮ гэж бичив
//     (2 сарын өр 225,000₮ ÷ 2 = 112,500₮ гэдэгтэй таарч байна).
//
// Тарифын тухай:
//   Тайланд «Мөнгөн дүн» нь хэдэн сарын нийлбэр вэ гэдгийг Хог баганаас
//   (8,000₮ × сар) тогтоов. НЭГ САРЫН мөрүүд дээр «Мөнгөн дүн» нь тухайн
//   айлын сарын хураамж ЯГ ӨӨРӨӨ болно — тэндээс шууд уншсан:
//     77,500₮ × 41 айл   ← стандарт (СӨХ-ийн ерөнхий дүн болгов)
//     65,237₮ ×  6 айл   ← лифтгүй давхрууд байх
//    112,500₮ ×  1 айл   ← 42 тоот
//   Олон сарын мөрүүдээс хураамжийг ХАСААД гаргаагүй — лифт, амьтны хураамж
//   зарим сард л ордог тул хуваахад буруу дүн гарна. Тэдгээр айл СӨХ-ийн
//   ерөнхий дүн (77,500₮)-г харна.
//
// Хяналт: эх тайланд НИЙТ мөр байхгүй тул скрипт нь өөрийн хүснэгтийн
// нийлбэрийг Excel-ээс уншсан дүнтэй тулгана. Excel-ийн нийлбэр 11,038,561₮
// байсныг 90 тоотын залруулгаар (−6₮) 11,038,555₮ болгов.
//
// Ажиллуулах:
//   node scripts/import-greenland-687.js              # dry-run: юу ч бичихгүй
//   node scripts/import-greenland-687.js --commit     # бодитоор бичнэ

const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const COMMIT = process.argv.includes('--commit');

const SOKH_ID = Number(process.env.SOKH_ID || 2690);
const MAX_APT = 129;          // тоотын дээд дугаар
const MISSING_APTS = [8];     // байхгүй тоот — дарга баталгаажуулав
const STD_FEE = 77500;        // хамгийн олон давтагдсан, нэг сарын мөрөөс шууд харагдсан

// Байрны бүх тоот: 1…129, 8-г хасаад = 128 айл
const ALL_APTS = Array.from({ length: MAX_APT }, (_, i) => i + 1)
  .filter((n) => !MISSING_APTS.includes(n));

// ------- Хяналтын дүн -------
const EXPECT_DEBTORS = 78;
const EXPECT_DEBT_TOTAL = 11038555; // Excel 11,038,561₮ − 90 тоотын залруулга 6₮

// ------- Өгөгдөл: [тоот, өрийн үлдэгдэл, сарын хураамж | null] -------
// Хураамжийг ЗӨВХӨН нэг сарын мөрөөс шууд харагдсан үед бичсэн.
const ROWS = [
  [  1,    204237,    null],
  [  2,     65237,   65237],
  [  3,    204237,    null],
  [  4,    134737,    null],
  [  5,     65237,   65237],
  [  6,    359237,    null],
  [  7,    134737,    null],
  [  9,    436737,    null],
  [ 10,    204237,    null],
  [ 11,     65237,   65237],
  [ 12,     65237,   65237],
  [ 13,     65237,   65237],
  [ 14,    359237,    null],
  [ 15,    134737,    null],
  [ 16,     65237,   65237],
  [ 17,    232500,    null],
  [ 19,    155000,    null],
  [ 21,     77500,    null],
  [ 22,     77500,    null],
  [ 24,    387500,    null],
  [ 25,     77500,    null],
  [ 26,     77500,    null],
  [ 27,     77500,    null],
  [ 28,    542500,    null],
  [ 30,     77500,    null],
  [ 31,     77500,    null],
  [ 32,     77500,    null],
  [ 34,     77500,    null],
  [ 35,    155000,    null],
  [ 36,     77500,    null],
  [ 38,     77500,    null],
  [ 39,     77500,    null],
  [ 42,    112500,  112500],
  [ 43,    155000,    null],
  [ 44,     77500,    null],
  [ 45,     77500,    null],
  [ 46,     77500,    null],
  [ 48,     77500,    null],
  [ 49,     77500,    null],
  [ 53,     77500,    null],
  [ 56,     77500,    null],
  [ 58,    155000,    null],
  [ 61,    310000,    null],
  [ 62,     77500,    null],
  [ 67,     77500,    null],
  [ 68,     77500,    null],
  [ 69,     77500,    null],
  [ 70,     77500,    null],
  [ 71,    542500,    null],
  [ 72,    155000,    null],
  [ 81,     77500,    null],
  [ 82,    155000,    null],
  [ 84,    310000,    null],
  [ 85,     77500,    null],
  [ 87,     77500,    null],
  [ 88,    155000,    null],
  [ 89,     77500,    null],
  [ 90,    155000,    null],   // Excel-д 155,006₮ — дарга залруулав
  [ 91,     77500,    null],
  [ 92,    225000,  112500],   // гараажтай тул тариф өндөр (даргын тайлбар)
  [ 97,    155000,    null],
  [ 98,     77500,    null],
  [ 99,    155000,    null],
  [100,     77500,    null],
  [101,     77500,    null],
  [105,    155000,    null],
  [106,     77500,    null],
  [107,    155000,    null],
  [108,     77500,    null],
  [109,     77500,    null],
  [110,    387500,    null],
  [113,    387500,    null],
  [114,     77500,    null],
  [116,     77500,    null],
  [118,     77500,    null],
  [122,     77500,    null],
  [125,     77500,    null],
  [127,     77500,    null],
];

const money = (n) => `${Number(n).toLocaleString('en-US')}₮`;

// ------- Хяналт -------
function verify() {
  const total = ROWS.reduce((s, r) => s + r[1], 0);
  const apts = ROWS.map((r) => r[0]);
  const dup = apts.length !== new Set(apts).size;
  const stray = apts.filter((a) => !ALL_APTS.includes(a));

  console.log('🔎 Эх тайлантай тулгах:');
  console.log(`   Өртэй айл:  ${String(ROWS.length).padStart(12)}  (Excel-д ${EXPECT_DEBTORS}) ${ROWS.length === EXPECT_DEBTORS ? '✓' : '❌'}`);
  console.log(`   Нийт өр:    ${money(total).padStart(12)}  (хүлээгдэж буй ${money(EXPECT_DEBT_TOTAL)}) ${total === EXPECT_DEBT_TOTAL ? '✓' : '❌'}`);
  console.log(`   Тоот давхардал: ${dup ? '❌ байна' : '— байхгүй ✓'}`);
  console.log(`   Байхгүй тоот дээр өр: ${stray.length ? '❌ ' + stray.join(',') : '— байхгүй ✓'}`);
  console.log(`   Нийт айл:   ${String(ALL_APTS.length).padStart(12)}  (1–${MAX_APT}, ${MISSING_APTS.join(',')}-г хасаад)`);

  return ROWS.length === EXPECT_DEBTORS && total === EXPECT_DEBT_TOTAL && !dup && !stray.length;
}

// ------- Supabase -------
function getClient() {
  const ENV_FILE = path.join(ROOT, '.env.local');
  if (fs.existsSync(ENV_FILE)) {
    for (const line of fs.readFileSync(ENV_FILE, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) {
        let v = m[2].trim();
        if (/^["'].*["']$/.test(v)) v = v.slice(1, -1);
        if (!process.env[m[1]]) process.env[m[1]] = v;
      }
    }
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('\n❌ NEXT_PUBLIC_SUPABASE_URL эсвэл SUPABASE_SERVICE_ROLE_KEY алга байна.');
    process.exitCode = 1;
    return null;
  }
  const { createClient } = require('@supabase/supabase-js');
  return createClient(url, key, { auth: { persistSession: false } });
}

async function run() {
  if (!verify()) {
    console.error('\n❌ Өгөгдөл эх тайлантай таарахгүй байна — засах хүртэл бичихгүй.');
    process.exitCode = 1;
    return;
  }

  const sb = getClient();
  if (!sb) return;

  // 1) СӨХ
  const { data: org, error: orgErr } = await sb
    .from('sokh_organizations')
    .select('id, name, address, phone, khoroo_id, claim_status, unit_count, monthly_fee')
    .eq('id', SOKH_ID)
    .maybeSingle();
  if (orgErr || !org) {
    console.error(`\n❌ СӨХ #${SOKH_ID} олдсонгүй${orgErr ? `: ${orgErr.message}` : ''}.`);
    process.exitCode = 1;
    return;
  }
  console.log(`\n🏢 СӨХ: #${org.id} — ${org.name} (${org.claim_status})`);
  console.log(`   Сарын хураамж: ${money(org.monthly_fee || 0)} → ${money(STD_FEE)} болгоно`);

  // 2) Одоо байгаа айлууд
  const { data: existing, error: resErr } = await sb
    .from('residents')
    .select('apartment')
    .eq('sokh_id', org.id);
  if (resErr) {
    console.error(`❌ DB унших алдаа: ${resErr.message}`);
    process.exitCode = 1;
    return;
  }
  const have = new Set((existing || []).map((r) => String(r.apartment).trim()));
  console.log(`   Одоо DB-д: ${have.size} айл`);

  // 3) 1…129 бүх айл
  const debtOf = new Map(ROWS.map((r) => [r[0], r[1]]));
  const feeOf = new Map(ROWS.filter((r) => r[2] != null).map((r) => [r[0], r[2]]));

  const toCreate = ALL_APTS.filter((n) => !have.has(String(n)));

  const withDebt = ALL_APTS.filter((n) => (debtOf.get(n) || 0) > 0).length;
  console.log('\n📊 Хураангуй:');
  console.log(`   Нийт айл:     ${ALL_APTS.length}`);
  console.log(`   Өртэй:        ${withDebt} айл · ${money(EXPECT_DEBT_TOTAL)}`);
  console.log(`   Өргүй:        ${ALL_APTS.length - withDebt} айл (төлбөрөө төлсөн)`);
  console.log(`   Тусгай тариф: ${feeOf.size} айл (${[...feeOf.entries()].map(([a, f]) => `${a}:${money(f)}`).join(', ')})`);

  console.log(`\n🧭 Төлөвлөгөө (${COMMIT ? 'COMMIT' : 'DRY-RUN'}):`);
  console.log(`   Шинээр үүсгэх:  ${toCreate.length} айл`);
  console.log(`   Аль хэдийн:     ${ALL_APTS.length - toCreate.length} (алгасна)`);
  console.log('   Аккаунт:        үүсгэхгүй (утас өгөгдөөгүй — QR-аар бүртгүүлнэ)');

  if (!COMMIT) {
    console.log('\n🔍 DRY-RUN — юу ч бичсэнгүй. Бичихдээ: node scripts/import-greenland-687.js --commit');
    return;
  }
  if (!toCreate.length) {
    console.log('\n✅ Бичих зүйл алга.');
    return;
  }

  const payload = toCreate.map((n) => ({
    name: `${n} тоот`,
    apartment: String(n),
    building: '687',
    debt: debtOf.get(n) || 0,
    monthly_fee: feeOf.get(n) ?? null,
    sokh_id: org.id,
  }));

  console.log(`\n✍️  ${payload.length} айл бичиж байна...`);
  let ok = 0;
  for (let i = 0; i < payload.length; i += 50) {
    const chunk = payload.slice(i, i + 50);
    const { error } = await sb.from('residents').insert(chunk);
    if (error) console.error(`   ❌ ${chunk[0].apartment}…${chunk[chunk.length - 1].apartment}: ${error.message}`);
    else ok += chunk.length;
  }

  const patch = {};
  if (org.unit_count !== ALL_APTS.length) patch.unit_count = ALL_APTS.length;
  if (Number(org.monthly_fee) !== STD_FEE) patch.monthly_fee = STD_FEE;
  if (Object.keys(patch).length) {
    await sb.from('sokh_organizations').update(patch).eq('id', org.id);
    console.log(`   ✓ СӨХ шинэчлэв: ${JSON.stringify(patch)}`);
  }

  console.log(`\n✅ ${ok}/${payload.length} айл бүртгэгдлээ. СӨХ #${org.id}`);
  console.log('\n   Дараагийн алхам:');
  console.log(`     1. Даргын эрх нээх → node scripts/activate-sokh.js --id=${org.id} --commit`);
  console.log(`     2. QR хэвлүүлэх   → node scripts/make-sokh-qr.mjs ${org.id}`);
}

run().catch((e) => { console.error(e); process.exitCode = 1; });
