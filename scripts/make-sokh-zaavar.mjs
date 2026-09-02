// СӨХ тус бүрд зориулсан оршин суугчийн "АШИГЛАХ ЗААВАР" хуудас үүсгэнэ.
//
//   node scripts/make-sokh-zaavar.mjs <sokh_id>
//   жишээ: node scripts/make-sokh-zaavar.mjs 2690
//
// Гаралт (docs/onboarding/sokh-<id>/):
//   zaavar.pdf   — A4 нэг нүүр, орцны самбарт наах / даргад илгээх
//   zaavar.png   — мөн адил, группт зургаар тавихад
//   zaavar.html  — эх файл (засвар оруулах бол үүнийг засаад дахин ажиллуулна)
//
// make-sokh-qr.mjs-ээс ялгаа: тэр нь БҮРТГҮҮЛЭХ (QR + 3 алхам) хуудас.
// Энэ нь нэвтэрсний ДАРАА аппыг юунд ашиглахыг харуулна — бүртгүүлээд
// хаячихсан хүнийг буцааж татах материал.
//
// ⚠️ Хуудас нэг A4 нүүрэнд багтах ёстой — скрипт өөрөө өндрийг хэмжиж
//    хэтэрсэн бол анхааруулна. Мөр нэмсэн бол дахин ажиллуулж шалга.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QRCodeSVG } from 'qrcode.react';
import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SITE = process.env.SITE_URL || 'https://www.khotol.com';

const sokhId = parseInt(process.argv[2], 10);
if (!Number.isFinite(sokhId) || sokhId <= 0) {
  console.error('Ашиглах нь: node scripts/make-sokh-zaavar.mjs <sokh_id>');
  process.exit(1);
}

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

const { data: org } = await sb
  .from('sokh_organizations')
  .select('id, name')
  .eq('id', sokhId)
  .single();
if (!org) { console.error(`❌ СӨХ #${sokhId} олдсонгүй`); process.exit(1); }

const { data: units } = await sb.from('residents').select('apartment').eq('sokh_id', sokhId);
const count = (units || []).length;
if (count === 0) {
  console.error('❌ Энэ СӨХ дээр нэг ч айл бүртгэгдээгүй байна — эхлээд жагсаалтаа оруул.');
  process.exit(1);
}
const nums = (units || []).map((u) => Number(u.apartment)).filter(Number.isFinite);
const range = nums.length ? `${Math.min(...nums)}–${Math.max(...nums)}` : '';

const url = `${SITE}/register?sokh=${sokhId}`;
const qrSvg = renderToStaticMarkup(
  createElement(QRCodeSVG, { value: url, size: 200, level: 'M', bgColor: '#ffffff', fgColor: '#0e1b30' }),
);

const shortUrl = url.replace(/^https?:\/\/(www\.)?/, '');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Оршин суугчийн нүүр дэлгэцэнд байдаг хэсгүүд (app/(mobile)/sokh/[id]/page.tsx)
const USES = [
  ['💵', 'Төлбөр', 'Сарын хураамж, өрийн үлдэгдэл, төлсөн түүх — тооцоо тулгахаар явахгүй'],
  ['📢', 'Зарлал', 'СӨХ-ийн мэдээ, ус тасрах зэрэг зарлал утсанд шууд ирнэ'],
  ['🔧', 'Засвар', 'Хүсэлтээ зураг хавсаргаж илгээгээд, явцыг нь хянана'],
  ['🛠', 'Хийсэн ажил', 'СӨХ-ийн хийсэн засварыг огноо, зурагтай нь харна'],
  ['💬', 'Гомдол / Санал', 'Даргад шууд бичнэ — группт маргалдах шаардлагагүй'],
  ['🗳', 'Санал хураалт', 'Хурлын шийдвэрт утаснаасаа санал өгнө'],
];

