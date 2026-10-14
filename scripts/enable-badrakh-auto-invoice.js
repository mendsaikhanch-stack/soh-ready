// «Бадрах» СӨХ (#1571) — сарын нэхэмжлэхийн автомат тооцоог асаана.
//
// Энэ нь ЗӨВХӨН энэ нэг СӨХ-д зориулсан нэг удаагийн скрипт (аппын кодыг өөрчлөхгүй).
// Гринланд-687 (#2690)-ыг асаасантай ижил загвар — app/lib/resident-billing/auto-invoices.ts.
//
// Урьдчилсан нөхцөл: `update-badrakh-debt.js --commit` ажилласан байх —
//   residents.debt  = банкны 10/02-ны тайлангийн 9-р сар хүртэлх үлдэгдэл
//   residents.monthly_fee = тайлангийн 10-р сарын дүн
//
// Хийх зүйл:
//   1. Айл бүрт «Эхний үлдэгдэл» нэхэмжлэх (2026/9, хугацаа 10/05, дүн = debt,
//      created_at = тайлангийн огноо) — openingInvoiceRow-той ижил хэлбэр.
//      Өргүй айлд 0₮-ийн мөр (Гринландад ч бүх айлд үүсгэсэн).
//   2. 2026/10-ын сарын хураамжийн нэхэмжлэх (хугацаа 11/05) — cron шөнө
//      өөрөө үүсгэх байсныг одоо үүсгэнэ, хэлбэр нь ижил.
//   3. Эцэст нь auto_invoice_from = 2026-10-01 — нэхэмжлэхүүд бэлэн болсны
//      дараа л асаана (cron дутуу өгөгдөл дээр ажиллахгүйн тулд).
//
// Асаасны дараа: cron өдөр бүр өрийг нэхэмжлэх + төлбөрөөс ДАХИН ТООЦНО →
// residents.debt-ийг гараар засвал шөнө дарагдана.
//
// Ажиллуулах:
//   node scripts/enable-badrakh-auto-invoice.js            # dry-run
//   node scripts/enable-badrakh-auto-invoice.js --commit   # бодитоор бичнэ

const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const ROOT = path.resolve(__dirname, '..');
const COMMIT = process.argv.includes('--commit');
const SOKH_ID = 1571;
const EXPECT_NAME = 'Бадрах';
const FROM = '2026-10-01';
const AS_OF = '2026-10-02';
const AS_OF_TS = '2026-10-02T00:00:00+08:00'; // тайлан «Хэвлэсэн огноо 2026/10/02»
const EXPECT_DEBT = 90620214; // update-badrakh-debt.js-ийн дүн
const OPENING = { year: 2026, month: 9, due: '2026-10-05' };
const CURRENT = { year: 2026, month: 10, due: '2026-11-05' };

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
const money = n => Number(n || 0).toLocaleString('en-US');

(async () => {
  console.log(`Горим: ${COMMIT ? 'COMMIT (DB-д бичнэ)' : 'DRY-RUN (юу ч бичихгүй)'}`);

  const { data: org } = await sb.from('sokh_organizations')
    .select('id, name, auto_invoice_from').eq('id', SOKH_ID).single();
  if (!org || org.name !== EXPECT_NAME) { console.error(`❌ #${SOKH_ID} нь «${EXPECT_NAME}» биш`); process.exit(1); }
  if (org.auto_invoice_from) { console.error(`❌ Аль хэдийн асаалттай: ${org.auto_invoice_from}`); process.exit(1); }

  const { data: residents, error } = await sb.from('residents')
    .select('id, building, apartment, debt, monthly_fee, pending_claim').eq('sokh_id', SOKH_ID);
  if (error) { console.error('❌', error.message); process.exit(1); }
  const active = residents.filter(r => !r.pending_claim);
  const debtSum = active.reduce((s, r) => s + Number(r.debt || 0), 0);
  if (debtSum !== EXPECT_DEBT) { console.error(`❌ Нийт өр ${money(debtSum)}₮ ≠ ${money(EXPECT_DEBT)}₮ — эхлээд update-badrakh-debt.js`); process.exit(1); }
  const noFee = active.filter(r => !(Number(r.monthly_fee) > 0));
  if (noFee.length) { console.error(`❌ Хураамжгүй айл: ${noFee.map(r => r.building + '/' + r.apartment).join(', ')}`); process.exit(1); }

  const { count: invCount } = await sb.from('invoices')
    .select('id', { count: 'exact', head: true }).eq('sokh_id', SOKH_ID);
  if (invCount) { console.error(`❌ Бадрахад аль хэдийн ${invCount} нэхэмжлэх байна — гараар шалга`); process.exit(1); }

  const opening = active.map(r => {
    const amount = Number(r.debt || 0);
    return {
      sokh_id: SOKH_ID, resident_id: r.id, year: OPENING.year, month: OPENING.month,
      amount, due_date: OPENING.due,
      // Өргүй бол шууд «төлсөн», өртэй бол хугацаа нь (10/05) өнгөрсөн
      status: amount > 0 ? 'overdue' : 'paid', paid_amount: 0, paid_at: amount > 0 ? null : AS_OF_TS,
      description: `Эхний үлдэгдэл (${AS_OF}-ны банкны тайлангаар)`,
      created_at: AS_OF_TS,
    };
  });
  const current = active.map(r => ({
    sokh_id: SOKH_ID, resident_id: r.id, year: CURRENT.year, month: CURRENT.month,
    amount: Number(r.monthly_fee), due_date: CURRENT.due, status: 'pending',
    description: `${CURRENT.month}-р сар ${CURRENT.year} - сарын хураамж`,
  }));

  console.log(`\n  Айл: ${active.length}`);
  console.log(`  Эхний үлдэгдэл (${OPENING.year}/${OPENING.month}): ${opening.length} мөр · ${money(debtSum)}₮ · өртэй ${opening.filter(o => o.amount > 0).length}`);
  console.log(`  ${CURRENT.year}/${CURRENT.month} нэхэмжлэх: ${current.length} мөр · ${money(current.reduce((s, c) => s + c.amount, 0))}₮ (хугацаа ${CURRENT.due})`);
  console.log(`  auto_invoice_from: — → ${FROM}`);

  if (!COMMIT) { console.log(`\nDRY-RUN — юу ч бичээгүй. Бичихдээ: node scripts/enable-badrakh-auto-invoice.js --commit`); return; }

  for (const [label, rows] of [['Эхний үлдэгдэл', opening], ['10-р сар', current]]) {
    let n = 0;
    for (let i = 0; i < rows.length; i += 100) {
      const { data, error: e } = await sb.from('invoices')
        .upsert(rows.slice(i, i + 100), { onConflict: 'resident_id,year,month', ignoreDuplicates: true }).select('id');
      if (e) { console.error(`❌ ${label}: ${e.message} — auto_invoice_from-ыг АСААГҮЙ`); process.exit(1); }
      n += data.length;
    }
    console.log(`  ✓ ${label}: ${n} нэхэмжлэх`);
  }

  const { error: oe } = await sb.from('sokh_organizations').update({ auto_invoice_from: FROM }).eq('id', SOKH_ID);
  if (oe) { console.error('❌ auto_invoice_from:', oe.message); process.exit(1); }
  console.log(`\n✅ Асаалаа: auto_invoice_from = ${FROM}`);
})().catch(e => { console.error(e); process.exit(1); });
