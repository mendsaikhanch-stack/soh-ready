// «Аман хуур дижитал» СӨХ (#2696) — гаражийн зогсоолын бүртгэлийг `parking_vehicles`-д оруулна.
//
// Энэ нь ЗӨВХӨН энэ нэг СӨХ-д зориулсан нэг удаагийн скрипт (аппын кодыг өөрчлөхгүй).
// Айлуудыг `import-amankhuur.js` аль хэдийн оруулсан байх ёстой.
//
// Эх сурвалж (2026-10-20-нд нэмэлтээр ирэв): `E:\Downloads\Нэгдсэн_бүртгэл (1).xlsx`,
// «зогсоолын бүртгэл2» хуудас: Байр · хаалганы тоот · Нэр · Утас · Зогсоол № · Машины дугаар.
//   Үлдсэн 2 хуудас («зогсоолын хураамж төлөлт», «зогсоолын бүртгэл 1») нь гаражийн
//   хаалганы мотор/автоматжуулалтын нэг удаагийн 60,000₮-ийн банкны хуулга — бүгд төлөгдсөн
//   («төлөөгүй дүн» 0) тул өр болгож оруулахгүй. Сарын 15,000₮ гаражийн хураамж нь
//   `residents.monthly_fee`-д аль хэдийн орсон.
//
// Онцлог:
//   • Зогсоол бүр нэг мөр (`parking_spot` = «Р-12», `parking_type` = 'garage'). Нэг зогсоолд
//     хэд хэдэн машин бичигдсэн бол машин тус бүр мөр болно.
//   • `plate_number` NOT NULL — дугааргүй зогсоолыг «—» гэж оруулна (дарга дараа нь засна).
//     Ингэснээр зогсоол → айлын хамаарал алдагдахгүй.
//   • `apartment` = «33Г-2» хэлбэртэй. Тоот нь орц бүрд 1-ээс эхэлдэг тул зөвхөн тоогоор
//     бичвэл өөр орцны айлтай андуурагдана.
//   • `resident_name` = DB дэх тэр айлын нэр — оршин суугч аппад машинаа нэрээрээ хардаг.
//     «Байгууллага — КЭЙ энд ТИ» нь 33Г/66-д холбогдоно; «Гадна» мөрүүдэд эх файлын нэрийг бичнэ.
//   • «лифт» (зогсоолгүй) ба «Аваарын гарц» 66 (төлбөргүй) мөрийг оруулахгүй.
//   • Утас `parking_vehicles`-д багана байхгүй тул бичихгүй.
//
// Ажиллуулах:
//   node scripts/import-amankhuur-parking.js             # dry-run
//   node scripts/import-amankhuur-parking.js --commit    # бодитоор бичнэ
//
// Дахин ажиллуулахад: зогсоол+машины дугаараар тулгаж давхарлахгүй.

const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const ROOT = path.resolve(__dirname, '..');
const COMMIT = process.argv.includes('--commit');
const SRC = process.env.SRC || 'E:/Downloads/Нэгдсэн_бүртгэл (1).xlsx';
const SHEET = 'зогсоолын бүртгэл2';
const SOKH_ID = 2696;
// Даргаас нэмэлтээр ирсэн машины дугаар/марк (git-д ордоггүй — scripts/*.local.js)
const LOCAL_FILE = path.join(__dirname, 'amankhuur-parking.local.js');
const LOCAL = fs.existsSync(LOCAL_FILE) ? require(LOCAL_FILE) : {};

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

const clean = (v) => String(v == null ? '' : v).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();

// «28-00 УАО,76-13 УНЭ» → ['28-00 УАО', '76-13 УНЭ']; «45-15....» → ['45-15']
function platesOf(cell) {
  const s = clean(cell);
  if (/хүртэл|мотоцикл/i.test(s)) return [];
  return [...s.matchAll(/(\d{2})[-\s]?(\d{2})\s*([А-ЯЁӨҮ]{3})?/g)]
    .map((m) => `${m[1]}-${m[2]}${m[3] ? ` ${m[3]}` : ''}`);
}

