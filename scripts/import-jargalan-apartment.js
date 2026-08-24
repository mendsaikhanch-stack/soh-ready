// "Жаргалан апартмент" СӨХ (73-р байр) — 99 айлын нэрсийн жагсаалт бүртгэнэ.
//
// Энэ файл ЗӨВХӨН энэ нэг СӨХ-д зориулсан нэг удаагийн скрипт (аппын кодыг өөрчлөхгүй).
//
// Эх сурвалж: даргын өгсөн Excel — 2026-negdsen-jagsaalt.xlsx («нийт айл тооцоо» хуудас),
//             2026-08-24-нд хүлээн авав.
//
// Excel-ийн багана → DB талбар:
//   №      = 73          → building = '73'   (СӨХ-ийн хаяг «73-р байр»-тай таарч байна)
//   байр   = 1 | 2       → entrance (1-р корпус: 1-42 тоот, 2-р корпус: 43-99 тоот)
//   корп   = 1…99        → apartment (тоот)
//   Хаалга = 1           → бүх айлд ижил тул бичихгүй
//   өрх    = 1 (2-т 4)   → тодорхойгүй тул бичихгүй
//   Төрийн банк          → bank_customer_code (и-баримт тулгахад хэрэглэнэ)
//   нэрс                 → name
//
// Онцлог:
//   • Утас өгөгдөөгүй → аккаунт үүсгэхгүй. Нэвтрэлтийг QR-аар өөрсдөөр нь бүртгүүлнэ.
//   • Хураамж, өр өгөгдөөгүй → monthly_fee = null (СӨХ-ийн 50,000₮ default үйлчилнэ),
//     debt = 0.
//   • 99 тоотын дансны дугаар эх Excel дээр 2003010073000000 гэж бичигдсэн —
//     дараалал ёсоор 2003010073000990 байх ёстой. Эх файлын алдаа тул ХЭВЭЭР нь
//     бичиж, ажиллах бүрдээ анхааруулна. Даргаас баталгаажуулж засна.
//
// Ажиллуулах:
//   node scripts/import-jargalan-apartment.js            # dry-run: юу ч бичихгүй
//   node scripts/import-jargalan-apartment.js --commit   # бодитоор бичнэ

const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const COMMIT = process.argv.includes('--commit');

const SOKH_ID = Number(process.env.SOKH_ID || 2686); // Жаргалан апартмент СӨХ
const BUILDING = '73';

// ------- Хяналтын тоо (эх Excel-ээс) -------
const EXPECT_UNITS = 99;
const EXPECT_CORP1 = 42; // 1-р корпус: 1-42 тоот
const EXPECT_CORP2 = 57; // 2-р корпус: 43-99 тоот
const ODD_ACCOUNT = '2003010073000000'; // 99 тоот — эх файлын алдаатай данс

