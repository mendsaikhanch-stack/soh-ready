// Хөгжил хаус СӨХ — Excel-ээс оршин суугчид + нэвтрэх аккаунт үүсгэнэ.
//
// Энэ файл ЗӨВХӨН энэ нэг Excel-д зориулсан нэг удаагийн скрипт (аппын кодыг өөрчлөхгүй).
// Бусад СӨХ өөр загвартай тул тэдэнд энэ скриптийг бүү ашигла.
//
// Файлын онцлог: оршин суугчдын НЭР байхгүй → нэрийг "<тоот> тоот" болгоно.
//                Утас нь заримд олон дугаартай ("99150238, 99905056") → эхнийхийг авна.
//
// Нэвтрэлт: утас = нэвтрэх нэр, түр нууц үг = МӨН утас (оршин суугч дараа нь солино).
//
// Ажиллуулах:
//   node scripts/import-hugjil-haus.js --parse-only   # зөвхөн задлаад харуулна (түлхүүр хэрэггүй)
//   node scripts/import-hugjil-haus.js                # dry-run: DB шалгаад төлөвлөгөө харуулна
//   node scripts/import-hugjil-haus.js --commit       # бодитоор үүсгэнэ
//
// Нэмэлт:
//   SOKH_ID=123 node scripts/import-hugjil-haus.js    # СӨХ-ийг нэрээр хайхгүй, шууд id өгөх

const path = require('path');
const fs = require('fs');
const XLSX = require(path.resolve(__dirname, '../node_modules/xlsx'));

// ------- Тохиргоо -------
const FILE = process.env.FILE || 'C:/Users/MNG/Downloads/Хөгжил хаус сөх .xlsx';
const ORG_NAME = 'Хөгжил хаус СӨХ';        // Шинээр үүсгэх СӨХ-ийн нэр (нэрээр нь хайж, байхгүй бол үүсгэнэ)
const CREATE_DARGA = true;                 // Даргын admin нэвтрэлт үүсгэх эсэх
const DARGA_PHONE = '88373982';            // Даргын дугаар (эх файлд 94073111 байсныг 2026-07-21 шинэчилсэн)
const DARGA_DISPLAY = 'Хөгжил хаус дарга';  // admin_users.display_name
const UNIT_SHEET = 'Утасны жагсаалт';      // Тоот + Утас (үндсэн эх сурвалж)
const LEDGER_SHEET = '2026.07.19';         // Тоот + Сарын төлбөр
const DEBT_SHEET = '2026оны 2 сар ';       // Хаалганы дугаар + Нийт төлөх дүн (өр)

const MODE = process.argv.includes('--commit')
  ? 'commit'
  : process.argv.includes('--parse-only')
    ? 'parse'
    : 'dry';

// ------- Туслах -------
const digits8 = (v) => {
  const m = String(v == null ? '' : v).match(/\b(\d{8})\b/); // эхний 8 оронтой дугаар
  return m ? m[1] : null;
};
const num = (v) => {
  const n = Number(String(v == null ? '' : v).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const rowsOf = (wb, name) =>
  wb.Sheets[name] ? XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null }) : null;

// ------- Excel задлах -------
function parseWorkbook() {
  if (!fs.existsSync(FILE)) {
    console.error(`❌ Файл олдсонгүй: ${FILE}`);
    process.exit(1);
  }
  const wb = XLSX.readFile(FILE);

  const unitRows = rowsOf(wb, UNIT_SHEET);
  if (!unitRows) {
    console.error(`❌ "${UNIT_SHEET}" хуудас олдсонгүй. Байгаа хуудсууд: ${wb.SheetNames.join(', ')}`);
    process.exit(1);
  }

  // Сарын төлбөр: тоот -> дүн ('2026.07.19' хуудас, header мөр 0)
  const feeByUnit = new Map();
  const ledgerRows = rowsOf(wb, LEDGER_SHEET) || [];
  for (const r of ledgerRows.slice(1)) {
    const toot = num(r[1]);              // "Тоот" багана
    const fee = num(r[2]);               // "Сарын төлбөр" багана
    if (toot && fee) feeByUnit.set(String(toot), fee);
  }

  // Өр: хаалганы дугаар -> "Нийт төлөх дүн" ('2026оны 2 сар' хуудас, header мөр 1)
  const debtByUnit = new Map();
  const debtRows = rowsOf(wb, DEBT_SHEET) || [];
  for (const r of debtRows.slice(2)) {
    const toot = num(r[1]);              // "Хаалганы дугаар"
    const debt = num(r[4]);              // "Нийт төлөх дүн"
    if (toot && debt) debtByUnit.set(String(toot), debt);
  }

  // Үндсэн жагсаалт: Тоот + Утас
  const records = [];
  const skipped = [];
  for (const r of unitRows.slice(1)) {
    const tootRaw = r[0];
    if (tootRaw == null || tootRaw === '' || isNaN(Number(tootRaw))) continue; // зөвхөн тоон тоот
    const apartment = String(Number(tootRaw));
    const phone = digits8(r[1]);
    const rec = {
      apartment,
      name: `${apartment} тоот`,
      phone,
      monthly_fee: feeByUnit.get(apartment) || 0,
      debt: debtByUnit.get(apartment) || 0,
      raw_phone_cell: r[1] == null ? '' : String(r[1]),
    };
    if (!phone) skipped.push(rec); // утасгүй → аккаунт үүсгэхгүй, зөвхөн мөр
    records.push(rec);
  }
  return { records, skipped, feeByUnit, debtByUnit, sheetNames: wb.SheetNames };
}

