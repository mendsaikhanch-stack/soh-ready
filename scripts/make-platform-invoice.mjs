// ХОТОЛ → СӨХ рүү хандсан НЭХЭМЖЛЭХ (A4, хэвлэхэд бэлэн).
//
// `make-sokh-invoice.mjs`-ээс ялгаа: тэр нь СӨХ → оршин суугч/дэлгүүр рүү.
// Энэ нь эсрэг чиглэл — Гүйцэтгэгч (Төгс Орчин ХХК) Захиалагч СӨХ-өөс авах
// суурилуулалтын болон сарын төлбөрөө нэхэмжилнэ.
//
// Нэхэмжлэгчийн мэдээллийг `app/lib/contract/service-agreement.ts`-ийн
// PROVIDER-оос ШУУД уншина — гэрээ, нэхэмжлэх хоёр өөр данс, өөр нэр
// харуулах ёсгүй. Тиймээс alias-register-тэй ажиллана.
//
// Дүнг `platform_invoices`-оос уншина (эсвэл --amount-аар дарна) — самбар
// дээрх дүн, цаасан нэхэмжлэх хоёр зөрөх ёсгүй.
//
// Ажиллуулах:
//   node --import ./scripts/lib/alias-register.mjs scripts/make-platform-invoice.mjs <sokh_id> [сонголт]
//
//   ... 2111                      # setup нэхэмжлэхийг DB-ээс уншиж гаргана
//   ... 2111 --kind=monthly       # сарын хураамжийн нэхэмжлэх
//   ... 2111 --amount=91500       # дүнг гараар дарж өгнө
//   ... 2111 --due=2026-10-14     # төлөх эцсийн хугацаа
//   ... 2111 --no-seal            # тамга, гарын үсэггүй (гараар дарах бол)
//
// Тамга, захирлын гарын үсэг нь Supabase-ийн ХААЛТТАЙ bucket-аас (contract-seal)
// уншигдана — гэрээтэй ижил эх сурвалж. Уншигдаагүй бол цэгтэй мөр гарна.
//
// ⚠️ Энэ нь e-Баримт БИШ (ДДТД, eBarimt лого, QR байхгүй).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

// ⚠️ Аппын модулиуд .env.local уншсаны ДАРАА динамикаар ачаална.
//    Статик import нь env тавигдахаас өмнө ажиллаж, supabase-admin унадаг
//    (make-contract-pdf.mjs-тэй ижил шалтгаан).

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const sokhId = parseInt(process.argv[2], 10);
const arg = (n) => {
  const h = process.argv.find((a) => a.startsWith(`--${n}=`));
  return h ? h.split('=').slice(1).join('=') : null;
};
const KIND = arg('kind') || 'setup';
const AMOUNT_OVERRIDE = arg('amount') ? Number(arg('amount')) : null;
const DUE_OVERRIDE = arg('due');
const NO_SEAL = process.argv.includes('--no-seal');

if (!Number.isFinite(sokhId) || sokhId <= 0) {
  console.error('Ашиглах нь: node --import ./scripts/lib/alias-register.mjs scripts/make-platform-invoice.mjs <sokh_id> [--kind=setup|monthly] [--amount=N] [--due=YYYY-MM-DD]');
  process.exit(1);
}

