// СӨХ тус бүрд зориулсан "өөрөө бүртгүүлэх" QR материал үүсгэнэ.
//
//   node scripts/make-sokh-qr.mjs <sokh_id>
//   жишээ: node scripts/make-sokh-qr.mjs 1787
//
// Гаралт (docs/onboarding/sokh-<id>/):
//   post.png     — 1080×1080, Facebook бүлэг / Viber-т тавих
//   poster.pdf   — A4, орцны самбарт нааx
//   poster.png   — мөн адил, зургаар илгээхэд
//
// QR нь /register?sokh=<id> руу заана. Оршин суугч тоотоо бичихэд сервер нь
// даргын оруулсан ЯГ ТЭР мөрийг олж холбоно (өр нь хэвээр үлдэнэ, давхар
// мөр үүсэхгүй) — app/api/auth/register/route.ts дахь "free.length === 1" зам.
//
// ⚠️ Тиймээс QR тараахаас ӨМНӨ айлын жагсаалт DB-д орсон байх ёстой.

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
  console.error('Ашиглах нь: node scripts/make-sokh-qr.mjs <sokh_id>');
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

const { data: org } = await sb.from('sokh_organizations').select('id, name').eq('id', sokhId).single();
if (!org) { console.error(`❌ СӨХ #${sokhId} олдсонгүй`); process.exit(1); }

const { data: units } = await sb.from('residents').select('apartment').eq('sokh_id', sokhId);
const count = (units || []).length;
if (count === 0) {
  console.error('❌ Энэ СӨХ дээр нэг ч айл бүртгэгдээгүй байна.');
  console.error('   Жагсаалтгүй байхад QR тараавал оршин суугч өөрөө бүртгүүлэхэд ШИНЭ мөр үүснэ.');
  process.exit(1);
}
const nums = (units || []).map(u => Number(u.apartment)).filter(Number.isFinite);
const range = nums.length ? `${Math.min(...nums)}–${Math.max(...nums)}` : '';

const url = `${SITE}/register?sokh=${sokhId}`;
const qr = (size) => renderToStaticMarkup(createElement(QRCodeSVG, {
  value: url, size, level: 'M', bgColor: '#ffffff', fgColor: '#0e1b30',
}));

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---- HTML загварууд ----
const CSS = `
  * { box-sizing: border-box; }
  body { margin:0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans", Arial, sans-serif;
         -webkit-font-smoothing: antialiased; background:#eef1f7; display:grid; place-items:center; }
  .sheet { background:#fff; color:#0e1b30; display:flex; flex-direction:column; overflow:hidden; }
  .brandbar { display:flex; align-items:center; gap:16px; }
  .dot { background:#2563eb; color:#fff; display:grid; place-items:center; font-weight:800; border-radius:22px; }
  .wordmark { font-weight:800; letter-spacing:-0.02em; }
  .tag { color:#4a5b76; }
  h1 { margin:0; font-weight:800; letter-spacing:-0.03em; line-height:1.06; }
  h1 em { font-style:normal; color:#2563eb; }
  .lede { color:#4a5b76; margin:0; }
  .perks { list-style:none; margin:0; padding:0; }
  .perks li { display:flex; align-items:center; gap:14px; }
  .qrframe { background:#fff; border:3px solid #d9e1ee; border-radius:26px; display:grid; place-items:center; }
  .steps { list-style:none; margin:0; padding:0; counter-reset:s; }
  .steps li { counter-increment:s; display:flex; gap:16px; align-items:flex-start; }
  .steps li::before { content:counter(s); background:#2563eb; color:#fff; font-weight:800;
    border-radius:50%; display:grid; place-items:center; flex:none; }
  .note { background:#f3f6fc; border:1px solid #d9e1ee; border-radius:18px; color:#31405c; }
  .url { color:#2563eb; font-weight:700; word-break:break-all; }
  /* «Нүүр хуудсанд нэмэх» — бүртгүүлээд хаачихвал дахин ирэхэд хэцүү тул
     иконоо хадгалуулах нь хамгийн чухал алхам. */
  .keep { background:#eef4ff; border:1px solid #c7d9f7; border-radius:18px; color:#26364f; }
  .keep .row { display:flex; align-items:flex-start; }
  .keep .row > span:last-child { flex:1; }
  .keep .os { background:#2563eb; color:#fff; border-radius:999px; font-weight:700; flex:none; text-align:center; }
`;

