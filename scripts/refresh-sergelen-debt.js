// Сэргэлэн СӨХ (#2679) — өрийн үлдэгдлийг шинэ Excel-ээс шинэчилнэ.
//
// Нэг удаагийн скрипт. Excel нь 17 хуудастай (1-17 байр), хуудас бүрд:
//   Тоот | Төлөгдөөгүй сарууд | СӨХ-ийн хураамж | Хогны мөнгө | 2022 оны 3-12 | Нийт
// «Нийт» баганыг residents.debt болгож бичнэ. Хуудасны нэр = байр (building).
//
// Байгаа мөрийг ЗӨВХӨН UPDATE хийнэ (нэр, утас, auth_user_id-д хүрэхгүй).
// Файлд байгаа ч DB-д байхгүй тоот (7А, 10b гэх мэт) --with-new өгвөл нэмнэ.
//
// Ажиллуулах:
//   node scripts/refresh-sergelen-debt.js                    # dry-run
//   node scripts/refresh-sergelen-debt.js --commit           # өрийг шинэчилнэ
//   node scripts/refresh-sergelen-debt.js --commit --with-new # + дутуу тоотыг нэмнэ

const path = require('path');
const fs = require('fs');
const XLSX = require(path.resolve(__dirname, '../node_modules/xlsx'));

const FILE = process.env.FILE || 'F:/сэргэлэн наах хуудас (2).xlsx';
const SOKH_ID = Number(process.env.SOKH_ID || 2679);

const COMMIT = process.argv.includes('--commit');
const WITH_NEW = process.argv.includes('--with-new');

