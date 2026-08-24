// СӨХ-ийн үйлчилгээний гэрээг PDF болгож татна — Хотолын тамга, гарын үсэг
// урьдчилан суусан хувилбар. СӨХ нь зөвхөн ӨӨРИЙН талын хоосон мөрийг бөглөж,
// тамгалаад буцаана.
//
// Гэрээний текстийг энд БИЧИХГҮЙ — `app/lib/contract/service-agreement.ts`-ээс
// шууд уншина. Тэгж байж дэлгэц дээрх, Word дээрх, PDF дээрх гурав ижил байна.
//
// Тамга, гарын үсэг нь `docs/contracts/assets/`-д (git-д ОРОХГҮЙ, репо public).
// Байхгүй бол PDF нь тамгагүй, цэгтэй мөртэй гарна — гараар тамгална.
//
// Ажиллуулах:
//   node --import ./scripts/lib/alias-register.mjs scripts/make-contract-pdf.mjs <sokh_id>
//
// Товчлол (package.json-д): npm run contract:pdf -- <sokh_id>
//
// Сонголт:
//   --out=<фолдер>        # анхдагч: docs/contracts
//   --chairman="Б.Болд"   # даргын нэрийг урьдчилан буулгах
//   --register=9012345    # СӨХ-ийн улсын бүртгэлийн дугаар
//   --date=2026-08-24     # гэрээний огноо (анхдагч: өнөөдөр)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---- env (аппын модуль импортлохоос ӨМНӨ) ----
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let v = m[2].trim();
  if (/^["'].*["']$/.test(v)) v = v.slice(1, -1);
  if (v && !process.env[m[1]]) process.env[m[1]] = v;
}

const arg = (name) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

const sokhId = Number(process.argv.find((a) => /^\d+$/.test(a)));
if (!sokhId) {
  console.error('Ашиглах нь: node --import ./scripts/lib/alias-register.mjs scripts/make-contract-pdf.mjs <sokh_id>');
  process.exit(1);
}

const { loadContractState, buildContractInput } = await import('../app/lib/contract/load.ts');
const { renderContractHtml, contractFileName } = await import('../app/lib/contract/service-agreement.ts');

const state = await loadContractState(sokhId);
if (!state) {
  console.error(`❌ СӨХ #${sokhId} олдсонгүй`);
  process.exit(1);
}

const dateArg = arg('date');
const input = buildContractInput(state, {
  chairman: arg('chairman'),
  register: arg('register'),
  date: dateArg ? new Date(dateArg) : undefined,
});

// Бэхний зургийг data: URI болгож дамжуулна — гэрээ ганц файл болж хаана ч
// зөв нээгдэнэ. Аппын код дотор ХАДГАЛАХГҮЙ (репо public).
const ASSETS = path.join(ROOT, 'docs/contracts/assets');
const dataUri = (name) => {
  const file = path.join(ASSETS, name);
  if (!fs.existsSync(file)) return null;
  return `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
};

const stamp = dataUri('tugs-orchin-tamga.png');
const signature = dataUri('tugs-orchin-gariin-useg.png');
if (!stamp || !signature) {
  console.warn('⚠️  docs/contracts/assets/ хоосон — тамгагүй хувилбар гарна.');
  console.warn('   Тамга суулгах: node scripts/extract-seal.mjs <цаасны-зураг.jpg>');
}

const html = renderContractHtml(input, {
  seal: stamp && signature ? { stamp, signature } : undefined,
});

const outDir = path.resolve(ROOT, arg('out') || 'docs/contracts');
fs.mkdirSync(outDir, { recursive: true });
const file = path.join(outDir, contractFileName(input, 'html').replace(/\.html$/, '.pdf'));

const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'load' });
await page.pdf({
  path: file,
  format: 'A4',
  printBackground: true,
  // Хуудасны захыг гэрээний @page дүрэм тогтооно — энд давхар нэмэхгүй
  margin: { top: '0', right: '0', bottom: '0', left: '0' },
  preferCSSPageSize: true,
});
await browser.close();

const kb = Math.round(fs.statSync(file).size / 1024);
console.log(`\n✅ ${state.org.name} (#${sokhId}) — ${state.apartments} айл`);
console.log(`   Гэрээний дугаар: ${input.number}`);
console.log(`   ${path.relative(ROOT, file)}   ${kb} KB`);
console.log('\n   Гүйцэтгэгчийн тамга, гарын үсэг суусан. СӨХ нь өөрийн талын');
console.log('   улсын бүртгэл, хаяг, утас, даргын нэрийг бөглөж, тамгалаад буцаана.\n');
