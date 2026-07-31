// Demo СӨХ-ийн төлбөрийн дата ЭНЭ САРААР шинэчилнэ (Play Store review-д зориулав).
//
// Яагаад хэрэгтэй вэ: /sokh/[id]/payments хуудас нь utility_bills болон invoices-ийг
// ЯГ ОДООГИЙН он/сараар шүүдэг. Demo дата 6-р сард суулгасан тул 7-р сард дэлгэц
// хоосон болсон — шүүгч нэвтрэхэд эвдэрсэн мэт харагдана.
//
// Энэ скрипт зөвхөн DATA бичнэ (DDL байхгүй). Дахин ажиллуулж болно (upsert).
//
//   node scripts/refresh-demo-billing.js            # dry-run: юу болохыг харуулна
//   node scripts/refresh-demo-billing.js --commit   # бодитоор бичнэ
//   MONTHS=6 node scripts/refresh-demo-billing.js --commit   # 6 сар урагш бэлдэнэ

const fs = require('fs');
const path = require('path');
const { createClient } = require(path.resolve(__dirname, '../node_modules/@supabase/supabase-js'));

const SOKH_ID = 2678;      // Туршилтын СӨХ — Хотол демо байр
const RESIDENT_ID = 762;   // "Та (демо хэрэглэгч)", тоот 12
const APARTMENT = '12';
const MONTHS_AHEAD = Number(process.env.MONTHS || 3); // энэ сар + дараагийн 2
const COMMIT = process.argv.includes('--commit');

const SOKH_FEE = 50000;
const UTILITIES = [
  { utility_type: 'water', amount: 12000 },
  { utility_type: 'heating', amount: 38000 },
  { utility_type: 'electricity', amount: 22000 },
];

// Зарцуулалтын тайлангийн зардал (budget_items) — мөн сар бүрээр шүүгддэг.
// Дүн нь supabase-demo-finance-enrich.sql-тэй ижил: зардал 350,000₮.
const BUDGET_ITEMS = [
  { name: 'Ажилчдын цалин', category: 'salary', amount: 150000, description: 'Үйлчлэгч, сахиулын цалин' },
  { name: 'Нийтийн цэвэрлэгээ', category: 'cleaning', amount: 60000, description: 'Орц, гадна талбай' },
  { name: 'Тог цахилгаан', category: 'electricity', amount: 45000, description: 'Нийтийн гэрэлтүүлэг' },
  { name: 'Хог ачуулалт', category: 'garbage', amount: 30000, description: 'Хог тээвэрлэлт' },
  { name: 'Засварын зардал', category: 'repair', amount: 40000, description: 'Урсгал засвар' },
  { name: 'Лифт засвар', category: 'elevator', amount: 25000, description: 'Лифтний үйлчилгээ' },
  { name: 'Зогсоолын орлого', category: 'parking_income', amount: 50000, description: 'Зогсоолын хураамж' },
];

// СӨХ-ийн байнгын төлбөрийн жагсаалт — сараас хамаарахгүй тул нэг л удаа хангалттай.
const BILLING_ITEMS = [
  { name: 'СӨХ хураамж', icon: '🏢', amount: SOKH_FEE, category: 'service', sort_order: 1 },
  { name: 'Ус', icon: '💧', amount: 12000, category: 'utility', sort_order: 2 },
  { name: 'Дулаан', icon: '🔥', amount: 38000, category: 'utility', sort_order: 3 },
  { name: 'Цахилгаан', icon: '⚡', amount: 22000, category: 'utility', sort_order: 4 },
];

function env() {
  const file = path.resolve(__dirname, '../.env.local');
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.includes('=') || line.trim().startsWith('#')) continue;
    const i = line.indexOf('=');
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/\r$/, '').replace(/^["']|["']$/g, '');
  }
  return out;
}

