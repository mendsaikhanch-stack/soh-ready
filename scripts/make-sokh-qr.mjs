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

const { data: units } = await sb.from('residents').select('apartment, building, unit_kind, pending_claim').eq('sokh_id', sokhId);
// Гараж, дэлгүүр зэрэг айл бус нэгжийг тоонд оруулахгүй — самбар дээрх «N айл»
// нь оршин суугчийн ойлгодог тоо байх ёстой. Мөн «баталгаажуулах хүлээж буй»
// (pending_claim) мөр нь давхар бүртгэл тул айлын тоонд орохгүй.
const homes = (units || []).filter(u => u.unit_kind !== 'business' && !u.pending_claim);
const count = homes.length;
if (count === 0) {
  console.error('❌ Энэ СӨХ дээр нэг ч айл бүртгэгдээгүй байна.');
  console.error('   Жагсаалтгүй байхад QR тараавал оршин суугч өөрөө бүртгүүлэхэд ШИНЭ мөр үүснэ.');
  process.exit(1);
}
// Хоосон тоотыг хасна, «0» тоотыг ХАСАХГҮЙ (Бадрах СӨХ шиг 0-оос эхэлдэг байр бий).
// Number('') нь 0 болдог тул тоог биш, ТЭКСТИЙГ шалгана.
const nums = homes.map(u => String(u.apartment ?? '').trim())
  .filter(s => /^\d+$/.test(s)).map(Number);
const range = nums.length ? `${Math.min(...nums)}–${Math.max(...nums)}` : '';
// Олон байртай СӨХ-д тоот давхцдаг тул байраа заавал бичүүлнэ
const buildings = [...new Set(homes.map(u => (u.building || '').trim()).filter(Boolean))]
  .sort((a, b) => a.localeCompare(b, 'mn', { numeric: true }));
