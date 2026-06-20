// Demo login-ийг production (www.khotol.com) дээр reviewer шиг шалгах туршилт.
// Гар аргаар: node scripts/test-demo-login.mjs
import puppeteer from 'puppeteer';

const PHONE = '88000000';
const PASSWORD = 'Demo12345!';
const BASE = 'https://www.khotol.com';

const log = (...a) => console.log(...a);

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true }); // iPhone-12 төстэй
  await page.setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/146 Mobile Safari/537.36');

  // Supabase auth хариуг барих
  let authStatus = null;
  let authBody = null;
  page.on('response', async (res) => {
    const u = res.url();
    if (u.includes('/auth/v1/token')) {
      authStatus = res.status();
      try { authBody = await res.text(); } catch {}
    }
  });
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

  log('1) /login нээж байна…');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2', timeout: 60000 });

  await page.waitForSelector('input[type=tel]', { timeout: 20000 });
  log('   ✓ Login форм ачаалагдсан');

  await page.type('input[type=tel]', PHONE, { delay: 30 });
  await page.type('input[type=password]', PASSWORD, { delay: 30 });
  log(`2) Утас=${PHONE}, нууц үг оруулсан. "Нэвтрэх" дарж байна…`);

  // "Нэвтрэх" товч (loading биш үндсэн товч)
  const clicked = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const b = btns.find((x) => /Нэвтрэх/.test(x.textContent || ''));
    if (b) { b.click(); return true; }
    return false;
  });
  log(`   товч дарсан: ${clicked}`);

  // auth хариу эсвэл навигаци хүлээх
  await new Promise((r) => setTimeout(r, 6000));

  const finalUrl = page.url();
  // Зөвхөн login форм дотрох алдааны баннерыг ав (dashboard-ийн улаан мэдэгдлийг биш)
  const errorBanner = await page.evaluate(() => {
    if (!/\/login/.test(location.pathname)) return null;
    const el = document.querySelector('.bg-red-50');
    return el ? el.textContent.trim() : null;
  });
  await page.screenshot({ path: 'scripts/demo-login-result.png' });
  const headings = await page.evaluate(() =>
    [...document.querySelectorAll('h1,h2,nav,header')].map(e => (e.textContent||'').trim()).filter(Boolean).slice(0, 6)
  );
  log('Dashboard толгойнууд   :', JSON.stringify(headings, null, 0).slice(0, 300));

  log('\n===== ҮР ДҮН =====');
  log('Supabase auth status :', authStatus);
  if (authBody) {
    try {
      const j = JSON.parse(authBody);
      if (j.access_token) log('Auth                 : ✅ ОЛГОСОН (access_token ирсэн)');
      else log('Auth                 : ❌', j.error || j.msg || j.error_description || authBody.slice(0, 200));
    } catch { log('Auth body            :', authBody.slice(0, 200)); }
  }
  log('Эцсийн URL           :', finalUrl);
  log('Алдааны баннер       :', errorBanner || '(байхгүй)');
  log('Console errors       :', consoleErrors.length ? consoleErrors.slice(0, 3) : '(байхгүй)');

  const success = authStatus === 200 && !/\/login$/.test(finalUrl) && !errorBanner;
  log('\nДҮГНЭЛТ:', success ? '✅ DEMO LOGIN АЖИЛЛАЖ БАЙНА' : '❌ Login амжилтгүй / шалгах шаардлагатай');
} catch (e) {
  log('ТЕСТ АЛДАА:', e.message);
} finally {
  await browser.close();
}
