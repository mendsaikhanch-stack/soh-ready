// Олон орцтой СӨХ-д ОРЦ БҮРТ тусдаа «өөрөө бүртгүүлэх» QR постер үүсгэнэ.
//
//   node scripts/make-entrance-posters.mjs <sokh_id>
//   жишээ: node scripts/make-entrance-posters.mjs 2694   (АйСиТаун, 6 орц)
//
// Яагаад: тоот орц бүрт давтагддаг (305 нь 6 орцонд бий). Нэг ерөнхий QR-аар
// бол оршин суугч «Байрны дугаар»-аа өөрөө бичих ёстой — «498» гэх мэтээр буруу
// бичвэл аль мөрөнд холбохыг систем мэдэхгүй, дарга гараар засна. Энд QR нь
// /register?sokh=<id>&b=<байр> — бүртгэлийн хуудас байр/орцыг өөрөө бөглөж,
// оршин суугч зөвхөн тоотоо бичнэ.
//
// Байр/орц = residents.building (жнь «2-1»), нэр нь block/entrance-аас
// («2-р блок 1-р орц»). Нэг байртай СӨХ-д make-sokh-qr.mjs хангалттай.
//
// Гаралт (docs/onboarding/sokh-<id>/orts-<байр>/):
//   poster.pdf — A4 нэг нүүр, тухайн орцны самбарт наана
//   poster.png — мөн адил, зургаар
//   post.png   — 1080×1080, группт тавих (орц бүрийнхийг)

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
  console.error('Ашиглах нь: node scripts/make-entrance-posters.mjs <sokh_id>');
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
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: org } = await sb.from('sokh_organizations').select('id, name').eq('id', sokhId).single();
if (!org) { console.error(`❌ СӨХ #${sokhId} олдсонгүй`); process.exit(1); }

const { data: units } = await sb.from('residents')
  .select('apartment, building, block, entrance, unit_kind, pending_claim').eq('sokh_id', sokhId);