const postHtml = `<!doctype html><html lang="mn"><head><meta charset="utf-8"><style>${CSS}
  .sheet { width:1080px; height:1080px; padding:56px 64px; }
  .brandbar .dot { width:62px; height:62px; font-size:34px; }
  .brandbar .wordmark { font-size:40px; }
  .brandbar .tag { font-size:22px; margin-left:auto; }
  h1 { font-size:70px; margin-top:38px; }
  .lede { font-size:27px; margin-top:20px; }
  .core { display:flex; gap:44px; align-items:center; margin-top:auto; }
  .perks li { font-size:26px; margin-bottom:20px; }
  .perks .ic { font-size:32px; }
  .qrframe { width:330px; height:330px; flex:none; }
  .qrframe svg { width:280px; height:280px; }
  .scan { text-align:center; font-size:20px; color:#4a5b76; margin:12px 0 0; }
  .foot { margin-top:auto; padding-top:34px; border-top:2px solid #d9e1ee; display:flex; align-items:center; gap:20px; }
  .pill { background:#2563eb; color:#fff; border-radius:999px; padding:12px 26px; font-size:22px; font-weight:700; }
  .foot .url { font-size:24px; }
</style></head><body><div class="sheet">
  <div class="brandbar"><div class="dot">Х</div><div class="wordmark">Хотол</div><div class="tag">СӨХ-ийн апп</div></div>
  <h1>Байрныхаа мэдээллийг<br><em>утаснаасаа</em> хараарай</h1>
  <p class="lede">${esc(org.name)} Хотол системд шилжлээ. ${count} айл бүртгэгдсэн —<br>QR-аа уншуулаад тоотоо сонгоход л болно.</p>
  <div class="core">
    <ul class="perks">
      <li><span class="ic">💳</span><span>Төлбөр, өрийн үлдэгдлээ хэзээ ч харах</span></li>
      <li><span class="ic">🔧</span><span>Засварын хүсэлт илгээж, явцыг хянах</span></li>
      <li><span class="ic">📢</span><span>СӨХ-ийн зарлал утсанд шууд ирэх</span></li>
      <li><span class="ic">📊</span><span>СӨХ-ийн санхүүг ил тод харах</span></li>
      <li><span class="ic">⭐</span><span>«Нүүр хуудсанд нэмэх» дарвал апп шиг болно</span></li>
    </ul>
    <div>
      <div class="qrframe">${qr(280)}</div>
      <p class="scan">Камераараа<br>уншуулна уу</p>
    </div>
  </div>
  <div class="foot"><span class="pill">Апп татах шаардлагагүй</span><span class="url">${esc(url)}</span></div>
</div></body></html>`;

