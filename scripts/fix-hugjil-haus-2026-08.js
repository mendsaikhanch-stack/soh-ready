// Хөгжил хаус СӨХ (#2681) — 2026.08.06-ны Excel-ээр өрийг ЗАСАХ скрипт.
//
// Энэ файл ЗӨВХӨН энэ нэг Excel-д зориулсан нэг удаагийн скрипт (аппын кодыг өөрчлөхгүй).
//
// ЯМАР АЛДААГ ЗАСАЖ БАЙНА:
//   2026-07-21-ний анхны импорт (scripts/import-hugjil-haus.js) өрийг
//   "2026оны 2 сар " хуудаснаас ("Нийт төлөх дүн") авсан. Тэр хуудас нь
//   2026.03.02-ны байдлаарх 2-р сар хүртэлх өрийн ХУУЧИН хормын хувилбар.
//   Тиймээс DB-д 111 айлын 105 нь буруу үлдэгдэлтэй суусан.
//   Жишээ: 103 тоот DB-д 702,800₮ ← бодитоор 60,000₮.
//
//   Зөв багана нь үндсэн хуудасны "төлбөрийн нийт үлдэгдэл" (индекс 5).
//   Шалгалт: тэр баганын нийлбэр = файлын "ДАНСАНД" мөр = 7,296,800₮ ✔
//
// Ажиллуулах:
//   node scripts/fix-hugjil-haus-2026-08.js              # dry-run (юу ч бичихгүй)
//   node scripts/fix-hugjil-haus-2026-08.js --commit     # өрийг шинэчилнэ
//   node scripts/fix-hugjil-haus-2026-08.js --commit --with-phones
//                                                        # + утасны залруулга (доор үзнэ үү)

const path = require('path');
const fs = require('fs');
const XLSX = require(path.resolve(__dirname, '../node_modules/xlsx'));

// ------- Тохиргоо -------
const FILE = process.env.FILE || 'C:/Users/MNG/Downloads/Хөгжил-хаус-сөх-1.xlsx';
const SOKH_ID = Number(process.env.SOKH_ID || 2681);
const MAIN_SHEET = '2026,08,06';        // Тоот + Сарын төлбөр + төлбөрийн нийт үлдэгдэл
const PHONE_SHEET = 'Утасны жагсаалт';  // Тоот + Утас

const COMMIT = process.argv.includes('--commit');
const WITH_PHONES = process.argv.includes('--with-phones');

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

  const mainRows = rowsOf(wb, MAIN_SHEET);
  if (!mainRows) {
    console.error(`❌ "${MAIN_SHEET}" хуудас олдсонгүй. Байгаа: ${wb.SheetNames.join(', ')}`);
    process.exit(1);
  }
  const phoneRows = rowsOf(wb, PHONE_SHEET) || [];

  // Утасны жагсаалт: тоот -> эхний 8 оронтой дугаар
  const phoneByUnit = new Map();
  for (const r of phoneRows.slice(1)) {
    if (r[0] == null || isNaN(Number(r[0]))) continue;
    phoneByUnit.set(String(Number(r[0])), digits8(r[1]));
  }

  // Үндсэн хуудас: тоот + сарын төлбөр + үлдэгдэл + (баруун талын утас)
  const units = [];
  let footerTotal = null;
  for (const r of mainRows.slice(1)) {
    // "ДАНСАНД" мөр — файлын өөрийн нийт дүн (хөндлөн шалгалт)
    if (String(r[1] || '').trim() === 'ДАНСАНД') footerTotal = num(r[5]);
    if (r[1] == null || isNaN(Number(r[1]))) continue; // зөвхөн тоон тоот
    const apartment = String(Number(r[1]));
    units.push({
      apartment,
      monthly_fee: num(r[2]),
      debt: num(r[5]),                    // "төлбөрийн нийт үлдэгдэл" — ЗӨВ багана
      phone_list: phoneByUnit.get(apartment) || null,
      phone_main: digits8(r[19]),         // үндсэн хуудасны баруун талын утас
    });
  }
  return { units, footerTotal, sheetNames: wb.SheetNames };
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
    process.exit(1);
  }
  const { createClient } = require('@supabase/supabase-js');
  return createClient(url, key, { auth: { persistSession: false } });
}

