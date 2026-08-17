// "Дондогдулам 73" СӨХ — 68 айлыг сарын хураамж + өрийн үлдэгдэлтэй нь бүртгэнэ.
//
// Энэ файл ЗӨВХӨН энэ нэг СӨХ-д зориулсан нэг удаагийн скрипт (аппын кодыг өөрчлөхгүй).
//
// Эх сурвалж: даргын өгсөн «2026 оны 08-р сарын 09-ны байдлаарх "ДОНДОГДУЛАМ 73"
// СӨХ-ны төлбөр төлөлтийн тайлан» (2 хуудас цаасан хувилбарын зураг, 2026-08-17).
//
// Өгөгдлийн үнэн зөвийг тайлангийн НИЙТ мөрөөр шалгасан:
//   сарын хураамжийн нийлбэр = 2,975,900₮   өрийн нийлбэр = 35,288,000₮
// Скрипт ажиллах бүрдээ энэ 2 дүнг дахин шалгана — зөрвөл зогсоно.
//
// Онцлог:
//   • Айл болгон ӨӨР тарифтай тул residents.monthly_fee-д тус тусад нь бичнэ.
//     (өмнө нь supabase-per-unit-fee-migration.sql ажиллаж, багана нь үүссэн байх ёстой)
//   • 201, 206 тоот ИЛҮҮ төлсөн тул өр сөрөг дүнтэй.
//   • 409 тоотын хураамжийг цаасан дээр бэх нөмөрсөн байсныг нийлбэрээр
//     тооцоолж 39,400₮ гэж тогтоов.
//   • Нэр, утас өгөгдөөгүй тул оршин суугчийн нэрийг "<тоот> тоот" гэж бичиж,
//     аккаунт үүсгэхгүй. Нэвтрэлтийг QR-аар өөрсдөөр нь бүртгүүлнэ.
//
// Ажиллуулах:
//   node scripts/import-dondogdulam-73.js              # dry-run: юу ч бичихгүй
//   node scripts/import-dondogdulam-73.js --commit     # бодитоор бичнэ
//
// Сонголт (орчны хувьсагч):
//   SOKH_ID=1234   — байгаа СӨХ рүү нэмнэ (өгөхгүй бол нэрээр хайж, олдохгүй бол шинээр үүсгэнэ)
//   KHOROO_ID=215  — шинээр үүсгэхэд хороо холбоно

const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const COMMIT = process.argv.includes('--commit');

// ------- СӨХ-ийн тохиргоо -------
const ORG_NAME = process.env.ORG_NAME || 'Дондогдулам 73 СӨХ';
const ORG_ADDRESS = process.env.ORG_ADDRESS || '';
const ORG_PHONE = process.env.ORG_PHONE || '';
const KHOROO_ID = process.env.KHOROO_ID ? Number(process.env.KHOROO_ID) : null;
const SOKH_ID = process.env.SOKH_ID ? Number(process.env.SOKH_ID) : null;
const ORG_DEFAULT_FEE = 35500; // хамгийн олон давтагдсан тариф (айл бүр өөрийн дүнтэй)

// ------- Тайлангийн хяналтын нийлбэр -------
const EXPECT_FEE_TOTAL = 2975900;
const EXPECT_DEBT_TOTAL = 35288000;

