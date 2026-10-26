// «АйСиТаун» СӨХ (#2694) — 2026 оны 10-р сарын хураамжийн нэхэмжлэх, айл бүрт 55,000₮.
//
// Энэ нь ЗӨВХӨН энэ нэг СӨХ-д зориулсан нэг удаагийн скрипт (2026-10-25).
//
// Дүрэм (даргын хүсэлт):
//   - 1-р давхрын тоотуудад нэхэмжлэх ҮҮСГЭХГҮЙ.
//   - СӨХ шинээр эхэлж байгаа — өмнөх өр, «Эхний үлдэгдэл» байхгүй.
//   - Төлөх хугацаа = 11-р сарын 5 (residentDueDate-ийн дүрэм) — тэр хүртэл өр биш.
//
// Нэг тоотод нэг л нэхэмжлэх: даргын импортолсон мөр (floor бөглөгдсөн) дээр.
// floor хоосон мөрүүд нь өөрөө бүртгүүлсэн гэр бүлийн гишүүн / буруу байраар
// бүртгүүлсэн (merge-ictown-strays.mjs) / баталгаажаагүй — тэдэнд үүсгэвэл
// нэг айлд давхар нэхэмжлэх очно.
//
// Ажиллуулах:
//   node scripts/create-ictown-invoices-2026-10.mjs            # dry-run: юу ч бичихгүй
//   node scripts/create-ictown-invoices-2026-10.mjs --commit   # бодитоор бичнэ

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COMMIT = process.argv.includes('--commit');

for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) {
    let v = m[2].trim();
    if (/^["'].*["']$/.test(v)) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const SOKH = 2694;
const YEAR = 2026;
const MONTH = 10;
const AMOUNT = 55000;
const DUE_DATE = '2026-11-05'; // residentDueDate(2026, 10)
const DESCRIPTION = `${MONTH}-р сар ${YEAR} - сарын хураамж`;

const { data: residents, error: e1 } = await sb
  .from('residents')
  .select('id, building, apartment, floor, pending_claim')
  .eq('sokh_id', SOKH);
if (e1) throw e1;

const billable = [];
const skipped = { floor1: 0, noFloor: [], pending: 0 };
for (const r of residents) {
  if (r.pending_claim) { skipped.pending++; continue; }
  if (r.floor == null || r.floor === '') { skipped.noFloor.push(`${r.id}:${r.building}-${r.apartment}`); continue; }
  if (Number(r.floor) === 1) { skipped.floor1++; continue; }
  billable.push(r);
}

// Нэг тоотод нэг л мөр байх ёстой
const seen = new Map();
for (const r of billable) {
  const key = `${r.building}-${r.apartment}`;
  if (seen.has(key)) throw new Error(`Давхар тоот: ${key} (#${seen.get(key)}, #${r.id})`);
  seen.set(key, r.id);
}

const { data: existing, error: e2 } = await sb
  .from('invoices')
  .select('resident_id')
  .eq('sokh_id', SOKH)
  .eq('year', YEAR)
  .eq('month', MONTH);
if (e2) throw e2;
const have = new Set(existing.map(i => i.resident_id));
const rows = billable
  .filter(r => !have.has(r.id))
  .map(r => ({
    sokh_id: SOKH,
    resident_id: r.id,
    year: YEAR,
    month: MONTH,
    amount: AMOUNT,
    due_date: DUE_DATE,
    status: 'pending',
    description: DESCRIPTION,
  }));

const perBuilding = {};
for (const r of billable) perBuilding[r.building] = (perBuilding[r.building] || 0) + 1;

console.log(`Горим: ${COMMIT ? 'COMMIT (бодитоор бичнэ)' : 'DRY-RUN'}`);
console.log(`Нийт мөр ${residents.length}: нэхэмжлэх ${billable.length}, 1-р давхар ${skipped.floor1}, баталгаажаагүй ${skipped.pending}, байргүй/давхар ${skipped.noFloor.length}`);
console.log(`  алгассан (floor хоосон): ${skipped.noFloor.join(', ')}`);
console.log(`Орцоор: ${Object.entries(perBuilding).sort().map(([b, n]) => `${b}=${n}`).join(', ')}`);
console.log(`Аль хэдийн байгаа: ${have.size}, шинээр: ${rows.length} × ${AMOUNT.toLocaleString()}₮ = ${(rows.length * AMOUNT).toLocaleString()}₮`);
console.log(`Тайлбар: «${DESCRIPTION}», төлөх хугацаа ${DUE_DATE}`);

if (!COMMIT) { console.log('\nDry-run — бичсэнгүй. --commit-оор ажиллуул.'); process.exit(0); }

let created = 0;
for (let i = 0; i < rows.length; i += 200) {
  const { data, error } = await sb
    .from('invoices')
    .upsert(rows.slice(i, i + 200), { onConflict: 'resident_id,year,month', ignoreDuplicates: true })
    .select('id');
  if (error) throw error;
  created += data.length;
}
console.log(`\n✓ ${created} нэхэмжлэх үүслээ.`);
