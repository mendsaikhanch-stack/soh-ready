// «БАДРАХ» СӨХ — суурилуулалтын нэхэмжлэхийг үүсгэнэ (төлөгдөөгүй).
//
// Энэ файл ЗӨВХӨН энэ нэг СӨХ-д зориулсан нэг удаагийн скрипт (аппын кодыг өөрчлөхгүй).
//
// Нөхцөл (2026-09-19):
//   437 айл · жишиг 1,500₮/айл = 655,500₮
//   Нээлтийн хямдрал 50% → 750₮/айл = 327,750₮  ← нэхэмжлэх энэ дүнгээр
//   Сарын хураамж 437,000₮ (хөнгөлөлтгүй), үнэгүй 2 сар (09-14 → 11-14),
//   эхний сарын нэхэмжлэх 2026 оны 12 сард.
//
// Өргөө-142-оос ЯЛГАА: тэнд тохирсон дүн тарифаас зөрсөн тул гараар бичсэн.
// Энд дүн нь тарифын тооцоотой яг таарна (437 × 750), тиймээс скрипт дүнг
// өөрөө бодож, хатуу бичсэн тоотой тулгаж байж бичнэ — зөрвөл зогсоно.
//
// Мөрийн бүтцийг суперадмины `create` API (app/api/superadmin/invoices/route.ts)
// -тай ижил байлгав: kind='setup', period = идэвхжсэн сар, due_date = дараа
// сарын 15. Ингэснээр самбар дээр ялгаагүй харагдана.
//
// Ажиллуулах:
//   node scripts/create-badrakh-setup-invoice.js            # dry-run
//   node scripts/create-badrakh-setup-invoice.js --commit   # бодитоор бичнэ

const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const COMMIT = process.argv.includes('--commit');

const SOKH_ID = 1571;
const EXPECT_APARTMENTS = 437;
const EXPECT_AMOUNT = 327750;        // 437 × 750₮
const PERIOD = { year: 2026, month: 9 };
const DUE_DATE = '2026-10-15';       // нэхэмжилсэн сарын дараа сарын 15
const NOTES = 'Нээлтийн хямдрал — суурилуулалтын хөлс 50% хөнгөлсөн '
  + '(жишгээр 437 айл × 1,500₮ = 655,500₮).';

const money = (n) => `${Number(n).toLocaleString('en-US')}₮`;

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

async function run() {
  const sb = getClient();
  if (!sb) { process.exitCode = 1; return; }

  const { data: org, error: orgErr } = await sb
    .from('sokh_organizations')
    .select('id, name, claim_status, activated_at, setup_discount_percent')
    .eq('id', SOKH_ID)
    .maybeSingle();
  if (orgErr || !org) {
    console.error(`\n❌ СӨХ #${SOKH_ID} олдсонгүй: ${orgErr && orgErr.message}`);
    process.exitCode = 1;
    return;
  }

  const { data: tariff } = await sb.from('platform_tariff').select('*').eq('id', 1).maybeSingle();
  const listPerUnit = Number(tariff?.setup_per_unit ?? 1500);
  const { count } = await sb.from('residents').select('id', { count: 'exact', head: true }).eq('sokh_id', SOKH_ID);
  const apartments = count || 0;

  const discount = Number(org.setup_discount_percent ?? 0);
  const perUnit = Math.round(listPerUnit * (100 - discount) / 100);
  const amount = apartments * perUnit;

  console.log(`\n🏢 ${org.name} (#${org.id}) — ${org.claim_status}, идэвхжсэн ${String(org.activated_at).slice(0, 10)}`);
  console.log('\n💵 Суурилуулалтын тооцоо:');
  console.log(`   Айл:            ${apartments}`);
  console.log(`   Жишиг үнэ:      ${money(listPerUnit)}/айл → ${money(apartments * listPerUnit)}`);
  console.log(`   Хөнгөлөлт:      ${discount}% → ${money(perUnit)}/айл`);
  console.log(`   Нэхэмжлэх дүн:  ${money(amount)}`);

  // Хүлээгдэж буй утгатай тулгана — айл нэмэгдсэн/хөнгөлөлт өөрчлөгдсөн бол зогсоно
  const problems = [];
  if (apartments !== EXPECT_APARTMENTS) problems.push(`айл ${apartments} ≠ ${EXPECT_APARTMENTS}`);
  if (amount !== EXPECT_AMOUNT) problems.push(`дүн ${money(amount)} ≠ ${money(EXPECT_AMOUNT)}`);
  if (discount !== 50) problems.push(`хөнгөлөлт ${discount}% ≠ 50%`);
  if (problems.length) {
    console.error(`\n❌ Хүлээгдэж буйгаас зөрж байна (${problems.join(', ')}) — юу ч бичихгүй.`);
    console.error('   Өөрчлөлт зөв бол скриптийн EXPECT_* утгыг шинэчил.');
    process.exitCode = 1;
    return;
  }

  const { data: existing } = await sb
    .from('platform_invoices')
    .select('id, kind, period_year, period_month, amount, status')
    .eq('sokh_id', SOKH_ID);
  const prior = (existing || []).find((i) => i.kind === 'setup');
  console.log(`\n📄 Одоо байгаа нэхэмжлэх: ${existing?.length || 0}` +
    (prior ? ` (суурилуулалт #${prior.id}: ${money(prior.amount)}, ${prior.status})` : ''));

  const row = {
    sokh_id: SOKH_ID,
    kind: 'setup',
    period_year: PERIOD.year,
    period_month: PERIOD.month,
    amount,
    calculation_details: {
      plan_name: 'Суурилуулалт',
      apartments,
      list_per_unit_fee: listPerUnit,
      discount_percent: discount,
      per_unit_fee: perUnit,
      unit_total: amount,
    },
    status: 'pending',
    due_date: DUE_DATE,
    notes: NOTES,
  };

  console.log(`\n🧭 Төлөвлөгөө (${COMMIT ? 'COMMIT' : 'DRY-RUN'}):`);
  console.log(`   platform_invoices ${prior ? 'ШИНЭЧЛЭХ' : 'ҮҮСГЭХ'}: setup ${PERIOD.year}.${PERIOD.month}, ` +
    `${money(amount)}, төлөгдөөгүй, төлөх хугацаа ${DUE_DATE}`);

  if (!COMMIT) {
    console.log('\n🔍 DRY-RUN — юу ч бичсэнгүй. Бичихдээ: node scripts/create-badrakh-setup-invoice.js --commit');
    return;
  }

  const { data: saved, error } = await sb
    .from('platform_invoices')
    .upsert([row], { onConflict: 'sokh_id,period_year,period_month,kind' })
    .select()
    .single();
  if (error) {
    console.error(`   ❌ ${error.message}`);
    process.exitCode = 1;
    return;
  }

  console.log(`   ✓ Нэхэмжлэх #${saved.id} — ${money(saved.amount)}, ${saved.status}`);
  console.log(`\n✅ Дууслаа. Мөнгө орсны дараа самбараас «төлсөн» гэж тэмдэглэнэ.`);
}

run().catch((e) => { console.error(e); process.exitCode = 1; });