function readSpots() {
  if (!fs.existsSync(SRC)) { console.error(`❌ Файл олдсонгүй: ${SRC}`); process.exit(1); }
  const wb = XLSX.readFile(SRC);
  if (!wb.Sheets[SHEET]) { console.error(`❌ «${SHEET}» хуудас олдсонгүй`); process.exit(1); }
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[SHEET], { header: 1, defval: '' });
  const spots = [];
  for (const r of rows.slice(6)) {
    const spotNo = Number(clean(r[4]).replace(/^Р/i, ''));
    if (!spotNo) continue;
    const bair = clean(r[0]);
    const name = clean(r[2]);
    if (/аваарын гарц/i.test(name) && !r[8]) continue; // төлбөргүй гарц
    // Р-64 (аваарын гарц), Р-99 (мотоциклын зогсоол болсон) — дарга «ийм зогсоол байхгүй» гэв (2026-10-20)
    if (spotNo === 64 || spotNo === 99) continue;
    // «Байгууллага — КЭЙ энд ТИ» = 33Г/66 (хэрэглэгч 2026-10-20). Задаргаанд 33Г/6 ч «K and T»
    // гэж бичигдсэн нь тэр тоотын эзэмшигч нэрээ солиулаагүйгээс — зогсоол нь 66-гийнх.
    // Харин Р-57 нь «КЭЙ энд ТИ» гэж бичигдсэн ч утас нь 33В/55-ынх, тэр айл гаражийн
    // хураамж төлдөг атлаа өөр зогсоолгүй → 33В/55-д холбоно.
    const isKT = /^байгуул/i.test(bair) && /к[эе]й\s*энд\s*ти/i.test(name);
    // Р-39 эх файлд 33А/26-д бичигдсэн ч 33А/35 айл саяхан худалдаж авсан (дарга, 2026-10-20)
    const fixed = spotNo === 57 ? ['', 'В', 55] : spotNo === 39 ? ['', 'А', 35] : isKT ? ['', 'Г', 66] : null;
    const m = fixed || bair.match(/^33\s*([АБВГ])/i);
    const apt = fixed ? fixed[2] : Number(r[1]) || null;
    // «Аваарын гарц» 64 — тэмдэглэлд «33в 11тоот» гэж ашиглагчийг бичсэн
    const note = clean(r[7]).match(/^33\s*([абвг])\s*(\d+)\s*тоот/i);
    spots.push({
      spot: `Р-${spotNo}`,
      building: m ? `33${m[1].toUpperCase()}` : note ? `33${note[1].toUpperCase()}` : null,
      apartment: m && apt ? String(apt) : note ? note[2] : null,
      srcName: name || bair,
      // Эх файлд байхгүй, даргаас ирсэн дугаар/марк — LOCAL файлд (хувийн мэдээлэл)
      plates: LOCAL.plates?.[spotNo] || platesOf(r[5]),
      carModel: LOCAL.carModels?.[spotNo] || null,
    });
  }
  return spots;
}

async function run() {
  const spots = readSpots();

  const { data: residents, error } = await sb.from('residents').select('building, apartment, name').eq('sokh_id', SOKH_ID);
  if (error) { console.error(`❌ ${error.message}`); process.exitCode = 1; return; }
  const resByKey = new Map(residents.map((r) => [`${r.building}|${r.apartment}`, r]));
  if (!residents.length) { console.error('❌ #2696-д айл алга — эхлээд import-amankhuur.js'); process.exitCode = 1; return; }

  const rows = [];
  const missing = [];
  for (const s of spots) {
    const res = s.building ? resByKey.get(`${s.building}|${s.apartment}`) : null;
    if (s.building && !res) missing.push(`${s.spot} ${s.building}/${s.apartment}`);
    const base = {
      sokh_id: SOKH_ID,
      parking_spot: s.spot,
      parking_type: 'garage',
      apartment: s.building ? `${s.building}-${s.apartment}` : null,
      resident_name: res ? res.name : s.srcName,
      car_model: s.carModel,
      status: 'active',
    };
    const plates = s.plates.length ? s.plates : ['—'];
    for (const p of plates) rows.push({ ...base, plate_number: p });
  }

  const spotNos = spots.map((s) => Number(s.spot.slice(2)));
  const dupSpots = [...new Set(spotNos.filter((n, i) => spotNos.indexOf(n) !== i))];
  console.log('🚗 Зогсоолын бүртгэл:');
  console.log(`   Зогсоол:            ${spots.length} (Р-${Math.min(...spotNos)} … Р-${Math.max(...spotNos)})`);
  console.log(`   Айлд хамаарах:      ${spots.filter((s) => s.building).length} · гадны/байгууллага: ${spots.filter((s) => !s.building).length}`);
  console.log(`   Машины дугаартай:   ${spots.filter((s) => s.plates.length).length} зогсоол · ${rows.filter((r) => r.plate_number !== '—').length} машин`);
  console.log(`   Дугааргүй («—»):    ${spots.filter((s) => !s.plates.length).length}`);
  console.log(`   Нийт мөр:           ${rows.length}`);
  if (dupSpots.length) console.log(`   ⚠️  Давхардсан зогсоол: ${dupSpots.join(', ')}`);
  if (missing.length) console.log(`   ⚠️  DB-д олдоогүй айл: ${missing.join(', ')}`);
  const absent = [];
  for (let n = 1; n <= Math.max(...spotNos); n++) if (!spotNos.includes(n)) absent.push(n);
  if (absent.length) console.log(`   Жагсаалтад байхгүй дугаар: ${absent.join(', ')}`);

  const { data: existing } = await sb.from('parking_vehicles').select('parking_spot, plate_number').eq('sokh_id', SOKH_ID);
  const have = new Set((existing || []).map((v) => `${v.parking_spot}|${v.plate_number}`));
  const toCreate = rows.filter((r) => !have.has(`${r.parking_spot}|${r.plate_number}`));
  console.log(`\n🧭 ${COMMIT ? 'COMMIT' : 'DRY-RUN'}: DB-д ${have.size} мөр бий · шинээр ${toCreate.length}`);

  if (!COMMIT) {
    console.log('\n🔍 DRY-RUN — юу ч бичсэнгүй. Бичихдээ: node scripts/import-amankhuur-parking.js --commit');
    return;
  }
  let ok = 0;
  for (let i = 0; i < toCreate.length; i += 50) {
    const chunk = toCreate.slice(i, i + 50);
    const { error: e } = await sb.from('parking_vehicles').insert(chunk);
    if (e) console.error(`   ❌ ${chunk[0].parking_spot}…: ${e.message}`);
    else ok += chunk.length;
  }
  console.log(`\n✅ ${ok}/${toCreate.length} мөр бичлээ.`);
}

run().catch((e) => { console.error(e); process.exitCode = 1; });
