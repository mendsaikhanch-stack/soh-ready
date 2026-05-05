// Pick top 50 Баянзүрх SOKHs by building count and emit a focused CSV
// (with codes from sokh-codes.csv) for the first onboarding push.

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const ROOT = path.resolve(__dirname, '..');
const XLSX_FILE = 'C:/Users/MNG/Downloads/СӨХолбоодын судалдаа2026.xlsx';
const CODES_CSV = path.join(ROOT, 'sokh-codes.csv');
const OUT_CSV = path.join(ROOT, 'bzd-target-50.csv');

function parseCsv(t) {
  if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);
  const lines = []; let cur = '', q = false, row = [];
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (c === '"') { if (q && t[i+1] === '"') { cur += '"'; i++; } else q = !q; }
    else if (c === ',' && !q) { row.push(cur); cur = ''; }
    else if ((c === '\n' || c === '\r') && !q) { if (c === '\r' && t[i+1] === '\n') i++; row.push(cur); cur = ''; if (row.some(x => x !== '')) lines.push(row); row = []; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); if (row.some(x => x !== '')) lines.push(row); }
  const h = lines[0].map(x => x.trim());
  return lines.slice(1).map(r => { const o = {}; h.forEach((k, i) => o[k] = (r[i] || '').trim()); return o; });
}

function csvEscape(s) {
  const v = String(s ?? '');
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function countBuildings(s) {
  if (!s) return 0;
  // "5а, 6а, 16" → 3, "57" → 1, "1-5,19-23" → handle ranges later
  // Зураг: , или ; ил тусгаарласан тэмдэглээгээр split хийгээд бус-хоосон элементийг тоолно
  const parts = String(s).split(/[,;\/]+/).map(x => x.trim()).filter(Boolean);
  return parts.length;
}

// Excel-аас Баянзүрхын СӨХ-уудын барилгын тоог гаргах
const wb = XLSX.readFile(XLSX_FILE);
const ws = wb.Sheets['БЗд'];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
// header row 4: ["д/д","д/д","Хороо","СӨХ","Захирал","Утас","Хариуцсан байр"]
const buildingMap = new Map(); // key: lowercased SOKH name → building count
for (let i = 5; i < rows.length; i++) {
  const r = rows[i] || [];
  const name = String(r[3] || '').trim();
  if (!name) continue;
  const buildings = String(r[6] || '').trim();
  const cnt = countBuildings(buildings);
  // Нэр давхардахгүй гэж бодсон, давхар бол хамгийн их-ийг хадгал
  const k = name.toLowerCase();
  buildingMap.set(k, Math.max(buildingMap.get(k) || 0, cnt));
}

// Codes CSV-аас Баянзүрхын мөрүүдийг авах
const codes = parseCsv(fs.readFileSync(CODES_CSV, 'utf8'))
  .filter(r => r['Дүүрэг'] === 'Баянзүрх');

// barilгын тоог нэмж
const enriched = codes.map(r => ({
  ...r,
  buildings: buildingMap.get(r['СӨХ нэр'].toLowerCase()) || 0,
}));

// Барилгын тоо буурах эрэмбээр sort
enriched.sort((a, b) => b.buildings - a.buildings || a['Хороо'].localeCompare(b['Хороо']));
const top50 = enriched.slice(0, 50);

// Үр дүн бичих
const headers = ['№', 'Дүүрэг', 'Хороо', 'СӨХ нэр', 'Дарга нэр', 'Утас', 'Идэвхжүүлэх код', 'Барилгын тоо', 'Холбогдсон огноо', 'Гэрээ', 'SMS явуулсан', 'Идэвхжсэн', 'Тайлбар'];
const lines = [headers.join(',')];
top50.forEach((r, i) => {
  lines.push([
    i + 1,
    r['Дүүрэг'],
    r['Хороо'],
    r['СӨХ нэр'],
    r['Дарга нэр'],
    r['Утас'],
    r['Идэвхжүүлэх код'],
    r.buildings,
    '', '', '', '', '',
  ].map(csvEscape).join(','));
});
fs.writeFileSync(OUT_CSV, '﻿' + lines.join('\n'), 'utf8');

// Тайлан
console.log(`Баянзүрхын нийт: ${codes.length}, top 50 сонгосон.`);
console.log(`Барилгын тоогоор хуваагдалт:`);
const buckets = { '5+': 0, '3-4': 0, '2': 0, '1': 0, '0 (мэдэгдээгүй)': 0 };
top50.forEach(r => {
  if (r.buildings >= 5) buckets['5+']++;
  else if (r.buildings >= 3) buckets['3-4']++;
  else if (r.buildings === 2) buckets['2']++;
  else if (r.buildings === 1) buckets['1']++;
  else buckets['0 (мэдэгдээгүй)']++;
});
Object.entries(buckets).forEach(([k, v]) => console.log(`  ${k.padEnd(20)} ${v}`));

console.log(`\nХорооны хуваарилалт:`);
const byKh = {};
top50.forEach(r => byKh[r['Хороо']] = (byKh[r['Хороо']] || 0) + 1);
Object.entries(byKh).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).forEach(([k, v]) => console.log(`  ${k.padEnd(15)} ${v}`));

console.log(`\nҮр дүн: ${OUT_CSV}`);
console.log(`Дээд 5:`);
top50.slice(0, 5).forEach((r, i) => console.log(`  ${i+1}. ${r['СӨХ нэр'].padEnd(25)} | ${r['Хороо'].padEnd(12)} | ${r.buildings} барилга | ${r['Дарга нэр']}`));
