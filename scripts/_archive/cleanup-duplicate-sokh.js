// Clean up duplicate sokh_organizations rows that were created during the
// botched second commit run.
//
// Strategy: for each (khoroo_id, lowercased trimmed name) group, keep the
// row with the LOWEST id (the one created in the first, successful run) and
// delete the rest. ON DELETE CASCADE on sokh_activation_tokens.sokh_id
// automatically removes the orphaned tokens.
//
// Modes:
//   default → DRY RUN (lists what would be deleted)
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
  console.log(`Mode: ${COMMIT ? 'COMMIT (DELETE хийнэ)' : 'DRY-RUN (харуулна л)'}`);

  // Бүх СӨХ-г татах (paginated to bypass PostgREST 1000-row default)
  const all = [];
  let from = 0;
  while (true) {
    const { data, error } = await sb.from('sokh_organizations')
      .select('id, khoroo_id, name, claim_status, created_at')
      .order('id', { ascending: true })
      .range(from, from + 999);
    if (error) { console.error(error); process.exit(1); }
    if (!data?.length) break;
    all.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  console.log('Нийт СӨХ:', all.length);

  // Group by (khoroo_id | name.toLowerCase().trim())
  const groups = new Map();
  for (const o of all) {
    const k = o.khoroo_id + '|' + o.name.toLowerCase().trim();
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(o);
  }

  const dupes = [...groups.entries()].filter(([_, arr]) => arr.length > 1);
  console.log('Давхардсан группын тоо:', dupes.length);

  // For each group: keep min(id), delete rest
  const toDelete = [];
  for (const [_, arr] of dupes) {
    arr.sort((a, b) => a.id - b.id);
    for (let i = 1; i < arr.length; i++) toDelete.push(arr[i]);
  }
  console.log('Устгах мөрийн тоо:', toDelete.length);

  if (toDelete.length === 0) {
    console.log('Цэвэрлэх юм алга'); return;
  }

  // Жишээ
  console.log('\nЖишээ устгагдах мөрүүд (эхний 5):');
  toDelete.slice(0, 5).forEach(o => {
    const groupKey = o.khoroo_id + '|' + o.name.toLowerCase().trim();
    const keeper = groups.get(groupKey)[0];
    console.log(`  устгах id ${o.id} ("${o.name}") ← хадгалах id ${keeper.id} (${o.created_at.slice(0,19)})`);
  });

  if (!COMMIT) {
    console.log('\nDRY-RUN — DB-д юу ч устсангүй.');
    console.log('Устгахдаа:  node scripts/cleanup-duplicate-sokh.js --commit');
    return;
  }

  // Commit: delete in chunks of 100
  console.log('\nDELETE-ийг гүйцэтгэж байна...');
  let deleted = 0, fail = 0;
  for (let i = 0; i < toDelete.length; i += 100) {
    const chunk = toDelete.slice(i, i + 100).map(o => o.id);
    const { error } = await sb.from('sokh_organizations').delete().in('id', chunk);
    if (error) { console.error('chunk error:', error.message); fail += chunk.length; }
    else deleted += chunk.length;
    if ((i + 100) % 500 === 0) console.log(`  ... ${deleted}/${toDelete.length}`);
  }
  console.log(`\nDELETE дууссан: ${deleted} амжилттай, ${fail} алдаатай`);

  // Дараах байдлыг шалгах
  const { count: orgCount } = await sb.from('sokh_organizations').select('*', { count: 'exact', head: true });
  const { count: tokCount } = await sb.from('sokh_activation_tokens').select('*', { count: 'exact', head: true });
  console.log(`\nDB сүүлийн тоо: sokh=${orgCount}, tokens=${tokCount}`);
})().catch(e => { console.error(e); process.exit(1); });
