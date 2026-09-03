// "Өрнөлт" СӨХ (#2111) — 112 айл + өрийн үлдэгдэл + эзэмшигчийн нэр/утас.
//
// Энэ файл ЗӨВХӨН энэ нэг СӨХ-д зориулсан нэг удаагийн скрипт (аппын кодыг өөрчлөхгүй).
//
// Эх сурвалж (2026-09-03, дарга өгсөн):
//   1) «Байр-Тоотын-бүртгэл-2026-09-03.xlsx» — 2 файл (гуравдахь нь давхардсан хуулбар):
//        файл A: 9A, 9B байр — 74 мөр
//        файл B: 11-р байр + «Аж Ахуй Нэгж» — 54 мөр
//      Багана: № | Байр | Орц | Тоот | Давхар | талбай | Өмчлөгч | Өмчлөгч хэлбэр | Зориулалт | Утас
//   2) «ӨРНӨЛТ СӨХ»-ийн төлбөрийн тайлангийн 2 хуудас цаасан хувилбарын зураг
//      (Төрийн банк, теллер-1191, гаргасан Алтантуул) — 62 өртэй нэгжийн жагсаалт.
//
// Байрны кодын тааралт (тайлан ↔ Excel), тоотын дээд дугаараар тогтоов:
//   9.2  ↔ 9А байр  (тоот 1–37)
//   9.3  ↔ 9Б байр  (тоот 1–35)
//   11.1 ↔ 11 байр  (тоот 1–40)
//   Нийт 37+35+40 = 112 айл — даргын хэлсэн тоотой таарч байна.
//
// Excel-д БАЙХГҮЙ 4 тоотыг нэргүй мөрөөр нөхөж үүсгэнэ:
//   9А-19 (өр 120,000), 9А-25 (өр 90,000), 9Б-23 (өр 30,000), 9Б-29 (өргүй)
//
// Сарын хураамж = 30,000 — тайлангийн нэг сарын мөрүүдээс шууд харагдана
//   (2026-8 -> 30,000; 2026-6,7,8 -> 90,000; 2026-4,5,6,7,8 -> 150,000).
//
// Хяналт: тайлангийн НИЙТ мөр 8,660,000 / 62 нэгж. Скрипт ажиллах бүрдээ
// доорх хүснэгтийн нийлбэрийг түүнтэй тулгана — зөрвөл юу ч бичихгүй зогсоно.
//
// Айл бус нэгжүүд (гараж, дэлгүүр, цех, халуун ус, сүм, СӨХ-ийн өрөө г.м. 19)
// нь --with-business өгснөөр unit_kind='business' болж ордог. Анхдагчаар ОРОХГҮЙ,
// учир нь тайланд өр нь тусад нь гарч ирдэггүй бөгөөд «112 айл» гэсэн тоог алдагдуулна.
//
// Ажиллуулах:
//   node scripts/import-ornolt.js --parse-only         # зөвхөн задлаад харуулна (DB хэрэггүй)
//   node scripts/import-ornolt.js                      # dry-run: DB шалгаад төлөвлөгөө харуулна
//   node scripts/import-ornolt.js --commit             # бодитоор бичнэ
// Сонголт:
//   --accounts        нэвтрэх аккаунт бас үүсгэнэ (и-мэйл <утас>@toot.app, нууц үг = утас)
//   --with-business   айл бус 19 нэгжийг бас оруулна

const path = require('path');
const fs = require('fs');
const XLSX = require(path.resolve(__dirname, '../node_modules/xlsx'));

const ROOT = path.resolve(__dirname, '..');
const COMMIT = process.argv.includes('--commit');
const PARSE_ONLY = process.argv.includes('--parse-only');
const WITH_ACCOUNTS = process.argv.includes('--accounts');
const WITH_BUSINESS = process.argv.includes('--with-business');

const SOKH_ID = Number(process.env.SOKH_ID || 2111);
const MONTHLY_FEE = 30000;

const DL = 'C:/Users/MNG/Downloads';
// [файлын зам, Excel-ийн «Байр» баганы утга -> байрны нэр]
const FILES = [
  [`${DL}/Байр-Тоотын-бүртгэл-2026-09-03.xlsx-2026-09-03.xlsx`, { '9A': '9А', '9B': '9Б' }],
  [`${DL}/Байр-Тоотын-бүртгэл-2026-09-03.xlsx-2026-09-03-2.xlsx`, { '11 р байр': '11', 'Аж Ахуй Нэгж': 'ААН' }],
];

// Байр бүрийн тоотын дээд дугаар (1..N бүгд байх ёстой)
const BUILDINGS = { '9А': 37, '9Б': 35, '11': 40 };

