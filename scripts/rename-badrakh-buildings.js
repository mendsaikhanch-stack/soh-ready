// «Бадрах» СӨХ (#1571) — байрны нэрийг бодит хаягаар нь солино.
//
// Энэ нь ЗӨВХӨН энэ нэг СӨХ-д зориулсан нэг удаагийн скрипт (аппын кодыг өөрчлөхгүй).
//
// ЯАГААД:
//   437 айлыг `import-badrakh.js`-ээр СӨХ-ийн нэхэмжлэлийн Excel-ээс оруулахад
//   байрны багана нь дотоод дугаар (89, 88, 23, 24, 25, 26) байв. Дарга
//   2026-09-24-нд бодит хаяг нь **23А, 23Б, 23В, 23Г, 22А, 22Б** гэж мэдэгдсэн.
//
//   Байрны нэр хоёр газар шууд хэрэглэгддэг тул зөрүүтэй байвал бүтэлгүйтнэ:
//     • `/register` — олон байртай СӨХ-д тоот давхцахад байраар нь ялгадаг.
//       Оршин суугч «22А» гэж бичихэд DB-д «89» байвал ТААРАХГҮЙ.
//     • `scripts/make-sokh-qr.mjs` — QR-ийн зааварт байрны жагсаалтыг хэвлэдэг.
//       Бадрах нь QR-аар онбординг хийх тул үүнээс өмнө зөв байх ёстой.
//
// БАТАЛГАА:
//   • 24 → 23Б нь БАТЛАГДСАН: 24-ийн 14 тоот DB-д алга, оронд нь «23Б» байртай
//     14 тоот (37м², 48,500₮ — 24-ийн загвартай яг таарна) ганцаар байна.
//     Өөрөөр хэлбэл хэн нэг нь тэр мөрийг гараар «23Б» болгож зассан байна.
//   • 23→23А, 25→23В, 26→23Г нь дараалал дээр суурилсан ДҮГНЭЛТ (24→23Б-тэй
//     нийцэж байна).
//   • 88/89 → 22А/22Б-ийн ДАРААЛАЛ нь таамаг. ЗААВАЛ даргаар тулгуулах.
//
// Кирилл/латин: А, Б, В, Г бүгд КИРИЛЛ үсгээр бичигдэнэ. Латин «A» нь нүдэнд
// ижил харагддаг ч өөр тэмдэгт. `/register` нь LOOKALIKE хүснэгтээр хоёуланг
// нь хүлээж авдаг тул оршин суугч латинаар бичсэн ч холбогдоно.
//
// Ажиллуулах:
//   node scripts/rename-badrakh-buildings.js            # dry-run: юу ч бичихгүй
//   node scripts/rename-badrakh-buildings.js --commit   # бодитоор бичнэ

const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const COMMIT = process.argv.includes('--commit');
const SOKH_ID = Number(process.env.SOKH_ID || 1571);
const EXPECT_NAME = 'Бадрах';

// Одоогийн байр → бодит хаяг. Мөрийн тоо нь ЯГ таарахгүй бол юу ч бичихгүй.
const RENAME = [
  { from: '89',  to: '22Б', units: 145, sure: false },  // ⚠️ 88/89-ийн дараалал таамаг
  { from: '88',  to: '22А', units: 145, sure: false },  // ⚠️ 88/89-ийн дараалал таамаг
  { from: '23',  to: '23А', units: 37,  sure: false },  // дараалал дээр суурилсан
  { from: '24',  to: '23Б', units: 35,  sure: true },   // батлагдсан (14 тоот)
  { from: '25',  to: '23В', units: 37,  sure: false },  // дараалал дээр суурилсан
  { from: '26',  to: '23Г', units: 37,  sure: false },  // дараалал дээр суурилсан
  { from: '23Б', to: '23Б', units: 1,   sure: true },   // аль хэдийн зөв — хөндөхгүй
];

const pad = (s, n) => String(s).padEnd(n);

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
    console.error('\n❌ NEXT_PUBLIC_SUPABASE_URL эсвэл SUPABASE_SERVICE_ROLE_KEY алга (.env.local).');
    return null;
  }
  const { createClient } = require('@supabase/supabase-js');
  return createClient(url, key, { auth: { persistSession: false } });
}

