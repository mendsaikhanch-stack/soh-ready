// Тодорхой НЭГ СӨХ-ийн бүх оршин суугчийг устгана (зөвхөн тэр sokh_id).
// Ажиллуулах: node scripts/clear-residents.js <sokh_id>
// Жишээ:      node scripts/clear-residents.js 2679
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const ENV_FILE = path.join(path.resolve(__dirname, '..'), '.env.local');
for (const line of fs.readFileSync(ENV_FILE, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) { let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; }
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const sokhId = parseInt(process.argv[2], 10);
if (!Number.isFinite(sokhId) || sokhId <= 0) { console.error('❌ sokh_id буруу'); process.exit(1); }

(async () => {
  const { data: org } = await sb.from('sokh_organizations').select('id, name').eq('id', sokhId).single();
  if (!org) { console.error('❌ СӨХ олдсонгүй'); process.exit(1); }

  const { data: before } = await sb.from('residents').select('id', { count: 'exact' }).eq('sokh_id', sokhId);
  const beforeCount = before ? before.length : 0;
  console.log(`СӨХ #${org.id} "${org.name}" — одоо ${beforeCount} айл`);

  if (beforeCount === 0) { console.log('Цэвэрлэх юм алга.'); return; }

  const { error } = await sb.from('residents').delete().eq('sokh_id', sokhId);
  if (error) { console.error('❌ Устгах алдаа:', error.message); process.exit(1); }

  const { data: after } = await sb.from('residents').select('id').eq('sokh_id', sokhId);
  console.log(`✅ Устгасан: ${beforeCount} айл. Үлдсэн: ${after ? after.length : 0}`);
})();