// ------- Өр: [байр, тоот, дүн] — цаасан тайлангаас гараар буулгав -------
const DEBTS = [
  ['9А',  1,  90000], ['9А',  7, 150000], ['9А',  8, 450000], ['9А',  9,  60000],
  ['9А', 10,  90000], ['9А', 11,  60000], ['9А', 13,  90000], ['9А', 15, 240000],
  ['9А', 16,  60000], ['9А', 19, 120000], ['9А', 21,  90000], ['9А', 23,  60000],
  ['9А', 24,  60000], ['9А', 25,  90000], ['9А', 31, 180000], ['9А', 35, 270000],
  ['9А', 36,  30000], ['9А', 37,  90000],
  ['9Б',  3,  60000], ['9Б',  7,  60000], ['9Б',  8,  30000], ['9Б', 11,  30000],
  ['9Б', 12,  60000], ['9Б', 14,  30000], ['9Б', 16, 630000], ['9Б', 17, 180000],
  ['9Б', 18,  30000], ['9Б', 20, 120000], ['9Б', 23,  30000], ['9Б', 27, 120000],
  ['9Б', 28,  60000], ['9Б', 30,  90000], ['9Б', 31, 150000], ['9Б', 34,  60000],
  ['9Б', 35,  60000],
  ['11',  1, 360000], ['11',  2,  90000], ['11',  5, 630000], ['11',  6,  60000],
  ['11',  8, 360000], ['11', 10, 450000], ['11', 11,  90000], ['11', 13,  90000],
  ['11', 15,  60000], ['11', 16,  60000], ['11', 17, 150000], ['11', 18,  60000],
  ['11', 19,  30000], ['11', 20,  30000], ['11', 24,  60000], ['11', 25, 470000],
  ['11', 26,  30000], ['11', 27, 300000], ['11', 29,  60000], ['11', 30,  30000],
  ['11', 31,  30000], ['11', 32,  60000], ['11', 33,  30000], ['11', 34, 180000],
  ['11', 35, 510000], ['11', 36, 120000], ['11', 40, 180000],
];
const EXPECT_DEBTORS = 62;
const EXPECT_DEBT_TOTAL = 8660000;

const money = (n) => `${Number(n).toLocaleString('en-US')}`;
const clean = (v) => String(v == null ? '' : v).replace(/[\r\n]+/g, ' ').trim();

const phoneOf = (v) => {
  const d = clean(v).replace(/\D/g, '');
  return /^[89]\d{7}$/.test(d) ? d : null;
};
// «99001122, 99003344,» -> эхний зөв дугаар
const firstPhone = (cell) => {
  for (const part of clean(cell).split(/[,;/]/)) {
    const p = phoneOf(part);
    if (p) return p;
  }
  return null;
};
// «Ankhbayar - 99001122» -> «Ankhbayar»; утга нь мэдээлэлгүй бол null
const ownerName = (cell) => {
  const s = clean(cell).replace(/\s*-\s*[89]\d{7}\s*$/, '').replace(/\s*-\s*$/, '').trim();
  if (!s || s === '-' || /^тодорхойгүй$/i.test(s)) return null;
  return s;
};
// Эхний үсгийг том болгоно (Excel-д «отгонцэцэг», «уянга» гэх мэт жижгээр бичигдсэн)
const titleCase = (s) => (s ? s.charAt(0).toLocaleUpperCase('mn-MN') + s.slice(1) : s);

// «24» -> 24 ; «27 тоот» -> 27 ; «СӨХ 34тоот» -> 34 ; «SERVICE», «Хэвлэл», «0», «00 Сүм» -> null
function apartmentNo(raw, maxApt) {
  const s = clean(raw);
  if (!s) return null;
  if (/^0/.test(s)) return null;   // «0тоот оёдол 9а», «00 халуун ус» гэх мэт нь айл биш
  const m = s.match(/(\d+)/g);
  if (!m) return null;
  const n = Number(m[0]);
  if (!Number.isFinite(n) || n < 1 || n > maxApt) return null;
  return n;
}

const floorOf = (raw) => {
  const s = clean(raw);
  return /^[1-9]$/.test(s) ? Number(s) : null;
};
const entranceOf = (raw) => {
  const m = clean(raw).match(/(\d+)/);
  return m ? Number(m[1]) : null;
};

