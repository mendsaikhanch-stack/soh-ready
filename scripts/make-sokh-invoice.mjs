// СӨХ тус бүрд оршин суугчийн САРЫН НЭХЭМЖЛЭХ үүсгэнэ (A4, хэвлэхэд бэлэн).
//
//   node scripts/make-sokh-invoice.mjs <sokh_id> --month=YYYY-MM [сонголтууд]
//
//   node scripts/make-sokh-invoice.mjs 2111 --month=2026-09 --all        # бүх айл, нэг PDF
//   node scripts/make-sokh-invoice.mjs 2111 --month=2026-09 --unit=9Б-34 # ганц айл
//
// АЖ АХУЙН НЭГЖИД (дэлгүүр, цех — дарга хэвлээд тамга дарж явуулна):
//   node scripts/make-sokh-invoice.mjs 2111 --month=2026-09 --business --all
//   node scripts/make-sokh-invoice.mjs 2111 --month=2026-09 --unit="11-GS25 дэлгүүр" \
//        --months=4 --fee=172000 --payer-name="ЖИ ЭС 25 ХХК" --payer-tin=1234567
//
// Сонголтууд:
//   --all              бүгдэд нь (эс бөгөөс зөвхөн эхний нэг — жишээ)
//   --unit=<байр>-<нэр/тоот>   ганц нэгж
//   --business         зөвхөн аж ахуйн нэгж (--with-business нь айл + ААН)
//   --months=N         хэдэн сарын хураамж вэ (Тоо, хэмжээ багана). Анхдагч 1
//   --fee=N            нэгжийн үнийг гараар өгнө (ААН-д заавал — DB-д тариф нь хоосон)
//   --payer-name / --payer-tin / --payer-address / --payer-phone   хариуцагчийн албан мэдээлэл
//   --due=25           тухайн сарын хэд хүртэл төлөх (анхдагч 25)
//   --no-debt          өмнөх өрийн мөрийг оруулахгүй
//   --qr               банкны QR-ыг нэхэмжлэх дээр бас гаргана (анхдагчаар ГАРАХГҮЙ)
//   --blank-payer      хариуцагчийн ТТД/нэр/хаяг/утас/гэрээг ХООСОН үлдээж, гараар бөглөнө
//
// Гаралт: docs/invoices/sokh-<id>/<YYYY-MM>/
//   nekhemjlekh.pdf   — айл бүр нэг нүүр, дараалуулсан (хэвлэхэд)
//   jishee.png        — эхний нэхэмжлэхийн зураг (даргад харуулах / группт тавих)
//   nekhemjlekh.html  — эх файл
//
// ⚠️ ЭНЭ НЬ eBARIMT БАРИМТ БИШ.
//    Загвар нь eBarimt-ийн «НЭХЭМЖЛЭХ» хуудастай ижил багана, ижил
//    үйлчилгээний код (7221201 «Орон сууц ашиглалтын конторын үйлчилгээ»)
//    ашигладаг ч дараах 3 зүйл ЗОРИУДААР БАЙХГҮЙ:
//      • eBARIMT.MN лого
//      • ДДТД (НӨАТУС-аас олгогддог, зохиож бичих боломжгүй)
//      • eBarimt-ийн QR
//    Оронд нь СӨХ-ийн өөрийн нэхэмжлэхийн дугаар, ЖИНХЭНЭ банкны QR орно.
//    eBarimt баримт нь төлбөр орсны дараа банк/НӨАТУС-аар тусад нь гарна
//    (docs/ebilling-ebarimt.md §6.1 — Төрийн банкны сувгаар бол банк өөрөө гаргана).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const sokhId = parseInt(process.argv[2], 10);
const arg = (name) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : null;
};
const ALL = process.argv.includes('--all');
const BUSINESS_ONLY = process.argv.includes('--business');
const WITH_BUSINESS = process.argv.includes('--with-business') || BUSINESS_ONLY;
const NO_DEBT = process.argv.includes('--no-debt');
const WITH_QR = process.argv.includes('--qr');   // банкны QR-ыг нэхэмжлэх дээр гаргах эсэх
const BLANK_PAYER = process.argv.includes('--blank-payer'); // хариуцагчийн талыг гараар бөглөхөөр хоосон
const ONLY_UNIT = arg('unit');
const MONTH = arg('month');
const MONTHS = Math.max(1, Number(arg('months') || 1));   // «Тоо, хэмжээ» багана
const FEE_OVERRIDE = arg('fee') ? Number(arg('fee')) : null;
const PAYER = { name: arg('payer-name'), tin: arg('payer-tin'), address: arg('payer-address'), phone: arg('payer-phone') };
const DUE_DAY = Number(arg('due') || 25);          // тухайн сарын хэддэхэн хүртэл төлөх
const SERVICE_CODE = arg('code') || '7221201';     // Орон сууц ашиглалтын конторын үйлчилгээ

