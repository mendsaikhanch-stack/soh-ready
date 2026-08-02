// Ариун Очир-69 СӨХ (#1768) — Excel-ээс оршин суугчид + нэвтрэх аккаунт үүсгэнэ.
//
// Энэ файл ЗӨВХӨН энэ нэг Excel-д зориулсан нэг удаагийн скрипт (аппын кодыг өөрчлөхгүй).
// Бусад СӨХ өөр загвартай тул тэдэнд энэ скриптийг бүү ашигла.
//
// Файлын онцлог ("Нийт" хуудас):
//   мөр 0-1 = толгой (жил / сар), мөр 2-оос өгөгдөл
//   багана 0 = тоот, 1-2 = утас, 3 = кадастрын дугаар эсвэл нэмэлт утас, 4 = нэр
//   ХОЁР БАЙР нэг хуудсанд: тоот 1..132 (69А), дараа нь дахин 1..24 (69Б).
//   Тоот давхцдаг тул building талбараар л ялгагдана.
//   Багана 5+ нь 2019-2025 оны сар бүрийн төлбөр — ЭНЭ СКРИПТ ТҮҮНИЙГ ОРУУЛАХГҮЙ.
//
// Нэвтрэлт: утас = нэвтрэх нэр, түр нууц үг = МӨН утас (оршин суугч дараа нь солино).
// Утасгүй өрхийг мөр болгон оруулна (аккаунтгүй) — дарга бүрэн жагсаалтаа харна.
//
// Ажиллуулах:
//   node scripts/import-ariun-ochir-69.js --parse-only   # зөвхөн задлаад харуулна
//   node scripts/import-ariun-ochir-69.js                # dry-run: DB шалгаад төлөвлөгөө харуулна
//   node scripts/import-ariun-ochir-69.js --commit       # бодитоор үүсгэнэ

const path = require('path');
const fs = require('fs');
const XLSX = require(path.resolve(__dirname, '../node_modules/xlsx'));

// ------- Тохиргоо -------
const FILE = process.env.FILE || 'C:/Users/MNG/Downloads/Айл-өрхийн-төлсөн-байдал.xlsx';
const SHEET = 'Нийт';
const SOKH_ID = Number(process.env.SOKH_ID || 1768);   // Ариун Очир-69 СӨХ (идэвхжсэн, дарга нь бий)
const BUILDINGS = ['69А', '69Б'];                       // тоот дахин 1-ээс эхлэх бүрд дараагийнх руу шилжинэ
const HEADER_ROWS = 2;

const MODE = process.argv.includes('--commit')
  ? 'commit'
  : process.argv.includes('--parse-only')
    ? 'parse'
    : 'dry';

// ------- Туслах -------
const phoneOf = (v) => {
  const d = String(v == null ? '' : v).replace(/\D/g, '');
  return /^[89]\d{7}$/.test(d) ? d : null;   // Монголын гар утас: 8 эсвэл 9-өөр эхэлсэн 8 орон
};

// ------- Excel задлах -------
function parseWorkbook() {
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

  const records = [];
  const ignored = [];
  let blockIdx = 0;
  let prevUnit = 0;

  for (let i = HEADER_ROWS; i < rows.length; i++) {
    const r = rows[i];
    const unitRaw = String(r[0] ?? '').trim();
    const name = String(r[4] ?? '').trim();
    const unit = Number(unitRaw);

    if (!Number.isFinite(unit) || !unit || !name) {
      if (unitRaw || name) ignored.push({ row: i + 1, unitRaw, name });
      continue;
    }
    // Тоот дахин эхэлбэл дараагийн байр руу шилжинэ
    if (prevUnit && unit <= prevUnit) blockIdx++;
    prevUnit = unit;

    if (blockIdx >= BUILDINGS.length) {
      console.error(`❌ ${BUILDINGS.length}-аас олон байр илэрлээ (мөр ${i + 1}). BUILDINGS-ээ тохируулна уу.`);
      process.exit(1);
    }

    const phone = phoneOf(r[1]) || phoneOf(r[2]) || phoneOf(r[3]);
    records.push({
      row: i + 1,
      building: BUILDINGS[blockIdx],
      apartment: String(unit),
      name,
      phone,
    });
  }
  return { records, ignored, sheetNames: wb.SheetNames };
}

function printPreview({ records, ignored }) {
  const withPhone = records.filter((r) => r.phone);
  const uniquePhones = new Set(withPhone.map((r) => r.phone));

  console.log(`\n📋 Задалсан дүн:`);
  for (const b of BUILDINGS) {
    const list = records.filter((r) => r.building === b);
    if (!list.length) continue;
    console.log(`   ${b}: ${list.length} өрх (тоот ${list[0].apartment}..${list[list.length - 1].apartment}), утастай ${list.filter((r) => r.phone).length}`);
  }
  console.log(`   ----`);
  console.log(`   Нийт өрх:                  ${records.length}`);
  console.log(`   Утастай (аккаунт үүснэ):   ${withPhone.length}`);
  console.log(`   Ялгаатай утас:             ${uniquePhones.size}`);
  console.log(`   Утасгүй (зөвхөн мөр):      ${records.length - withPhone.length}`);

  const dup = withPhone.length - uniquePhones.size;
  if (dup > 0) {
    console.log(`   ⚠️  Давхардсан утас: ${dup} — нэг л аккаунт үүснэ`);
    const seen = new Map();
    withPhone.forEach((r) => {
      if (!seen.has(r.phone)) seen.set(r.phone, []);
      seen.get(r.phone).push(`${r.building}/${r.apartment}`);
    });
    [...seen.entries()].filter(([, v]) => v.length > 1)
      .forEach(([ph, v]) => console.log(`      ${ph}: ${v.join(', ')}`));
  }

  console.log(`\n   Эхний 6 бичлэг:`);
  console.log('   байр  | тоот | нэр                  | утас');
  for (const r of records.slice(0, 6)) {
    console.log(`   ${r.building.padEnd(5)} | ${r.apartment.padEnd(4)} | ${r.name.slice(0, 20).padEnd(20)} | ${r.phone || '—'}`);
  }

  const noPhone = records.filter((r) => !r.phone);
  if (noPhone.length) {
    console.log(`\n   ⚠️  Утасгүй өрх (аккаунт үүсэхгүй, мөр нь үүснэ):`);
    noPhone.forEach((r) => console.log(`      ${r.building} ${r.apartment} тоот — ${r.name}`));
  }
  if (ignored.length) {
    console.log(`\n   ℹ️  Алгассан мөр (тоот эсвэл нэр дутуу): ${ignored.length}`);
    ignored.slice(0, 8).forEach((r) => console.log(`      мөр ${r.row}: "${r.unitRaw}" / "${r.name}"`));
  }
}

