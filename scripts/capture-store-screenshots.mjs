// Play Store-д тавих утасны screenshot-уудыг production-оос demo бүртгэлээр авна.
// 9:16 (1236×2196) — Play-ийн phone screenshot шаардлага хангана.
// Гар аргаар: node scripts/capture-store-screenshots.mjs
import puppeteer from 'puppeteer';
import { mkdirSync } from 'fs';

const BASE = 'https://www.khotol.com';
const SOKH = '2678';
const PHONE = '88000000';
const PASSWORD = 'Demo12345!';
const OUT = 'scripts/screenshots';
mkdirSync(OUT, { recursive: true });

const log = (...a) => console.log(...a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

try {
  const page = await browser.newPage();
  // 412×732 = 9:16; deviceScaleFactor 3 → 1236×2196 PNG (crisp)
  await page.setViewport({ width: 412, height: 732, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await page.setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/146 Mobile Safari/537.36');

  // PWA "суулгах" банер болон cookie зэргийг цэвэрлэх
  async function dismissBanners() {
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      const later = btns.find((b) => /^(Дараа|Хаах|Болсон|×)$/.test((b.textContent || '').trim()));
      if (later) later.click();
    }).catch(() => {});
  }

  async function shot(name, url, { settle = 2500, scrollTop = true } = {}) {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await wait(settle);
    await dismissBanners();
    if (scrollTop) await page.evaluate(() => window.scrollTo(0, 0));
    await wait(400);
    const file = `${OUT}/${name}.png`;
    await page.screenshot({ path: file });
    log(`  ✓ ${name}  ←  ${url}`);
  }

  // 1) Public хуудсууд
  log('Public дэлгэцүүд:');
  await shot('01-landing', `${BASE}/`);
  await shot('02-login', `${BASE}/login`);

  // Login хийх (session авах)
  log('Demo нэвтрэлт хийж байна…');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('input[type=tel]', { timeout: 20000 });
  await page.type('input[type=tel]', PHONE, { delay: 25 });
  await page.type('input[type=password]', PASSWORD, { delay: 25 });
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /Нэвтрэх/.test(x.textContent || ''));
    if (b) b.click();
  });
  await page.waitForFunction(() => /\/sokh\//.test(location.pathname), { timeout: 30000 });
  log(`  ✓ Нэвтэрсэн → ${page.url()}`);

  // 2) Auth шаардлагатай дэлгэцүүд
  log('Дотоод дэлгэцүүд:');
  await shot('03-dashboard', `${BASE}/sokh/${SOKH}`, { settle: 3500 });
  await shot('04-payments', `${BASE}/sokh/${SOKH}/payments`, { settle: 3000 });
  await shot('05-announcements', `${BASE}/sokh/${SOKH}/announcements`, { settle: 3000 });
  await shot('06-complaints', `${BASE}/sokh/${SOKH}/complaints`, { settle: 3000 });
  await shot('07-reports', `${BASE}/sokh/${SOKH}/reports`, { settle: 3000 });
  await shot('08-contact', `${BASE}/sokh/${SOKH}/contact`, { settle: 3000 });

  log('\n✅ Бүх screenshot бэлэн боллоо →', OUT);
} catch (e) {
  log('АЛДАА:', e.message);
} finally {
  await browser.close();
}