(async () => {
  const e = env();
  const sb = createClient(e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY);

  const now = new Date();
  const periods = [];
  for (let i = 0; i < MONTHS_AHEAD; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    periods.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }

  console.log(`Demo СӨХ #${SOKH_ID}, оршин суугч #${RESIDENT_ID} (тоот ${APARTMENT})`);
  console.log(`Хамрах сарууд: ${periods.map((p) => `${p.year}-${p.month}`).join(', ')}`);
  console.log(`Горим: ${COMMIT ? 'COMMIT (бодитоор бичнэ)' : 'DRY-RUN'}\n`);

  // ── 1. billing_items (байнгын жагсаалт) ──
  const { data: existingItems } = await sb.from('billing_items').select('id, name').eq('sokh_id', SOKH_ID);
  const haveNames = new Set((existingItems || []).map((r) => r.name));
  const newItems = BILLING_ITEMS.filter((b) => !haveNames.has(b.name));
  console.log(`billing_items: одоо ${existingItems?.length || 0} мөр → шинээр ${newItems.length} нэмнэ`);

  // ── 2. utility_bills (сар бүр) ──
  const utilityRows = [];
  for (const p of periods) {
    for (const u of UTILITIES) {
      utilityRows.push({
        sokh_id: SOKH_ID,
        resident_id: RESIDENT_ID,
        apartment: APARTMENT,
        utility_type: u.utility_type,
        year: p.year,
        month: p.month,
        amount: u.amount,
        status: 'paid',              // dashboard-ийн "Миний өр 0₮"-тэй нийцнэ
        paid_at: new Date().toISOString(),
      });
    }
  }
  console.log(`utility_bills: ${utilityRows.length} мөр upsert`);

  // ── 3. invoices (СӨХ хураамж, сар бүр) ──
  const invoiceRows = periods.map((p) => ({
    sokh_id: SOKH_ID,
    resident_id: RESIDENT_ID,
    year: p.year,
    month: p.month,
    amount: SOKH_FEE,
    status: 'paid',
    paid_amount: SOKH_FEE,
    paid_at: new Date().toISOString(),
    due_date: `${p.year}-${String(p.month).padStart(2, '0')}-25`,
    description: 'СӨХ сарын хураамж',
  }));
  console.log(`invoices: ${invoiceRows.length} мөр upsert`);

  // ── 4. budget_items (зарцуулалтын тайлан, сар бүр) ──
  const budgetRows = [];
  for (const p of periods) {
    for (const b of BUDGET_ITEMS) {
      budgetRows.push({ sokh_id: SOKH_ID, ...b, month: p.month, year: p.year });
    }
  }
  console.log(`budget_items: ${budgetRows.length} мөр (сар тус бүрд дахин бичнэ)`);

  if (!COMMIT) {
    console.log('\n💡 Бодитоор бичих: node scripts/refresh-demo-billing.js --commit');
    return;
  }

  if (newItems.length) {
    const { error } = await sb.from('billing_items')
      .insert(newItems.map((b) => ({ ...b, sokh_id: SOKH_ID, is_active: true })));
    console.log(error ? `❌ billing_items: ${error.message}` : `✅ billing_items: ${newItems.length} мөр нэмэв`);
  }

  {
    const { error } = await sb.from('utility_bills')
      .upsert(utilityRows, { onConflict: 'resident_id,utility_type,year,month' });
    console.log(error ? `❌ utility_bills: ${error.message}` : `✅ utility_bills: ${utilityRows.length} мөр`);
  }

  {
    const { error } = await sb.from('invoices')
      .upsert(invoiceRows, { onConflict: 'resident_id,year,month' });
    console.log(error ? `❌ invoices: ${error.message}` : `✅ invoices: ${invoiceRows.length} мөр`);
  }

  // budget_items-д unique constraint байхгүй тул сар бүрийг эхлээд цэвэрлэж, дараа нь бичнэ
  for (const p of periods) {
    const { error: delErr } = await sb.from('budget_items')
      .delete().eq('sokh_id', SOKH_ID).eq('year', p.year).eq('month', p.month);
    if (delErr) console.log(`❌ budget_items устгах (${p.year}-${p.month}): ${delErr.message}`);
  }
  {
    const { error } = await sb.from('budget_items').insert(budgetRows);
    console.log(error ? `❌ budget_items: ${error.message}` : `✅ budget_items: ${budgetRows.length} мөр`);
  }

  // ── 5. Түүх таб хоосон биш байх ──
  const { data: pays } = await sb.from('payments').select('id').eq('resident_id', RESIDENT_ID).limit(1);
  if (!pays || pays.length === 0) {
    const { error } = await sb.from('payments')
      .insert([{ resident_id: RESIDENT_ID, amount: SOKH_FEE, description: 'СӨХ хураамж — энэ сар', paid_at: new Date().toISOString() }]);
    console.log(error ? `❌ payments: ${error.message}` : '✅ payments: түүхэнд 1 бичилт нэмэв');
  } else {
    console.log('   payments: түүх аль хэдийн бий — алгасав');
  }

  console.log('\n✅ Дууслаа. /sokh/2678/payments дэлгэцийг шалгана уу.');
})();