function printPreview({ records, skipped }) {
  const withPhone = records.filter((r) => r.phone);
  const uniquePhones = new Set(withPhone.map((r) => r.phone));
  console.log(`\n📋 Задалсан дүн:`);
  console.log(`   Нийт айл (тоотоор):        ${records.length}`);
  console.log(`   Утастай (аккаунт үүснэ):   ${withPhone.length}`);
  console.log(`   Ялгаатай утас:             ${uniquePhones.size}`);
  console.log(`   Утасгүй (зөвхөн мөр):      ${skipped.length}`);
  const dup = withPhone.length - uniquePhones.size;
  if (dup > 0) console.log(`   ⚠️  Давхардсан утас:        ${dup} (нэг л аккаунт үүснэ)`);
  console.log(`\n   Эхний 8 бичлэгийн жишээ:`);
  console.log('   тоот | нэр       | утас     | сар.төлбөр | өр');
  for (const r of records.slice(0, 8)) {
    console.log(
      `   ${String(r.apartment).padEnd(4)} | ${r.name.padEnd(9)} | ${(r.phone || '—').padEnd(8)} | ${String(r.monthly_fee).padStart(9)} | ${String(r.debt).padStart(8)}`,
    );
  }
  if (skipped.length) {
    console.log(`\n   ⚠️  Утасгүй тоотууд (аккаунт үүсэхгүй): ${skipped.map((r) => r.apartment).join(', ')}`);
  }
}

// ------- Supabase (dry / commit горимд л) -------
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
    console.error('   .env.local-д нэмэх эсвэл `vercel env pull .env.local` ажиллуулна уу.');
    console.error('   (Түлхүүргүйгээр `--parse-only` горим ажиллана.)');
    process.exit(1);
  }
  const { createClient } = require('@supabase/supabase-js');
  return createClient(url, key, { auth: { persistSession: false } });
}

// СӨХ-ийг ЯГ нэрээр нь олох; байхгүй бол (commit үед) шинээр үүсгэх.
// SOKH_ID=<id> өгвөл шууд түүнийг ашиглана.
async function resolveOrCreateSokh(sb, commit, unitCount) {
  if (process.env.SOKH_ID) {
    const id = Number(process.env.SOKH_ID);
    const { data } = await sb.from('sokh_organizations').select('id, name').eq('id', id).single();
    if (!data) { console.error(`❌ SOKH_ID=${id} олдсонгүй.`); process.exit(1); }
    console.log(`🏢 СӨХ (SOKH_ID-аар): #${data.id} — ${data.name}`);
    return data.id;
  }
  const { data: found } = await sb
    .from('sokh_organizations')
    .select('id, name, claim_status')
    .eq('name', ORG_NAME)
    .maybeSingle();
  if (found) {
    console.log(`🏢 СӨХ бэлэн байна: #${found.id} — ${found.name} (${found.claim_status})`);
    return found.id;
  }
  if (!commit) {
    console.log(`🏢 СӨХ "${ORG_NAME}" олдсонгүй → COMMIT үед ШИНЭЭР үүснэ (claim_status=active)`);
    return null; // dry-run: одоохондоо id алга
  }
  const { data: created, error } = await sb
    .from('sokh_organizations')
    .insert([{
      name: ORG_NAME,
      address: '',
      phone: '',
      claim_status: 'active',
      activated_at: new Date().toISOString(),
      unit_count: unitCount,
    }])
    .select('id, name')
    .single();
  if (error || !created) { console.error(`❌ СӨХ үүсгэх алдаа: ${error?.message}`); process.exit(1); }
  console.log(`🏢 ✅ СӨХ ШИНЭЭР үүсгэв: #${created.id} — ${created.name}`);
  return created.id;
}

