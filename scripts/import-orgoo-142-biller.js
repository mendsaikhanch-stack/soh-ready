// «ӨРГӨӨ-142» СӨХ — Төрийн банкны биллерийн файлаас өр/нэр/хураамжийг шинэчилнэ.
//
// Энэ файл ЗӨВХӨН энэ нэг СӨХ-д зориулсан нэг удаагийн скрипт (аппын кодыг өөрчлөхгүй).
//
// Эх сурвалж (2026-09-16-нд хүлээн авав):
//   `data/orgoo-142/biller_2026-09-16.xlsx` — «invoices» хуудас, 346 мөр.
//   Багана: Хэрэглэгчийн № | Хороо | Байр | Корпус | Хаалга | Өрх |
//           Нэх/Он | Нэх/Сар | Харилцагчийн нэр | Нэхэмжилсэн дүн
//   Мөр бүр = ТӨЛӨГДӨӨГҮЙ нэг сарын нэхэмжлэх. 75 тоот, нийт 22,150,000₮.
//
// Энэ нь `import-orgoo-142.js`-ийн (Word, 2026.01, нийт 8,535,000₮) ОРЛУУЛАГЧ биш,
// ХОЙШХИ төлөв: 8 сарын дараах бодит үлдэгдэл. Банкны систем эх сурвалж тул
// өр/хураамжийг үүгээр дарж бичнэ.
//
// Онцлог:
//   • Дүн нь 55,000 (гараажгүй) / 90,000 (1 зогсоол) / 125,000 (2 зогсоол).
//     Хамгийн сүүлийн (2026.09) нэхэмжлэхийн дүн = тухайн айлын сарын хураамж.
//     → 802 тоот 125,000 биш 90,000 болж байна (Word дээр 2 зогсоолтой гэсэн байв).
//   • 2025.01-ний 2 мөр нь сарын хураамж биш, ӨМНӨХ ҮЛДЭГДЭЛ шилжүүлсэн мөр:
//     404 тоот 660,000₮ ба 806 тоот 435,000₮. Бусад бүх мөр 3 тарифын нэг.
//   • ⚠️ Биллерт БАЙХГҮЙ айлын сарын хураамжийг энэ скрипт ЗАСДАГГҮЙ — тэдэнд
//     нэхэмжлэхийн мөр байхгүй тул шалгах эх сурвалж алга. Тиймээс 1 сарын Word
//     жагсаалтын (зогсоолын тоо) боломжит алдаа хэвээр үлддэг. 2026-09-24-нд
//     дарга 809 тоот 90,000₮-өөр төлдөг гэж мэдэгдсэний дагуу 125,000 → 90,000
//     болгож ГАРААР зассан (802-т биллер яг ижил алдааг илрүүлж зассан байсан).
//     Үлдсэн шалгагдаагүй нь: 607, 1207, 1209 (бүгд 90,000₮) — даргаар тулгуулна.
//   • Биллерт БАЙХГҮЙ 21 тоот = өр төлбөргүй → өрийг 0 болгоно.
//     Ганц үл хамаарах нь 1006: 2026 он дуустал урьдчилж төлсөн. 1 сард
//     -990,000₮ (11 сар × 90,000) байсан нь 2-9 сарын 8 сараар зарцуулагдаж
//     10, 11, 12 сарын 3 × 90,000 = -270,000₮ үлдэнэ (дарга, 2026-09-16).
//   • «Хэрэглэгчийн №» = И-Биллингийн 16 оронт код. Файл дахь 75 кодыг шууд,
//     үлдсэн 21-г нь ижил томъёогоор (2005|01|0142|1|<тоот>|0) үүсгэнэ —
//     файлын 75 кодтой 100% таарч байгааг скрипт шалгана.
//   • Нэрийг ЗӨВХӨН «<тоот> тоот» гэж хоосон үлдсэн мөрөнд бичнэ. Өөрөө
//     бүртгүүлсэн (auth_user_id-тай) хүний нэрийг хэзээ ч дарж бичихгүй.
//   • Нэр нь оршин суугчийн ХУВЬ ХҮНИЙ мэдээлэл тул энэ скриптэд БИЧИГДЭЭГҮЙ —
//     ажиллах үедээ xlsx-ээс уншина. xlsx нь `/data/`-д (git-д ОРОХГҮЙ).
//
// Хяналт: эх файлын нийт дүн 22,150,000₮ ба 346 мөрийг тулгана; таарахгүй бол
// юу ч бичихгүй.
//
// Ажиллуулах:
//   node scripts/import-orgoo-142-biller.js               # dry-run: юу ч бичихгүй
//   node scripts/import-orgoo-142-biller.js --commit      # бодитоор бичнэ
//   node scripts/import-orgoo-142-biller.js --file <зам>  # өөр xlsx