async function run() {
  const { units, footerTotal, sheetNames } = parseWorkbook();
  console.log(`📂 Файл: ${FILE}`);
  console.log(`   Хуудсууд: ${sheetNames.join(', ')}`);
  console.log(`   Файлаас уншсан айл: ${units.length}`);

  const fileTotal = units.reduce((s, u) => s + u.debt, 0);
  console.log(`   Өрийн нийлбэр: ${fileTotal.toLocaleString()}₮`);
  if (footerTotal != null) {
    const ok = footerTotal === fileTotal;
    console.log(`   Файлын "ДАНСАНД" мөр: ${footerTotal.toLocaleString()}₮  ${ok ? '✔ таарч байна' : '⚠️ ТААРАХГҮЙ'}`);
    if (!ok) {
      console.error('\n❌ Хөндлөн шалгалт унасан — багана буруу байж болзошгүй. Зогсов.');
      process.exit(1);
    }
  }

  const sb = getClient();
  const { data: res, error } = await sb
    .from('residents')
    .select('id, apartment, name, phone, debt')
    .eq('sokh_id', SOKH_ID);
  if (error) { console.error(`❌ DB унших алдаа: ${error.message}`); process.exit(1); }

  const dbByUnit = new Map(res.map((r) => [String(r.apartment), r]));
  console.log(`\n🏢 СӨХ #${SOKH_ID} — DB-д ${res.length} мөр`);

  // ---- Өрийн зөрүү ----
  const debtChanges = [];
  const onlyInFile = [];
  for (const u of units) {
    const row = dbByUnit.get(u.apartment);
    if (!row) { onlyInFile.push(u.apartment); continue; }
    if (Number(row.debt || 0) !== u.debt) debtChanges.push({ row, u });
  }
  const onlyInDb = res.filter((r) => !units.some((u) => u.apartment === String(r.apartment)));
  const dbTotal = res.reduce((s, r) => s + Number(r.debt || 0), 0);

  console.log(`\n💰 ӨР (гол засвар):`);
  console.log(`   Шинэчлэгдэх:     ${debtChanges.length} мөр`);
  console.log(`   Өөрчлөлтгүй:     ${units.length - debtChanges.length - onlyInFile.length}`);
  console.log(`   Зөвхөн файлд:    ${onlyInFile.length ? onlyInFile.join(', ') : '—'}`);
  console.log(`   Зөвхөн DB-д:     ${onlyInDb.length ? onlyInDb.map((r) => r.apartment).join(', ') : '—'}`);
  console.log(`   Нийт өр: ${dbTotal.toLocaleString()}₮ → ${fileTotal.toLocaleString()}₮  (${(fileTotal - dbTotal).toLocaleString()}₮)`);

  const biggest = [...debtChanges].sort(
    (a, b) => Math.abs(Number(b.row.debt || 0) - b.u.debt) - Math.abs(Number(a.row.debt || 0) - a.u.debt),
  );
  console.log(`\n   Хамгийн том 10 зөрүү (тоот: DB → файл):`);
  for (const c of biggest.slice(0, 10)) {
    console.log(
      `     ${String(c.u.apartment).padEnd(4)} ${String(Number(c.row.debt || 0).toLocaleString()).padStart(10)}₮ → ${String(c.u.debt.toLocaleString()).padStart(10)}₮`,
    );
  }

  // ---- Утасны зөрүү ----
  // Дүрэм: "Утасны жагсаалт" хуудас нь эрх мэдэлтэй эх сурвалж (даргын хөтөлдөг
  // ажлын жагсаалт, үндсэн хуудасны баруун талын дугаараас шинэ). Зөрчилдвөл
  // жагсаалт нь ялна; жагсаалтад байхгүй бол үндсэн хуудсаар нөхнө.
  const phoneChanges = [];
  const conflicts = [];
  for (const u of units) {
    const row = dbByUnit.get(u.apartment);
    if (!row) continue;
    if (u.phone_main && u.phone_list && u.phone_main !== u.phone_list) {
      conflicts.push({ apartment: u.apartment, db: row.phone, main: u.phone_main, list: u.phone_list });
    }
    const target = u.phone_list || u.phone_main;
    if (target && target !== row.phone) phoneChanges.push({ row, target });
  }

  console.log(`\n📞 УТАС ("Утасны жагсаалт" хуудсыг зөв гэж үзнэ):`);
  console.log(`   Солигдох:  ${phoneChanges.length}`);
  for (const p of phoneChanges) {
    console.log(`     ${String(p.row.apartment).padEnd(4)} ${p.row.phone || '—'} → ${p.target}`);
  }
  if (conflicts.length) {
    console.log(`   Хоёр хуудас зөрчилдсөн ${conflicts.length} тоот (жагсаалтаар шийдэв):`);
    for (const c of conflicts) {
      const win = c.list === c.db ? 'DB хэвээр' : 'солигдоно';
      console.log(`     ${String(c.apartment).padEnd(4)} үндсэн=${c.main}  жагсаалт=${c.list}  → ${win}`);
    }
  }

  // Давхардсан утас (нэг auth данс → хоёр тоот)
  const cnt = {};
  for (const r of res) if (r.phone) cnt[r.phone] = (cnt[r.phone] || 0) + 1;
  const dups = Object.entries(cnt).filter(([, v]) => v > 1);
  if (dups.length) {
    console.log(`\n   ⚠️  DB-д давхардсан утас (нэг нэвтрэлт → хэд хэдэн тоот):`);
    for (const [ph, n] of dups) {
      const which = res.filter((r) => r.phone === ph).map((r) => r.apartment).join(', ');
      console.log(`     ${ph} × ${n}  → тоот ${which}`);
    }
  }

  if (!COMMIT) {
    console.log(`\n💡 DRY-RUN — юу ч бичээгүй.`);
    console.log(`   Өр засах:            node scripts/fix-hugjil-haus-2026-08.js --commit`);
    console.log(`   Өр + утас засах:     node scripts/fix-hugjil-haus-2026-08.js --commit --with-phones`);
    return;
  }

  // ---- Бичих ----
  let okDebt = 0, failDebt = 0;
  for (const c of debtChanges) {
    const { error: e } = await sb.from('residents').update({ debt: c.u.debt }).eq('id', c.row.id);
    if (e) { console.error(`   ❌ ${c.u.apartment} тоот өр: ${e.message}`); failDebt++; }
    else okDebt++;
  }
  console.log(`\n✅ Өр шинэчлэв: ${okDebt} мөр${failDebt ? `, алдаа ${failDebt}` : ''}`);

  if (WITH_PHONES) {
    let okPh = 0, failPh = 0, newAuth = 0, reAuth = 0;
    for (const p of phoneChanges) {
      // Шинэ дугаарт нэвтрэх данс үүсгэх (эсвэл байгааг нь олж холбох),
      // эс бөгөөс утсаа сольсон айл нэвтэрч чадахгүй болно.
      const email = `${p.target}@toot.app`;
      let authUserId = null;
      const { data: created, error: authErr } = await sb.auth.admin.createUser({
        email,
        password: p.target, // түр нууц үг = утас
        email_confirm: true,
        user_metadata: { name: p.row.name, phone: p.target },
      });
      if (authErr) {
        if (authErr.message.includes('already been registered')) {
          const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
          authUserId = (list?.users || []).find((u) => u.email === email)?.id || null;
          reAuth++;
        } else {
          console.error(`   ⚠️  ${p.row.apartment} тоот данс (${p.target}): ${authErr.message}`);
        }
      } else {
        authUserId = created.user?.id || null;
        newAuth++;
      }

      const patch = { phone: p.target };
      if (authUserId) patch.auth_user_id = authUserId;
      const { error: e } = await sb.from('residents').update(patch).eq('id', p.row.id);
      if (e) { console.error(`   ❌ ${p.row.apartment} тоот утас: ${e.message}`); failPh++; }
      else okPh++;
    }
    console.log(`✅ Утас шинэчлэв: ${okPh} мөр${failPh ? `, алдаа ${failPh}` : ''}`);
    console.log(`   Шинэ нэвтрэх данс: ${newAuth}, байсныг холбосон: ${reAuth}`);
    console.log(`   Түр нууц үг = шинэ утасны дугаар.`);
  }

  // Баталгаажуулалт
  const { data: after } = await sb.from('residents').select('debt').eq('sokh_id', SOKH_ID);
  const afterTotal = after.reduce((s, r) => s + Number(r.debt || 0), 0);
  console.log(`\n🔎 Шалгалт: DB-ийн нийт өр = ${afterTotal.toLocaleString()}₮  (файл: ${fileTotal.toLocaleString()}₮)  ${afterTotal === fileTotal ? '✔' : '⚠️'}`);
}

run();