// ------- Supabase -------
function getClient() {
  const ENV_FILE = path.join(path.resolve(__dirname, '..'), '.env.local');
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
    console.error('   (Түлхүүргүйгээр `--parse-only` горим ажиллана.)');
    process.exit(1);
  }
  const { createClient } = require('@supabase/supabase-js');
  return createClient(url, key, { auth: { persistSession: false } });
}

async function runDb({ records }, commit) {
  const sb = getClient();

  const { data: org, error: orgErr } = await sb
    .from('sokh_organizations')
    .select('id, name, claim_status, unit_count')
    .eq('id', SOKH_ID)
    .single();
  if (orgErr || !org) {
    console.error(`❌ СӨХ #${SOKH_ID} олдсонгүй: ${orgErr?.message}`);
    process.exit(1);
  }
  console.log(`\n🏢 СӨХ: #${org.id} — ${org.name} (${org.claim_status}, бүртгэлтэй тоот ${org.unit_count})`);

  // Давхардлаас хамгаалах: байр + тоот хосоор шалгана (тоот 2 байранд давхцдаг)
  const { data: existing } = await sb
    .from('residents')
    .select('apartment, building, phone')
    .eq('sokh_id', SOKH_ID);
  const existingKeys = new Set((existing || []).map((r) => `${r.building || ''}-${r.apartment}`));
  console.log(`   Одоо DB-д: ${(existing || []).length} оршин суугч`);

  const toCreate = records.filter((r) => !existingKeys.has(`${r.building}-${r.apartment}`));
  const already = records.length - toCreate.length;

  console.log(`\n🧭 Төлөвлөгөө (${commit ? 'COMMIT' : 'DRY-RUN'}):`);
  console.log(`   Шинээр үүсгэх:      ${toCreate.length} мөр`);
  console.log(`   Аль хэдийн байгаа:  ${already} (алгасна)`);
  console.log(`   Утастай→аккаунт:    ${toCreate.filter((r) => r.phone).length}`);
  console.log(`   Түр нууц үг:        = утасны дугаар`);
  console.log(`   Өр:                 0 (төлбөрийн түүх энэ скриптээр ОРОХГҮЙ)`);

  if (!commit) {
    console.log('\n💡 Бодитоор үүсгэхийн тулд: node scripts/import-ariun-ochir-69.js --commit');
    return;
  }

  let created = 0, linked = 0, reused = 0, failed = 0;
  for (const r of toCreate) {
    let authUserId = null;
    if (r.phone) {
      const email = `${r.phone}@toot.app`;
      const { data: authData, error: authErr } = await sb.auth.admin.createUser({
        email,
        password: r.phone,
        email_confirm: true,
        user_metadata: { name: r.name, phone: r.phone },
      });
      if (authErr) {
        if (authErr.message.includes('already been registered')) {
          const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
          const found = (list?.users || []).find((u) => u.email === email);
          authUserId = found?.id || null;
          reused++;
        } else {
          console.error(`   ❌ ${r.building} ${r.apartment} тоот (${r.phone}) аккаунт: ${authErr.message}`);
          failed++;
        }
      } else {
        authUserId = authData.user?.id || null;
        linked++;
      }
    }

    const { error: insErr } = await sb.from('residents').insert([{
      name: r.name,
      apartment: r.apartment,
      building: r.building,
      phone: r.phone || null,
      debt: 0,
      sokh_id: SOKH_ID,
      auth_user_id: authUserId,
    }]);
    if (insErr) {
      console.error(`   ❌ ${r.building} ${r.apartment} тоот мөр: ${insErr.message}`);
      failed++;
      continue;
    }
    created++;
  }

  console.log(`\n✅ Дууслаа:`);
  console.log(`   Үүссэн мөр:            ${created}`);
  console.log(`   Шинэ аккаунт:          ${linked}`);
  console.log(`   Байсан аккаунт холбов: ${reused}`);
  console.log(`   Алдаа:                 ${failed}`);
  console.log(`   Утасгүй (аккаунтгүй):  ${toCreate.filter((r) => !r.phone).length}`);
}

// ------- Гол урсгал -------
(async () => {
  const parsed = parseWorkbook();
  console.log(`📂 Файл: ${FILE}`);
  console.log(`   Хуудсууд: ${parsed.sheetNames.join(', ')}`);
  printPreview(parsed);

  if (MODE === 'parse') return;
  await runDb(parsed, MODE === 'commit');
})();