const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const COMMIT = process.argv.includes('--commit');
const argFile = (() => {
  const i = process.argv.indexOf('--file');
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
})();
const FILE = argFile || path.join(ROOT, 'data', 'orgoo-142', 'biller_2026-09-16.xlsx');

// ------- Тохиргоо -------
const SOKH_ID = Number(process.env.SOKH_ID || 2693);
const EXPECT_ROWS = 346;
const EXPECT_TOTAL = 22150000;
const EXPECT_UNITS = 96;          // DB дэх нийт айл
const FEES = [55000, 90000, 125000];
// 2025.01-нд шилжүүлсэн өмнөх үлдэгдлийн мөр — сарын тариф биш нь ЗӨВ
const CARRY_FORWARD = { '404': 660000, '806': 435000 };
// Биллерт байхгүй боловч өр нь 0 БИШ тоот (урьдчилгаа)
const PREPAID = { '1006': -270000 };
// И-Биллингийн кодын загвар: 2005|хороо(2)|байр(4)|корпус(1)|тоот(4)|өрх(1)
const CODE = { prefix: '2005', horoo: 1, bair: 142, korpus: 1, orh: 0 };

const money = (n) => `${Number(n).toLocaleString('en-US')}₮`;
const pad = (v, n) => String(v).padStart(n, '0');
const codeFor = (apt) =>
  CODE.prefix + pad(CODE.horoo, 2) + pad(CODE.bair, 4) + pad(CODE.korpus, 1) + pad(apt, 4) + pad(CODE.orh, 1);

// Биллер нэрийг ТОМ үсгээр өгдөг тул эхний үсгээр нь жижигрүүлнэ.
// Жишээ (зохиомол): «ХХХХХХ» → «Хххххх», «Б.ХХХХ» → «Б.Хххх», «Б ХХХХ» → «Б Хххх»
// ЖИЧ: энд бодит оршин суугчийн нэр БҮҮ бич — репо public.
function titleCase(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/(^|[\s.\-])(\S)/g, (_, sep, ch) => sep + ch.toUpperCase());
}

// ------- Файлыг унших -------
function readBiller() {
  if (!fs.existsSync(FILE)) {
    console.error(`\n❌ Файл олдсонгүй: ${FILE}`);
    console.error('   --file <зам> гэж заана уу.');
    return null;
  }
  const XLSX = require('xlsx');
  const wb = XLSX.readFile(FILE);
  const sheet = wb.Sheets['invoices'] || wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(sheet, { defval: null });

  const units = new Map();   // тоот → { name, code, debt, fee, latest, months[] }
  let total = 0;
  for (const r of raw) {
    const apt = String(r['Хаалга']).trim();
    const amt = Number(r['Нэхэмжилсэн дүн']) || 0;
    const key = Number(r['Нэх/Он']) * 12 + Number(r['Нэх/Сар']);
    total += amt;
    let u = units.get(apt);
    if (!u) {
      u = {
        apt,
        name: titleCase(r['Харилцагчийн нэр']),
        code: String(r['Хэрэглэгчийн №']).trim(),
        debt: 0, fee: 0, latest: -1, months: [],
      };
      units.set(apt, u);
    }
    u.debt += amt;
    u.months.push({ key, ym: `${r['Нэх/Он']}-${pad(r['Нэх/Сар'], 2)}`, amt });
    if (key > u.latest) { u.latest = key; u.fee = amt; }
  }
  return { raw, units, total };
}