// ------- Өгөгдөл: [корпус, тоот, Төрийн банкны данс, нэр] -------
const ROWS = [
  [1, '1',   '2003010073000010', 'Гүнжиен'],
  [1, '2',   '2003010073000020', 'Төмөр'],
  [1, '3',   '2003010073000030', 'Төрмөнх'],
  [1, '4',   '2003010073000040', 'Гүнжиен'],
  [1, '5',   '2003010073000050', 'Чогдон'],
  [1, '6',   '2003010073000060', 'Мөнхцэцэг'],
  [1, '7',   '2003010073000070', 'Гүнжиен'],
  [1, '8',   '2003010073000080', 'Төгсөө'],
  [1, '9',   '2003010073000090', 'Сергей'],
  [1, '10',  '2003010073000100', 'Гүнжиен'],
  [1, '11',  '2003010073000110', 'Аюушмягмар'],
  [1, '12',  '2003010073000120', 'Энхжаргал'],
  [1, '13',  '2003010073000130', 'Жанар гуль'],
  [1, '14',  '2003010073000140', 'Нямдорж'],
  [1, '15',  '2003010073000150', 'Гүнжиен'],
  [1, '16',  '2003010073000160', 'Ганчимэг'],
  [1, '17',  '2003010073000170', 'Мөнхбаатар'],
  [1, '18',  '2003010073000180', 'Надмид'],
  [1, '19',  '2003010073000190', 'Бүрэндүүрэн'],
  [1, '20',  '2003010073000200', 'Батнасан'],
  [1, '21',  '2003010073000210', 'Баярсайхан'],
  [1, '22',  '2003010073000220', 'Гүнжиен'],
  [1, '23',  '2003010073000230', 'Цагаанбаатар'],
  [1, '24',  '2003010073000240', 'Гүнжиен'],
  [1, '25',  '2003010073000250', 'Өгөөмөр'],
  [1, '26',  '2003010073000260', 'Но-Амар'],
  [1, '27',  '2003010073000270', 'Сергей'],
  [1, '28',  '2003010073000280', 'Ариунтунгалаг'],
  [1, '29',  '2003010073000290', 'Золзаяа'],
  [1, '30',  '2003010073000300', 'Сергей'],
  [1, '31',  '2003010073000310', 'Батнасан'],
  [1, '32',  '2003010073000320', 'Ариунболд'],
  [1, '33',  '2003010073000330', 'Хүрэлбаатар'],
  [1, '34',  '2003010073000340', 'Гүнжиен'],
  [1, '35',  '2003010073000350', 'Баярмаа'],
  [1, '36',  '2003010073000360', 'Сайнбаяр'],
  [1, '37',  '2003010073000370', 'Гүнжиен'],
  [1, '38',  '2003010073000380', 'Биндэрьяа'],
  [1, '39',  '2003010073000390', 'Гүнжиен'],
  [1, '40',  '2003010073000400', 'Сергей'],
  [1, '41',  '2003010073000410', 'Гүнжиен'],
  [1, '42',  '2003010073000420', 'Гүнжиен'],
  [2, '43',  '2003010073000430', 'Мөнхтуяа'],
  [2, '44',  '2003010073000440', 'Сергей'],
  [2, '45',  '2003010073000450', 'Уянга'],
  [2, '46',  '2003010073000460', 'Хүрэлчулуун'],
  [2, '47',  '2003010073000470', 'Сергей'],
  [2, '48',  '2003010073000480', 'Гүнжиен'],
  [2, '49',  '2003010073000490', 'Цогт'],
  [2, '50',  '2003010073000500', 'Пүрэвсүрэн'],
  [2, '51',  '2003010073000510', 'Гүнжиен'],
  [2, '52',  '2003010073000520', 'Баярчимэг'],
  [2, '53',  '2003010073000530', 'Ганзориг'],
  [2, '54',  '2003010073000540', 'Гүлдиген'],
  [2, '55',  '2003010073000550', 'Гүнжиен'],
  [2, '56',  '2003010073000560', 'Алтантуяа'],
  [2, '57',  '2003010073000570', 'Мөнхжаргал'],
  [2, '58',  '2003010073000580', 'Амарзаяа'],
  [2, '59',  '2003010073000590', 'Гүнжиен'],
  [2, '60',  '2003010073000600', 'Гүнжиен'],
  [2, '61',  '2003010073000610', 'Батмөнх'],
  [2, '62',  '2003010073000620', 'Сүхээ'],
  [2, '63',  '2003010073000630', 'Гүнжиен'],
  [2, '64',  '2003010073000640', 'Гүнжиен'],
  [2, '65',  '2003010073000650', 'Мөнхбаатар'],
  [2, '66',  '2003010073000660', 'Цагаанаа'],
  [2, '67',  '2003010073000670', 'Бадар-Ууган'],
  [2, '68',  '2003010073000680', 'Буянхишиг'],
  [2, '69',  '2003010073000690', 'Бат'],
  [2, '70',  '2003010073000700', 'Наранцацрал'],
  [2, '71',  '2003010073000710', 'Сергей'],
  [2, '72',  '2003010073000720', 'Ундрахбуян'],
  [2, '73',  '2003010073000730', 'Чулуунбаатар'],
  [2, '74',  '2003010073000740', 'Даваажав'],
  [2, '75',  '2003010073000750', 'Гүнжиен'],
  [2, '76',  '2003010073000760', 'Номин'],
  [2, '77',  '2003010073000770', 'Батзориг'],
  [2, '78',  '2003010073000780', 'Төрмөнх'],
  [2, '79',  '2003010073000790', 'Гүнжиен'],
  [2, '80',  '2003010073000800', 'Банзрагч'],
  [2, '81',  '2003010073000810', 'Мөнхчулуун'],
  [2, '82',  '2003010073000820', 'Болормаа'],
  [2, '83',  '2003010073000830', 'Гүнжиен'],
  [2, '84',  '2003010073000840', 'Нямдаваа'],
  [2, '85',  '2003010073000850', 'Баатарцогт'],
  [2, '86',  '2003010073000860', 'Билгүүн очир'],
  [2, '87',  '2003010073000870', 'Сергей'],
  [2, '88',  '2003010073000880', 'Батхүү'],
  [2, '89',  '2003010073000890', 'Нарантунгалаг'],
  [2, '90',  '2003010073000900', 'Баярцогзол'],
  [2, '91',  '2003010073000910', 'Баатар'],
  [2, '92',  '2003010073000920', 'Чулуунцэцэг'],
  [2, '93',  '2003010073000930', 'Мөнхжин'],
  [2, '94',  '2003010073000940', 'Сүрэнням'],
  [2, '95',  '2003010073000950', 'Нэмэхболд'],
  [2, '96',  '2003010073000960', 'Гүнжиен'],
  [2, '97',  '2003010073000970', 'Мөнхжаргал'],
  [2, '98',  '2003010073000980', 'Болдбаатар'],
  [2, '99',  '2003010073000000', 'Батнасан'],
];

