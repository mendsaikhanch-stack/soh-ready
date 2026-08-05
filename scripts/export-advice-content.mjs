// «СӨХ-ийн зөвлөгөө» модулийн бүх картыг docs/advice-content.md болгон гаргана.
//
// Зорилго: хуульч, мэргэжилтнээр контентоо хянуулахад код уншуулах шаардлагагүй
// байх. Гараар хуулбарладаггүй тул data.ts-тэй үргэлж таарна.
//
// Ажиллуулах (репогийн үндсэн фолдероос):
//   node scripts/export-advice-content.mjs
//
// data.ts-ийг өөрчилсөн бол ЭНЭ СКРИПТИЙГ ДАХИН АЖИЛЛУУЛЖ, docs/advice-content.md-г
// шинэчилнэ. Тэр файлыг ГАРААР засахгүй.

import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { CARDS, CATEGORIES, DISCLAIMER } = await import(
  pathToFileURL(join(root, 'app/lib/advice/data.ts')).href
);

const out = [];
out.push('# СӨХ-ийн зөвлөгөө — бүрэн агуулга\n');
out.push('> Автоматаар `app/lib/advice/data.ts`-ээс гаргасан. Энэ файлыг ГАРААР бүү засаарай —');
out.push('> засвараа `data.ts` дээр хийж, `node scripts/export-advice-content.mjs` ажиллуулна уу.\n');
out.push(`**Ангилал:** ${CATEGORIES.length} · **Карт:** ${CARDS.length}\n`);
out.push('**Карт бүрийн төгсгөлд апп дээр автоматаар харагдах тайлбар:**');
out.push(`> ℹ️ ${DISCLAIMER}\n`);
out.push('---\n');

out.push('## Агуулга\n');
for (const cat of CATEGORIES) {
  const n = CARDS.filter(c => c.category === cat.id).length;
  out.push(`- ${cat.icon} **${cat.label}** — ${n} карт`);
}
out.push('');
out.push('---\n');

for (const cat of CATEGORIES) {
  out.push(`## ${cat.icon} ${cat.label}\n`);
  for (const c of CARDS.filter(x => x.category === cat.id)) {
    out.push(`### 📌 ${c.title}\n`);
    out.push(`**❓ Асуулт:** ${c.question}\n`);
    out.push(`**✅ Хариулт:** ${c.answer}\n`);
    out.push('**📖 Дэлгэрэнгүй:**\n');
    for (const p of c.detail.split('\n\n')) out.push(`${p}\n`);
    out.push('**⚖️ Холбогдох хууль:**\n');
    for (const src of c.sources) {
      const article = src.article ? ` — *${src.article}*` : '';
      const url = src.url
        ? ` ([эх бичвэр](${src.url}))`
        : ' *(legalinfo.mn-ээс нэрээр нь хайна уу)*';
      out.push(`- ${src.law}${article}${url}`);
    }
    out.push('');
    out.push(`<sub>id: \`${c.id}\` · нэмэгдсэн: ${c.added}</sub>\n`);
    out.push('---\n');
  }
}

writeFileSync(join(root, 'docs/advice-content.md'), out.join('\n'), 'utf8');
console.log(`OK — ${CARDS.length} карт, ${CATEGORIES.length} ангилал → docs/advice-content.md`);
