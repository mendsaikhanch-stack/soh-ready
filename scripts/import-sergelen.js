// Сэргэлэн СӨХ #2679 рүү айл+өрийг шууд оруулна (Excel-ээс задлаад).
// Ажиллуулах: node scripts/import-sergelen.js
const path = require('path');
const fs = require('fs');
const XLSX = require(path.resolve(__dirname, '../node_modules/xlsx'));
const { createClient } = require('@supabase/supabase-js');

const ENV_FILE = path.join(path.resolve(__dirname, '..'), '.env.local');
for (const line of fs.readFileSync(ENV_FILE, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) { let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; }
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const SOKH_ID = 2679;
const FILE = 'F:/сэргэлэн наах хуудас2603.xlsx';

const wb = XLSX.readFile(FILE);
const records = [];
for (const sn of wb.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '' });
  let building = sn;
  for (const r of rows.slice(0, 3)) { const m = String(r[0] || '').match(/(\d+)\s*-?\s*р?\s*байр/); if (m) { building = m[1]; break; } }
  const hi = rows.findIndex(r => String(r[0]).trim() === 'Тоот');
  if (hi === -1) continue;
  const header = rows[hi].map(c => String(c).trim());
  const niitIdx = header.findIndex(h => h === 'Нийт');
  const huraamjIdx = header.findIndex(h => h.includes('хураамж'));
  const hogIdx = header.findIndex(h => h.includes('ог'));
  const num = v => { const n = Number(String(v).replace(/[^\d.-]/g, '')); return Number.isFinite(n) ? n : 0; };
  for (let i = hi + 1; i < rows.length; i++) {
    const toot = rows[i][0];
    if (toot === '' || toot === null || isNaN(Number(toot))) continue;
    let debt = niitIdx >= 0 ? num(rows[i][niitIdx]) : 0;
    if (!debt) debt = num(rows[i][huraamjIdx]) + num(rows[i][hogIdx]);
    records.push({
      sokh_id: SOKH_ID,
      name: `${building}-р байр ${String(toot).trim()} тоот`,
      apartment: String(toot).trim(),
      building: String(building),
      debt,
      area_sqm: 0,
    });
  }
}

(async () => {
  console.log(`Оруулах: ${records.length} айл → Сэргэлэн СӨХ #${SOKH_ID}`);
  // 100-аар багцалж insert
  let ok = 0;
  for (let i = 0; i < records.length; i += 100) {
    const batch = records.slice(i, i + 100);
    const { error } = await sb.from('residents').insert(batch);
    if (error) { console.error(`❌ Багц ${i}-${i + batch.length} алдаа:`, error.message); process.exit(1); }
    ok += batch.length;
  }
  // Баталгаажуулах
  const { data: chk } = await sb.from('residents').select('debt').eq('sokh_id', SOKH_ID);
  const total = (chk || []).reduce((s, r) => s + Number(r.debt || 0), 0);
  console.log(`✅ Орсон: ${ok} айл`);
  console.log(`   DB-д одоо: ${chk ? chk.length : 0} айл, нийт өр ${total.toLocaleString()}₮`);
})();