// ------- Хяналт -------
function verify(biller) {
  const { raw, units, total } = biller;
  const problems = [];
  console.log('🔎 Эх файлтай тулгах:');
  console.log(`   Мөр:         ${String(raw.length).padStart(5)}  (хүлээгдэж буй ${EXPECT_ROWS}) ${raw.length === EXPECT_ROWS ? '✓' : '❌'}`);
  console.log(`   Нийт дүн:    ${money(total).padStart(13)}  (хүлээгдэж буй ${money(EXPECT_TOTAL)}) ${total === EXPECT_TOTAL ? '✓' : '❌'}`);
  console.log(`   Тоот:        ${String(units.size).padStart(5)}`);
  if (raw.length !== EXPECT_ROWS) problems.push('мөрийн тоо');
  if (total !== EXPECT_TOTAL) problems.push('нийт дүн');

  // Мөр бүр 3 тарифын нэг, эсвэл баталгаажсан шилжүүлсэн үлдэгдэл байх ёстой
  const strange = [];
  for (const u of units.values()) {
    for (const m of u.months) {
      if (FEES.includes(m.amt)) continue;
      if (CARRY_FORWARD[u.apt] === m.amt) continue;
      strange.push(`${u.apt} ${m.ym}: ${money(m.amt)}`);
    }
    if (!FEES.includes(u.fee)) strange.push(`${u.apt} сарын хураамж ${money(u.fee)}`);
  }
  console.log(`   Тарифт үл нийцэх дүн: ${strange.length ? '❌ ' + strange.join(', ') : 'байхгүй ✓'}`);
  if (strange.length) problems.push('тарифт үл нийцэх дүн');
  Object.entries(CARRY_FORWARD).forEach(([apt, amt]) =>
    console.log(`   ✓ ${apt} тоот ${money(amt)} — 2025.01-нд шилжүүлсэн өмнөх үлдэгдэл (тариф биш нь зөв)`));

  // Хамгийн сүүлийн нэхэмжлэх бүгд ижил сард (2026.09) байх ёстой
  const maxKey = Math.max(...[...units.values()].map((u) => u.latest));
  const stale = [...units.values()].filter((u) => u.latest !== maxKey).map((u) => u.apt);
  console.log(`   Сүүлийн сар зөрүүтэй тоот: ${stale.length ? '⚠️ ' + stale.join(', ') : 'байхгүй ✓'}`);

  // Файл дахь 16 оронт код нь томъёогоор үүсгэсэнтэй таарч байна уу
  const badCode = [...units.values()].filter((u) => u.code !== codeFor(u.apt));
  console.log(`   Банкны код (${units.size}): ${badCode.length ? '❌ ' + badCode.map((u) => `${u.apt} ${u.code}≠${codeFor(u.apt)}`).join(', ') : 'томъёотой 100% таарлаа ✓'}`);
  if (badCode.length) problems.push('банкны код');

  return problems;
}

