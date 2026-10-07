// АйСиТаун (ICTown) СӨХ — 498-р байрны 1-р орцны айлуудыг оруулна (2026-10-07).
//
// Эх сурвалж: даргын өгсөн «АЙ-Си-таун-СӨХ.xlsx» (Sheet1) —
//   «498- байрны 2-ын 1-р орц», багана: № · тоот · Оршин суугч · Утас · Машины дугаар.
//   16 давхар × 7 = 112 тоот (101…1607). 51-д нэр/утас бий, 61 хоосон.
//   СӨХ нийт ~750 айлтай; энэ файл зөвхөн нэг орц, бас бүрэн бөглөгдөөгүй.
//
// СӨХ-ийг ШИНЭЭР үүсгэхгүй: оршин суугч 2026-10-04-нд «Ictwon» нэрээр гараар
// бүртгүүлж #2694 (Хан-Уул, 8-р хороо) үүссэн байсан → түүнийг засаж ашиглана.
//   - Тэр үед бүртгүүлсэн Наранжаргал (1005, building='ictwon') нь файлын 1005-тай
//     ижил хүн → шинэ мөр үүсгэхгүй, байгаа мөрийн байр/орц/давхрыг засна.
//   - Доржготов Ням (305, building='203') — өөр байр, ХӨНДӨХГҮЙ.
//
// Хоосон тоотыг «<тоот> тоот» нэртэйгээр оруулна (хэрэглэгчийн шийдвэр: бүх 112).
// Нэвтрэх аккаунт үүсгэхгүй — QR-аар өөрсдөө бүртгүүлж мөртөө холбогдоно.
// Сарын хураамж тодорхойгүй → СӨХ-ийн жишиг 50,000₮-ийг null болгоно.
// Машины дугаар → docs/onboarding/sokh-2694/cars.local.md (PII, git-д орохгүй).
//
//   node scripts/import-ictown.js --parse-only   # зөвхөн файлыг уншина
//   node scripts/import-ictown.js                # DB шалгана, бичихгүй
//   node scripts/import-ictown.js --commit       # бичнэ

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const ROOT = path.resolve(__dirname, '..');
const FILE = process.env.ICTOWN_XLSX || 'C:/Users/MNG/Downloads/АЙ-Си-таун-СӨХ.xlsx';
const SOKH_ID = 2694;
const BUILDING = '2-1';   // 2-р блок 1-р орц (ictown-entrances.js-ээр «498»-аас нэрлэсэн)
const ENTRANCE = 1;
const BLOCK = '2';
const ORG_NAME = 'АйСиТаун СӨХ';
const ORG_PHONE = '95114666';
const ORG_ADDRESS = 'Хан-Уул дүүрэг, 8-р хороо';

const parseOnly = process.argv.includes('--parse-only');
const commit = process.argv.includes('--commit');

function parse() {
  const rows = XLSX.utils.sheet_to_json(XLSX.readFile(FILE).Sheets.Sheet1, { header: 1, defval: '' });
  if (!/498/.test(String(rows[0][2])) || String(rows[1][1]).trim() !== 'тоот') {
    throw new Error('Файлын толгой хүлээгдсэнээс өөр: ' + JSON.stringify(rows.slice(0, 2)));
  }
  const units = [];
  for (const r of rows.slice(2)) {
    const apt = String(r[1]).trim();
    if (!apt) continue;
    if (!/^\d{3,4}$/.test(apt)) throw new Error('Тоот буруу: ' + JSON.stringify(r));
    const name = String(r[2]).replace(/\s+/g, ' ').trim();
    const phone = String(r[3]).replace(/\D/g, '');
    if (phone && phone.length !== 8) throw new Error('Утас буруу: ' + JSON.stringify(r));
    units.push({ apartment: apt, name, phone, car: String(r[4]).trim(), floor: Math.floor(Number(apt) / 100) });
  }
  if (units.length !== 112 || new Set(units.map(u => u.apartment)).size !== 112) {
    throw new Error(`112 өвөрмөц тоот хүлээсэн, ${units.length} ирсэн`);
  }
  return units;
}

