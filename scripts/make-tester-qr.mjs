// Play-ийн хаалттай туршилтад оршин суугчдыг урих QR материал үүсгэнэ.
//
//   node scripts/make-tester-qr.mjs
//
// Гаралт (docs/onboarding/tester/):
//   post.png     — 1080×1080, Facebook бүлэг / Messenger-т тавих
//   poster.pdf   — A4, орцны самбарт наах
//   poster.png   — мөн адил, зургаар илгээхэд
//
// QR нь Play-ийн opt-in линк рүү заана.
//
// ⚠️ ЭНЭ НЬ /register-ийн QR БИШ. Тэр нь СӨХ-д бүртгүүлэх (make-sokh-qr.mjs).
// Энэ нь Google Play-ийн туршилтад нэгдэх — өөр зорилготой, өөр хүмүүст.
//
// ⚠️ Хамгийн чухал: энэ материал нь «товч дараад орхи» гэж БИЧИХГҮЙ.
// 2026-08-28-нд Google «testers were not engaged» гэж татгалзсан — opt-in
// дарсан ч аппыг нээгээгүй хүн Google-ийн нүдээр тэг. Тиймээс бичвэр нь
// «суулга, ашигла» гэдэг дээр төвлөрнө.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QRCodeSVG } from 'qrcode.react';
import puppeteer from 'puppeteer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const OPT_IN_URL = 'https://play.google.com/apps/testing/mn.khotol.app';