// ------- Supabase -------
function getClient() {
  const ENV_FILE = path.join(ROOT, '.env.local');
  if (fs.existsSync(ENV_FILE)) {
    for (const line of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let v = m[2].trim();
      if (/^["'].*["']$/.test(v)) v = v.slice(1, -1);
      if (!process.env[m[1]]) process.env[m[1]] = v;
    }
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('\n❌ NEXT_PUBLIC_SUPABASE_URL эсвэл SUPABASE_SERVICE_ROLE_KEY алга байна (.env.local).');
    return null;
  }
  const { createClient } = require('@supabase/supabase-js');
  return createClient(url, key, { auth: { persistSession: false } });
}

const isPlaceholder = (apt, name) => new RegExp(`^${apt}\\s*тоот$`).test(String(name || '').trim());

async function run() {
  const biller = readBiller();
  if (!biller) { process.exitCode = 1; return; }

  const problems = verify(biller);
  if (problems.length) {
    console.error(`\n❌ Эх файл хүлээгдэж буйгаас зөрж байна (${problems.join(', ')}) — юу ч бичихгүй.`);
    console.error('   Шинэ файл бол скриптийн EXPECT_ROWS / EXPECT_TOTAL-ыг шинэчил.');
    process.exitCode = 1;
    return;
  }

  const sb = getClient();
  if (!sb) { process.exitCode = 1; return; }

  const { data: org, error: orgErr } = await sb
    .from('sokh_organizations').select('id, name, unit_count').eq('id', SOKH_ID).single();
  if (orgErr || !org) {
    console.error(`\n❌ СӨХ #${SOKH_ID} олдсонгүй: ${orgErr && orgErr.message}`);
    process.exitCode = 1;
    return;
  }

  const { data: residents, error } = await sb
    .from('residents')
    .select('id, apartment, name, debt, monthly_fee, auth_user_id, bank_customer_code, pending_claim')
    .eq('sokh_id', SOKH_ID);
  if (error) {
    console.error(`❌ DB унших алдаа: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const active = residents.filter((r) => !r.pending_claim);
  const byApt = new Map(active.map((r) => [String(r.apartment), r]));
  console.log(`\n🏢 ${org.name} (#${org.id}) — DB-д ${residents.length} мөр` +
    (residents.length - active.length ? ` (баталгаажаагүй ${residents.length - active.length} — алгаслаа)` : ''));

  const missing = [...biller.units.keys()].filter((a) => !byApt.has(a));
  if (missing.length) {
    console.error(`\n❌ Биллерт байгаа ${missing.length} тоот DB-д алга: ${missing.join(', ')} — юу ч бичихгүй.`);
    process.exitCode = 1;
    return;
  }
  if (active.length !== EXPECT_UNITS) {
    console.log(`   ⚠️  DB-д ${active.length} айл байна (хүлээгдэж буй ${EXPECT_UNITS}).`);
  }

  // ------- Төлөвлөгөө -------
  const plan = [];
  for (const r of active) {
    const apt = String(r.apartment);
    const u = biller.units.get(apt);
    const patch = {};

    // Өр: биллерт байвал түүний нийлбэр, байхгүй бол 0 (эсвэл урьдчилгаа)
    const debt = u ? u.debt : (apt in PREPAID ? PREPAID[apt] : 0);
    if (Number(r.debt || 0) !== debt) patch.debt = debt;

    // Сарын хураамж: зөвхөн биллерт мэдээлэлтэй айлд (сүүлийн нэхэмжлэхийн дүн)
    if (u && Number(r.monthly_fee || 0) !== u.fee) patch.monthly_fee = u.fee;

    // Нэр: зөвхөн «<тоот> тоот» хэвээр байгаа, өөрөө бүртгүүлээгүй мөрөнд
    if (u && u.name && !r.auth_user_id && isPlaceholder(apt, r.name)) patch.name = u.name;

    // Банкны 16 оронт код
    const code = u ? u.code : codeFor(apt);
    if (r.bank_customer_code !== code) patch.bank_customer_code = code;

    if (Object.keys(patch).length) plan.push({ r, apt, u, patch });
  }

  const debtChanges = plan.filter((p) => 'debt' in p.patch);
  const feeChanges = plan.filter((p) => 'monthly_fee' in p.patch);
  const nameChanges = plan.filter((p) => 'name' in p.patch);
  const codeChanges = plan.filter((p) => 'bank_customer_code' in p.patch);
  // Биллерт нэртэй боловч DB-д аль хэдийн жинхэнэ нэртэй мөр — хэвээр үлдэнэ
  const keptNames = active.filter((r) =>
    biller.units.has(String(r.apartment)) && !isPlaceholder(String(r.apartment), r.name));

  const oldTotal = active.reduce((s, r) => s + Number(r.debt || 0), 0);
  const newTotal = active.reduce((s, r) => {
    const p = plan.find((x) => x.r.id === r.id);
    return s + (p && 'debt' in p.patch ? p.patch.debt : Number(r.debt || 0));
  }, 0);

  console.log('\n📊 Өр (DB 2026.01 → биллер 2026.09):');
  console.log(`   Нийт:      ${money(oldTotal).padStart(13)} → ${money(newTotal)}`);
  console.log(`   Өртэй:     ${biller.units.size} айл · төлбөргүй ${active.length - biller.units.size} айл`);
  const top = [...biller.units.values()].sort((a, b) => b.debt - a.debt).slice(0, 5);
  console.log(`   Хамгийн их: ${top.map((u) => `${u.apt} ${money(u.debt)}`).join(' · ')}`);
  Object.entries(PREPAID).forEach(([apt, v]) =>
    console.log(`   ✓ ${apt} тоот урьдчилгаа → ${money(v)} (10, 11, 12 сар × ${money(90000)})`));

  console.log(`\n🧭 Төлөвлөгөө (${COMMIT ? 'COMMIT' : 'DRY-RUN'}) — ${plan.length} мөр засна:`);
  console.log(`   Өр засах:        ${debtChanges.length}`);
  console.log(`   Хураамж засах:   ${feeChanges.length}${feeChanges.length ? ' → ' + feeChanges.map((p) => `${p.apt}: ${money(p.r.monthly_fee)}→${money(p.patch.monthly_fee)}`).join(', ') : ''}`);
  console.log(`   Нэр нэмэх:       ${nameChanges.length}`);
  console.log(`   Банкны код:      ${codeChanges.length}`);
  if (keptNames.length) console.log(`   Хэвээр үлдэх нэр: ${keptNames.map((r) => `${r.apartment} (${r.name})`).join(', ')}`);

  if (!COMMIT) {
    console.log('\n   Өрийн дэлгэрэнгүй:');
    debtChanges
      .sort((a, b) => a.apt.localeCompare(b.apt, 'en', { numeric: true }))
      .forEach((p) => console.log(
        `      ${p.apt.padStart(4)} тоот: ${money(p.r.debt || 0).padStart(12)} → ${money(p.patch.debt).padStart(12)}` +
        (p.u ? `  (${p.u.months.length} сар)` : '  (биллерт байхгүй → төлсөн)')));
    console.log('\n🔍 DRY-RUN — юу ч бичсэнгүй. Бичихдээ: node scripts/import-orgoo-142-biller.js --commit');
    return;
  }

  if (!plan.length) { console.log('\n✅ Бичих зүйл алга.'); return; }

  let ok = 0, failed = 0;
  for (const p of plan) {
    const { error: e } = await sb.from('residents').update(p.patch).eq('id', p.r.id);
    if (e) { failed++; console.error(`   ❌ ${p.apt} тоот: ${e.message}`); } else ok++;
  }
  console.log(`\n💾 Бичигдсэн: ${ok}/${plan.length}${failed ? ` · амжилтгүй ${failed}` : ''}`);
  console.log(`   Нийт өр одоо: ${money(newTotal)}`);
}

run().catch((e) => { console.error(e); process.exitCode = 1; });
