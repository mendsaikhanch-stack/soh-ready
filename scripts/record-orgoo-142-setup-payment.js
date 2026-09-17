// «ӨРГӨӨ-142» СӨХ — суурилуулалтын төлбөрийг төлөгдсөнөөр бүртгэнэ.
//
// Энэ файл ЗӨВХӨН энэ нэг СӨХ-д зориулсан нэг удаагийн скрипт (аппын кодыг өөрчлөхгүй).
//
// Нөхцөл (2026-09-17-нд мэдэгдэв):
//   • Нээлтийн хямдралаар суурилуулалтын хөлсийг 50% хөнгөлсөн.
//   • СӨХ 74,000₮-ыг төлсөн. Төлсөн огноо = идэвхжсэн өдөр, 2026-09-13.
//
// ⚠️ 74,000₮ нь тарифын тооцоо БИШ. Тарифаар: 96 айл × 1,500₮ × 50% = 72,000₮.
//    74,000 ÷ 750 = 98.67 тул ямар ч айлын тоонд таарахгүй — энэ нь талуудын
//    тохирсон (дугуйруулсан) дүн. Иймд `platform_invoices.amount`-д 74,000₮-ыг
//    шууд бичнэ. Суперадмины `create` API нь дүнг сервер дээрээ дахин бодож
//    72,000₮ гаргадаг тул тэр замаар энэ дүнг оруулах БОЛОМЖГҮЙ — скриптээр
//    бичих болсны шалтгаан энэ.
//    Тарифын 72,000₮-ыг `calculation_details.unit_total`-д, тохирсон 74,000₮-ыг
//    `agreed_total`-д хоёуланг нь үлдээв — хожим яагаад зөрсөнийг тайлбарлана.
//
// Мөн `sokh_organizations.setup_discount_percent = 50` гэж бичнэ. Үүнийг
// бичихгүй бол үйлчилгээний гэрээ болон хожмын нэхэмжлэх бүтэн үнээр
// (96 × 1,500 = 144,000₮) бодогдоно. (Өрнөлт СӨХ-д ижил тохиргоо хийгдсэн.)
//
// Ажиллуулах:
//   node scripts/record-orgoo-142-setup-payment.js            # dry-run
//   node scripts/record-orgoo-142-setup-payment.js --commit   # бодитоор бичнэ

const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const COMMIT = process.argv.includes('--commit');