const homes = (units || []).filter(u => u.unit_kind !== 'business' && !u.pending_claim);
const codes = [...new Set(homes.map(u => (u.building || '').trim()).filter(Boolean))].sort();
if (codes.length < 2) {
  console.error('❌ Нэгээс олон байр/орц бүртгэгдээгүй — make-sokh-qr.mjs ашиглана уу.');
  process.exit(1);
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const qr = (url, size) => renderToStaticMarkup(createElement(QRCodeSVG, {
  value: url, size, level: 'M', bgColor: '#ffffff', fgColor: '#0e1b30',
}));
const site = SITE.replace(/^https?:\/\//, '');

const CSS = `
  * { box-sizing: border-box; }
  body { margin:0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans", Arial, sans-serif;
         -webkit-font-smoothing: antialiased; background:#fff; }
  .sheet { background:#fff; color:#0e1b30; display:flex; flex-direction:column; overflow:hidden; }
  .brandbar { display:flex; align-items:center; gap:14px; }
  .dot { background:#2563eb; color:#fff; display:grid; place-items:center; font-weight:800; }
  .wordmark { font-weight:800; letter-spacing:-0.02em; }
  .tag { color:#4a5b76; margin-left:auto; }
  .entr { background:#0e1b30; color:#fff; display:flex; align-items:center; justify-content:space-between; }
  .entr b { font-weight:800; letter-spacing:-0.02em; }
  .entr span { background:#2563eb; border-radius:999px; font-weight:700; }
  h1 { margin:0; font-weight:800; letter-spacing:-0.03em; line-height:1.08; }
  h1 em { font-style:normal; color:#2563eb; }
  .lede { color:#4a5b76; margin:0; }
  .qrframe { background:#fff; border:3px solid #d9e1ee; border-radius:24px; display:grid; place-items:center; }
  .url { color:#2563eb; font-weight:700; word-break:break-all; }
  .steps { list-style:none; margin:0; padding:0; counter-reset:s; }
  /* display:block — flex байхад <b> ба текст тусдаа багана болж хуваагддаг */
  .steps li { counter-increment:s; display:block; position:relative; }
  .steps li::before { content:counter(s); background:#2563eb; color:#fff; font-weight:800;
    border-radius:50%; display:grid; place-items:center; position:absolute; left:0; top:-2px; }
  .warn { background:#fff7e6; border:2px solid #f5c26b; border-radius:16px; color:#5c3d00; }
  .note { background:#f3f6fc; border:1px solid #d9e1ee; border-radius:16px; color:#31405c; }
`;

function posterHtml({ code, label, url, count, range }) {
  return `<!doctype html><html lang="mn"><head><meta charset="utf-8"><style>${CSS}
  @page { size: A4; margin: 0; }
  .sheet { width:210mm; height:297mm; padding:12mm 15mm 10mm; }
  .dot { width:46px; height:46px; font-size:25px; border-radius:15px; }
  .wordmark { font-size:28px; } .tag { font-size:16px; }
  .entr { margin-top:16px; padding:14px 20px; border-radius:18px; }
  .entr b { font-size:34px; } .entr span { font-size:20px; padding:6px 16px; }
  h1 { font-size:32px; margin-top:14px; }
  .lede { font-size:17px; margin-top:8px; line-height:1.45; }
  .qrwrap { text-align:center; margin:12px 0 10px; }
  .qrframe { width:270px; height:270px; margin:0 auto; }
  .qrframe svg { width:230px; height:230px; }
  .scan { font-size:15px; color:#4a5b76; margin:8px 0 2px; }
  .steps li { font-size:16px; margin-bottom:9px; line-height:1.4; padding-left:42px; }
  .steps li::before { width:28px; height:28px; font-size:15px; }
  .warn { font-size:15px; padding:12px 16px; margin-top:6px; line-height:1.5; }
  .note { font-size:13.5px; padding:10px 16px; margin-top:10px; line-height:1.5; }
  .foot { margin-top:auto; padding-top:10px; border-top:2px solid #d9e1ee; font-size:14px; color:#4a5b76; }
</style></head><body><div class="sheet">
  <div class="brandbar"><div class="dot">Х</div><div class="wordmark">Хотол</div><div class="tag">${esc(org.name)}</div></div>
  <div class="entr"><b>${esc(label)}</b><span>Код ${esc(code)}</span></div>
  <h1>Байрныхаа мэдээллийг <em>утаснаасаа</em> хараарай</h1>
  <p class="lede">Манай СӨХ Хотол системд шилжлээ. <b>Энэ орцны ${count} айл</b> бүртгэгдсэн байгаа — та зөвхөн өөрийгөө холбоно.</p>
  <div class="qrwrap">
    <div class="qrframe">${qr(url, 230)}</div>
    <p class="scan">Утасныхаа камераар уншуулна уу</p>
    <p class="url" style="font-size:14px">${esc(url)}</p>
  </div>
  <ol class="steps">
    <li>QR кодыг утасныхаа камераар уншуулна</li>
    <li><b>Байр, орц автоматаар бөглөгдөнө</b> (${esc(label)}) — та бичих шаардлагагүй</li>
    <li><b>Тоот</b> хэсэгт зөвхөн хаалганыхаа дугаарыг бичнэ${range ? ` (${esc(range)})` : ''}</li>
    <li>Нэр, утасны дугаараа бичээд өөрийн нууц үгээ тохируулна</li>
    <li>Болоо. Төлбөр, зарлал, засварын хүсэлт бүгд утсанд тань байна</li>
  </ol>
  <div class="warn"><b>⚠️ Энэ QR зөвхөн ${esc(label)}ны айлуудад.</b> Өөр орцонд амьдардаг бол өөрийн орцны
    самбар дээрх QR-ыг уншуулна уу — эс бөгөөс өөр орцны айлд бүртгэгдэнэ.</div>
  <div class="note"><b>Апп татах шаардлагагүй</b> — QR-аар шууд нээгдэнэ. Утасны дугаар нь таны нэвтрэх нэр болно.
    Нэг тоотод нэг хүн бүртгүүлнэ. Дараа нь хөтчийн цэснээс «Нүүр хуудсанд нэмэх» дарвал апп шиг нээгдэнэ.
    Асуудал гарвал СӨХ-ийн даргад хандана уу.</div>
  <div class="foot">${esc(org.name)} · ${esc(label)} · Хотол — ${esc(site)}</div>
</div></body></html>`;
}

function postHtml({ code, label, url, count }) {
  return `<!doctype html><html lang="mn"><head><meta charset="utf-8"><style>${CSS}
  .sheet { width:1080px; height:1080px; padding:52px 60px; }
  .dot { width:58px; height:58px; font-size:32px; border-radius:18px; }
  .wordmark { font-size:38px; } .tag { font-size:22px; }
  .entr { margin-top:28px; padding:20px 28px; border-radius:22px; }
  .entr b { font-size:50px; } .entr span { font-size:26px; padding:8px 22px; }
  h1 { font-size:54px; margin-top:28px; }
  .core { display:flex; gap:40px; align-items:center; margin-top:auto; }
  .steps li { font-size:27px; margin-bottom:16px; line-height:1.35; padding-left:56px; }
  .steps li::before { width:40px; height:40px; font-size:21px; }
  .qrframe { width:330px; height:330px; flex:none; }
  .qrframe svg { width:280px; height:280px; }
  .warn { font-size:22px; padding:16px 22px; margin-top:26px; line-height:1.4; }
</style></head><body><div class="sheet">
  <div class="brandbar"><div class="dot">Х</div><div class="wordmark">Хотол</div><div class="tag">${esc(org.name)}</div></div>
  <div class="entr"><b>${esc(label)}</b><span>Код ${esc(code)}</span></div>
  <h1>Байрныхаа мэдээллийг <em>утаснаасаа</em> хараарай</h1>
  <div class="core">
    <ol class="steps">
      <li>QR-аа уншуулна</li>
      <li>Байр, орц <b>автоматаар</b> бөглөгдөнө</li>
      <li>Зөвхөн <b>тоотоо</b> бичнэ</li>
      <li>Нэр, утас, нууц үгээ тохируулна</li>
    </ol>
    <div class="qrframe">${qr(url, 280)}</div>
  </div>
  <div class="warn"><b>⚠️ Зөвхөн ${esc(label)}ны ${count} айлд.</b> Өөр орцных бол өөрийн орцны QR-ыг уншуулна уу.</div>
</div></body></html>`;
}

const baseDir = path.join(ROOT, 'docs', 'onboarding', `sokh-${sokhId}`);
const browser = await puppeteer.launch();
console.log(`\n✅ ${org.name} (#${sokhId}) — ${homes.length} айл, ${codes.length} орц`);

for (const code of codes) {
  const mine = homes.filter(u => (u.building || '').trim() === code);
  const nums = mine.map(u => String(u.apartment ?? '').trim()).filter(s => /^\d+$/.test(s)).map(Number);
  const range = nums.length ? `${Math.min(...nums)}–${Math.max(...nums)}` : '';
  const blk = mine.find(u => u.block)?.block;
  const ent = mine.find(u => u.entrance)?.entrance;
  const label = blk && ent ? `${blk}-р блок ${ent}-р орц` : ent ? `${code}, ${ent}-р орц` : `${code} байр`;
  const url = `${SITE}/register?sokh=${sokhId}&b=${encodeURIComponent(code)}`;
  const dir = path.join(baseDir, `orts-${code.replace(/[^\p{L}\p{N}-]/gu, '_')}`);
  fs.mkdirSync(dir, { recursive: true });

  const args = { code, label, url, count: mine.length, range };
  fs.writeFileSync(path.join(dir, 'poster.html'), posterHtml(args), 'utf8');
  fs.writeFileSync(path.join(dir, 'post.html'), postHtml(args), 'utf8');

  const poster = await browser.newPage();
  await poster.goto('file:///' + path.join(dir, 'poster.html').replace(/\\/g, '/'), { waitUntil: 'networkidle0' });
  await poster.pdf({ path: path.join(dir, 'poster.pdf'), printBackground: true, preferCSSPageSize: true });
  const pages = Buffer.from(await poster.pdf({ printBackground: true, preferCSSPageSize: true })).toString('latin1').match(/\/Type\s*\/Page[^s]/g)?.length || 0;
  await poster.setViewport({ width: 900, height: 1273, deviceScaleFactor: 1.4 });
  await (await poster.$('.sheet')).screenshot({ path: path.join(dir, 'poster.png') });
  await poster.close();

  const post = await browser.newPage();
  await post.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 1 });
  await post.goto('file:///' + path.join(dir, 'post.html').replace(/\\/g, '/'), { waitUntil: 'networkidle0' });
  await post.screenshot({ path: path.join(dir, 'post.png') });
  await post.close();

  console.log(`   ${label.padEnd(18)} ${String(mine.length).padStart(3)} айл  ${range.padEnd(9)} ${pages === 1 ? 'A4 1 нүүр ✓' : `⚠️ ${pages} нүүр`}  → ${path.relative(ROOT, dir)}`);
}
await browser.close();
console.log(`   QR жишээ: ${SITE}/register?sokh=${sokhId}&b=${encodeURIComponent(codes[0])}`);