const CSS = `
  * { box-sizing: border-box; }
  body { margin:0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans", Arial, sans-serif;
         -webkit-font-smoothing: antialiased; background:#fff; display:grid; place-items:center; }
  @page { size: A4; margin: 0; }
  .sheet { width:210mm; min-height:297mm; padding:11mm 14mm; background:#fff; color:#0e1b30;
           display:flex; flex-direction:column; overflow:hidden; }
  .brandbar { display:flex; align-items:center; gap:14px; }
  .dot { background:#2563eb; color:#fff; display:grid; place-items:center; font-weight:800;
         border-radius:16px; width:46px; height:46px; font-size:25px; }
  .wordmark { font-weight:800; letter-spacing:-0.02em; font-size:29px; }
  .tag { color:#4a5b76; font-size:16px; margin-left:auto; text-align:right; }
  h1 { margin:14px 0 0; font-weight:800; letter-spacing:-0.03em; line-height:1.08; font-size:30px; }
  h1 em { font-style:normal; color:#2563eb; }
  .lede { color:#4a5b76; margin:8px 0 0; font-size:15.5px; line-height:1.45; }
  .sec { margin-top:12px; }
  .sec > h2 { margin:0 0 8px; font-size:15px; font-weight:800; letter-spacing:0.06em;
              text-transform:uppercase; color:#2563eb; }
  .login { display:flex; gap:18px; align-items:center; background:#f3f6fc; border:1px solid #d9e1ee;
           border-radius:20px; padding:14px 18px; }
  .qrframe { background:#fff; border:2px solid #d9e1ee; border-radius:18px; width:132px; height:132px;
             flex:none; display:grid; place-items:center; }
  .qrframe svg { width:112px; height:112px; }
  .steps { list-style:none; margin:0; padding:0; counter-reset:s; flex:1; }
  .steps li { counter-increment:s; display:flex; gap:11px; align-items:flex-start;
              font-size:15px; line-height:1.4; margin-bottom:6px; }
  .steps li:last-child { margin-bottom:0; }
  .steps li::before { content:counter(s); background:#2563eb; color:#fff; font-weight:800;
    border-radius:50%; display:grid; place-items:center; flex:none; width:26px; height:26px; font-size:14px; }
  .url { color:#2563eb; font-weight:700; word-break:break-all; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:8px 16px; }
  .use { display:flex; gap:11px; align-items:flex-start; }
  .use .ic { font-size:22px; line-height:1.1; flex:none; }
  .use b { display:block; font-size:15px; margin-bottom:1px; }
  .use span.d { font-size:13px; color:#4a5b76; line-height:1.4; }
  .keep { background:#eef4ff; border:1px solid #c7d9f7; border-radius:18px; color:#26364f;
          padding:11px 16px; font-size:14.5px; line-height:1.45; }
  .keep > b { display:block; font-size:15px; margin-bottom:6px; }
  .keep .row { display:flex; align-items:flex-start; gap:10px; margin-bottom:5px; }
  .keep .os { background:#2563eb; color:#fff; border-radius:999px; font-weight:700; flex:none;
              text-align:center; width:76px; font-size:12.5px; padding:3px 0; }
  .keep .tail { margin:7px 0 0; font-size:13.5px; color:#4a5b76; }
  .faq { border:1px solid #d9e1ee; border-radius:18px; padding:10px 16px; font-size:13.5px;
         line-height:1.5; color:#31405c; }
  .faq p { margin:0 0 6px; }
  .faq p:last-child { margin:0; }
  .faq b { color:#0e1b30; }
  .foot { margin-top:auto; padding-top:10px; border-top:2px solid #d9e1ee; font-size:14px; color:#4a5b76; }
`;