// ------- Өгөгдөл: [тоот, сарын хураамж, 2026.08.09-ны өр, тайлбар] -------
// Тайлбар нь DB-д ОРОХГҮЙ — эх тайланг мөрдөх боломжтой байлгах үүднээс энд үлдээв.
const ROWS = [
  ['101',  35500,   810000, 'үлдэгдэл+1-8р сар'],
  ['102',  35500,   204000, '3-8р сар'],
  ['103',  35500,   284000, '1-8р сар'],
  ['104',  35500,   178000, '4-8р сар'],
  ['105',  35500,   784000, 'үлдэгдэл+1-8р сар'],
  ['106',  35500,   213000, '3-8р сар'],
  ['107',  35500,        0, 'үлдэгдэлгүй'],
  ['108',  35500,    35500, '8р сар'],
  ['109',  35500,    35500, '8р сар'],
  ['201',  35500,   -35500, 'илүү төлсөн'],
  ['202',  40500,   162000, '5-8р сар'],
  ['203',  35500,    79500, '6,7р сар'],
  ['204',  35500,   674500, '2025.2-2025.12, 2026.1-8р сар'],
  ['205',  39500,   122500, '6-8р сар'],
  ['206',  35500,  -142000, '2026 он дуустал бүрэн төлсөн'],
  ['207',  35500,   894000, '2024.08-2025.12, 2026.1-8р сар'],
  ['208',  35500,    71000, '7,8р сар'],
  ['209',  35500,   214000, '3-8р сар'],
  ['301',  56000,   395000, '2-8р сар'],
  ['302',  37500,   192300, '4-8р сар'],
  ['303',  61000,   122000, '7,8р сар'],
  ['304',  39500,   316000, '1-8р сар'],
  ['305',  37500,   112500, '6-8р сар'],
  ['306',  54000,    54000, '8р сар'],
  ['307',  45500,  1820000, 'үлдэгдэл+1-8р сар'],
  ['308',  39500,    39500, '8р сар'],
  ['309',  39500,  1382500, 'үлдэгдэл+1-8р сар'],
  ['401',  47500,  1235000, 'үлдэгдэл+1-8р сар'],
  ['402',  37500,    75000, '7,8р сар'],
  ['403',  43500,   348000, '1-8р сар'],
  ['404',  37500,    75000, '7,8р сар'],
  ['405',  39500,    39500, '8р сар'],
  ['406',  39500,        0, 'үлдэгдэлгүй'],
  ['407',  45500,   340000, '2-8р сар'],
  ['408',  37500,    75000, '7,8р сар'],
  ['409',  39400,        0, 'үлдэгдэлгүй'],           // хураамж нь бэхэн толбо доогуур — нийлбэрээр тогтоов
  ['501',  39500,   259600, '3-8р сар'],
  ['502',  41500,   207500, '4-8р сар'],
  ['503',  45500,  1820000, 'үлдэгдэл+1-8р сар'],
  ['504',  41500,    41000, '8р сар'],
  ['505',  39500,   553000, 'үлдэгдэл+1-8р сар'],
  ['506',  45500,  1320000, 'үлдэгдэл+1-8р сар'],
  ['507',  39500,    39500, '8р сар'],
  ['508',  37500,  1237500, 'үлдэгдэл+1-8р сар'],
  ['509',  37500,    37500, '8р сар'],
  ['601',  45500,  1415000, 'үлдэгдэл+1-8р сар'],
  ['602',  48000,   144000, '6-8р сар'],
  ['603',  39500,        0, 'үлдэгдэлгүй'],
  ['604',  45500,   364000, '1-8р сар'],
  ['605',  45500,   955500, 'үлдэгдэл+1-8р сар'],
  ['701',  45500,  1592500, 'үлдэгдэл+1-8р сар'],
  ['702',  57500,   287500, '4-8р сар'],
  ['703',  58000,   116000, '7,8р сар'],
  ['704',  43500,  1528500, 'үлдэгдэл+1-8р сар'],
  ['705',  47500,   159500, '6-8р сар'],
  ['801',  45500,  1820000, 'үлдэгдэл+1-8р сар'],
  ['802',  58500,   386100, '3-8р сар'],
  ['803',  41500,    41500, '8р сар'],
  ['804',  41500,    83000, '7,8р сар'],
  ['805',  39500,   158000, '5-8р сар'],
  ['901',  78500,  1177500, 'үлдэгдэл+1-8р сар'],
  ['902',  44000,   176000, '5-8р сар'],
  ['903',  45500,  1638000, 'үлдэгдэл+1-8р сар'],
  ['904',  45500,   537500, '2025.10-2025.12, 2026.1-8р сар'],
  ['905',  56000,   792000, '2025.07-2025.12, 2026.1-8р сар'],
  ['906',  45500,        0, 'үлдэгдэлгүй'],
  ['907',  37500,    75000, '7,8р сар'],
  ['908', 128000,  5120000, 'үлдэгдэл+1-8р сар'],
];