// ------- Хяналт -------
function verify() {
  const units = ROWS.map((r) => Number(r[1]));
  const corp1 = ROWS.filter((r) => r[0] === 1).length;
  const corp2 = ROWS.filter((r) => r[0] === 2).length;
  const missing = Array.from({ length: EXPECT_UNITS }, (_, i) => i + 1).filter((n) => !units.includes(n));
  const dupApt = units.length !== new Set(units).size;
  const dupAcct = ROWS.length !== new Set(ROWS.map((r) => r[2])).size;

  console.log('🔎 Excel-тэй тулгах:');
  console.log(`   Айлын тоо:    ${String(ROWS.length).padStart(3)}  (хүлээгдэж буй ${EXPECT_UNITS}) ${ROWS.length === EXPECT_UNITS ? '✓' : '❌'}`);
  console.log(`   1-р корпус:   ${String(corp1).padStart(3)}  (хүлээгдэж буй ${EXPECT_CORP1}) ${corp1 === EXPECT_CORP1 ? '✓' : '❌'}`);
  console.log(`   2-р корпус:   ${String(corp2).padStart(3)}  (хүлээгдэж буй ${EXPECT_CORP2}) ${corp2 === EXPECT_CORP2 ? '✓' : '❌'}`);
  console.log(`   Дутуу тоот:   ${missing.length ? missing.join(',') : '— байхгүй ✓'}`);
  console.log(`   Тоот давхардал:  ${dupApt ? '❌ байна' : '— байхгүй ✓'}`);
  console.log(`   Данс давхардал:  ${dupAcct ? '❌ байна' : '— байхгүй ✓'}`);

  const odd = ROWS.filter((r) => r[2] === ODD_ACCOUNT);
  if (odd.length) {
    console.log(`\n⚠️  ${odd.map((r) => r[1]).join(', ')} тоотын данс эх Excel дээр ${ODD_ACCOUNT} —`);
    console.log('   дараалал ёсоор 2003010073000990 байх ёстой. Хэвээр бичнэ, даргаас баталгаажуул.');
  }

  return ROWS.length === EXPECT_UNITS && corp1 === EXPECT_CORP1 && corp2 === EXPECT_CORP2
    && !missing.length && !dupApt && !dupAcct;
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

async function run() {
  if (!verify()) {
    console.error('\n❌ Өгөгдөл Excel-тэй таарахгүй байна — засах хүртэл бичихгүй.');
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
  console.log(`\n🏢 СӨХ: #${org.id} — ${org.name} (${org.address || '—'}, ${org.claim_status})`);
  console.log(`   Сарын хураамж: ${Number(org.monthly_fee || 0).toLocaleString('en-US')}₮ (айл бүрт тусад нь бичихгүй)`);

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
  const existingKeys = new Set((existing || []).map((r) => String(r.apartment).trim()));
  console.log(`   Одоо DB-д: ${existingKeys.size} айл`);

  const toCreate = ROWS.filter((r) => !existingKeys.has(r[1]));

  console.log(`\n🧭 Төлөвлөгөө (${COMMIT ? 'COMMIT' : 'DRY-RUN'}):`);
  console.log(`   Шинээр үүсгэх айл:  ${toCreate.length}`);
  console.log(`   Аль хэдийн байгаа:  ${ROWS.length - toCreate.length} (алгасна)`);
  console.log('   Аккаунт:            үүсгэхгүй (утас өгөгдөөгүй — QR-аар бүртгүүлнэ)');
  if (toCreate.length) {
    const sample = toCreate.slice(0, 3).map((r) => `${r[1]} тоот — ${r[3]}`).join(' | ');
    console.log(`   Жишээ:              ${sample}`);
  }

  if (!COMMIT) {
    console.log('\n🔍 DRY-RUN — юу ч бичсэнгүй. Бичихдээ: node scripts/import-jargalan-apartment.js --commit');
    return;
  }
  if (!toCreate.length) {
    console.log('\n✅ Бичих зүйл алга.');
    return;
  }

  const payload = toCreate.map(([corp, apartment, account, name]) => ({
    name,
    apartment,
    building: BUILDING,
    entrance: corp,
    debt: 0,
    monthly_fee: null,
    sokh_id: org.id,
    bank_customer_code: account,
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
    console.log(`   ✓ unit_count → ${ROWS.length}`);
  }

  console.log(`\n✅ ${ok}/${payload.length} айл бүртгэгдлээ. СӨХ #${org.id}`);
  console.log('\n   Дараагийн алхам:');
  console.log('     1. QR хэвлүүлэх → node scripts/make-sokh-qr.mjs');
  console.log('     2. 99 тоотын дансыг даргаас баталгаажуулж засах');
}

run().catch((e) => { console.error(e); process.exitCode = 1; });