for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) {
    let v = m[2].trim();
    if (/^["'].*["']$/.test(v)) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
const { createClient } = await import('@supabase/supabase-js');
const { PROVIDER } = await import('../app/lib/contract/service-agreement.ts');
const { loadSeal } = await import('../app/lib/contract/seal.ts');

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ---- өгөгдөл ----
const { data: org } = await sb
  .from('sokh_organizations')
  .select('id, name, tax_id, address, phone, contact_email, contract_number')
  .eq('id', sokhId).single();
if (!org) { console.error(`❌ СӨХ #${sokhId} олдсонгүй`); process.exit(1); }

const { data: inv } = await sb
  .from('platform_invoices')
  .select('id, amount, kind, period_year, period_month, due_date, status, calculation_details')
  .eq('sokh_id', sokhId).eq('kind', KIND)
  .order('period_year', { ascending: false })
  .order('period_month', { ascending: false })
  .limit(1).maybeSingle();

if (!inv && AMOUNT_OVERRIDE == null) {
  console.error(`❌ platform_invoices-д "${KIND}" нэхэмжлэх алга. --amount=N гэж гараар өгч болно.`);
  process.exit(1);
}

const amount = AMOUNT_OVERRIDE ?? Number(inv.amount);
const details = inv?.calculation_details || {};
const dueDate = DUE_OVERRIDE || inv?.due_date || '';
const issueDate = inv ? `${inv.period_year}-${String(inv.period_month).padStart(2, '0')}-01` : '';

// ---- туслах ----
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const money = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const blank = '................';

const NUM_U = ['', 'нэгэн', 'хоёр', 'гурван', 'дөрвөн', 'таван', 'зургаан', 'долоон', 'найман', 'есөн'];
const NUM_T = ['', 'арван', 'хорин', 'гучин', 'дөчин', 'тавин', 'жаран', 'далан', 'наян', 'ерэн'];
function triple(n) {
  const p = [];
  const h = Math.floor(n / 100), r = n % 100, t = Math.floor(r / 10), u = r % 10;
  if (h) p.push(h === 1 ? 'зуун' : `${NUM_U[h]} зуун`);
  if (t) p.push(NUM_T[t]);
  if (u) p.push(NUM_U[u]);
  return p.join(' ');
}
function tugrugWords(a) {
  let n = Math.round(Number(a) || 0);
  if (n === 0) return 'тэг төгрөг';
  const bil = Math.floor(n / 1e9), mil = Math.floor((n % 1e9) / 1e6);
  const th = Math.floor((n % 1e6) / 1000), rest = n % 1000;
  const p = [];
  if (bil) p.push(`${triple(bil)} тэрбум`);
  if (mil) p.push(`${triple(mil)} сая`);
  if (th) p.push(`${th === 1 ? 'нэг' : triple(th)} ${rest ? 'мянга' : 'мянган'}`);
  if (rest) p.push(triple(rest));
  return `${p.join(' ')} төгрөг`;
}

// Гэрээтэй ижил тамга, гарын үсэг. Уншигдаагүй бол баримт нь тамгагүй гарна
// (алдаа шидэхгүй) — тамгагүй гарсан нь огт гарахгүй байснаас дээр.
const seal = NO_SEAL ? undefined : await loadSeal();

const isSetup = KIND === 'setup';
const units = details.apartments ?? null;
const perUnit = details.per_unit_fee ?? null;
const itemName = isSetup
  ? 'Хотол платформын суурилуулалтын нэг удаагийн төлбөр'
  : `Хотол платформын сарын хураамж${inv ? ` (${inv.period_year} оны ${inv.period_month}-р сар)` : ''}`;
const memo = `${org.name}${org.contract_number ? `, ${org.contract_number}` : ''}, ${isSetup ? 'суурилуулалт' : 'сарын хураамж'}`;

const CSS = `
  @page { size: A4; margin: 12mm 10mm; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: "Times New Roman", "Noto Serif", Georgia, serif; color:#000; font-size:11.5px; }
  .doctitle { text-align:center; font-size:17px; font-weight:700; letter-spacing:.06em; margin:0 0 2px; }
  .subtitle { text-align:center; font-size:11px; margin:0 0 12px; color:#333; }
  .parties { display:flex; gap:26px; margin-bottom:10px; }
  .parties > div { flex:1; }
  .parties h3 { margin:0 0 3px; font-size:12px; font-weight:700; }
  .parties p { margin:0 0 1.5px; line-height:1.42; }
  table.items { width:100%; border-collapse:collapse; margin-top:4px; }
  table.items th, table.items td { border:1px solid #000; padding:4px 5px; }
  table.items th { font-weight:700; text-align:center; font-size:10.5px; line-height:1.25; }
  table.items td.n { text-align:right; }
  table.items td.c { text-align:center; }
  .totals { margin-left:auto; width:330px; margin-top:10px; }
  .totals table { width:100%; border-collapse:collapse; }
  .totals td { padding:4px 6px; }
  .totals td.lbl { text-align:right; }
  .totals td.val { border:1px solid #000; text-align:right; width:120px; }
  .totals tr.grand td { font-weight:700; }
  .words { margin:6px 0 0; text-align:right; font-size:11px; font-style:italic; }
  .paybox { border-collapse:collapse; margin-top:9px; width:100%; }
  .paybox td { border:1px solid #000; padding:4px 7px; }
  .paybox td.k { width:120px; background:#f2f2f2; }
  .paybox td.v { font-size:12px; }
  .payhint { margin-top:7px; font-size:10px; line-height:1.5; color:#222; }
  .sign { display:flex; gap:40px; margin-top:22px; }
  .sign > div { flex:1; }
  .sign p { margin:0 0 4px; line-height:1.5; }
  .sign .line { font-weight:700; }
  /* Урьдчилан тамгалсан хувилбар — бэхийг гарын үсгийн мөрийн дээгүүр байрлуулна */
  /* padding-top нь тамганы өндрөөс их байх ёстой — эс бөгөөс доорх мөр рүү халина */
  .ink { position:relative; margin-top:8px; padding-top:124px; }
  .ink .sig { position:absolute; left:78px; top:14px; width:138px; }
  .ink .stamp-img { position:absolute; left:0; top:0; width:112px; }
  .ink .rule { margin:0; }
  .sign .stamp { margin-top:16px; width:118px; height:118px; border:1px dashed #aaa; border-radius:50%;
                 display:flex; align-items:center; justify-content:center; font-size:9px; color:#aaa; letter-spacing:.12em; }
  .foot { margin-top:10px; padding-top:6px; border-top:1px solid #999; font-size:9px; color:#444; line-height:1.45; }
`;

const html = `<!doctype html><html lang="mn"><head><meta charset="utf-8">
<title>${esc(PROVIDER.brand)} → ${esc(org.name)} нэхэмжлэх</title><style>${CSS}</style></head><body>
  <p class="doctitle">НЭХЭМЖЛЭХ</p>
  <p class="subtitle">№ ${esc(`${PROVIDER.brand.toUpperCase()}-${sokhId}-${isSetup ? 'S' : `${inv?.period_year}${String(inv?.period_month).padStart(2, '0')}`}`)} · ${esc(PROVIDER.company)}</p>

  <div class="parties">
    <div>
      <h3>Нэхэмжлэгч:</h3>
      <p>ТТД: ${esc(PROVIDER.register)}</p>
      <p>НЭР: <b>${esc(PROVIDER.company)}</b> («${esc(PROVIDER.brand)}» платформ)</p>
      <p>Хаяг: ${esc(PROVIDER.address)}</p>
      <p>Утас: ${esc(PROVIDER.phone)}</p>
      <p>Э-Шуудан: ${esc(PROVIDER.email)}</p>
      <p>Банкны нэр: ${esc(PROVIDER.bank)} банк</p>
      <p>Банкны дансны дугаар: <b>${esc(PROVIDER.bankAccount)}</b></p>
      <p>Данс эзэмшигч: ${esc(PROVIDER.bankAccountHolder)}</p>
    </div>
    <div>
      <h3>Хариуцагч:</h3>
      <p>ТТД: ${esc(org.tax_id || blank)}</p>
      <p>НЭР: <b>${esc(org.name)}</b></p>
      <p>Хаяг: ${esc(org.address || blank)}</p>
      <p>Утас: ${esc(org.phone || blank)}</p>
      <p>Гэрээний №: ${esc(org.contract_number || blank)}</p>
      <p>Нэхэмжилсэн огноо: ${esc(issueDate || blank)}</p>
      <p>Төлөх эцсийн хугацаа: <b>${esc(dueDate || blank)}</b></p>
    </div>
  </div>

  <table class="items">
    <thead><tr>
      <th style="width:26px">Д/д</th><th>Бараа, ажил, үйлчилгээний нэр</th>
      <th style="width:70px">Хэмжих<br>нэгж</th><th style="width:64px">Тоо,<br>хэмжээ</th>
      <th style="width:96px">Нэгжийн үнэ</th><th style="width:104px">Бүгд үнэ</th>
    </tr></thead>
    <tbody><tr>
      <td class="c">1</td>
      <td>${esc(itemName)}</td>
      <td class="c">${units ? 'айл' : 'ш'}</td>
      <td class="c">${units ?? 1}</td>
      <td class="n">${money(perUnit ?? amount)}</td>
      <td class="n">${money(amount)}</td>
    </tr></tbody>
  </table>

  <div class="totals"><table>
    <tr><td class="lbl">Бараа, ажил үйлчилгээний үнэ:</td><td class="val">${money(amount)}</td></tr>
    <tr><td class="lbl">Нэмэгдсэн өртгийн албан татвар:</td><td class="val">.00</td></tr>
    <tr><td class="lbl">Нийслэл хотын албан татвар:</td><td class="val">.00</td></tr>
    <tr class="grand"><td class="lbl">Нийт дүн:</td><td class="val">${money(amount)}</td></tr>
  </table></div>
  <p class="words">Үсгээр: <b>${esc(tugrugWords(amount))}</b></p>

  <table class="paybox">
    <tr><td class="k">Гүйлгээний утга</td><td class="v"><b>${esc(memo)}</b></td></tr>
    <tr><td class="k">Төлөх дүн</td><td class="v"><b>${money(amount)}₮</b></td></tr>
  </table>
  <p class="payhint">
    Төлбөрөө <b>${esc(PROVIDER.bank)} банк ${esc(PROVIDER.bankAccount)}</b>
    (данс эзэмшигч: ${esc(PROVIDER.bankAccountHolder)}) данс руу шилжүүлнэ үү.
    Гүйлгээний утгыг <b>яг дээрх байдлаар</b> бичихийг хүсье.
    ${details.discount_percent ? `<br>Тайлбар: ${esc(String(details.apartments))} нэгж × ${money(details.per_unit_fee)} — жишиг үнэ ${money(details.list_per_unit_fee)}-өөс <b>${esc(String(details.discount_percent))}% хөнгөлсөн</b> тусгай нөхцөл.` : ''}
  </p>

  <div class="sign">
    <div>
      <p>Нэхэмжлэх гаргасан:</p>
      <p class="line">${esc(PROVIDER.company)}-ийн ${esc(PROVIDER.representativeTitle)} /${esc(PROVIDER.representative)}/</p>
      ${seal ? `<div class="ink">
        <img class="sig" src="${seal.signature}" alt="">
        <img class="stamp-img" src="${seal.stamp}" alt="">
        <p class="rule">..................................... /гарын үсэг/</p>
      </div>` : `<p>..................................... /гарын үсэг/</p>
      <p class="stamp">Т А М Г А</p>`}
    </div>
    <div>
      <p>Хүлээн авсан:</p>
      <p class="line">${esc(org.name)}</p>
      <p>..................................... /гарын үсэг/</p>
      <p>Огноо: 20....... оны ........ сарын ........ өдөр</p>
    </div>
  </div>

  <p class="foot">
    Энэ бол нэхэмжлэх бөгөөд татварын баримт (e-Баримт) БИШ.
    Төлбөрийн баримтыг төлбөр хийгдсэний дараа тусад нь олгоно.
  </p>
</body></html>`;

const outDir = path.join(ROOT, 'docs', 'invoices', 'platform', `sokh-${sokhId}`);
fs.mkdirSync(outDir, { recursive: true });
const base = `${KIND}${inv ? `-${inv.period_year}${String(inv.period_month).padStart(2, '0')}` : ''}`;
fs.writeFileSync(path.join(outDir, `${base}.html`), html, 'utf8');

const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.goto('file:///' + path.join(outDir, `${base}.html`).replace(/\\/g, '/'), { waitUntil: 'networkidle0' });
await page.pdf({ path: path.join(outDir, `${base}.pdf`), printBackground: true, preferCSSPageSize: true });
await page.setViewport({ width: 820, height: 1160, deviceScaleFactor: 1.6 });
await page.screenshot({ path: path.join(outDir, `${base}.png`), fullPage: true });
await browser.close();

console.log(`\n✅ ${PROVIDER.company} → ${org.name}`);
console.log(`   Төрөл:      ${isSetup ? 'Суурилуулалт' : 'Сарын хураамж'}`);
if (units) console.log(`   Тооцоо:     ${units} нэгж × ${money(perUnit)}${details.discount_percent ? ` (жишиг ${money(details.list_per_unit_fee)}-өөс ${details.discount_percent}% хөнгөлсөн)` : ''}`);
console.log(`   Нийт дүн:   ${money(amount)}`);
console.log(`   Үсгээр:     ${tugrugWords(amount)}`);
console.log(`   Төлөх:      ${dueDate || '—'}`);
if (!org.tax_id) console.log('   ⚠️  Захиалагчийн ТТД байхгүй');
if (!org.contract_number) console.log('   ⚠️  Гэрээний дугаар алга — гэрээ хараахан нээгдээгүй');
console.log(`   ${path.relative(ROOT, outDir)}/${base}.pdf`);
