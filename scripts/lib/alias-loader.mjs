// `@/...` алиасыг төслийн үндэс рүү заана — аппын TypeScript модулийг скриптээс
// шууд дуудахад хэрэгтэй. Node 24 нь .ts файлын төрлийг өөрөө хуулж уншдаг тул
// bundler хэрэггүй, зөвхөн энэ алиас дутдаг.
//
// Ашиглах:
//   node --import ./scripts/lib/alias-register.mjs scripts/<script>.mjs

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = new URL('../../', import.meta.url);
const EXT = ['.ts', '.tsx', '.mjs', '.js', '/index.ts'];

/** Өргөтгөлгүй замыг .ts/.tsx болгож нөхнө (TypeScript-ийн заншил) */
function withExt(base) {
  if (existsSync(fileURLToPath(base))) return base;
  for (const ext of EXT) {
    const candidate = new URL(base.href + ext);
    if (existsSync(fileURLToPath(candidate))) return candidate;
  }
  return null;
}

export async function resolve(specifier, context, next) {
  // `@/app/lib/...` — төслийн үндэснээс
  if (specifier.startsWith('@/')) {
    const hit = withExt(new URL(specifier.slice(2), ROOT));
    if (hit) return next(hit.href, context);
  }

  // `./service-agreement` — өргөтгөлгүй харьцангуй зам
  if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) && context.parentURL) {
    const hit = withExt(new URL(specifier, context.parentURL));
    if (hit) return next(hit.href, context);
  }

  return next(specifier, context);
}
