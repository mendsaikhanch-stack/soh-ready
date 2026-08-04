// docs/onboarding/*.html хуудсууд НЭГ A4 нүүрэнд багтаж байгаа эсэхийг шалгана.
//
//   node scripts/check-print-fit.mjs                       # бүх хэвлэх хуудас
//   node scripts/check-print-fit.mjs orshin-suugch-qr.html # тодорхой файл
//
// Яагаад хэрэгтэй вэ: HTML-д мөр нэмэхэд PDF чимээгүйхэн 2 нүүр болдог.
// Хэвлэсний дараа л мэдэгддэг тул өөрчлөлт хийсэн бүрдээ энэ скриптийг
// ажиллуулж, дараа нь `node scripts/make-onboarding-pdf.mjs` хийнэ.

import puppeteer from 'puppeteer';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(__dirname, '..', 'docs', 'onboarding');

// A4 portrait 210×297mm, @page margin 12mm → 186×273mm ≈ 703×1032px (96dpi)
const PRINT_W = 703;
const PRINT_H = 1032;

const files = process.argv.slice(2);
const targets = files.length
  ? files
  : ['orshin-suugch-qr-niitiin.html', 'orshin-suugch-qr.html'];

const browser = await puppeteer.launch();
let failed = false;

for (const f of targets) {
  const page = await browser.newPage();
  await page.setViewport({ width: PRINT_W, height: PRINT_H });
  await page.emulateMediaType('print'); // @media print дүрмийг мөрдүүлнэ
  await page.goto('file:///' + path.join(dir, f).replace(/\\/g, '/'), {
    waitUntil: 'networkidle0',
  });

  const m = await page.evaluate(() => {
    const sheet = document.querySelector('.sheet');
    const parts = {};
    for (const sel of ['.brandbar', '.hero', '.cta', '.core', '.cases', '.creds', '.foot']) {
      const el = document.querySelector(sel);
      if (el) parts[sel] = Math.round(el.getBoundingClientRect().height);
    }
    return { height: Math.round(sheet.getBoundingClientRect().height), parts };
  });

  const spare = PRINT_H - m.height;
  const ok = spare >= 0;
  if (!ok) failed = true;
  console.log(
    `${ok ? '✓' : '✗'} ${f} — ${m.height}px / ${PRINT_H}px ` +
      (ok ? `(${spare}px үлдсэн)` : `ХЭТЭРСЭН ${-spare}px → 2 нүүр болно`),
  );
  console.log('   ', JSON.stringify(m.parts));
  await page.close();
}

await browser.close();
if (failed) {
  console.error('\n@media print доторх зайг багасгаж дахин шалгана уу.');
  process.exit(1);
}