const qr = (size) => renderToStaticMarkup(createElement(QRCodeSVG, {
  value: OPT_IN_URL, size, level: 'M', bgColor: '#ffffff', fgColor: '#0e1b30',
}));

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
  .qrframe { background:#fff; border:3px solid #d9e1ee; border-radius:26px; display:grid; place-items:center; }
  .steps { list-style:none; margin:0; padding:0; counter-reset:s; }
  .steps li { counter-increment:s; display:flex; gap:16px; align-items:flex-start; }
  .steps li::before { content:counter(s); background:#2563eb; color:#fff; font-weight:800;
    border-radius:50%; display:grid; place-items:center; flex:none; }
  .note { background:#f3f6fc; border:1px solid #d9e1ee; border-radius:18px; color:#31405c; }
  .warn { background:#fff5e6; border:1px solid #f3d9a8; border-radius:18px; color:#5c4715; }
  .url { color:#2563eb; font-weight:700; word-break:break-all; }
`;

const postHtml = `<!doctype html><html lang="mn"><head><meta charset="utf-8"><style>${CSS}
  .sheet { width:1080px; height:1080px; padding:56px 64px; }
  .brandbar .dot { width:62px; height:62px; font-size:34px; }
  .brandbar .wordmark { font-size:40px; }
  .brandbar .tag { font-size:22px; margin-left:auto; }
  h1 { font-size:64px; margin-top:34px; }
  .lede { font-size:26px; margin-top:18px; }
  .core { display:flex; gap:44px; align-items:center; margin-top:34px; }
  .steps li { font-size:26px; margin-bottom:18px; }
  .steps li::before { width:42px; height:42px; font-size:22px; }
  .qrframe { width:320px; height:320px; flex:none; }
  .qrframe svg { width:270px; height:270px; }
  .scan { text-align:center; font-size:19px; color:#4a5b76; margin:12px 0 0; }
  .warn { margin-top:auto; padding:22px 26px; font-size:22px; }
  .foot { padding-top:26px; font-size:21px; color:#4a5b76; }
</style></head><body>
<div class="sheet">
  <div class="brandbar"><span class="dot">Х</span><span class="wordmark">Хотол</span><span class="tag">Google Play туршилт</span></div>
  <h1>Аппыг Play дэлгүүрт<br><em>гаргахад тусална уу</em></h1>
  <p class="lede">Хотол апп одоо хаалттай туршилтад байна. Play дэлгүүрт нээлттэй
  гарахын тулд 12-оос дээш хүн 14 хоног бодитоор ашигласан байх ёстой гэсэн
  Google-ийн шаардлага бий.</p>
  <div class="core">
    <ol class="steps">
      <li><span>QR-ыг уншуулж, <b>«Become a tester»</b> дарна</span></li>
      <li><span>Гарч ирэх <b>Google Play</b> линкээр аппаа <b>суулгана</b></span></li>
      <li><span>14 хоног утаснаасаа хааяа <b>нээж ашиглана</b></span></li>
    </ol>
    <div>
      <div class="qrframe">${qr(270)}</div>
      <p class="scan">Утасныхаа камерыг чиглүүлнэ</p>
    </div>
  </div>
  <div class="warn"><b>Зөвхөн Android утас.</b> Өөрийнхөө утас, өөрийнхөө Gmail
  хаягаар л нэгдэнэ үү — нэг утсан дээр олон хаягаар нэвтэрвэл Google
  тоолохгүй. iPhone-той бол khotol.com-оор хэвийн ашиглаж болно.</div>
  <div class="foot">Хотол — khotol.com</div>
</div></body></html>`;

const posterHtml = `<!doctype html><html lang="mn"><head><meta charset="utf-8"><style>${CSS}
  @page { size: A4; margin: 0; }
  .sheet { width:210mm; height:297mm; padding:14mm 15mm; }
  .brandbar .dot { width:54px; height:54px; font-size:30px; }
  .brandbar .wordmark { font-size:34px; }
  .brandbar .tag { font-size:18px; margin-left:auto; }
  h1 { font-size:42px; margin-top:20px; }
  .lede { font-size:18px; margin-top:12px; line-height:1.45; }
  .qrframe { width:260px; height:260px; margin:20px auto 0; }
  .qrframe svg { width:215px; height:215px; }
  .scan { text-align:center; font-size:16px; color:#4a5b76; margin:9px 0 0; }
  .steps { margin-top:20px; }
  .steps li { font-size:18px; margin-bottom:13px; line-height:1.4; }
  .steps li::before { width:33px; height:33px; font-size:18px; }
  .warn { margin-top:16px; padding:14px 18px; font-size:15.5px; line-height:1.45; }
  .note { margin-top:11px; padding:14px 18px; font-size:15px; line-height:1.45; }
  .foot { margin-top:auto; padding-top:16px; border-top:2px solid #d9e1ee; font-size:16px; color:#4a5b76; }
</style></head><body>
<div class="sheet">
  <div class="brandbar"><span class="dot">Х</span><span class="wordmark">Хотол</span><span class="tag">Google Play туршилт</span></div>
  <h1>Аппыг Play дэлгүүрт <em>гаргахад тусална уу</em></h1>
  <p class="lede">Хотол апп одоо хаалттай туршилтад байна. Play дэлгүүрт бүх хүнд
  нээлттэй гарахын тулд <b>12-оос дээш хүн 14 хоног бодитоор ашигласан</b> байх
  ёстой гэсэн Google-ийн шаардлага бий. Танай 10 хүн тусалбал хангалттай.</p>
  <div class="qrframe">${qr(250)}</div>
  <p class="scan">Утасныхаа камерыг чиглүүлнэ</p>
  <ol class="steps">
    <li><span>QR-ыг уншуулж, нээгдэх хуудсан дээрх <b>«Become a tester»</b> дарна</span></li>
    <li><span>Тэндээс гарах <b>Google Play</b> линкээр Хотол аппыг <b>утсандаа суулгана</b></span></li>
    <li><span>14 хоногийн турш утаснаасаа <b>хааяа нээж ашиглана</b> — зарлал унших,
        төлбөрөө харах гэх мэт. Аппыг устгахгүй байх нь чухал.</span></li>
  </ol>
  <div class="warn"><b>Зөвхөн Android утас.</b> Өөрийнхөө утас, өөрийнхөө Gmail
  хаягаар нэгдэнэ үү. Нэг утсан дээр хэд хэдэн Gmail хаягаар ээлжлэн нэвтэрвэл
  Google үүнийг тоолохгүй, бүр туршилтыг хүчингүй болгож ч мэднэ.
  iPhone-той бол khotol.com-оор хэвийн ашиглаарай.</div>
  <div class="note"><b>«App not available» гарвал</b> — Play дээр өөр Google
  дансаар нэвтэрсэн байна. Даргадаа өгсөн Gmail хаягаараа нэвтрээд линкийг
  дахин нээнэ үү. Play дэлгүүрээс «Хотол» гэж хайж бүү оролдоорой — туршилтын
  апп хайлтад гардаггүй, зөвхөн энэ линкээр ордог.</div>
  <div class="foot">Хотол — khotol.com · Асуулт гарвал СӨХ-ийн даргадаа хандана уу</div>
</div></body></html>`;

const outDir = path.join(ROOT, 'docs', 'onboarding', 'tester');
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

console.log('\n✅ Тестер урих QR материал бэлэн');
console.log(`   QR → ${OPT_IN_URL}`);
console.log(`   ${path.relative(ROOT, outDir)}/`);
for (const f of ['post.png', 'poster.pdf', 'poster.png']) {
  const s = fs.statSync(path.join(outDir, f));
  console.log(`     ${f.padEnd(12)} ${(s.size / 1024).toFixed(0)} KB`);
}