const money = (n) => `${Number(n).toLocaleString('en-US')}₮`;

// ------- Хяналтын нийлбэр -------
function verifyTotals() {
  const feeTotal = ROWS.reduce((s, r) => s + r[1], 0);
  const debtTotal = ROWS.reduce((s, r) => s + r[2], 0);

  console.log('🔎 Тайлангийн нийлбэртэй тулгах:');
  console.log(`   Сарын хураамж: ${money(feeTotal).padStart(14)}  (тайланд ${money(EXPECT_FEE_TOTAL)}) ${feeTotal === EXPECT_FEE_TOTAL ? '✓' : '❌'}`);
  console.log(`   Өрийн үлдэгдэл: ${money(debtTotal).padStart(13)}  (тайланд ${money(EXPECT_DEBT_TOTAL)}) ${debtTotal === EXPECT_DEBT_TOTAL ? '✓' : '❌'}`);
  console.log(`   Айлын тоо:     ${String(ROWS.length).padStart(13)}`);

  const apts = new Set(ROWS.map((r) => r[0]));
  if (apts.size !== ROWS.length) {
    console.error('❌ Тоот давхардаж байна.');
    return false;
  }
  return feeTotal === EXPECT_FEE_TOTAL && debtTotal === EXPECT_DEBT_TOTAL;
}

