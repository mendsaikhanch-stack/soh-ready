import puppeteer from 'puppeteer';
import fs from 'node:fs';

const URL = process.env.URL || 'http://localhost:3000/demo';
const OUT = 'C:/Users/MNG/AppData/Local/Temp/easybox-smoke';
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const log = (m) => console.log(`[smoke] ${m}`);

let browser;
let failed = false;

try {
  browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

  const consoleErrors = [];
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(`console.error: ${msg.text()}`);
  });

  log(`navigating ${URL}`);
  const resp = await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });
  log(`HTTP ${resp.status()}`);
  if (resp.status() !== 200) throw new Error(`bad status ${resp.status()}`);

  await page.screenshot({ path: `${OUT}/01-home.png` });

  // Click bottom tab "Илгээмж"
  log('clicking Илгээмж tab');
  const clicked = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const t = btns.find(b => b.textContent && b.textContent.includes('Илгээмж'));
    if (t) { t.click(); return true; }
    return false;
  });
  if (!clicked) throw new Error('Илгээмж tab button not found');

  await sleep(800); // smooth scroll
  await page.screenshot({ path: `${OUT}/02-parcels.png` });

  // Verify hero + cards visible
  const heroOk = await page.evaluate(() => {
    return document.body.innerText.includes('ХҮЛЭЭЖ БУЙ')
      && document.body.innerText.includes('илгээмж танай хайрцагт байна');
  });
  if (!heroOk) throw new Error('EasyBox hero not visible');
  log('hero visible ✓');

  // Reveal first code
  log('revealing first code');
  const revealClicked = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const t = btns.find(b => b.textContent && b.textContent.includes('Хүлээн авах код харах'));
    if (t) { t.scrollIntoView({ block: 'center' }); t.click(); return true; }
    return false;
  });
  if (!revealClicked) throw new Error('reveal button not found');
  await sleep(300);

  const revealedOk = await page.evaluate(() => {
    return document.body.innerText.includes('Хүлээн авах код')
      && document.body.innerText.includes('Кодыг нуух');
  });
  if (!revealedOk) throw new Error('code reveal did not render hidden state');
  log('code revealed ✓');
  await page.screenshot({ path: `${OUT}/03-revealed.png` });

  // Hide it again
  log('hiding code');
  const hideClicked = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const t = btns.find(b => b.textContent && b.textContent.trim() === 'Кодыг нуух');
    if (t) { t.click(); return true; }
    return false;
  });
  if (!hideClicked) throw new Error('hide button not found');
  await sleep(300);

  const hiddenOk = await page.evaluate(() =>
    document.body.innerText.includes('Хүлээн авах код харах')
  );
  if (!hiddenOk) throw new Error('code did not return to hidden state');
  log('hidden again ✓');

  // History section present
  const historyOk = await page.evaluate(() =>
    document.body.innerText.includes('ӨМНӨХ ИЛГЭЭМЖ')
  );
  if (!historyOk) throw new Error('history section missing');
  log('history section ✓');

  log('--- console/page errors ---');
  for (const e of consoleErrors) console.log('  ' + e);
  log(`errors: ${consoleErrors.length}`);
  log(`screenshots → ${OUT}`);
} catch (err) {
  failed = true;
  console.error(`[smoke] FAIL: ${err.message}`);
} finally {
  if (browser) await browser.close();
  process.exit(failed ? 1 : 0);
}