if (!Number.isFinite(sokhId) || sokhId <= 0 || !MONTH || !/^\d{4}-\d{2}$/.test(MONTH)) {
  console.error('Ашиглах нь: node scripts/make-sokh-invoice.mjs <sokh_id> --month=YYYY-MM [--all|--unit=9Б-34] [--with-business]');
  process.exit(1);
}
const [YEAR, MON] = MONTH.split('-').map(Number);

// ---- env ----
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) {
    let v = m[2].trim();
    if (/^["'].*["']$/.test(v)) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ---- өгөгдөл ----
const { data: org } = await sb
  .from('sokh_organizations')
  .select('id, name, tax_id, address, phone, contact_email, monthly_fee, is_vat_payer')
  .eq('id', sokhId).single();
if (!org) { console.error(`❌ СӨХ #${sokhId} олдсонгүй`); process.exit(1); }

const { data: bank } = await sb
  .from('sokh_bank_accounts')
  .select('bank_name, account_number, account_holder, qr_image_url, note')
  .eq('sokh_id', sokhId).maybeSingle();

const { data: rows } = await sb
  .from('residents')
  .select('id, name, apartment, building, phone, debt, monthly_fee, unit_kind')
  .eq('sokh_id', sokhId);

// --unit өгсөн бол айл/ААН гэж ялгахгүй, бүх мөрөөс хайна
let residents = ONLY_UNIT
  ? (rows || [])
  : (rows || []).filter((r) => BUSINESS_ONLY
      ? r.unit_kind === 'business'
      : (WITH_BUSINESS || r.unit_kind !== 'business'));
if (ONLY_UNIT) {
  const want = ONLY_UNIT.toLowerCase().replace(/\s/g, '');
  residents = residents.filter((r) => `${r.building || ''}-${r.apartment}`.toLowerCase().replace(/\s/g, '') === want);
  if (!residents.length) { console.error(`❌ "${ONLY_UNIT}" олдсонгүй`); process.exit(1); }
} else if (!ALL) {
  residents = residents.slice(0, 1);
}
// Байр, дараа нь тоотын дугаараар эрэмбэлнэ
residents.sort((a, b) =>
  String(a.building || '').localeCompare(String(b.building || ''), 'mn') ||
  (Number(a.apartment) || 0) - (Number(b.apartment) || 0) ||
  String(a.apartment).localeCompare(String(b.apartment), 'mn'));

if (!residents.length) { console.error('❌ Нэгж олдсонгүй'); process.exit(1); }

// Тарифгүй нэгжид таамгаар дүн бичихгүй — тамга дарж явуулах баримт тул зогсооно.
// Айл нь СӨХ-ийн ерөнхий хураамжийг авна, ААН нь ЗААВАЛ өөрийн тарифтай байх ёстой.
const feeOf = (r) => FEE_OVERRIDE ?? (r.unit_kind === 'business'
  ? (r.monthly_fee ?? null)
  : (r.monthly_fee ?? org.monthly_fee ?? null));
const noFee = residents.filter((r) => !(feeOf(r) > 0));
if (noFee.length) {
  console.error(`\n❌ ${noFee.length} нэгжийн сарын тариф тодорхойгүй байна — дүнг таамгаар бичихгүй:`);
  noFee.forEach((r) => console.error(`   ${r.building || ''}-${r.apartment}  ${r.name}`));
  console.error('\n   Шийдэх 2 зам:');
  console.error('   1) Ганц нэгжид:  --fee=172000  гэж гараар өг');
  console.error('   2) Бүрмөсөн:     residents.monthly_fee-д даргаас авсан тарифыг DB-д бич');
  console.error('\n   (Аж ахуйн нэгж СӨХ-ийн айлын хураамжийг автоматаар авахгүй — санаатай.)');
  process.exit(1);
}

// ---- банкны QR-ыг data URI болгож суулгана (офлайн хэвлэхэд ч гарна) ----
let qrDataUri = null;
if (WITH_QR && bank?.qr_image_url) {
  try {
    const res = await fetch(bank.qr_image_url);
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      qrDataUri = `data:${res.headers.get('content-type') || 'image/png'};base64,${buf.toString('base64')}`;
    }
  } catch { /* QR-гүй ч нэхэмжлэх гарна */ }
}

// ---- туслах ----
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const money = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pad2 = (n) => String(n).padStart(2, '0');
const lastDay = new Date(Date.UTC(YEAR, MON, 0)).getUTCDate();
const issueDate = `${YEAR}-${pad2(MON)}-01`;
const dueDate = `${YEAR}-${pad2(MON)}-${pad2(Math.min(DUE_DAY, lastDay))}`;
const dueDays = Math.min(DUE_DAY, lastDay) - 1;
const blank = '................';
const wline = '.'.repeat(46);   // гараар бөглөх урт зураас

// ---- тоог үсгээр (албан баримтад заавал) ----
// «төгрөг» ард нь ирдэг тул сүүлийн бүрэлдэхүүн нь тодотгох хэлбэртэй байна.
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
function tugrugWords(amount) {
  let n = Math.round(Number(amount) || 0);
  if (n === 0) return 'тэг төгрөг';
  const neg = n < 0; n = Math.abs(n);
  const bil = Math.floor(n / 1e9), mil = Math.floor((n % 1e9) / 1e6);
  const th = Math.floor((n % 1e6) / 1000), rest = n % 1000;
  const p = [];
  if (bil) p.push(`${triple(bil)} тэрбум`);
  if (mil) p.push(`${triple(mil)} сая`);
  if (th) p.push(`${th === 1 ? 'нэг' : triple(th)} ${rest ? 'мянга' : 'мянган'}`);
  if (rest) p.push(triple(rest));
  return `${neg ? 'хасах ' : ''}${p.join(' ')} төгрөг`;
}

const CSS = `
  @page { size: A4; margin: 12mm 10mm; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: "Times New Roman", "Noto Serif", Georgia, serif;
         color:#000; font-size:11.5px; -webkit-font-smoothing:antialiased; }
  .sheet { page-break-after: always; }
  .sheet:last-child { page-break-after: auto; }
  .doctitle { text-align:center; font-size:17px; font-weight:700; letter-spacing:.06em; margin:0 0 2px; }
  .subtitle { text-align:center; font-size:11px; margin:0 0 12px; color:#333; }
  .no { font-weight:700; }
  .parties { display:flex; gap:26px; margin-bottom:10px; }
  .parties > div { flex:1; }
  .parties h3 { margin:0 0 3px; font-size:12px; font-weight:700; }
  .parties p { margin:0 0 1.5px; line-height:1.42; }
  .parties b { font-weight:700; }
  table.items { width:100%; border-collapse:collapse; margin-top:4px; }
  table.items th, table.items td { border:1px solid #000; padding:4px 5px; }
  table.items th { font-weight:700; text-align:center; font-size:10.5px; line-height:1.25; }
  table.items td.n { text-align:right; }
  table.items td.c { text-align:center; }
  .bottom { display:flex; gap:16px; margin-top:10px; align-items:flex-start; }
  .qrbox { width:112px; flex:none; text-align:center; }
  .qrbox img { width:112px; height:112px; object-fit:contain; display:block; }
  .qrbox span { display:block; font-size:8.5px; line-height:1.3; margin-top:3px; color:#333; }
  .totals { margin-left:auto; width:330px; }
  .totals table { width:100%; border-collapse:collapse; }
  .totals td { padding:4px 6px; }
  .totals td.lbl { text-align:right; }
  .totals td.val { border:1px solid #000; text-align:right; width:120px; }
  .totals tr.grand td.lbl { font-weight:700; }
  .totals tr.grand td.val { font-weight:700; }
  .words { margin:6px 0 0; text-align:right; font-size:11px; font-style:italic; }
  .paybox { border-collapse:collapse; margin-top:9px; width:100%; }
  .paybox td { border:1px solid #000; padding:4px 7px; }
  .paybox td.k { width:120px; background:#f2f2f2; }
  .paybox td.v { font-size:12px; }
  .fill { color:#555; letter-spacing:.5px; }
  .payhint { margin-top:7px; font-size:10px; line-height:1.5; color:#222; }
  .payhint b { font-weight:700; }
  .foot { margin-top:10px; padding-top:6px; border-top:1px solid #999;
          font-size:9px; color:#444; line-height:1.45; }
  .sign { display:flex; gap:40px; margin-top:22px; }
  .sign > div { flex:1; }
  .sign p { margin:0 0 4px; line-height:1.5; }
  .sign .line { font-weight:700; }
  .sign .rule { color:#333; }
  .sign .stamp { margin-top:16px; width:118px; height:118px; border:1px dashed #aaa;
                 border-radius:50%; display:flex; align-items:center; justify-content:center;
                 font-size:9px; color:#aaa; letter-spacing:.12em; }
`;

// «2026 оны 9-р сар» / «2026 оны 6–9-р сар»
function periodLabel() {
  if (MONTHS === 1) return `${YEAR} оны ${MON}-р сар`;
  const start = new Date(Date.UTC(YEAR, MON - 1 - (MONTHS - 1), 1));
  const sy = start.getUTCFullYear(), sm = start.getUTCMonth() + 1;
  return sy === YEAR ? `${YEAR} оны ${sm}–${MON}-р сар` : `${sy} оны ${sm}-р сараас ${YEAR} оны ${MON}-р сар`;
}

function sheet(r) {
  const isBiz = r.unit_kind === 'business';
  const fee = Number(feeOf(r));
  const debt = NO_DEBT ? 0 : Number(r.debt || 0);
  const addr = [r.building ? `${r.building} байр` : '', isBiz ? r.apartment : `${r.apartment} тоот`]
    .filter(Boolean).join(', ');
  const invNo = `${sokhId}/${YEAR}${pad2(MON)}/${[r.building, r.apartment].filter(Boolean).join('-')}`;

  const items = [];
  items.push({
    name: `Орон сууц ашиглалтын конторын үйлчилгээ (${periodLabel()})`,
    code: SERVICE_CODE, unit: 'ш', qty: MONTHS, price: fee, sum: fee * MONTHS,
  });
  if (debt > 0) {
    items.push({
      name: `Өмнөх саруудын төлбөрийн үлдэгдэл`,
      code: SERVICE_CODE, unit: 'ш', qty: 1, price: debt, sum: debt,
    });
  }
  const total = items.reduce((s, i) => s + i.sum, 0);
  const memo = `${addr}, ${periodLabel()} хураамж`;

  return `
<div class="sheet">
  <p class="doctitle">НЭХЭМЖЛЭХ</p>
  <p class="subtitle"><span class="no">№ ${esc(invNo)}</span> · ${esc(org.name)}</p>

  <div class="parties">
    <div>
      <h3>Нэхэмжлэгч:</h3>
      <p>ТТД: ${esc(org.tax_id || blank)}</p>
      <p>НЭР: <b>${esc(org.name)}</b></p>
      <p>Хаяг: ${esc(org.address || blank)}</p>
      <p>Утас: ${esc(org.phone || blank)}</p>
      <p>Э-Шуудан: ${esc(org.contact_email || blank)}</p>
      <p>Банкны нэр: ${esc(bank?.bank_name || blank)}</p>
      <p>Банкны дансны дугаар: <b>${esc(bank?.account_number || blank)}</b></p>
    </div>
    <div>
      <h3>Хариуцагч:</h3>
      ${BLANK_PAYER ? `
      <p class="fill">ТТД: ${wline}</p>
      <p class="fill">НЭР: ${wline}</p>
      <p class="fill">Хаяг: ${wline}</p>
      <p class="fill">Утас: ${wline}</p>
      <p class="fill">Гэрээний №: ${wline}</p>` : `
      ${isBiz ? `<p>ТТД: ${esc(PAYER.tin || blank)}</p>` : ''}
      <p>НЭР: <b>${esc(PAYER.name || r.name)}</b></p>
      <p>Хаяг: <b>${esc(PAYER.address || addr)}</b></p>
      <p>Утас: ${esc(PAYER.phone || r.phone || blank)}</p>
      <p>Гэрээний №: ${esc(blank)}</p>`}
      <p>Нэхэмжилсэн огноо: ${esc(issueDate)}</p>
      <p>Төлбөр хийх хугацаа (Хоног): ${dueDays}</p>
      <p>Төлөх эцсийн хугацаа: <b>${esc(dueDate)}</b></p>
    </div>
  </div>

  <table class="items">
    <thead>
      <tr>
        <th style="width:26px">Д/д</th>
        <th>Бараа, ажил, үйлчилгээний нэр</th>
        <th style="width:58px">Код</th>
        <th style="width:56px">Хэмжих<br>нэгж</th>
        <th style="width:56px">Тоо,<br>хэмжээ</th>
        <th style="width:88px">Нэгжийн үнэ</th>
        <th style="width:92px">Бүгд үнэ</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((it, i) => `
      <tr>
        <td class="c">${i + 1}</td>
        <td>${esc(it.name)}</td>
        <td class="c">${esc(it.code)}</td>
        <td class="c">${esc(it.unit)}</td>
        <td class="c">${it.qty}</td>
        <td class="n">${money(it.price)}</td>
        <td class="n">${money(it.sum)}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <div class="bottom">
    ${qrDataUri ? `<div class="qrbox"><img src="${qrDataUri}" alt="QR">
      <span>Банкны аппаараа<br>уншуулж төлнө</span></div>` : ''}
    <div class="totals">
      <table>
        <tr><td class="lbl">Бараа, ажил үйлчилгээний үнэ:</td><td class="val">${money(total)}</td></tr>
        <tr><td class="lbl">Нэмэгдсэн өртгийн албан татвар:</td><td class="val">${org.is_vat_payer ? money(0) : '.00'}</td></tr>
        <tr><td class="lbl">Нийслэл хотын албан татвар:</td><td class="val">.00</td></tr>
        <tr class="grand"><td class="lbl">Нийт дүн:</td><td class="val">${money(total)}</td></tr>
      </table>
    </div>
  </div>

  <p class="words">Үсгээр: <b>${esc(tugrugWords(total))}</b></p>

  <table class="paybox">
    <tr><td class="k">Гүйлгээний утга</td><td class="v">${BLANK_PAYER ? `<span class="fill">${wline}</span>` : `<b>${esc(memo)}</b>`}</td></tr>
    <tr><td class="k">Төлөх дүн</td><td class="v"><b>${money(total)}₮</b></td></tr>
  </table>
  <p class="payhint">
    Төлбөрөө ${qrDataUri ? 'дээрх QR-аар эсвэл ' : ''}<b>${esc(bank?.bank_name || '')} ${esc(bank?.account_number || '')}</b>
    (${esc(bank?.account_holder || org.name)}) данс руу шилжүүлнэ үү.
    Гүйлгээний утгыг <b>яг дээрх байдлаар</b> бичихийг хүсье — эс бөгөөс аль нэгжийн төлбөр болох нь тодорхойгүй болно.
  </p>

  <div class="sign">
    <div>
      <p>Нэхэмжлэх гаргасан:</p>
      <p class="line">${esc(/сөх/i.test(org.name) ? org.name : org.name + ' СӨХ')}-ийн дарга</p>
      <p class="rule">..................................... /гарын үсэг/</p>
      <p class="stamp">Т А М Г А</p>
    </div>
    <div>
      <p>Хүлээн авсан:</p>
      <p class="line">&nbsp;</p>
      <p class="rule">..................................... /гарын үсэг/</p>
      <p class="rule">Огноо: 20....... оны ........ сарын ........ өдөр</p>
    </div>
  </div>

  <p class="foot">
    Энэ бол СӨХ-ийн нэхэмжлэх бөгөөд татварын баримт (e-Баримт) БИШ.
    Төлбөрийн баримтыг төлбөр хийсний дараа банкнаас авна уу.
  </p>
</div>`;
}

const html = `<!doctype html><html lang="mn"><head><meta charset="utf-8">
<title>${esc(org.name)} — ${MONTH} нэхэмжлэх</title><style>${CSS}</style></head>
<body>${residents.map(sheet).join('\n')}</body></html>`;

// ---- гаралт ----
const outDir = path.join(ROOT, 'docs', 'invoices', `sokh-${sokhId}`, MONTH);
fs.mkdirSync(outDir, { recursive: true });
const htmlPath = path.join(outDir, 'nekhemjlekh.html');
fs.writeFileSync(htmlPath, html, 'utf8');

const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.goto('file:///' + htmlPath.replace(/\\/g, '/'), { waitUntil: 'networkidle0' });
await page.pdf({ path: path.join(outDir, 'nekhemjlekh.pdf'), printBackground: true, preferCSSPageSize: true });
await page.setViewport({ width: 820, height: 1160, deviceScaleFactor: 1.6 });
const first = await page.$('.sheet');
await first.screenshot({ path: path.join(outDir, 'jishee.png') });
await browser.close();

const totalSum = residents.reduce((s, r) =>
  s + Number(feeOf(r)) * MONTHS + (NO_DEBT ? 0 : Number(r.debt || 0)), 0);

console.log(`\n✅ ${org.name} (#${sokhId}) — ${MONTH} сарын нэхэмжлэх`);
console.log(`   Нэхэмжлэх:      ${residents.length} ширхэг${ALL ? '' : ONLY_UNIT ? '' : '  (жишээ — бүгдийг гаргах бол --all)'}`);
console.log(`   Нэгжийн үнэ:    ${money(feeOf(residents[0]))} × ${MONTHS} сар`);
console.log(`   Нийт дүн:       ${money(totalSum)}  (хураамж + өмнөх өр)`);
console.log(`   Төлөх хугацаа:  ${dueDate}`);
if (!org.tax_id) console.log(`   ⚠️  СӨХ-ийн ТТД байхгүй — нэхэмжлэх дээр хоосон гарна. Даргаас авч DB-д нэм.`);
if (!bank) console.log(`   ⚠️  Банкны данс бүртгэгдээгүй — төлөх мэдээлэл хоосон гарна.`);
else if (WITH_QR && !qrDataUri) console.log(`   ⚠️  Банкны QR татагдсангүй — зөвхөн дансны дугаар гарна.`);
console.log(`   ${path.relative(ROOT, outDir)}/`);
for (const f of ['nekhemjlekh.pdf', 'jishee.png']) {
  const s = fs.statSync(path.join(outDir, f));
  console.log(`     ${f.padEnd(18)} ${(s.size / 1024).toFixed(0)} KB`);
}