async function run() {
  const sb = getClient();
  if (!sb) { process.exitCode = 1; return; }

  const { data: org } = await sb.from('sokh_organizations').select('id, name').eq('id', SOKH_ID).single();
  if (!org || !String(org.name).includes(EXPECT_NAME)) {
    console.error(`\n❌ СӨХ #${SOKH_ID} нь «${EXPECT_NAME}» биш (${org && org.name}) — юу ч бичихгүй.`);
    process.exitCode = 1;
    return;
  }

  const { data: rs, error } = await sb
    .from('residents').select('id, apartment, building').eq('sokh_id', SOKH_ID).limit(2000);
  if (error) { console.error(`❌ DB унших алдаа: ${error.message}`); process.exitCode = 1; return; }

  const byBuilding = new Map();
  for (const r of rs) {
    const b = String(r.building || '').trim();
    if (!byBuilding.has(b)) byBuilding.set(b, []);
    byBuilding.get(b).push(r);
  }

  console.log(`\n🏢 ${org.name} (#${org.id}) — DB-д ${rs.length} айл\n`);

  // ---- Хяналт: байр бүрийн мөрийн тоо хүлээгдэж буйтай таарах ёстой ----
  const problems = [];
  console.log('🔎 Одоогийн байрны бүрэлдэхүүн:');
  for (const m of RENAME) {
    const have = (byBuilding.get(m.from) || []).length;
    const ok = have === m.units;
    console.log(`   ${pad(`«${m.from}»`, 7)} ${String(have).padStart(3)} айл (хүлээгдэж буй ${String(m.units).padStart(3)}) ${ok ? '✓' : '❌'}`);
    if (!ok) problems.push(`${m.from}: ${have} ≠ ${m.units}`);
  }
  const known = new Set(RENAME.map((m) => m.from));
  const extra = [...byBuilding.keys()].filter((b) => !known.has(b));
  if (extra.length) {
    console.log(`   ⚠️  Жагсаалтад байхгүй байр: ${extra.map((b) => `«${b}» (${byBuilding.get(b).length})`).join(', ')}`);
    problems.push('танихгүй байр');
  }
  if (problems.length) {
    console.error(`\n❌ Одоогийн төлөв хүлээгдэж буйгаас зөрж байна (${problems.join('; ')}) — юу ч бичихгүй.`);
    process.exitCode = 1;
    return;
  }

  // ---- Төлөвлөгөө ----
  const plan = RENAME.filter((m) => m.from !== m.to);
  console.log('\n🧭 Солих төлөвлөгөө:');
  for (const m of plan) {
    console.log(`   «${pad(m.from, 3)}» → «${pad(m.to, 4)}»  ${String(m.units).padStart(3)} айл  ${m.sure ? '✓ батлагдсан' : '⚠️  ДАРГААР ТУЛГУУЛАХ'}`);
  }

  // Солисны дараах бүрэлдэхүүн (23Б нь 24-ийн 35 + байгаа 1 = 36 болно)
  const after = new Map();
  for (const m of RENAME) after.set(m.to, (after.get(m.to) || 0) + m.units);
  console.log('\n📋 Солисны дараа:');
  for (const [b, n] of [...after.entries()].sort((a, b) => a[0].localeCompare(b[0], 'mn', { numeric: true }))) {
    console.log(`   «${pad(b, 4)}» ${String(n).padStart(3)} айл`);
  }
  console.log(`   Нийт ${[...after.values()].reduce((s, n) => s + n, 0)} айл`);

  // 24-ийн 14 тоот нь аль хэдийн «23Б» болсон тул солисны дараа эвлэнэ
  const b23b = (byBuilding.get('23Б') || []).map((r) => r.apartment);
  const b24 = new Set((byBuilding.get('24') || []).map((r) => String(r.apartment)));
  const heal = b23b.filter((a) => !b24.has(String(a)));
  if (heal.length) console.log(`   ✓ «23Б» дэх ${heal.join(', ')} тоот нь 24-ийн дутуу мөр — солисны дараа нэг байранд нийлнэ`);

  if (!COMMIT) {
    console.log('\n🔍 DRY-RUN — юу ч бичсэнгүй.');
    console.log('   ⚠️  88/89 → 22А/22Б-ийн дараалал БАТАЛГААЖААГҮЙ. Даргаар тулгуулсны');
    console.log('       дараа бичнэ үү: node scripts/rename-badrakh-buildings.js --commit');
    return;
  }

  let ok = 0, failed = 0;
  for (const m of plan) {
    const { error: e, count } = await sb
      .from('residents')
      .update({ building: m.to }, { count: 'exact' })
      .eq('sokh_id', SOKH_ID)
      .eq('building', m.from);
    if (e) { failed++; console.error(`   ❌ «${m.from}» → «${m.to}»: ${e.message}`); }
    else { ok += count ?? m.units; console.log(`   ✓ «${m.from}» → «${m.to}»: ${count ?? m.units} мөр`); }
  }
  console.log(`\n💾 Солигдсон: ${ok} мөр${failed ? ` · амжилтгүй ${failed} байр` : ''}`);
  console.log('   Дараагийн алхам: QR/заавар дахин үүсгэх — node scripts/make-sokh-qr.mjs 1571');
}

run().catch((e) => { console.error(e); process.exitCode = 1; });
