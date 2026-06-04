// READ-ONLY export of the SOKH list from the live superadmin DB to Excel (.xlsx).
//   data/export/SOH-bvh-duureg.xlsx       — нэг workbook, дүүрэг бүр тусдаа sheet + "Бүгд" sheet
//   data/export/SOH-Bayanzurkh.xlsx       — зөвхөн Баянзүрх (идэвхижүүлэх ажилд)
// No writes to the DB.

const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const ROOT = path.resolve(__dirname, '..');
const ENV_FILE = path.join(ROOT, '.env.local');
const OUT_DIR = path.join(ROOT, 'data', 'export');

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

const STATUS_MN = {
  pending: 'Хүлээгдэж буй',
  unclaimed: 'Эзэнгүй',
  claimed: 'Баталгаажсан',
  active: 'Идэвхтэй',
  activated: 'Идэвхжсэн',
};

(async () => {
  const [{ data: districts, error: de }, { data: khoroos, error: ke }] = await Promise.all([
    sb.from('districts').select('id, name'),
    sb.from('khoroos').select('id, district_id, name'),
  ]);
  if (de || ke) { console.error('lookup алдаа:', de || ke); process.exit(1); }
  const distById = new Map(districts.map(d => [d.id, d.name]));
  const khById = new Map(khoroos.map(k => [k.id, k]));

  let rows = [], from = 0; const PAGE = 1000;
  while (true) {
    const { data, error } = await sb
      .from('sokh_organizations')
      .select('id, name, phone, address, khoroo_id, claim_status, unit_count, monthly_fee, contact_email')
      .order('id').range(from, from + PAGE - 1);
    if (error) { console.error('sokh_organizations алдаа:', error.message); process.exit(1); }
    rows = rows.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  const enriched = rows.map(o => {
    const kh = khById.get(o.khoroo_id);
    return {
      'Дүүрэг': kh ? distById.get(kh.district_id) || '' : '',
      'Хороо': kh ? kh.name : '',
      'СӨХ нэр': o.name,
      'Дарга утас': o.phone || '',
      'Хаяг': o.address || '',
      'Айлын тоо': o.unit_count ?? '',
      'Сарын хураамж': o.monthly_fee ?? '',
      'И-мэйл': o.contact_email || '',
      'Төлөв': STATUS_MN[o.claim_status] || o.claim_status || '',
    };
  });

  const khNum = s => { const m = String(s).match(/(\d+)/); return m ? parseInt(m[1], 10) : 9999; };
  enriched.sort((a, b) =>
    a['Дүүрэг'].localeCompare(b['Дүүрэг'], 'mn') ||
    khNum(a['Хороо']) - khNum(b['Хороо']) ||
    a['СӨХ нэр'].localeCompare(b['СӨХ нэр'], 'mn'));

  const COLW = [{ wch: 14 }, { wch: 12 }, { wch: 32 }, { wch: 12 }, { wch: 30 }, { wch: 10 }, { wch: 13 }, { wch: 22 }, { wch: 16 }];
  const mkSheet = list => { const ws = XLSX.utils.json_to_sheet(list); ws['!cols'] = COLW; return ws; };

  // 1) Бүх дүүрэг — нэг workbook, sheet бүрт нэг дүүрэг + "Бүгд"
  const wbAll = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wbAll, mkSheet(enriched), 'Бүгд');
  const order = ['Баянзүрх', 'Баянгол', 'Хан-Уул', 'Сүхбаатар', 'Чингэлтэй', 'Сонгинохайрхан', 'Налайх', 'Багануур'];
  const seen = new Set();
  for (const d of order.concat([...new Set(enriched.map(r => r['Дүүрэг']))])) {
    if (!d || seen.has(d)) continue; seen.add(d);
    const list = enriched.filter(r => r['Дүүрэг'] === d);
    if (list.length) XLSX.utils.book_append_sheet(wbAll, mkSheet(list), d.slice(0, 31));
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  XLSX.writeFile(wbAll, path.join(OUT_DIR, 'SOH-bvh-duureg.xlsx'));

  // 2) Зөвхөн Баянзүрх
  const bz = enriched.filter(r => r['Дүүрэг'] === 'Баянзүрх');
  const wbBz = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wbBz, mkSheet(bz), 'Баянзүрх');
  XLSX.writeFile(wbBz, path.join(OUT_DIR, 'SOH-Bayanzurkh.xlsx'));

  console.log('Нийт СӨХ:', enriched.length);
  console.log('Баянзүрх:', bz.length);
  console.log('→ data/export/SOH-bvh-duureg.xlsx (дүүрэг бүр тусдаа хуудас)');
  console.log('→ data/export/SOH-Bayanzurkh.xlsx (идэвхижүүлэх ажилд)');
})();
