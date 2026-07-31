// docs/onboarding/*.html → PDF + PNG. Шинэ СӨХ-д өгөх хэвлэх/тараах материал.
//   node scripts/make-onboarding-pdf.mjs
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(__dirname, '..', 'docs', 'onboarding');

// png: true → нэмж зураг болгоно (Facebook/Viber бүлэгт тараахад)
const jobs = [
  { html: 'orshin-suugch-qr-niitiin.html', pdf: 'orshin-suugch-qr-niitiin.pdf', png: true },
  { html: 'orshin-suugch-qr.html', pdf: 'orshin-suugch-qr.pdf', png: true },
  { html: 'admin-garyn-avlaga.html', pdf: 'admin-garyn-avlaga.pdf' },
];

const browser = await puppeteer.launch();
for (const job of jobs) {
  const page = await browser.newPage();
  const file = 'file:///' + path.join(dir, job.html).replace(/\\/g, '/');
  await page.goto(file, { waitUntil: 'networkidle0' });

  // preferCSSPageSize — HTML доторх @page { size / margin } тохиргоог мөрдөнө
  await page.pdf({
    path: path.join(dir, job.pdf),
    printBackground: true,
    preferCSSPageSize: true,
  });
  console.log('✓', job.pdf);

  if (job.png) {
    // 2x нягтралтай — утсан дээр ч тод харагдана
    await page.setViewport({ width: 900, height: 1200, deviceScaleFactor: 2 });
    const sheet = await page.$('.sheet');
    await sheet.screenshot({ path: path.join(dir, job.pdf.replace(/\.pdf$/, '.png')) });
    console.log('✓', job.pdf.replace(/\.pdf$/, '.png'));
  }

  await page.close();
}
await browser.close();
