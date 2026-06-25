// Аль table-ууд anon-аар блоклогдсоныг тогтооно (#2679 + populated #7).
const path = require('path'), fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const ENV = path.join(path.resolve(__dirname, '..'), '.env.local');
for (const line of fs.readFileSync(ENV, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) { let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; }
}
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const tables = ['residents','payments','announcements','maintenance_requests','complaints','polls','messages','budget_items','invoices','sokh_organizations','cities'];
(async () => {
  console.log('table | anon count | service_role count');
  for (const t of tables) {
    const a = await anon.from(t).select('*', { count: 'exact', head: true });
    const s = await admin.from(t).select('*', { count: 'exact', head: true });
    console.log(`  ${t.padEnd(22)} anon=${a.error ? 'ERR('+a.error.message.slice(0,20)+')' : (a.count ?? 0)}  | sr=${s.count ?? 0}`);
  }
})();
