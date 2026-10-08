// docs/fb-posts/carousel-*.md → 1080×1350 PNG слайдууд + caption.txt
//   node scripts/make-carousel.mjs docs/fb-posts/carousel-02-hurlyn-irts.md
//
// MD бүтэц: «## Слайд N — ...» хэсэг бүр нэг слайд, «## Facebook caption»
// доорх текст caption болно. Слайдын эхний бүтэн тод мөр(үүд) = гарчиг.
// Гаралт: MD-тэй ижил нэртэй хавтас (slide-01.png ..., caption.txt).
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const mdPath = process.argv[2];
if (!mdPath) {
  console.error('Хэрэглээ: node scripts/make-carousel.mjs <carousel.md>');
  process.exit(1);
}
const md = fs.readFileSync(path.resolve(mdPath), 'utf8').replace(/\r\n/g, '\n');
const outDir = path.resolve(mdPath).replace(/\.md$/, '');
fs.mkdirSync(outDir, { recursive: true });

// --- MD задлах ---
const captionMatch = md.split(/^## Facebook caption\s*$/m);
const caption = (captionMatch[1] || '').trim();
const slides = [...captionMatch[0].matchAll(/^## Слайд (\d+)[^\n]*\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm)]
  .map((m) => m[2].replace(/^---\s*$/gm, '').trim());

if (!slides.length) {
  console.error('«## Слайд N» хэсэг олдсонгүй');
  process.exit(1);
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>');

function slideHtml(src) {
  const lines = src.split('\n');
  const title = [];
  while (lines.length && /^\*\*[^*].*\*\*$/.test(lines[0].trim())) {
    title.push(lines.shift().trim().slice(2, -2));
  }
  let body = '';
  let list = null;
  const closeList = () => { if (list) { body += `</${list}>`; list = null; } };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { closeList(); continue; }
    let m;
    if ((m = line.match(/^<small>(.*)<\/small>$/))) {
      closeList();
      body += `<p class="note">${inline(m[1])}</p>`;
    } else if ((m = line.match(/^- (.*)$/))) {
      if (list !== 'ul') { closeList(); body += '<ul>'; list = 'ul'; }
      body += `<li>${inline(m[1])}</li>`;
    } else if ((m = line.match(/^\d+\. (.*)$/))) {
      if (list !== 'ol') { closeList(); body += '<ol>'; list = 'ol'; }
      body += `<li>${inline(m[1])}</li>`;
    } else {
      closeList();
      body += `<p>${inline(line)}</p>`;
    }
  }
  closeList();
  return { title: title.map(esc).join('<br>'), body };
}

const logo = 'data:image/png;base64,' +
  fs.readFileSync(path.join(root, 'public', 'brand', 'khotol-mark.png')).toString('base64');

function page({ title, body }, i, n) {
  const isFirst = i === 0;
  const isLast = i === n - 1;
  return `<!doctype html><html lang="mn"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&subset=cyrillic&display=block" rel="stylesheet">
<style>
  :root { --bg:#0F2A5F; --bg2:#1E40AF; --ink:#fff; --soft:rgba(255,255,255,.78); --accent:#F59E0B; }
  * { box-sizing:border-box; margin:0; padding:0; }
  html,body { width:1080px; height:1350px; }
  body { font-family:Inter,"Segoe UI",sans-serif; color:var(--ink); -webkit-font-smoothing:antialiased;
    background:radial-gradient(1200px 900px at 100% 0%, var(--bg2) 0%, var(--bg) 60%); }
  .slide { width:1080px; height:1350px; padding:84px 88px 72px; display:flex; flex-direction:column; }
  header { display:flex; align-items:center; justify-content:space-between; }
  .brand { display:flex; align-items:center; gap:18px; font-weight:800; font-size:34px; letter-spacing:.06em; }
  .brand span.mark { width:64px; height:64px; border-radius:18px; background:#fff; display:grid; place-items:center; }
  .brand img { width:46px; height:46px; }
  .count { font-size:28px; font-weight:600; color:var(--soft); }
  .count b { color:var(--accent); }
  main { flex:1; display:flex; flex-direction:column; justify-content:${isFirst || isLast ? 'center' : 'flex-start'}; padding-top:${isFirst || isLast ? 0 : 96}px; overflow:hidden; }
  h1 { font-size:${isFirst ? 92 : 70}px; line-height:1.12; font-weight:800; letter-spacing:-.02em; margin-bottom:56px; }
  h1::after { content:""; display:block; width:120px; height:10px; background:var(--accent); border-radius:5px; margin-top:44px; }
  .content { font-size:40px; line-height:1.45; color:var(--soft); }
  .content b { color:var(--ink); font-weight:700; }
  .content i { font-style:normal; color:var(--accent); }
  .content p { margin-bottom:28px; }
  .content ul, .content ol { margin:0 0 28px; padding-left:0; list-style:none; counter-reset:n; }
  .content li { position:relative; padding-left:64px; margin-bottom:24px; }
  .content ul li::before { content:""; position:absolute; left:8px; top:.55em; width:18px; height:18px; border-radius:50%; background:var(--accent); }
  .content ol li { counter-increment:n; }
  .content ol li::before { content:counter(n); position:absolute; left:0; top:.05em; width:44px; height:44px; border-radius:12px;
    background:var(--accent); color:var(--bg); font-weight:800; font-size:.7em; display:grid; place-items:center; }
  .content .note { font-size:.62em; line-height:1.4; opacity:.7; margin-top:auto; }
  ${isLast ? `.content p:first-child b { display:inline-block; background:var(--accent); color:var(--bg); padding:2px 18px; border-radius:12px; }` : ''}
  footer { display:flex; justify-content:space-between; align-items:center; font-size:26px; color:var(--soft); padding-top:32px; border-top:2px solid rgba(255,255,255,.14); }
  footer .swipe { color:var(--accent); font-weight:700; }
</style></head><body><div class="slide">
  <header><div class="brand"><span class="mark"><img src="${logo}"></span>ХОТОЛ</div>
    <div class="count"><b>${String(i + 1).padStart(2, '0')}</b> / ${String(n).padStart(2, '0')}</div></header>
  <main>${title ? `<h1>${title}</h1>` : ''}<div class="content">${body}</div></main>
  <footer><span>khotol.com</span>${isLast ? '' : '<span class="swipe">Дараагийнх →</span>'}</footer>
</div>
<script>
  // Агуулга багтахгүй бол фонтыг багасгана
  document.fonts.ready.then(() => {
    const main = document.querySelector('main');
    const content = document.querySelector('.content');
    const h1 = document.querySelector('h1');
    let size = parseFloat(getComputedStyle(content).fontSize);
    while (main.scrollHeight > main.clientHeight && size > 26) {
      size -= 1;
      content.style.fontSize = size + 'px';
      if (h1) h1.style.fontSize = Math.max(48, parseFloat(getComputedStyle(h1).fontSize) - 1) + 'px';
    }
    document.body.dataset.ready = '1';
  });
</script></body></html>`;
}

const browser = await puppeteer.launch();
for (const [i, src] of slides.entries()) {
  const pg = await browser.newPage();
  await pg.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 1 });
  await pg.setContent(page(slideHtml(src), i, slides.length), { waitUntil: 'load' });
  await pg.waitForSelector('body[data-ready="1"]');
  const file = path.join(outDir, `slide-${String(i + 1).padStart(2, '0')}.png`);
  await pg.screenshot({ path: file });
  await pg.close();
  console.log('✓', path.relative(root, file));
}
await browser.close();

fs.writeFileSync(path.join(outDir, 'caption.txt'), caption.replace(/\*\*(.+?)\*\*/g, '$1') + '\n');
console.log('✓', path.relative(root, path.join(outDir, 'caption.txt')));