// ------- Supabase -------
function getClient() {
  const ENV_FILE = path.join(ROOT, '.env.local');
  if (fs.existsSync(ENV_FILE)) {
    for (const line of fs.readFileSync(ENV_FILE, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) {
        let v = m[2].trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
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

async function findOrg(sb) {
  if (SOKH_ID) {
    const { data } = await sb
      .from('sokh_organizations')
      .select('id, name, khoroo_id, claim_status, unit_count, monthly_fee')
      .eq('id', SOKH_ID)
      .maybeSingle();
    return data || null;
  }
  const { data } = await sb
    .from('sokh_organizations')
    .select('id, name, khoroo_id, claim_status, unit_count, monthly_fee')
    .ilike('name', '%ондогдулам%');
  return (data && data[0]) || null;
}

async function run() {
  if (!verifyTotals()) {
    console.error('\n❌ Нийлбэр тайлантай таарахгүй байна — өгөгдлийг засах хүртэл бичихгүй.');
    process.exitCode = 1;
    return;
  }

  const sb = getClient();
  if (!sb) return;

  // 1) СӨХ
  let org = await findOrg(sb);
  if (org) {
    console.log(`\n🏢 Байгаа СӨХ: #${org.id} — ${org.name} (${org.claim_status})`);
  } else {
    console.log(`\n🏢 СӨХ олдсонгүй → шинээр үүсгэнэ: "${ORG_NAME}"`);
    console.log(`   хороо: ${KHOROO_ID ?? '— (дараа холбоно)'}   утас: ${ORG_PHONE || '—'}   хаяг: ${ORG_ADDRESS || '—'}`);
    if (COMMIT) {
      const { data, error } = await sb
        .from('sokh_organizations')
        .insert([{
          name: ORG_NAME,
          address: ORG_ADDRESS,
          phone: ORG_PHONE,
          khoroo_id: KHOROO_ID,
          monthly_fee: ORG_DEFAULT_FEE,
          unit_count: ROWS.length,
          claim_status: 'pending',
        }])
        .select('id, name, khoroo_id, claim_status, unit_count, monthly_fee')
        .single();
      if (error) {
        console.error(`❌ СӨХ үүсгэж чадсангүй: ${error.message}`);
        process.exitCode = 1;
        return;
      }
      org = data;
      console.log(`   ✓ Үүсгэв: #${org.id}`);
    }
  }

  // 2) Айлууд
  let existingKeys = new Set();
  if (org) {
    const { data: existing, error } = await sb
      .from('residents')
      .select('apartment, monthly_fee, debt')
      .eq('sokh_id', org.id);
    if (error) {
      if (/monthly_fee/.test(error.message)) {
        console.error('\n❌ residents.monthly_fee багана алга — эхлээд supabase-per-unit-fee-migration.sql-ийг ажиллуулна уу.');
      } else {
        console.error(`❌ DB унших алдаа: ${error.message}`);
      }
      process.exitCode = 1;
      return;
    }
    existingKeys = new Set((existing || []).map((r) => String(r.apartment)));
    console.log(`   Одоо DB-д: ${existingKeys.size} айл`);
  }

  const toCreate = ROWS.filter((r) => !existingKeys.has(r[0]));

  // 3) Хураангуй
  const byFee = new Map();
  for (const [, fee] of ROWS) byFee.set(fee, (byFee.get(fee) || 0) + 1);
  console.log('\n📋 Тариф:');
  [...byFee.entries()].sort((a, b) => a[0] - b[0])
    .forEach(([fee, n]) => console.log(`   ${money(fee).padStart(10)} × ${String(n).padStart(2)} айл`));

  const withDebt = ROWS.filter((r) => r[2] > 0).length;
  const overpaid = ROWS.filter((r) => r[2] < 0);
  console.log('\n📊 Өр:');
  console.log(`   Өртэй:        ${withDebt} айл`);
  console.log(`   Өргүй:        ${ROWS.length - withDebt - overpaid.length} айл`);
  console.log(`   Илүү төлсөн:  ${overpaid.length} айл (${overpaid.map((r) => `${r[0]}: ${money(r[2])}`).join(', ')})`);

  console.log(`\n🧭 Төлөвлөгөө (${COMMIT ? 'COMMIT' : 'DRY-RUN'}):`);
  console.log(`   Шинээр үүсгэх айл:   ${toCreate.length}`);
  console.log(`   Аль хэдийн байгаа:   ${ROWS.length - toCreate.length} (алгасна)`);
  console.log(`   Аккаунт:             үүсгэхгүй (утас өгөгдөөгүй — QR-аар бүртгүүлнэ)`);

  if (!COMMIT) {
    console.log('\n🔍 DRY-RUN — юу ч бичсэнгүй. Бичихдээ: node scripts/import-dondogdulam-73.js --commit');
    return;
  }
  if (!toCreate.length) {
    console.log('\n✅ Бичих зүйл алга.');
    return;
  }

  const payload = toCreate.map(([apartment, fee, debt]) => ({
    name: `${apartment} тоот`,
    apartment,
    floor: apartment.slice(0, 1),
    monthly_fee: fee,
    debt,
    sokh_id: org.id,
    bank_customer_code: apartment,
  }));

  console.log(`\n✍️  ${payload.length} айл бичиж байна...`);
  let ok = 0;
  for (let i = 0; i < payload.length; i += 50) {
    const chunk = payload.slice(i, i + 50);
    const { error } = await sb.from('residents').insert(chunk);
    if (error) console.error(`   ❌ ${chunk[0].apartment}…${chunk[chunk.length - 1].apartment}: ${error.message}`);
    else ok += chunk.length;
  }

  if (org.unit_count !== ROWS.length) {
    await sb.from('sokh_organizations').update({ unit_count: ROWS.length }).eq('id', org.id);
  }

  console.log(`\n✅ ${ok}/${payload.length} айл бүртгэгдлээ. СӨХ #${org.id}`);
  console.log('\n   Дараагийн алхам:');
  console.log(`     1. Даргын утсыг оруулах → node scripts/activate-sokh.js --id=${org.id} --commit`);
  console.log('     2. QR хэвлүүлэх       → node scripts/make-sokh-qr.mjs');
}

run().catch((e) => { console.error(e); process.exitCode = 1; });