async function main() {
  const units = parse();
  const named = units.filter(u => u.name || u.phone);
  console.log(`📄 ${units.length} тоот (давхар 1–16 × 7), нэр/утастай ${named.length}, хоосон ${units.length - named.length}`);
  if (parseOnly) { named.forEach(u => console.log(`  ${u.apartment}\t${u.name || '—'}\t${u.phone}`)); return; }

  const env = {};
  for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/\r$/, '').replace(/^["']|["']$/g, '');
  }
  const { createClient } = require('@supabase/supabase-js');
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const { data: org, error: orgErr } = await sb.from('sokh_organizations').select('id, name, khoroo_id, claim_status').eq('id', SOKH_ID).single();
  if (orgErr || !org) throw new Error('СӨХ #2694 олдсонгүй');
  if (org.khoroo_id !== 124) throw new Error('Хороо өөрчлөгдсөн байна: ' + org.khoroo_id);

  const { data: existing } = await sb.from('residents').select('id, apartment, building, name, phone, auth_user_id').eq('sokh_id', SOKH_ID);
  // Энэ орцны мөр гэж тооцох: building='498' эсвэл анхны «ictwon» гэж бичсэн
  const mine = (existing || []).filter(r => r.building === BUILDING || r.building === '498' || r.building === 'ictwon');
  const byApt = new Map(mine.map(r => [String(r.apartment), r]));

  const inserts = [], updates = [];
  for (const u of units) {
    const ex = byApt.get(u.apartment);
    const base = { building: BUILDING, block: BLOCK, entrance: ENTRANCE, floor: u.floor };
    if (ex) {
      // Байгаа мөр (өөрөө бүртгүүлсэн) — нэр/утсыг нь хөндөхгүй, байршлыг л засна
      updates.push({ id: ex.id, apt: u.apartment, patch: base, note: `${ex.name} / ${ex.phone} (файлд: ${u.name} / ${u.phone})` });
    } else {
      inserts.push({ sokh_id: SOKH_ID, apartment: u.apartment, name: u.name || `${u.apartment} тоот`, phone: u.phone || null, debt: 0, ...base });
    }
  }

  console.log(`\n🏢 #${SOKH_ID} «${org.name}» → «${ORG_NAME}», утас ${ORG_PHONE}, хаяг «${ORG_ADDRESS}», хураамж null`);
  console.log(`➕ шинэ мөр ${inserts.length}`);
  console.log(`✏️  засах мөр ${updates.length}`); updates.forEach(u => console.log(`   ${u.apt}: ${u.note}`));
  const other = (existing || []).filter(r => !mine.includes(r));
  console.log(`⏭  хөндөхгүй (өөр байр) ${other.length}`); other.forEach(r => console.log(`   ${r.building}/${r.apartment} ${r.name}`));

  const cars = units.filter(u => u.car);
  if (!commit) { console.log('\n💡 Бичихийн тулд: node scripts/import-ictown.js --commit'); return; }

  const { error: e1 } = await sb.from('sokh_organizations')
    .update({ name: ORG_NAME, phone: ORG_PHONE, address: ORG_ADDRESS, monthly_fee: null }).eq('id', SOKH_ID);
  if (e1) throw new Error('СӨХ засах: ' + e1.message);
  for (const u of updates) {
    const { error } = await sb.from('residents').update(u.patch).eq('id', u.id);
    if (error) throw new Error(`${u.apt} засах: ${error.message}`);
  }
  if (inserts.length) {
    const { error } = await sb.from('residents').insert(inserts);
    if (error) throw new Error('Оруулах: ' + error.message);
  }
  const dir = path.join(ROOT, 'docs/onboarding/sokh-2694');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'cars.local.md'),
    '# АйСиТаун 498-1-р орц — машины дугаар (PII, git-д орохгүй)\n\n| Тоот | Нэр | Утас | Машин |\n|---|---|---|---|\n' +
    cars.map(u => `| ${u.apartment} | ${u.name} | ${u.phone} | ${u.car} |`).join('\n') + '\n');
  const { count } = await sb.from('residents').select('id', { count: 'exact', head: true }).eq('sokh_id', SOKH_ID);
  console.log(`\n✅ Бичигдэв. #${SOKH_ID}-д нийт ${count} мөр.`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