// ------- Тохиргоо -------
const SOKH_ID = 2693;
const DISCOUNT_PERCENT = 50;
const AGREED_TOTAL = 74000;          // бодитоор төлсөн, тохирсон дүн
const PERIOD = { year: 2026, month: 9 };
const PAID_AT = '2026-09-13T04:00:00.000Z';   // 2026-09-13 12:00 Улаанбаатар
const DUE_DATE = '2026-10-15';
const NOTES = 'Нээлтийн хямдрал — суурилуулалтын хөлс 50% хөнгөлсөн. '
  + 'Талуудын тохирсон дүн 74,000₮ (тарифаар 96 айл × 750₮ = 72,000₮).';

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
  const setupPerUnit = Number(tariff?.setup_per_unit ?? 1500);
  const { count } = await sb.from('residents').select('id', { count: 'exact', head: true }).eq('sokh_id', SOKH_ID);
  const apartments = count || 0;

  const discounted = Math.round(setupPerUnit * (100 - DISCOUNT_PERCENT) / 100);
  const tariffTotal = apartments * discounted;

  console.log(`\n🏢 ${org.name} (#${org.id}) — ${org.claim_status}, идэвхжсэн ${String(org.activated_at).slice(0, 10)}`);
  console.log('\n💵 Суурилуулалтын тооцоо:');
  console.log(`   Айл:              ${apartments}`);
  console.log(`   Жишиг үнэ:        ${money(setupPerUnit)}/айл`);
  console.log(`   Хөнгөлөлт:        ${DISCOUNT_PERCENT}% → ${money(discounted)}/айл`);
  console.log(`   Тарифын дүн:      ${money(tariffTotal)}`);
  console.log(`   Тохирсон дүн:     ${money(AGREED_TOTAL)}${AGREED_TOTAL !== tariffTotal ? `  (тарифаас ${money(AGREED_TOTAL - tariffTotal)} зөрүүтэй)` : ''}`);

  // Байгаа нэхэмжлэх
  const { data: existing } = await sb
    .from('platform_invoices')
    .select('id, kind, period_year, period_month, amount, status, paid_at, paid_amount')
    .eq('sokh_id', SOKH_ID);
  const prior = (existing || []).find((i) => i.kind === 'setup');
  console.log(`\n📄 Одоо байгаа нэхэмжлэх: ${existing?.length || 0}` +
    (prior ? ` (суурилуулалт: ${money(prior.amount)}, ${prior.status})` : ''));

  const row = {
    sokh_id: SOKH_ID,
    kind: 'setup',
    period_year: PERIOD.year,
    period_month: PERIOD.month,
    amount: AGREED_TOTAL,
    calculation_details: {
      plan_name: 'Суурилуулалт',
      apartments,
      list_per_unit_fee: setupPerUnit,
      discount_percent: DISCOUNT_PERCENT,
      per_unit_fee: discounted,
      unit_total: tariffTotal,     // тарифаар бодвол
      agreed_total: AGREED_TOTAL,  // бодитоор тохирч, төлсөн
    },
    status: 'paid',
    due_date: DUE_DATE,
    paid_at: PAID_AT,
    paid_amount: AGREED_TOTAL,
    notes: NOTES,
  };

  console.log(`\n🧭 Төлөвлөгөө (${COMMIT ? 'COMMIT' : 'DRY-RUN'}):`);
  console.log(`   1. sokh_organizations.setup_discount_percent: ${org.setup_discount_percent ?? '(хоосон)'} → ${DISCOUNT_PERCENT}`);
  console.log(`   2. platform_invoices ${prior ? 'ШИНЭЧЛЭХ' : 'ҮҮСГЭХ'}: setup ${PERIOD.year}.${PERIOD.month}, ` +
    `${money(AGREED_TOTAL)}, төлсөн ${String(PAID_AT).slice(0, 10)}`);

  if (!COMMIT) {
    console.log('\n🔍 DRY-RUN — юу ч бичсэнгүй. Бичихдээ: node scripts/record-orgoo-142-setup-payment.js --commit');
    return;
  }

  if (org.setup_discount_percent !== DISCOUNT_PERCENT) {
    const { error } = await sb
      .from('sokh_organizations')
      .update({ setup_discount_percent: DISCOUNT_PERCENT })
      .eq('id', SOKH_ID);
    if (error) { console.error(`   ❌ Хөнгөлөлт бичих алдаа: ${error.message}`); process.exitCode = 1; return; }
    console.log('   ✓ Хөнгөлөлт бичигдлээ');
  } else {
    console.log('   ✓ Хөнгөлөлт аль хэдийн зөв');
  }

  const { data: saved, error: invErr } = await sb
    .from('platform_invoices')
    .upsert([row], { onConflict: 'sokh_id,period_year,period_month,kind' })
    .select()
    .single();
  if (invErr) {
    console.error(`   ❌ Нэхэмжлэх бичих алдаа: ${invErr.message}`);
    console.error('      supabase-platform-tariff-migration.sql ажилласан эсэхийг шалгана уу.');
    process.exitCode = 1;
    return;
  }

  console.log(`   ✓ Нэхэмжлэх #${saved.id} — ${money(saved.amount)}, ${saved.status}`);
  console.log(`\n✅ Дууслаа. /mng-ctrl/customers дээр «${org.name}» суурилуулалт төлөгдсөн харагдана.`);
}

run().catch((e) => { console.error(e); process.exitCode = 1; });