// Даргын admin_users нэвтрэлт үүсгэх (username=утас, нууц үг=утас).
async function ensureDarga(sb, sokhId, commit) {
  if (!CREATE_DARGA) return;
  const username = DARGA_PHONE;
  const { data: existing } = await sb.from('admin_users').select('id').eq('username', username).maybeSingle();
  if (existing) { console.log(`   👤 Дарга аль хэдийн байна (username=${username}) — алгасав`); return; }
  if (!commit) { console.log(`   👤 [DRY] Дарга үүснэ: нэвтрэх нэр=${username}, нууц үг=${username}, role=admin`); return; }
  const bcrypt = require(path.resolve(__dirname, '../node_modules/bcryptjs'));
  const password_hash = await bcrypt.hash(DARGA_PHONE, 12);
  const { error } = await sb.from('admin_users').insert([{
    username,
    password_hash,
    sokh_id: sokhId,
    role: 'admin',
    display_name: DARGA_DISPLAY,
    status: 'active',
  }]);
  if (error) console.error(`   ❌ Дарга үүсгэх алдаа: ${error.message}`);
  else console.log(`   👤 ✅ Дарга үүсгэв: нэвтрэх нэр=${username}, нууц үг=${username}`);
}

async function runDb({ records, skipped }, commit) {
  const sb = getClient();
  const sokhId = await resolveOrCreateSokh(sb, commit, records.length);
  await ensureDarga(sb, sokhId, commit);

  // Аль хэдийн орсон тоотуудыг шалгах (дахин ажиллуулахад давхардуулахгүй)
  const existing = sokhId
    ? (await sb.from('residents').select('apartment, phone').eq('sokh_id', sokhId)).data
    : [];
  const existingUnits = new Set((existing || []).map((r) => String(r.apartment)));
  console.log(`   Одоо DB-д: ${existing ? existing.length : 0} мөр (энэ СӨХ-д)`);

  const toCreate = records.filter((r) => !existingUnits.has(r.apartment));
  const already = records.length - toCreate.length;

  console.log(`\n🧭 Төлөвлөгөө (${commit ? 'COMMIT' : 'DRY-RUN'}):`);
  console.log(`   Шинээр үүсгэх:      ${toCreate.length} мөр`);
  console.log(`   Аль хэдийн байгаа:  ${already} (алгасна)`);
  console.log(`   Утастай→аккаунт:    ${toCreate.filter((r) => r.phone).length}`);
  console.log(`   Түр нууц үг:        = утасны дугаар`);

  if (!commit) {
    console.log('\n💡 Бодитоор үүсгэхийн тулд: node scripts/import-hugjil-haus.js --commit');
    return;
  }

  let created = 0, linked = 0, failed = 0, skippedExisting = 0;
  for (const r of toCreate) {
    let authUserId = null;
    if (r.phone) {
      const email = `${r.phone}@toot.app`;
      const { data: authData, error: authErr } = await sb.auth.admin.createUser({
        email,
        password: r.phone, // түр нууц үг = утас
        email_confirm: true,
        user_metadata: { name: r.name, phone: r.phone },
      });
      if (authErr) {
        if (authErr.message.includes('already been registered')) {
          // Аккаунт бий — тухайн auth хэрэглэгчийг олоод холбоно
          const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
          const found = (list?.users || []).find((u) => u.email === email);
          authUserId = found?.id || null;
          skippedExisting++;
        } else {
          console.error(`   ❌ ${r.apartment} тоот (${r.phone}) аккаунт: ${authErr.message}`);
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
      phone: r.phone || null,
      debt: r.debt,
      sokh_id: sokhId,
      auth_user_id: authUserId,
    }]);
    if (insErr) { console.error(`   ❌ ${r.apartment} тоот мөр: ${insErr.message}`); failed++; continue; }
    created++;
  }

  console.log(`\n✅ Дууслаа:`);
  console.log(`   Үүссэн мөр:          ${created}`);
  console.log(`   Шинэ аккаунт:        ${linked}`);
  console.log(`   Байсан аккаунт холбов: ${skippedExisting}`);
  console.log(`   Алдаа:               ${failed}`);
  console.log(`   Утасгүй (аккаунтгүй): ${toCreate.filter((r) => !r.phone).length}`);
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
