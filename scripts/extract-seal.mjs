// Төгс Орчин ХХК-ийн тамга, захирлын гарын үсгийг цаасны зургаас ялгаж авна.
//
// Гэрээ бүрд урьдчилан тамгалсан хувилбар өгөхийн тулд хоёуланг нь ил тод
// дэвсгэртэй PNG болгож `docs/contracts/assets/`-д хадгална.
//
// ⚠️ ЭНЭ РЕПО PUBLIC. Гарсан PNG-г git-д ХЭЗЭЭ Ч бүү оруул — тамга, гарын
//    үсэг нийтэд тарвал хэн ч хуурамч баримт үйлдэж чадна. `docs/contracts/`
//    бүхэлдээ .gitignore-д байгаа.
//
// Ажиллуулах:
//   node scripts/extract-seal.mjs [эх-зураг.jpg]
//
// Эх зураг солигдвол доорх CROP тохиргоог шинэ зурагт тааруулж засна.
// Шалгахдаа `docs/contracts/assets/*-preview.png` (цагаан дэвсгэр дээр) хар.

import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.argv[2] || 'C:/Users/MNG/Downloads/cf075525-0225-4f60-83c4-3210cafb7ccd.jpg';
const ASSETS = path.join(ROOT, 'docs/contracts/assets');

// Цаас vs бэхний саарал түвшин. Зураг бүрд өөр — `paper` нь цаасны голч,
// `ink` нь бэхний хамгийн бараан хэсэг. Хооронд нь шугаман байдлаар alpha болгоно.
const CROPS = [
  {
    name: 'tugs-orchin-tamga',
    label: 'Тамга',
    box: { left: 163, top: 744, width: 340, height: 352 },
    paper: 182, ink: 72, rgb: [26, 79, 160], width: 420, rotate: -0.8,
  },
  {
    name: 'tugs-orchin-gariin-useg',
    label: 'Гарын үсэг',
    box: { left: 499, top: 712, width: 431, height: 285 },
    paper: 178, ink: 60, rgb: [17, 17, 17], width: 460, rotate: 0,
  },
];

const GAMMA = 1.6; // цаасны сүүдрийг дарж, бэхийг тод үлдээнэ

async function cut(c) {
  let img = sharp(SRC).extract(c.box);
  if (c.rotate) img = img.rotate(c.rotate, { background: { r: 255, g: 255, b: 255 } });

  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  const px = info.width * info.height;
  const rgba = Buffer.alloc(px * 4);

  for (let i = 0; i < px; i++) {
    const r = data[i * ch], g = data[i * ch + 1], b = data[i * ch + 2];
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    const a = Math.max(0, Math.min(1, (c.paper - gray) / (c.paper - c.ink))) ** GAMMA;
    rgba[i * 4] = c.rgb[0];
    rgba[i * 4 + 1] = c.rgb[1];
    rgba[i * 4 + 2] = c.rgb[2];
    rgba[i * 4 + 3] = Math.round(a * 255);
  }

  const base = sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
    .resize({ width: c.width, kernel: 'lanczos3' });

  const out = path.join(ASSETS, `${c.name}.png`);
  const res = await base.clone().png({ compressionLevel: 9, palette: true, colours: 32 }).toFile(out);
  await base.clone().flatten({ background: '#ffffff' })
    .png().toFile(path.join(ASSETS, `${c.name}-preview.png`));

  console.log(`  ${c.label.padEnd(12)} ${res.width}×${res.height}  ${Math.round(res.size / 1024)} KB`);
  return { ...c, file: out, w: res.width, h: res.height };
}

fs.mkdirSync(ASSETS, { recursive: true });
console.log(`\n✂️  ${path.basename(SRC)}-аас ялгаж байна:`);
await Promise.all(CROPS.map(cut));

console.log('\n✅ docs/contracts/assets/ — git-д ОРОХГҮЙ (репо public).');
console.log('   Шалгах: *-preview.png (цагаан дэвсгэр дээр)');
console.log('   Гэрээнд суулгах: node --import ./scripts/lib/alias-register.mjs \\');
console.log('                      scripts/make-contract-pdf.mjs <sokh_id>\n');
