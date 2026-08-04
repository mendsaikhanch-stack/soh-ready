// docs/onboarding/*.html → PDF + PNG. Шинэ СӨХ-д өгөх хэвлэх/тараах материал.
//   node scripts/make-onboarding-pdf.mjs
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(__dirname, '..', 'docs', 'onboarding');

// pdf → хэвлэх файл (хүсэхгүй бол орхино)
// png → нэмж зураг болгоно (Facebook/Viber бүлэгт тараахад)
// viewport → .sheet-ийн бодит хэмжээтэй тааруулах (дөрвөлжин пост гэх мэт)
const jobs = [
  { html: 'orshin-suugch-qr-niitiin.html', pdf: 'orshin-suugch-qr-niitiin.pdf', png: 'orshin-suugch-qr-niitiin.png' },
  { html: 'orshin-suugch-qr.html', pdf: 'orshin-suugch-qr.pdf', png: 'orshin-suugch-qr.png' },
  { html: 'admin-garyn-avlaga.html', pdf: 'admin-garyn-avlaga.pdf' },
  // СӨХ-ийн дарга оршин суугчиддаа тавих дөрвөлжин зарлалын пост — зөвхөн зураг
  { html: 'post-orshin-suugch.html', png: 'post-orshin-suugch.png', viewport: { width: 1080, height: 1080 } },
];

const browser = await puppeteer.launch();
for (const job of jobs) {
  const page = await browser.newPage();
  if (job.viewport) await page.setViewport({ ...job.viewport, deviceScaleFactor: 1 });
  const file = 'file:///' + path.join(dir, job.html).replace(/\\/g, '/');
  await page.goto(file, { waitUntil: 'networkidle0' });

  if (job.pdf) {
    // preferCSSPageSize — HTML доторх @page { size / margin } тохиргоог мөрдөнө
    await page.pdf({
      path: path.join(dir, job.pdf),
      printBackground: true,
      preferCSSPageSize: true,
    });
    console.log('✓', job.pdf);
  }

  if (job.png) {
    // viewport заагаагүй бол 2x нягтралтай — утсан дээр ч тод харагдана
    if (!job.viewport) await page.setViewport({ width: 900, height: 1200, deviceScaleFactor: 2 });
    const sheet = await page.$('.sheet');
    await sheet.screenshot({ path: path.join(dir, job.png) });
    console.log('✓', job.png);
  }

  await page.close();
}
await browser.close();
