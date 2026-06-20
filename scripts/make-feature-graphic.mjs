// Google Play Feature graphic (1024×500) үүсгэнэ.
// node scripts/make-feature-graphic.mjs → playstore/feature-graphic-1024x500.png
import puppeteer from 'puppeteer';
import { readFileSync } from 'fs';

const logoB64 = readFileSync('mobile/www/logo.png').toString('base64');
const logo = `data:image/png;base64,${logoB64}`;

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:1024px; height:500px; overflow:hidden; }
  .wrap {
    width:1024px; height:500px; display:flex; align-items:center; gap:48px;
    padding:0 64px;
    font-family:"Segoe UI",Roboto,system-ui,Arial,sans-serif;
    background:
      radial-gradient(900px 500px at 88% -20%, rgba(255,255,255,.12), transparent 60%),
      linear-gradient(135deg,#2563eb 0%,#1e40af 48%,#152a5e 100%);
    color:#fff; position:relative;
  }
  /* нарийн барилгын силуэт чимэг */
  .skyline { position:absolute; left:0; right:0; bottom:0; height:120px; opacity:.10;
    background:repeating-linear-gradient(90deg,#fff 0 26px,transparent 26px 64px);
    -webkit-mask:linear-gradient(180deg,transparent,#000); }
  .card {
    flex:0 0 312px; height:360px; background:#fff; border-radius:36px;
    display:flex; align-items:center; justify-content:center; padding:34px;
    box-shadow:0 24px 60px rgba(0,0,0,.28);
  }
  .card img { max-width:100%; max-height:100%; object-fit:contain; }
  .right { flex:1; position:relative; z-index:2; }
  .brand { font-size:88px; font-weight:800; letter-spacing:-2px; line-height:1; }
  .sub { font-size:31px; font-weight:600; margin-top:14px; color:rgba(255,255,255,.94); }
  .chips { display:flex; flex-wrap:wrap; gap:12px; margin-top:26px; }
  .chip { font-size:23px; font-weight:600; padding:9px 20px; border-radius:999px;
    background:rgba(255,255,255,.16); border:1px solid rgba(255,255,255,.28); }
  .url { position:absolute; right:64px; bottom:30px; font-size:21px;
    font-weight:600; color:rgba(255,255,255,.85); z-index:2; }
</style></head><body>
  <div class="wrap">
    <div class="skyline"></div>
    <div class="card"><img src="${logo}" alt="Хотол"/></div>
    <div class="right">
      <div class="brand">Хотол</div>
      <div class="sub">СӨХ-ийн дижитал шийдэл</div>
      <div class="chips">
        <span class="chip">Зар</span>
        <span class="chip">Төлбөр</span>
        <span class="chip">Хүсэлт</span>
        <span class="chip">Тайлан</span>
      </div>
    </div>
    <div class="url">khotol.com</div>
  </div>
</body></html>`;

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 500, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.screenshot({ path: 'playstore/feature-graphic-1024x500.png', clip: { x: 0, y: 0, width: 1024, height: 500 } });
  console.log('✓ playstore/feature-graphic-1024x500.png');
} finally { await browser.close(); }