// ------- Excel задлах -------
function parseAll() {
  const units = [];      // айл (unit_kind='household')
  const business = [];   // айл бус нэгж
  const problems = [];

  for (const [file, buildingMap] of FILES) {
    if (!fs.existsSync(file)) {
      console.error(`Файл олдсонгүй: ${file}`);
      process.exit(1);
    }
    const wb = XLSX.readFile(file);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: false });

    for (let i = 2; i < rows.length; i++) {
      const r = rows[i];
      if (!clean(r[1])) continue;                       // № хоосон = хоосон мөр
      const bKey = clean(r[2]);
      const building = buildingMap[bKey];
      if (!building) { problems.push(`${path.basename(file)} мөр ${i + 1}: танихгүй байр "${bKey}"`); continue; }

      const label = clean(r[4]);
      const name = titleCase(ownerName(r[7]));
      const phone = firstPhone(r[10]) || phoneOf((clean(r[7]).match(/[89]\d{7}/) || [])[0]);
      const entrance = entranceOf(r[3]);

      if (building === 'ААН') {
        business.push({ building: 'ААН', name, phone, entrance, label });
        continue;
      }
      const apt = apartmentNo(label, BUILDINGS[building]);
      if (apt == null) {
        business.push({ building, name, phone, entrance, label });
        continue;
      }
      units.push({ building, apt, name, phone, entrance, floor: floorOf(r[5]), label });
    }
  }

  // Нэг тоот 2 мөрөнд гарвал мэдээлэл илүүтэйг нь авна (11-27: «27 тоот» ба хоосон «27»)
  const byKey = new Map();
  const merged = [];
  for (const u of units) {
    const k = `${u.building}-${u.apt}`;
    const prev = byKey.get(k);
    if (!prev) { byKey.set(k, u); merged.push(u); continue; }
    const score = (x) => (x.name ? 2 : 0) + (x.phone ? 1 : 0);
    if (score(u) > score(prev)) Object.assign(prev, u);
    problems.push(`давхардсан тоот ${k} — нэг мөр болгон нэгтгэв`);
  }

  return { units: merged, business, problems };
}

// ------- Хяналт -------
function verify() {
  const total = DEBTS.reduce((s, d) => s + d[2], 0);
  const keys = DEBTS.map((d) => `${d[0]}-${d[1]}`);
  const dup = keys.length !== new Set(keys).size;
  const stray = DEBTS.filter((d) => !BUILDINGS[d[0]] || d[1] < 1 || d[1] > BUILDINGS[d[0]]);
  const totalUnits = Object.values(BUILDINGS).reduce((a, b) => a + b, 0);

  console.log('\nЦаасан тайлантай тулгах:');
  console.log(`   Өртэй нэгж:  ${String(DEBTS.length).padStart(11)}  (тайланд ${EXPECT_DEBTORS}) ${DEBTS.length === EXPECT_DEBTORS ? 'OK' : 'ЗӨРӨӨ'}`);
  console.log(`   Нийт өр:     ${money(total).padStart(11)}  (тайланд ${money(EXPECT_DEBT_TOTAL)}) ${total === EXPECT_DEBT_TOTAL ? 'OK' : 'ЗӨРӨӨ'}`);
  console.log(`   Давхардал:   ${dup ? 'БАЙНА' : 'байхгүй'}`);
  console.log(`   Байхгүй тоот дээр өр: ${stray.length ? stray.map((d) => d[0] + '-' + d[1]).join(',') : 'байхгүй'}`);
  console.log(`   Нийт айл:    ${String(totalUnits).padStart(11)}  (9А 37 + 9Б 35 + 11 40) ${totalUnits === 112 ? 'OK' : 'ЗӨРӨӨ'}`);

  return DEBTS.length === EXPECT_DEBTORS && total === EXPECT_DEBT_TOTAL && !dup && !stray.length && totalUnits === 112;
}

// ------- Бүрэн жагсаалт угсрах -------
function buildRoster(parsed) {
  const found = new Map(parsed.units.map((u) => [`${u.building}-${u.apt}`, u]));
  const debtOf = new Map(DEBTS.map((d) => [`${d[0]}-${d[1]}`, d[2]]));

  const roster = [];
  for (const [building, maxApt] of Object.entries(BUILDINGS)) {
    for (let apt = 1; apt <= maxApt; apt++) {
      const k = `${building}-${apt}`;
      const u = found.get(k) || null;
      roster.push({
        building,
        apartment: String(apt),
        name: (u && u.name) || `${apt} тоот`,
        phone: (u && u.phone) || null,
        entrance: u ? u.entrance : null,
        floor: u ? u.floor : null,
        debt: debtOf.get(k) || 0,
        unit_kind: 'household',
        fromExcel: Boolean(u),
      });
    }
  }
  return roster;
}

