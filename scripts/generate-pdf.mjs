import puppeteer from 'puppeteer';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const htmlPath = path.join(root, 'presentations', '4-Дээд-зөвлөл-танилцуулга.html');
const pdfPath = path.join(root, 'public', 'hotol-tanilzuulga.pdf');

const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.goto('file:///' + htmlPath.replace(/\\/g, '/'), { waitUntil: 'networkidle0' });
await page.pdf({
  path: pdfPath,
  format: 'A4',
  landscape: true,
  printBackground: true,
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
});
await browser.close();
console.log('PDF үүслээ:', pdfPath);
