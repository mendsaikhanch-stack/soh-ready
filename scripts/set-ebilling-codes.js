// Төрийн банкны И-Биллингийн 16 оронт "Хэрэглэгчийн №"-г айл бүрд оноох скрипт.
//
// Кодын бүтэц (Хөгжил Хаус СӨХ-ийн бодит биллер файлаас тайлсан, 312/312 мөр таарсан):
//
//   2005   18      0067    3        0101      0
//   └угтвар └хороо  └байр   └корпус  └тоот     └өрх
//     4       2       4       1        4        1     = 16 орон
//
// Тоот нь код дотроо шингэдэг тул Хотол код ↔ тоотыг хоёр тийш хөрвүүлж чадна.
// Ингэснээр банкнаас ирсэн төлөлтийн тайланг айлтай 100% тулгана.
//
// ⚠️ Угтвар (2005) СӨХ бүрд ижил эсэх нь БАТЛАГДААГҮЙ. Шинэ СӨХ-д ажиллуулахын
//    өмнө тухайн СӨХ-ийн бодит биллер файлаас угтварыг нь шалгаж ав.
//
// Ажиллуулах:
//   node scripts/set-ebilling-codes.js --sokh 2681 --horoo 18 --bair 67 --korpus 3
//   node scripts/set-ebilling-codes.js --sokh 2681 --horoo 18 --bair 67 --korpus 3 --commit
//
// Нэмэлт: --prefix 2005 (өгөхгүй бол 2005), --orh 0

const path = require('path');
const fs = require('fs');

// ------- Тохиргоо -------
const arg = (name, def) => {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
};
const SOKH_ID = Number(arg('sokh'));
const PREFIX  = String(arg('prefix', '2005'));
const HOROO   = arg('horoo');
const BAIR    = arg('bair');
const KORPUS  = arg('korpus');
const ORH     = String(arg('orh', '0'));
const COMMIT  = process.argv.includes('--commit');

if (!SOKH_ID || HOROO == null || BAIR == null || KORPUS == null) {
  console.error('❌ --sokh, --horoo, --bair, --korpus заавал өгнө.');
  console.error('   Жишээ: node scripts/set-ebilling-codes.js --sokh 2681 --horoo 18 --bair 67 --korpus 3');
  process.exit(1);
}

const pad = (v, n) => String(v).padStart(n, '0');

// Айлын тоотоос 16 оронт код угсарна. Тоот 4 оронд багтахгүй бол null.
function buildCode(apartment) {
  const apt = String(apartment == null ? '' : apartment).trim();
  if (!/^\d+$/.test(apt)) return null;      // "12А" гэх мэт үсэгтэй тоот
  if (apt.length > 4) return null;
  const code = PREFIX + pad(HOROO, 2) + pad(BAIR, 4) + pad(KORPUS, 1) + pad(apt, 4) + pad(ORH, 1);
  return code.length === 16 ? code : null;
}

function client() {
  const ENV_FILE = path.join(path.resolve(__dirname, '..'), '.env.local');
  if (fs.existsSync(ENV_FILE)) {
    for (const line of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!process.env[m[1]]) process.env[m[1]] = v;
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
  const sb = client();

  const { data: org, error: orgErr } = await sb
    .from('sokh_organizations').select('id, name').eq('id', SOKH_ID).single();
  if (orgErr || !org) {
    console.error(`❌ СӨХ #${SOKH_ID} олдсонгүй.`);
    process.exit(1);
  }

  const { data: all, error } = await sb
    .from('residents').select('id, apartment, bank_customer_code, pending_claim').eq('sokh_id', SOKH_ID);
  if (error) {
    console.error('❌ Оршин суугчдыг уншиж чадсангүй:', error.message);
    process.exit(1);
  }

  // Дарга баталгаажуулаагүй (өөрөө бүртгүүлсэн) мөр нь байгаа айлтай ижил
  // тоотоор давхцдаг тул код оноохгүй. Баталгаажсаны дараа дахин ажиллуулна.
  // Аппын бусад хэсэг (нэхэмжлэх, санхүү) мөн адил алгасдаг.
  const residents = all.filter(r => !r.pending_claim);
  const pending = all.length - residents.length;

  console.log(`\n🏢 ${org.name} (#${SOKH_ID}) — ${residents.length} айл` +
    (pending ? ` (+ баталгаажаагүй ${pending} — алгаслаа)` : ''));
  console.log(`📐 Загвар: ${PREFIX}|${pad(HOROO, 2)}|${pad(BAIR, 4)}|${pad(KORPUS, 1)}|<тоот>|${pad(ORH, 1)}\n`);

  const updates = [];
  const skipped = [];
  let already = 0;

  for (const r of residents) {
    const code = buildCode(r.apartment);
    if (!code) { skipped.push(r.apartment); continue; }
    if (r.bank_customer_code === code) { already++; continue; }
    updates.push({ id: r.id, apartment: r.apartment, from: r.bank_customer_code, code });
  }

  // Нэг код 2 айлд оногдвол банк тэднийг ялгаж чадахгүй — заавал зогсооно.
  const seen = new Map();
  const dupes = [];
  for (const u of updates) {
    if (seen.has(u.code)) dupes.push([seen.get(u.code), u.apartment, u.code]);
    else seen.set(u.code, u.apartment);
  }
  if (dupes.length) {
    console.error(`❌ ${dupes.length} код давхардлаа — тоот давхардсан байна:`);
    dupes.slice(0, 10).forEach(d => console.error(`   ${d[0]} ба ${d[1]} → ${d[2]}`));
    console.error('   Оршин суугчид цэснээс тоотыг нь засаад дахин ажиллуул.');
    process.exit(1);
  }

  console.log(`✅ Аль хэдийн зөв : ${already}`);
  console.log(`✏️  Шинэчлэх      : ${updates.length}`);
  console.log(`⏭️  Алгасах       : ${skipped.length}${skipped.length ? ' (' + skipped.slice(0, 8).join(', ') + ')' : ''}`);

  if (updates.length) {
    console.log('\nЖишээ:');
    updates.slice(0, 5).forEach(u =>
      console.log(`   ${String(u.apartment).padStart(4)} тоот: ${u.from || '(хоосон)'} → ${u.code}`));
  }

  if (!COMMIT) {
    console.log('\n🔍 DRY-RUN — юу ч бичээгүй. Бодитоор бичих бол --commit нэмнэ.');
    return;
  }

  let ok = 0, failed = 0;
  for (const u of updates) {
    const { error } = await sb.from('residents')
      .update({ bank_customer_code: u.code }).eq('id', u.id);
    if (error) { failed++; console.error(`   ⚠️ ${u.apartment}: ${error.message}`); }
    else ok++;
  }
  console.log(`\n💾 Бичигдсэн: ${ok}${failed ? ` | Амжилтгүй: ${failed}` : ''}`);
}

run().catch(e => { console.error('❌', e); process.exit(1); });
