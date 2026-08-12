// Хөгжил хаус СӨХ (#2681) — айл тус бүрийн сарын хураамжийг тогтоох скрипт.
//
// Энэ СӨХ тарифаа ялгавартай тогтоосон:
//   • эхний давхруудын зарим тоот албан байгууллага → тусдаа дүн
//   • 101–213 тоот  → 28,000₮
//   • 301–911 тоот  → 31,000₮
// (Эх сурвалж: даргын 2026-08-12-ны заавар.)
//
// ӨМНӨ НЬ ажиллуулах ёстой migration:
//   supabase-per-unit-fee-migration.sql  (residents.monthly_fee багана нэмнэ)
//
// Ажиллуулах:
//   node scripts/set-hugjil-haus-fees.js            # dry-run — юу ч бичихгүй
//   node scripts/set-hugjil-haus-fees.js --commit   # DB-д бичнэ

const path = require('path');
const fs = require('fs');

const SOKH_ID = Number(process.env.SOKH_ID || 2681);
const COMMIT = process.argv.includes('--commit');

// ------- Тарифын дүрэм -------
// Тусгай тоот (албан байгууллага гэх мэт) — дүрмээс дээгүүр бичнэ.
const OVERRIDES = {
  102: 50200,
  103: 30000,
  110: 40200,
};

// Мужаар тогтоосон тариф. Дээрээс доош шалгаж, эхний тохирсныг авна.
const RANGES = [
  { from: 101, to: 213, fee: 28000 },
  { from: 301, to: 911, fee: 31000 },
];

const feeFor = (apartment) => {
  const n = Number(apartment);
  if (!Number.isFinite(n)) return null;
  if (OVERRIDES[n] != null) return OVERRIDES[n];
  for (const r of RANGES) if (n >= r.from && n <= r.to) return r.fee;
  return null; // дүрэмд хамрагдаагүй — гараар шийднэ
};

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
  const sb = getClient();

  const { data: res, error } = await sb
    .from('residents')
    .select('id, apartment, name, monthly_fee')
    .eq('sokh_id', SOKH_ID)
    .order('apartment');

  if (error) {
    // process.exit-ийг ашиглахгүй — Windows дээр дуусаагүй fetch байхад libuv
    // assertion шидээд гаралтыг бохирдуулдаг. Зөвхөн exitCode тавиад буцна.
    if (/monthly_fee/.test(error.message)) {
      console.error('\n❌ residents.monthly_fee багана алга байна.');
      console.error('   Эхлээд supabase-per-unit-fee-migration.sql-ийг ажиллуулна уу:');
      console.error('   ALTER TABLE residents ADD COLUMN IF NOT EXISTS monthly_fee NUMERIC;');
    } else {
      console.error(`❌ DB унших алдаа: ${error.message}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`🏢 СӨХ #${SOKH_ID} — DB-д ${res.length} айл\n`);

  const changes = [];
  const same = [];
  const uncovered = [];

  for (const r of res) {
    const target = feeFor(r.apartment);
    if (target == null) { uncovered.push(r); continue; }
    if (Number(r.monthly_fee) === target) same.push(r);
    else changes.push({ r, target });
  }

  // Тарифын хураангуй
  const byFee = {};
  for (const r of res) {
    const t = feeFor(r.apartment);
    if (t == null) continue;
    (byFee[t] = byFee[t] || []).push(Number(r.apartment));
  }
  console.log('📋 Тогтоох тариф:');
  for (const [fee, units] of Object.entries(byFee).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    const list = units.length <= 6 ? units.join(', ') : `${Math.min(...units)}…${Math.max(...units)}`;
    console.log(`   ${String(Number(fee).toLocaleString()).padStart(9)}₮ × ${String(units.length).padStart(3)} айл   (${list})`);
  }
  const total = res.reduce((s, r) => s + (feeFor(r.apartment) || 0), 0);
  console.log(`   ${'─'.repeat(40)}`);
  console.log(`   Нийт сарын хураамж: ${total.toLocaleString()}₮\n`);

  console.log(`🔄 Шинэчлэгдэх: ${changes.length}   Өөрчлөлтгүй: ${same.length}   Дүрэмд ороогүй: ${uncovered.length}`);
  if (uncovered.length) {
    console.log(`   ⚠️  Дүрэмд хамрагдаагүй тоот: ${uncovered.map((r) => r.apartment).join(', ')}`);
  }

  if (changes.length) {
    console.log('\n   Тоот   одоо → шинэ');
    for (const c of changes) {
      const cur = c.r.monthly_fee == null ? '—' : `${Number(c.r.monthly_fee).toLocaleString()}₮`;
      console.log(`     ${String(c.r.apartment).padEnd(5)} ${cur.padStart(10)} → ${`${c.target.toLocaleString()}₮`.padStart(10)}`);
    }
  }

  if (!COMMIT) {
    console.log('\n🔍 DRY-RUN — юу ч бичсэнгүй. Бичихдээ: node scripts/set-hugjil-haus-fees.js --commit');
    return;
  }
  if (!changes.length) {
    console.log('\n✅ Бичих зүйл алга.');
    return;
  }

  console.log(`\n✍️  ${changes.length} мөр бичиж байна...`);
  let ok = 0;
  for (const c of changes) {
    const { error: e } = await sb.from('residents').update({ monthly_fee: c.target }).eq('id', c.r.id);
    if (e) console.error(`   ❌ ${c.r.apartment}: ${e.message}`);
    else ok++;
  }
  console.log(`✅ ${ok}/${changes.length} мөр шинэчлэгдлээ.`);
}

run().catch((e) => { console.error(e); process.exit(1); });