function printPreview(parsed, roster) {
  console.log('\nExcel-ээс задалсан:');
  for (const b of Object.keys(BUILDINGS)) {
    const list = roster.filter((r) => r.building === b);
    const inExcel = list.filter((r) => r.fromExcel).length;
    const named = list.filter((r) => !/^\d+ тоот$/.test(r.name)).length;
    console.log(`   ${b.padEnd(3)} байр: ${String(list.length).padStart(3)} тоот · Excel-д ${inExcel} · нэртэй ${named} · утастай ${list.filter((r) => r.phone).length}`);
  }
  console.log('   ----');
  console.log(`   Нийт айл:              ${roster.length}`);
  console.log(`   Утастай:               ${roster.filter((r) => r.phone).length}`);
  console.log(`   Утасгүй:               ${roster.filter((r) => !r.phone).length}`);
  console.log(`   Өртэй:                 ${roster.filter((r) => r.debt > 0).length} айл · ${money(roster.reduce((s, r) => s + r.debt, 0))}`);
  console.log(`   Сарын хураамж:         ${money(MONTHLY_FEE)} (бүгдэд ижил)`);

  const missing = roster.filter((r) => !r.fromExcel);
  if (missing.length) {
    console.log(`\n   Excel-д БАЙХГҮЙ тул нэргүй нөхөж үүсгэх ${missing.length} тоот:`);
    missing.forEach((r) => console.log(`      ${r.building}-${r.apartment} · өр ${money(r.debt)}`));
  }

  const phones = roster.filter((r) => r.phone).map((r) => r.phone);
  const dupPhones = [...new Set(phones.filter((p, i) => phones.indexOf(p) !== i))];
  if (dupPhones.length) {
    console.log(`\n   Хэд хэдэн тоотод давхардсан утас (${dupPhones.length}) — аккаунт үүсгэвэл нэг л аккаунт болно:`);
    dupPhones.forEach((p) => console.log(`      ${p}: ${roster.filter((r) => r.phone === p).map((r) => `${r.building}-${r.apartment}`).join(', ')}`));
  }

  console.log(`\n   Айл бус нэгж: ${parsed.business.length} (${WITH_BUSINESS ? 'ОРНО' : 'ОРОХГҮЙ — --with-business өгвөл орно'})`);
  parsed.business.forEach((b) => console.log(`      ${String(b.building).padEnd(3)} | ${String(b.label).slice(0, 22).padEnd(22)} | ${b.name || '—'} | ${b.phone || '—'}`));

  if (parsed.problems.length) {
    console.log('\n   Анхаарах:');
    parsed.problems.forEach((p) => console.log(`      ${p}`));
  }
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
    console.error('\nNEXT_PUBLIC_SUPABASE_URL эсвэл SUPABASE_SERVICE_ROLE_KEY алга байна (.env.local).');
    process.exit(1);
  }
  const { createClient } = require('@supabase/supabase-js');
  return createClient(url, key, { auth: { persistSession: false } });
}