const multiBuilding = buildings.length > 1;

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
  .sheet { width:210mm; height:297mm; padding:14mm 14mm 10mm; }  /* яг 1 хуудас — өмнө нь 2 хуудас болж байсан */
  .brandbar .dot { width:52px; height:52px; font-size:28px; border-radius:18px; }
  .brandbar .wordmark { font-size:32px; }
  .brandbar .tag { font-size:17px; margin-left:auto; }
  /* Гарчиг зүүн талд, QR баруун талд — босоо зайг доорх тайлбарт үлдээнэ */
  .hero { display:flex; gap:22px; align-items:center; margin-top:18px; }
  .hero .txt { flex:1; }
  h1 { font-size:34px; }
  .lede { font-size:17px; margin-top:10px; }
  .qrwrap { text-align:center; flex:none; }
  .qrframe { width:230px; height:230px; margin:0 auto; }
  .qrframe svg { width:200px; height:200px; }
  .scan { font-size:15px; color:#4a5b76; margin:6px 0 0; }
  .hero .url { font-size:15px; margin:10px 0 0; }
  .below { margin-top:18px; }
  /* QR-ын доорх тайлбар — --k коэффициентоор томруулна; доорх fit алхам нь
     A4-т багтах хамгийн том --k-г сонгоно (айлд жижиг цаасан дээр хэвлэдэг тул). */
  .below { --k:1; }
  .steps li { font-size:calc(19px * var(--k)); margin-bottom:calc(14px * var(--k)); line-height:1.4; }
  .steps li::before { width:calc(32px * var(--k)); height:calc(32px * var(--k)); font-size:calc(17px * var(--k)); }
  .steps li > span { flex:1; }
  .keep { font-size:calc(16px * var(--k)); padding:calc(14px * var(--k)) calc(18px * var(--k)); margin-top:calc(16px * var(--k)); line-height:1.45; }
  .keep > b { display:block; font-size:calc(17px * var(--k)); margin-bottom:calc(8px * var(--k)); }  /* зөвхөн гарчиг — мөр доторх <b> инлайн хэвээр */
  .keep .row { gap:calc(10px * var(--k)); margin-bottom:calc(6px * var(--k)); }
  .keep .os { width:calc(84px * var(--k)); font-size:calc(15px * var(--k)); padding:calc(3px * var(--k)) 0; }
  .keep .tail { margin:calc(8px * var(--k)) 0 0; font-size:calc(16px * var(--k)); color:#4a5b76; }
  .note { font-size:calc(16px * var(--k)); padding:calc(12px * var(--k)) calc(18px * var(--k)); margin-top:calc(14px * var(--k)); line-height:1.45; }
  .foot { margin-top:auto; padding-top:8px; border-top:2px solid #d9e1ee; font-size:13px; color:#4a5b76; }
</style></head><body><div class="sheet">
  <div class="brandbar"><div class="dot">Х</div><div class="wordmark">Хотол</div><div class="tag">${esc(org.name)}</div></div>
  <div class="hero">
    <div class="txt">
      <h1>Байрныхаа мэдээллийг<br><em>утаснаасаа</em> хараарай</h1>
      <p class="lede">Манай СӨХ Хотол системд шилжлээ. ${count} айл бүгд бүртгэгдсэн байгаа —
         та зөвхөн өөрийгөө холбоно.</p>
      <p class="url">${esc(url)}</p>
    </div>
    <div class="qrwrap">
      <div class="qrframe">${qr(200)}</div>
      <p class="scan">Камераар уншуулна уу</p>
    </div>
  </div>
  <div class="below">
  <ol class="steps">
    <li><span>QR кодыг утасныхаа камераар уншуулна</span></li>
    ${multiBuilding ? `<li><span><b>Байрны дугаар</b> хэсэгт байраа бичнэ (${esc(buildings.join(' / '))})</span></li>` : ''}
    <li><span><b>Тоот</b> хэсэгт хаалганыхаа дугаарыг бичнэ${range ? ` (${esc(range)})` : ''}</span></li>
    <li><span>Нэр, утасны дугаараа бичээд өөрийн нууц үгээ тохируулна</span></li>
    <li><span>Болоо. Төлбөр, зарлал, засварын хүсэлт бүгд утсанд тань байна</span></li>
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
// QR-ын доорх тайлбарыг A4-т багтах хэмжээгээр хамгийн том болгоно: хуудсыг 297мм-т
// түгжиж, агуулга хэтрэхгүй хамгийн том --k-г хоёртын хайлтаар олно.
const k = await poster.evaluate(() => {
  const sheet = document.querySelector('.sheet'), below = document.querySelector('.below');
  const fits = (v) => { below.style.setProperty('--k', v); return sheet.scrollHeight <= sheet.clientHeight; };
  let lo = 0.5, hi = 3;
  for (let i = 0; i < 20; i++) { const mid = (lo + hi) / 2; if (fits(mid)) lo = mid; else hi = mid; }
  const best = Math.floor(lo * 100) / 100;
  fits(best);
  return best;
});
fs.writeFileSync(path.join(outDir, 'poster.html'), posterHtml.replace('.below { --k:1; }', `.below { --k:${k}; }`), 'utf8');
await poster.pdf({ path: path.join(outDir, 'poster.pdf'), printBackground: true, preferCSSPageSize: true });
const box = await poster.$('.sheet');
await poster.setViewport({ width: 900, height: 1273, deviceScaleFactor: 1.4 });
await box.screenshot({ path: path.join(outDir, 'poster.png') });
await poster.close();

await browser.close();

console.log(`\n✅ ${org.name} (#${sokhId}) — ${count} айл`);
console.log(`   QR → ${url}`);
console.log(`   Постерын тайлбар ×${k} томруулсан`);
console.log(`   ${path.relative(ROOT, outDir)}/`);
for (const f of ['post.png', 'poster.pdf', 'poster.png']) {
  const s = fs.statSync(path.join(outDir, f));
  console.log(`     ${f.padEnd(12)} ${(s.size / 1024).toFixed(0)} KB`);
}
