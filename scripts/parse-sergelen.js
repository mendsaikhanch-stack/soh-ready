// READ-ONLY: "сэргэлэн наах хуудас" Excel-ийг задалж айл/өрийн нэгдсэн жагсаалт гаргана.
// 17 хуудас = 17 байр. Багана: Тоот | Төлөгдөөгүй сарууд | хураамж үлдэгдэл | хог үлдэгдэл | ... | Нийт
// Ажиллуулах: node scripts/parse-sergelen.js
const XLSX = require(require('path').resolve(__dirname, '../node_modules/xlsx'));
const FILE = 'F:/сэргэлэн наах хуудас2603.xlsx';

const wb = XLSX.readFile(FILE);
const units = [];

for (const sn of wb.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '' });

  // Байрны дугаар — гарчиг мөрнөөс "N-р байр"
  let building = sn;
  for (const r of rows.slice(0, 3)) {
    const m = String(r[0] || '').match(/(\d+)\s*-?\s*р?\s*байр/);
    if (m) { building = m[1]; break; }
  }

  // Header мөр (эхний нүд нь "Тоот")
  let hi = rows.findIndex(r => String(r[0]).trim() === 'Тоот');
  if (hi === -1) continue;
  const header = rows[hi].map(c => String(c).trim());
  const niitIdx = header.findIndex(h => h === 'Нийт');
  const huraamjIdx = header.findIndex(h => h.includes('хураамж'));
  const hogIdx = header.findIndex(h => h.includes('Хог') || h.includes('хог'));

  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i];
    const toot = r[0];
    // зөвхөн тоот дугаартай мөр (1,2,3...) — нийлбэр/хоосон мөрийг алгасна
    if (toot === '' || toot === null || isNaN(Number(toot))) continue;
    const num = v => { const n = Number(String(v).replace(/[^\d.-]/g, '')); return Number.isFinite(n) ? n : 0; };
    let debt = niitIdx >= 0 ? num(r[niitIdx]) : 0;
    if (!debt) debt = num(r[huraamjIdx]) + num(r[hogIdx]); // Нийт хоосон бол нэмж тооцоо
    units.push({
      building: String(building),
      apartment: String(toot).trim(),
      huraamj: huraamjIdx >= 0 ? num(r[huraamjIdx]) : 0,
      hog: hogIdx >= 0 ? num(r[hogIdx]) : 0,
      debt,
      months: String(r[1] || '').replace(/\s+/g, ' ').trim().slice(0, 60),
    });
  }
}

// Дүгнэлт
const byB = {};
for (const u of units) { byB[u.building] = byB[u.building] || { n: 0, debt: 0 }; byB[u.building].n++; byB[u.building].debt += u.debt; }
console.log('Нийт айл:', units.length);
console.log('Нийт өр :', units.reduce((s, u) => s + u.debt, 0).toLocaleString(), '₮\n');
console.log('Байр | айл | өр');
Object.entries(byB).sort((a, b) => Number(a[0]) - Number(b[0])).forEach(([b, v]) =>
  console.log(`  ${b}-р байр: ${v.n} айл, ${v.debt.toLocaleString()}₮`));
console.log('\nЖишээ 8 мөр:');
units.slice(0, 8).forEach(u => console.log(`  ${u.building}-р байр ${u.apartment} тоот | өр ${u.debt.toLocaleString()}₮ | ${u.months}`));

// CSV-д хадгалах (import-д бэлэн, name=building+toot placeholder)
const fs = require('fs');
const out = require('path').resolve(__dirname, '../scratch-residents-sergelen.csv');
const header = 'name,apartment,phone,building,block,entrance,floor,area_sqm,debt\n';
const lines = units.map(u => `"${u.building}-р байр ${u.apartment} тоот","${u.apartment}","","${u.building}","","","",0,${u.debt}`).join('\n');
try { fs.writeFileSync(out, '﻿' + header + lines); console.log('\nCSV →', out); } catch (e) { console.log('CSV бичих алдаа:', e.message); }
