// АйСиТаун СӨХ (#2694) — 6 орцыг «блок-орц» байрны нэрээр ялгана (2026-10-07).
//
// Даргын өгсөн бүтэц (498-р байр):
//   1-1  1-р блок 1-р орц  112 айл  101–1607 (16 давхар × 7)
//   2-1  2-р блок 1-р орц  112 айл  ← «АЙ-Си-таун-СӨХ.xlsx» (import-ictown.js) аль хэдийн орсон
//   2-2  2-р блок 2-р орц  112 айл
//   3-1  3-р блок 1-р орц   79 айл  101–1605 (16 давхар × 5 = 80)
//   5-1  5-р блок 1-р орц   79 айл
//   5-2  5-р блок 2-р орц   79 айл
// 79 айлтай орцонд аль тоот байхгүйг мэдэхгүй → 80-аар үүсгэнэ, байхгүйг нь
// дарга хэлэхээр устгана (хэрэглэгчийн шийдвэр).
//
// Яагаад `building`-д «2-1» гэж бичих вэ: даргын /admin/residents хуудас айлыг
// building-ээр бүлэглэж шүүдэг, /api/auth/register ч тоот давхцахад building-ээр
// нарийсгадаг (normBuilding: «2-1», «2/1», «21» бүгд таарна). Тоот 6 орцонд
// давтагддаг тул энэ ялгаа заавал хэрэгтэй. block/entrance-д тоогоор нь бичнэ.
//
//   node scripts/ictown-entrances.js            # шалгана, бичихгүй
//   node scripts/ictown-entrances.js --commit   # бичнэ

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SOKH_ID = 2694;
const commit = process.argv.includes('--commit');

const ENTRANCES = [
  { code: '1-1', block: '1', entrance: '1', perFloor: 7 },
  { code: '2-1', block: '2', entrance: '1', perFloor: 7 },
  { code: '2-2', block: '2', entrance: '2', perFloor: 7 },
  { code: '3-1', block: '3', entrance: '1', perFloor: 5 },
  { code: '5-1', block: '5', entrance: '1', perFloor: 5 },
  { code: '5-2', block: '5', entrance: '2', perFloor: 5 },
];
const FLOORS = 16;

function unitsOf(e) {
  const out = [];
  for (let f = 1; f <= FLOORS; f++) for (let n = 1; n <= e.perFloor; n++) out.push({ apartment: String(f * 100 + n), floor: String(f) });
  return out;
}

async function main() {
  const env = {};
  for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/\r$/, '').replace(/^["']|["']$/g, '');
  }
  const { createClient } = require('@supabase/supabase-js');
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const { data: existing, error } = await sb.from('residents').select('id, apartment, building, block, entrance').eq('sokh_id', SOKH_ID);
  if (error) throw new Error(error.message);

  // 1) Анхны импорт (building='498') = 2-р блокны 1-р орц
  const relabel = existing.filter(r => r.building === '498');
  const unknown = existing.filter(r => r.building !== '498' && !ENTRANCES.some(e => e.code === r.building));
  if (unknown.length) throw new Error('Танихгүй байртай мөр: ' + JSON.stringify(unknown));

  // 2) Орц бүрийн дутуу тоотыг үүсгэнэ (2-1-ийг relabel хийсний дараах төлөвөөр тооцно)
  const have = new Set(existing.map(r => `${r.building === '498' ? '2-1' : r.building}|${r.apartment}`));
  const inserts = [];
  for (const e of ENTRANCES) {
    const units = unitsOf(e);
    const missing = units.filter(u => !have.has(`${e.code}|${u.apartment}`));
    console.log(`${e.code}  ${e.block}-р блок ${e.entrance}-р орц  ${units.length} тоот — байгаа ${units.length - missing.length}, үүсгэх ${missing.length}`);
    for (const u of missing) {
      inserts.push({ sokh_id: SOKH_ID, apartment: u.apartment, name: `${u.apartment} тоот`, phone: null, debt: 0,
        building: e.code, block: e.block, entrance: e.entrance, floor: u.floor });
    }
  }
  console.log(`\n✏️  «498» → «2-1» болгох: ${relabel.length} мөр`);
  console.log(`➕ шинэ мөр: ${inserts.length}`);
  console.log(`= нийт ${existing.length + inserts.length} мөр болно`);
  if (!commit) { console.log('\n💡 Бичихийн тулд: node scripts/ictown-entrances.js --commit'); return; }

  if (relabel.length) {
    const { error: e1 } = await sb.from('residents').update({ building: '2-1', block: '2', entrance: '1' })
      .eq('sokh_id', SOKH_ID).eq('building', '498');
    if (e1) throw new Error('2-1 болгох: ' + e1.message);
  }
  for (let i = 0; i < inserts.length; i += 200) {
    const { error: e2 } = await sb.from('residents').insert(inserts.slice(i, i + 200));
    if (e2) throw new Error('Оруулах: ' + e2.message);
  }
  const { data: after } = await sb.from('residents').select('building').eq('sokh_id', SOKH_ID);
  const by = {};
  for (const r of after) by[r.building] = (by[r.building] || 0) + 1;
  console.log('\n✅ Бичигдэв:', by, 'нийт', after.length);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