const posterHtml = `<!doctype html><html lang="mn"><head><meta charset="utf-8"><style>${CSS}
  @page { size: A4; margin: 0; }
  body { background:#fff; }
  .sheet { width:210mm; min-height:297mm; padding:18mm 16mm; }
  .brandbar .dot { width:52px; height:52px; font-size:28px; border-radius:18px; }
  .brandbar .wordmark { font-size:32px; }
  .brandbar .tag { font-size:17px; margin-left:auto; }
  h1 { font-size:44px; margin-top:26px; }
  .lede { font-size:19px; margin-top:14px; }
  .qrwrap { text-align:center; margin:26px 0; }
  .qrframe { width:300px; height:300px; margin:0 auto; }
  .qrframe svg { width:255px; height:255px; }
  .scan { font-size:17px; color:#4a5b76; margin:12px 0 4px; }
  .steps li { font-size:19px; margin-bottom:14px; line-height:1.45; }
  .steps li::before { width:32px; height:32px; font-size:17px; }
  .keep { font-size:16px; padding:14px 18px; margin-top:16px; line-height:1.5; }
  .keep > b { display:block; font-size:17px; margin-bottom:8px; }  /* зөвхөн гарчиг — мөр доторх <b> инлайн хэвээр */
  .keep .row { gap:10px; margin-bottom:6px; }
  .keep .os { width:78px; font-size:13px; padding:3px 0; }
  .keep .tail { margin:8px 0 0; font-size:14px; color:#4a5b76; }
  .note { font-size:14px; padding:12px 18px; margin-top:14px; line-height:1.5; }
  .foot { margin-top:auto; padding-top:16px; border-top:2px solid #d9e1ee; font-size:15px; color:#4a5b76; }
</style></head><body><div class="sheet">
  <div class="brandbar"><div class="dot">Х</div><div class="wordmark">Хотол</div><div class="tag">${esc(org.name)}</div></div>
  <h1>Байрныхаа мэдээллийг<br><em>утаснаасаа</em> хараарай</h1>
  <p class="lede">Манай СӨХ Хотол системд шилжлээ. ${count} айл бүгд бүртгэгдсэн байгаа —
     та зөвхөн өөрийгөө холбоно.</p>
  <div class="qrwrap">
    <div class="qrframe">${qr(255)}</div>
    <p class="scan">Утасныхаа камераар уншуулна уу</p>
    <p class="url" style="font-size:17px">${esc(url)}</p>
  </div>
  <ol class="steps">
    <li>QR кодыг утасныхаа камераар уншуулна</li>
    <li><b>Тоот</b> хэсэгт хаалганыхаа дугаарыг бичнэ${range ? ` (${esc(range)})` : ''}</li>
    <li>Нэр, утасны дугаараа бичээд өөрийн нууц үгээ тохируулна</li>
    <li>Болоо. Төлбөр, зарлал, засварын хүсэлт бүгд утсанд тань байна</li>
  </ol>
  <div class="keep">
    <b>Дараа нь утсандаа апп болгож хадгална уу</b>
    <div class="row"><span class="os">Android</span><span>Chrome-ийн баруун дээд булангийн <b>цэг гурвыг</b> дарж «Нүүр хуудсанд нэмэх»</span></div>
    <div class="row"><span class="os">iPhone</span><span>Safari-ийн доод талын <b>хуваалцах</b> товчийг дарж «Нүүр хуудсанд нэмэх»</span></div>
    <p class="tail">Ингэвэл утсанд тань «Хотол» икон үүсч, дараа нь QR хайлгүй шууд нээгдэнэ.</p>
  </div>
  <div class="note">
    <b>Апп татах шаардлагагүй</b> — QR-аар шууд нээгдэнэ. Утасны дугаар нь таны нэвтрэх нэр болно.
    Нэг тоотод нэг хүн бүртгүүлнэ. Асуудал гарвал СӨХ-ийн даргад хандана уу.
  </div>
  <div class="foot">${esc(org.name)} · Хотол — ${esc(SITE.replace(/^https?:\/\//, ''))}</div>
</div></body></html>`;

// ---- Гаралт ----
const outDir = path.join(ROOT, 'docs', 'onboarding', `sokh-${sokhId}`);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'post.html'), postHtml, 'utf8');
fs.writeFileSync(path.join(outDir, 'poster.html'), posterHtml, 'utf8');

const browser = await puppeteer.launch();

const post = await browser.newPage();
await post.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 1 });
await post.goto('file:///' + path.join(outDir, 'post.html').replace(/\\/g, '/'), { waitUntil: 'networkidle0' });
await post.screenshot({ path: path.join(outDir, 'post.png') });
await post.close();

const poster = await browser.newPage();
await poster.goto('file:///' + path.join(outDir, 'poster.html').replace(/\\/g, '/'), { waitUntil: 'networkidle0' });
await poster.pdf({ path: path.join(outDir, 'poster.pdf'), printBackground: true, preferCSSPageSize: true });
const box = await poster.$('.sheet');
await poster.setViewport({ width: 900, height: 1273, deviceScaleFactor: 1.4 });
await box.screenshot({ path: path.join(outDir, 'poster.png') });
await poster.close();

await browser.close();

console.log(`\n✅ ${org.name} (#${sokhId}) — ${count} айл`);
console.log(`   QR → ${url}`);
console.log(`   ${path.relative(ROOT, outDir)}/`);
for (const f of ['post.png', 'poster.pdf', 'poster.png']) {
  const s = fs.statSync(path.join(outDir, f));
  console.log(`     ${f.padEnd(12)} ${(s.size / 1024).toFixed(0)} KB`);
}
