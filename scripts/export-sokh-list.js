// READ-ONLY export of the SOKH list from the live superadmin DB.
// Joins sokh_organizations -> khoroos -> districts, writes:
//   data/export/sokh-all.csv         (бүх дүүрэг)
//   data/export/sokh-bayanzurkh.csv  (зөвхөн Баянзүрх)
// No writes to the DB.

const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const ROOT = path.resolve(__dirname, '..');
const ENV_FILE = path.join(ROOT, '.env.local');
const OUT_DIR = path.join(ROOT, 'data', 'export');

// --- load .env.local ---
for (const line of fs.readFileSync(ENV_FILE, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) {
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) { console.error('SUPABASE env алга'); process.exit(1); }

const sb = createClient(URL, KEY, { auth: { persistSession: false } });

function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

(async () => {
  // lookup maps
  const [{ data: districts, error: de }, { data: khoroos, error: ke }] = await Promise.all([
    sb.from('districts').select('id, name'),
    sb.from('khoroos').select('id, district_id, name'),
  ]);
  if (de || ke) { console.error('lookup алдаа:', de || ke); process.exit(1); }
  const distById = new Map(districts.map(d => [d.id, d.name]));
  const khById = new Map(khoroos.map(k => [k.id, k]));

  // pull all sokh orgs (paginate to be safe)
  let rows = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await sb
      .from('sokh_organizations')
      .select('id, name, phone, address, khoroo_id, claim_status, unit_count, monthly_fee, contact_email')
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) { console.error('sokh_organizations алдаа:', error.message); process.exit(1); }
    rows = rows.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  const enriched = rows.map(o => {
    const kh = khById.get(o.khoroo_id);
    const district = kh ? distById.get(kh.district_id) || '' : '';
    const khoroo = kh ? kh.name : '';
    return {
      district, khoroo,
      name: o.name,
      chairman_phone: o.phone || '',
      address: o.address || '',
      unit_count: o.unit_count ?? '',
      monthly_fee: o.monthly_fee ?? '',
      contact_email: o.contact_email || '',
      claim_status: o.claim_status || '',
    };
  });

  // sort by district, then khoroo number, then name
  const khNum = s => { const m = String(s).match(/(\d+)/); return m ? parseInt(m[1], 10) : 9999; };
  enriched.sort((a, b) =>
    a.district.localeCompare(b.district, 'mn') ||
    khNum(a.khoroo) - khNum(b.khoroo) ||
    a.name.localeCompare(b.name, 'mn'));

  const header = ['Дүүрэг', 'Хороо', 'СӨХ нэр', 'Дарга утас', 'Хаяг', 'Айлын тоо', 'Сарын хураамж', 'И-мэйл', 'Төлөв'];
  const toCsv = list => '﻿' + [header.join(',')]
    .concat(list.map(r => [r.district, r.khoroo, r.name, r.chairman_phone, r.address, r.unit_count, r.monthly_fee, r.contact_email, r.claim_status].map(csvCell).join(',')))
    .join('\n') + '\n';

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'sokh-all.csv'), toCsv(enriched));
  const bz = enriched.filter(r => r.district === 'Баянзүрх');
  fs.writeFileSync(path.join(OUT_DIR, 'sokh-bayanzurkh.csv'), toCsv(bz));

  // summary
  const byDist = {};
  for (const r of enriched) byDist[r.district] = (byDist[r.district] || 0) + 1;
  console.log('Нийт СӨХ:', enriched.length);
  console.log('Дүүргээр:');
  for (const [d, c] of Object.entries(byDist).sort((a, b) => b[1] - a[1])) console.log(`  ${d || '(тодорхойгүй)'}: ${c}`);
  console.log('\nБаянзүрх:', bz.length, '→ data/export/sokh-bayanzurkh.csv');
  console.log('Бүгд:', enriched.length, '→ data/export/sokh-all.csv');
})();