async function runDb(parsed, roster) {
  const sb = getClient();

  const { data: org, error: orgErr } = await sb
    .from('sokh_organizations')
    .select('id, name, khoroo_id, claim_status, unit_count, monthly_fee')
    .eq('id', SOKH_ID)
    .single();
  if (orgErr || !org) {
    console.error(`\nСӨХ #${SOKH_ID} олдсонгүй${orgErr ? `: ${orgErr.message}` : ''}.`);
    process.exit(1);
  }
  console.log(`\nСӨХ: #${org.id} — ${org.name} (${org.claim_status}, хороо #${org.khoroo_id})`);
  console.log(`   unit_count: ${org.unit_count ?? '—'} -> ${roster.length}`);
  console.log(`   monthly_fee: ${money(org.monthly_fee || 0)} -> ${money(MONTHLY_FEE)}`);

  const { data: existing, error: resErr } = await sb
    .from('residents')
    .select('id, name, apartment, building, phone, debt, auth_user_id')
    .eq('sokh_id', SOKH_ID);
  if (resErr) {
    console.error(`DB унших алдаа: ${resErr.message}`);
    process.exit(1);
  }
  console.log(`   Одоо DB-д: ${(existing || []).length} мөр`);
  (existing || []).forEach((r) => console.log(`      #${r.id} ${r.building || '(байргүй)'}-${r.apartment} · ${r.name} · ${r.phone || '—'} · ${r.auth_user_id ? 'нэвтэрсэн' : 'аккаунтгүй'}`));

  const have = new Set((existing || []).filter((r) => r.building).map((r) => `${r.building}-${r.apartment}`));

  const rows = [...roster];
  if (WITH_BUSINESS) {
    parsed.business.forEach((b) => rows.push({
      building: b.building,
      apartment: b.label || '—',
      name: b.name || b.label || 'Аж ахуйн нэгж',
      phone: b.phone,
      entrance: b.entrance,
      floor: null,
      debt: 0,
      unit_kind: 'business',
      fromExcel: true,
    }));
  }

  const toCreate = rows.filter((r) => !have.has(`${r.building}-${r.apartment}`));
  console.log(`\nТөлөвлөгөө (${COMMIT ? 'COMMIT' : 'DRY-RUN'}):`);
  console.log(`   Шинээр үүсгэх:      ${toCreate.length} мөр`);
  console.log(`   Аль хэдийн байгаа:  ${rows.length - toCreate.length} (алгасна)`);
  console.log(`   Аккаунт үүсгэх:     ${WITH_ACCOUNTS ? `${new Set(toCreate.filter((r) => r.phone).map((r) => r.phone)).size} ширхэг (нууц үг = утас)` : 'ҮГҮЙ — QR-аар өөрсдөө бүртгүүлнэ'}`);

  if (!COMMIT) {
    console.log('\nDRY-RUN — юу ч бичсэнгүй. Бичихдээ: node scripts/import-ornolt.js --commit');
    return;
  }
  if (!toCreate.length) {
    console.log('\nБичих зүйл алга.');
    return;
  }

  // Аккаунт (сонголтоор)
  const authByPhone = new Map();
  if (WITH_ACCOUNTS) {
    const phones = [...new Set(toCreate.filter((r) => r.phone).map((r) => r.phone))];
    let made = 0, reused = 0, failed = 0;
    for (const phone of phones) {
      const email = `${phone}@toot.app`;
      const owner = toCreate.find((r) => r.phone === phone);
      const { data, error } = await sb.auth.admin.createUser({
        email, password: phone, email_confirm: true,
        user_metadata: { name: owner.name, phone },
      });
      if (error) {
        if (/already been registered/i.test(error.message)) {
          const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
          const found = (list?.users || []).find((u) => u.email === email);
          if (found) { authByPhone.set(phone, found.id); reused++; } else failed++;
        } else { console.error(`   Аккаунт ${phone}: ${error.message}`); failed++; }
      } else {
        authByPhone.set(phone, data.user.id);
        made++;
      }
    }
    console.log(`   Аккаунт: шинэ ${made}, байсныг холбов ${reused}, алдаа ${failed}`);
  }

  const payload = toCreate.map((r) => ({
    name: r.name,
    apartment: r.apartment,
    building: r.building,
    entrance: r.entrance,
    floor: r.floor,
    phone: r.phone || null,
    debt: r.debt,
    unit_kind: r.unit_kind,
    sokh_id: SOKH_ID,
    auth_user_id: r.phone ? authByPhone.get(r.phone) || null : null,
  }));

  console.log(`\n${payload.length} мөр бичиж байна...`);
  let ok = 0;
  for (let i = 0; i < payload.length; i += 50) {
    const chunk = payload.slice(i, i + 50);
    const { error } = await sb.from('residents').insert(chunk);
    if (error) console.error(`   Алдаа ${chunk[0].building}-${chunk[0].apartment}...: ${error.message}`);
    else ok += chunk.length;
  }

  const patch = {};
  if (org.unit_count !== roster.length) patch.unit_count = roster.length;
  if (Number(org.monthly_fee) !== MONTHLY_FEE) patch.monthly_fee = MONTHLY_FEE;
  if (Object.keys(patch).length) {
    const { error } = await sb.from('sokh_organizations').update(patch).eq('id', SOKH_ID);
    console.log(error ? `   СӨХ шинэчлэх алдаа: ${error.message}` : `   СӨХ шинэчлэв: ${JSON.stringify(patch)}`);
  }

  console.log(`\n${ok}/${payload.length} мөр бүртгэгдлээ. СӨХ #${SOKH_ID}`);
  console.log('\n   Дараагийн алхам:');
  console.log(`     1. Даргын эрх нээх -> node scripts/activate-sokh.js --id=${SOKH_ID} --commit`);
  console.log(`     2. QR хэвлүүлэх   -> node scripts/make-sokh-qr.mjs ${SOKH_ID}`);
}

(async () => {
  const parsed = parseAll();
  if (!verify()) {
    console.error('\nӨгөгдөл тайлантай таарахгүй байна — засах хүртэл бичихгүй.');
    process.exitCode = 1;
    return;
  }
  const roster = buildRoster(parsed);
  printPreview(parsed, roster);
  if (PARSE_ONLY) return;
  await runDb(parsed, roster);
})().catch((e) => { console.error(e); process.exitCode = 1; });