const num = (v) => {
  const n = Number(String(v ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

// Зөв тоот: 1-3 оронтой тоо, ард нь нэг үсэг байж болно (7А, 10b)
const UNIT_RE = /^\d{1,3}\s*[A-Za-zА-Яа-яӨөҮүЁё]?$/;
const normUnit = (v) => String(v ?? '').trim().replace(/\s+/g, '').toUpperCase();

function parseFile() {
  if (!fs.existsSync(FILE)) {
    console.error(`❌ Файл олдсонгүй: ${FILE}`);
    process.exit(1);
  }
  const wb = XLSX.readFile(FILE);
  const rows = [];
  const notes = [];

  for (const sheet of wb.SheetNames) {
    const grid = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: '' });
    const hi = grid.findIndex((r) => String(r[0]).trim() === 'Тоот');
    if (hi === -1) {
      notes.push(`хуудас "${sheet}": "Тоот" толгой олдсонгүй → алгасав`);
      continue;
    }
    const header = grid[hi].map((c) => String(c).trim());
    const totalIdx = header.findIndex((h) => h === 'Нийт');
    if (totalIdx === -1) {
      notes.push(`хуудас "${sheet}": "Нийт" багана олдсонгүй → алгасав`);
      continue;
    }
    for (const r of grid.slice(hi + 1)) {
      const raw = String(r[0] ?? '').trim();
      if (!raw) continue;
      if (!UNIT_RE.test(raw)) {
        notes.push(`хуудас "${sheet}": тоот биш мөр алгасав — "${raw.slice(0, 40)}${raw.length > 40 ? '…' : ''}"`);
        continue;
      }
      rows.push({ building: String(sheet).trim(), apartment: normUnit(raw), debt: num(r[totalIdx]) });
    }
  }
  return { rows, notes };
}

function getClient() {
  const ENV_FILE = path.join(path.resolve(__dirname, '..'), '.env.local');
  if (fs.existsSync(ENV_FILE)) {
    for (const line of fs.readFileSync(ENV_FILE, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) {
        let v = m[2].trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        if (!process.env[m[1]]) process.env[m[1]] = v;
      }
    }
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('❌ Supabase түлхүүр алга (.env.local).');
    process.exit(1);
  }
  const { createClient } = require('@supabase/supabase-js');
  return createClient(url, key, { auth: { persistSession: false } });
}

(async () => {
  const { rows, notes } = parseFile();
  console.log(`📂 Файл: ${FILE}`);
  console.log(`   Уншсан тоот: ${rows.length}`);
  if (notes.length) {
    console.log(`   Алгассан мөр: ${notes.length}`);
    notes.slice(0, 6).forEach((n) => console.log(`      ${n}`));
    if (notes.length > 6) console.log(`      … +${notes.length - 6}`);
  }

  const sb = getClient();
  const { data: db } = await sb
    .from('residents')
    .select('id, apartment, building, debt, name')
    .eq('sokh_id', SOKH_ID)
    .limit(1000);
  console.log(`\n🗄  DB-д: ${db.length} мөр (СӨХ #${SOKH_ID})`);

  const dbMap = new Map(db.map((r) => [`${String(r.building).trim()}-${normUnit(r.apartment)}`, r]));

  const toUpdate = [];
  const toInsert = [];
  let unchanged = 0;

  for (const f of rows) {
    const row = dbMap.get(`${f.building}-${f.apartment}`);
    if (!row) { toInsert.push(f); continue; }
    if (Number(row.debt) === f.debt) unchanged++;
    else toUpdate.push({ id: row.id, from: Number(row.debt), to: f.debt, key: `${f.building}-${f.apartment}` });
  }

  const fileKeys = new Set(rows.map((f) => `${f.building}-${f.apartment}`));
  const missingInFile = db.filter((r) => !fileKeys.has(`${String(r.building).trim()}-${normUnit(r.apartment)}`));

  const sumFrom = toUpdate.reduce((s, u) => s + u.from, 0);
  const sumTo = toUpdate.reduce((s, u) => s + u.to, 0);

  console.log(`\n🧭 Төлөвлөгөө (${COMMIT ? 'COMMIT' : 'DRY-RUN'}):`);
  console.log(`   Өр шинэчлэгдэх:        ${toUpdate.length} мөр`);
  console.log(`   Өөрчлөлтгүй:           ${unchanged}`);
  console.log(`   Файлд байгаа шинэ тоот: ${toInsert.length} ${WITH_NEW ? '→ НЭМНЭ' : '→ алгасна (--with-new өгвөл нэмнэ)'}`);
  console.log(`   Файлд байхгүй DB мөр:  ${missingInFile.length} (хөндөхгүй)`);
  console.log(`   Өрийн нийлбэр: ${sumFrom.toLocaleString()}₮ → ${sumTo.toLocaleString()}₮  (${(sumTo - sumFrom >= 0 ? '+' : '')}${(sumTo - sumFrom).toLocaleString()}₮)`);

  if (toUpdate.length) {
    console.log(`\n   Эхний 10 өөрчлөлт:`);
    toUpdate.slice(0, 10).forEach((u) =>
      console.log(`      ${u.key.padEnd(8)} ${String(u.from).padStart(8)} → ${String(u.to).padStart(8)}`));
  }
  if (toInsert.length) {
    console.log(`\n   Шинэ тоот: ${toInsert.map((t) => `${t.building}-${t.apartment}`).join(', ')}`);
  }
  if (missingInFile.length) {
    console.log(`\n   Файлд ороогүй DB мөр: ${missingInFile.slice(0, 10).map((r) => `${r.building}-${r.apartment}`).join(', ')}${missingInFile.length > 10 ? ' …' : ''}`);
  }

  if (!COMMIT) {
    console.log('\n💡 Гүйцэтгэхийн тулд: node scripts/refresh-sergelen-debt.js --commit');
    return;
  }

  let updated = 0, inserted = 0, failed = 0;
  for (const u of toUpdate) {
    const { error } = await sb.from('residents').update({ debt: u.to }).eq('id', u.id);
    if (error) { console.error(`   ❌ ${u.key}: ${error.message}`); failed++; }
    else updated++;
  }
  if (WITH_NEW) {
    for (const t of toInsert) {
      const { error } = await sb.from('residents').insert([{
        sokh_id: SOKH_ID,
        building: t.building,
        apartment: t.apartment,
        name: `${t.building}-р байр ${t.apartment} тоот`,
        debt: t.debt,
      }]);
      if (error) { console.error(`   ❌ ${t.building}-${t.apartment}: ${error.message}`); failed++; }
      else inserted++;
    }
  }

  console.log(`\n✅ Дууслаа:`);
  console.log(`   Шинэчилсэн: ${updated}`);
  console.log(`   Нэмсэн:     ${inserted}`);
  console.log(`   Алдаа:      ${failed}`);
})();
