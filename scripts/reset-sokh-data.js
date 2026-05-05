// Wipe all SOKH data added by the botched import runs and start clean.
//
// What it deletes:
//   - All sokh_organizations rows (CASCADE removes sokh_activation_tokens)
//   - The 6 auto-created khoroos (id 209-214) — these were correctly created
//     so we KEEP them. The script will resolve them via exact match next run.
//
// What it KEEPS:
//   - The 6 setup demo SOKHs (Нарантуул, Од, Алтан гадас, Номин, Баянзүрх СӨХ-1,
//     Сүхбаатар СӨХ-1) — these came from setup-locations.js and are unrelated
//     to the import.
//
// Modes:
//   default  → DRY-RUN
//   --commit → actually deletes

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const ROOT = path.resolve(__dirname, '..');
const env = {};
fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/).forEach(l => {
  const m = l.match(/^([^#=]+)=(.*)$/); if (m) env[m[1].trim()] = m[2].trim();
});
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const COMMIT = process.argv.includes('--commit');

(async () => {
  console.log(`Mode: ${COMMIT ? 'COMMIT (DELETE хийнэ)' : 'DRY-RUN'}`);

  // Татах: бүх sokh_organizations
  const all = [];
  let from = 0;
  while (true) {
    const { data, error } = await sb.from('sokh_organizations')
      .select('id, name, khoroo_id, created_at, claim_status')
      .order('id').range(from, from + 999);
    if (error) { console.error(error); process.exit(1); }
    if (!data?.length) break;
    all.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  console.log('Нийт СӨХ:', all.length);

  // Setup-аас үлдсэн id-ууд (created_at нь 2026-03-20-нд)
  const setupIds = all
    .filter(o => o.created_at < '2026-03-21')
    .map(o => o.id);

  // Идэвхтэй (active) болсон СӨХ — устгахаас сэргийлж хадгал
  const activeIds = all
    .filter(o => o.claim_status === 'active')
    .map(o => o.id);

  const keepIds = new Set([...setupIds, ...activeIds]);
  const toDelete = all.filter(o => !keepIds.has(o.id));

  console.log(`Хадгалах: ${keepIds.size} (setup: ${setupIds.length}, идэвхтэй: ${activeIds.length})`);
  console.log(`Устгах:   ${toDelete.length}`);

  if (activeIds.length > 0) {
    console.log('\nИдэвхтэй СӨХ-уудыг устгахгүй:');
    all.filter(o => activeIds.includes(o.id)).slice(0, 10).forEach(o =>
      console.log(`  id ${o.id} | ${o.name}`));
  }

  console.log(`\nЖишээ устгагдах (эхний 5):`);
  toDelete.slice(0, 5).forEach(o =>
    console.log(`  id ${o.id} | ${JSON.stringify(o.name)} | kh ${o.khoroo_id}`));

  if (!COMMIT) {
    console.log('\nDRY-RUN.  Устгахдаа: node scripts/reset-sokh-data.js --commit');
    return;
  }

  console.log('\nDELETE-ийг гүйцэтгэж байна...');
  let deleted = 0, fail = 0;
  for (let i = 0; i < toDelete.length; i += 200) {
    const chunk = toDelete.slice(i, i + 200).map(o => o.id);
    const { error } = await sb.from('sokh_organizations').delete().in('id', chunk);
    if (error) { console.error('chunk err:', error.message); fail += chunk.length; }
    else deleted += chunk.length;
    if ((i / 200) % 5 === 0) console.log(`  ... ${deleted}/${toDelete.length}`);
  }
  console.log(`\nDELETE дууссан: ${deleted} амжилттай, ${fail} алдаа`);

  // Тоог batal
  const { count: orgCount } = await sb.from('sokh_organizations').select('*', { count: 'exact', head: true });
  const { count: tokCount } = await sb.from('sokh_activation_tokens').select('*', { count: 'exact', head: true });
  console.log(`\nDB сүүлийн тоо: sokh=${orgCount}, tokens=${tokCount}`);
})().catch(e => { console.error(e); process.exit(1); });