const html = `<!doctype html><html lang="mn"><head><meta charset="utf-8"><style>${CSS}</style></head>
<body><div class="sheet">
  <div class="brandbar">
    <div class="dot">Х</div><div class="wordmark">Хотол</div>
    <div class="tag">${esc(org.name)}<br>Оршин суугчийн заавар</div>
  </div>

  <h1>Байрныхаа мэдээллийг<br><em>утаснаасаа</em> хараарай</h1>
  <p class="lede">Манай СӨХ Хотол системд шилжсэн. ${count} айл бүгд бүртгэгдсэн байгаа —
     та зөвхөн өөрийгөө холбоно. <b>Апп татах шаардлагагүй.</b></p>

  <div class="sec">
    <h2>1 · Хэрхэн нэвтрэх вэ</h2>
    <div class="login">
      <div class="qrframe">${qrSvg}</div>
      <ol class="steps">
        <li><span>QR кодыг утасныхаа камераар уншуулна<br><span class="url">${esc(shortUrl)}</span></span></li>
        <li><span><b>Тоот</b> хэсэгт хаалганыхаа дугаарыг бичнэ${range ? ` (${esc(range)})` : ''} — урд нь тэг бүү нэм</span></li>
        <li><span>Нэр, утасны дугаараа бичээд <b>өөрийн нууц үгээ</b> тохируулна</span></li>
      </ol>
    </div>
  </div>

  <div class="sec">
    <h2>2 · Аппаас юу хийх вэ</h2>
    <div class="grid">
      ${USES.map(([ic, t, d]) => `<div class="use"><span class="ic">${ic}</span>
        <span><b>${esc(t)}</b><span class="d">${esc(d)}</span></span></div>`).join('\n      ')}
    </div>
  </div>

  <div class="sec">
    <h2>3 · Утсандаа апп болгож хадгалах</h2>
    <div class="keep">
      <b>Нэг удаа хийчихвэл дараа нь холбоос хайхгүй</b>
      <div class="row"><span class="os">Android</span><span>Chrome-ийн баруун дээд булангийн <b>цэг гурвыг</b> дарж «Нүүр хуудсанд нэмэх»</span></div>
      <div class="row"><span class="os">iPhone</span><span>Safari-ийн доод талын <b>хуваалцах</b> товчийг дарж «Нүүр хуудсанд нэмэх»</span></div>
      <p class="tail">Утсанд тань «Хотол» икон үүсч, апп шиг шууд нээгдэнэ.</p>
    </div>
  </div>

  <div class="sec">
    <h2>Түгээмэл асуулт</h2>
    <div class="faq">
      <p><b>Уншуулахад юу ч болохгүй байна.</b> Хөтчөө нээгээд ${esc(shortUrl)} гэж шууд бичнэ.</p>
      <p><b>«Энэ тоот бүртгэгдсэн» гэж байна.</b> Тухайн тоотод өөр хүн бүртгүүлсэн байна — даргад хандана уу.</p>
      <p><b>Нууц үгээ мартсан.</b> Дарга сэргээж өгнө. Дараа нь «Миний мэдээлэл»-ээс шинээр тохируулна.</p>
      <p><b>Өрийн дүн зөрж байна.</b> Группт бичихийн оронд СӨХ-ийн даргад шууд хандаарай.</p>
    </div>
  </div>

  <div class="foot">${esc(org.name)} · Хотол — ${esc(SITE.replace(/^https?:\/\//, ''))}</div>
</div></body></html>`;

// ---- Гаралт ----
const outDir = path.join(ROOT, 'docs', 'onboarding', `sokh-${sokhId}`);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'zaavar.html'), html, 'utf8');

const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.goto('file:///' + path.join(outDir, 'zaavar.html').replace(/\\/g, '/'), { waitUntil: 'networkidle0' });

// нэг A4 нүүрэнд багтаж байна уу (297mm ≈ 1122px @96dpi)
const h = await page.evaluate(() => Math.round(document.querySelector('.sheet').getBoundingClientRect().height));
const A4 = 1123;

await page.pdf({ path: path.join(outDir, 'zaavar.pdf'), printBackground: true, preferCSSPageSize: true });
const box = await page.$('.sheet');
await page.setViewport({ width: 900, height: 1273, deviceScaleFactor: 1.4 });
await box.screenshot({ path: path.join(outDir, 'zaavar.png') });
await page.close();
await browser.close();

console.log(`\n✅ ${org.name} (#${sokhId}) — ${count} айл`);
console.log(`   QR → ${url}`);
console.log(`   ${path.relative(ROOT, outDir)}/`);
for (const f of ['zaavar.pdf', 'zaavar.png']) {
  const s = fs.statSync(path.join(outDir, f));
  console.log(`     ${f.padEnd(12)} ${(s.size / 1024).toFixed(0)} KB`);
}
console.log(h <= A4 ? `   Хэвлэлт: нэг A4 нүүр ✓ (${h}/${A4}px)` : `   ⚠️ ХЭТЭРСЭН ${h - A4}px → 2 нүүр болно`);
