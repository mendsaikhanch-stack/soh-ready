// Тамга, гарын үсгийг Supabase Storage-ийн ХААЛТТАЙ bucket-д байршуулна.
//
// Ингэснээр СӨХ-ийн дарга /admin/contract-аас татсан гэрээнд тамга суусан
// байна — СӨХ бүрд гараар PDF гаргах шаардлагагүй болно.
//
// Bucket нь `public: false`. Хэн ч URL-аар татаж чадахгүй, зөвхөн service
// role-оор сервер тал уншина (app/lib/contract/seal.ts).
//
// Ажиллуулах:
//   node scripts/upload-seal.mjs            # шалгана, юу ч бичихгүй
//   node scripts/upload-seal.mjs --commit   # bucket үүсгээд байршуулна
//
// Эх зураг: docs/contracts/assets/ (git-д ОРОХГҮЙ).
// Байхгүй бол эхлээд: node scripts/extract-seal.mjs <цаасны-зураг.jpg>

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COMMIT = process.argv.includes('--commit');
const ASSETS = path.join(ROOT, 'docs/contracts/assets');

const BUCKET = 'contract-seal';
const FILES = ['tugs-orchin-tamga.png', 'tugs-orchin-gariin-useg.png'];

for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let v = m[2].trim();
  if (/^["'].*["']$/.test(v)) v = v.slice(1, -1);
  if (v && !process.env[m[1]]) process.env[m[1]] = v;
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ---- 1. Эх файлууд ----
const missing = FILES.filter((f) => !fs.existsSync(path.join(ASSETS, f)));
if (missing.length) {
  console.error(`\n❌ docs/contracts/assets/-д алга: ${missing.join(', ')}`);
  console.error('   Эхлээд: node scripts/extract-seal.mjs <цаасны-зураг.jpg>');
  process.exit(1);
}

console.log('\n📄 Байршуулах файл:');
for (const f of FILES) {
  console.log(`   ${f.padEnd(32)} ${Math.round(fs.statSync(path.join(ASSETS, f)).size / 1024)} KB`);
}

// ---- 2. Bucket ----
const { data: buckets, error: listErr } = await sb.storage.listBuckets();
if (listErr) {
  console.error(`\n❌ Bucket жагсаалт уншиж чадсангүй: ${listErr.message}`);
  process.exit(1);
}
const existing = (buckets || []).find((b) => b.name === BUCKET);

console.log(`\n🪣 Bucket "${BUCKET}": ${existing ? (existing.public ? '⚠️ БАЙНА, ГЭХДЭЭ ОЛОН НИЙТЭД НЭЭЛТТЭЙ' : 'байна (хаалттай ✓)') : 'алга → үүсгэнэ'}`);

if (existing && existing.public) {
  console.error('\n❌ Энэ bucket нээлттэй байна — тамга нийтэд задарна.');
  console.error('   Supabase Dashboard → Storage → тохиргоог "Private" болгоно уу.');
  process.exit(1);
}

if (!COMMIT) {
  console.log('\n🔍 Шалгалт дууслаа — юу ч бичсэнгүй.');
  console.log('   Байршуулахдаа: node scripts/upload-seal.mjs --commit\n');
} else {

if (!existing) {
  const { error } = await sb.storage.createBucket(BUCKET, {
    public: false,
    allowedMimeTypes: ['image/png'],
    fileSizeLimit: '2MB',
  });
  if (error) {
    console.error(`❌ Bucket үүсгэж чадсангүй: ${error.message}`);
    process.exit(1);
  }
  console.log('   ✓ Үүсгэв (хаалттай)');
}

// ---- 3. Байршуулах ----
let ok = 0;
for (const f of FILES) {
  const { error } = await sb.storage
    .from(BUCKET)
    .upload(f, fs.readFileSync(path.join(ASSETS, f)), { contentType: 'image/png', upsert: true });
  if (error) console.error(`   ❌ ${f}: ${error.message}`);
  else { ok++; console.log(`   ✓ ${f}`); }
}

// ---- 4. Нээлттэй биш эсэхийг батлах ----
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});
const { data: leak } = await anon.storage.from(BUCKET).download(FILES[0]);
console.log(`\n🔒 Anon түлхүүрээр татаж үзэхэд: ${leak ? '❌ ТАТАГДАЖ БАЙНА — bucket-ыг private болгоно уу!' : 'татагдахгүй ✓'}`);

console.log(`\n✅ ${ok}/${FILES.length} файл байршлаа.`);
console.log('   Эрх нээсэн СӨХ /admin/contract-аас татахад гэрээ нь тамгатай гарна.\n');

}
