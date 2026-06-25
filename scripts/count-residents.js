// READ-ONLY: СӨХ бүрийн оршин суугчдын тоог гаргана (хамгийн ихээс нь).
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const ENV_FILE = path.join(path.resolve(__dirname, '..'), '.env.local');
for (const line of fs.readFileSync(ENV_FILE, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) { let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; }
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

(async () => {
  // бүх residents-ийг sokh_id, debt-тэй татаж paginate
  let rows = [], from = 0; const PAGE = 1000;
  while (true) {
    const { data, error } = await sb.from('residents').select('id, sokh_id, name, apartment, debt').order('id').range(from, from + PAGE - 1);
    if (error) { console.error('residents алдаа:', error.message); process.exit(1); }
    rows = rows.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  console.log('Нийт оршин суугч (бүх СӨХ):', rows.length, '\n');

  const byS = {};
  for (const r of rows) { byS[r.sokh_id] = byS[r.sokh_id] || { count: 0, debt: 0 }; byS[r.sokh_id].count++; byS[r.sokh_id].debt += Number(r.debt || 0); }
  const ids = Object.keys(byS).map(Number);
  const { data: orgs } = await sb.from('sokh_organizations').select('id, name').in('id', ids.length ? ids : [-1]);
  const nameById = new Map((orgs || []).map(o => [o.id, o.name]));

  console.log('СӨХ-оор (оршин суугчтай):');
  Object.entries(byS).sort((a, b) => b[1].count - a[1].count).forEach(([id, v]) => {
    console.log(`  #${id}  ${nameById.get(Number(id)) || '(нэргүй)'} — ${v.count} айл, өр нийт ${v.debt.toLocaleString()}₮`);
  });
})();
