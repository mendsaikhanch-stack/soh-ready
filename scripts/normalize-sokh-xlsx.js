// Normalize the multi-sheet "СӨХолбоодын судалдаа2026.xlsx" into a single
// CSV that bulk-onboard accepts: Дүүрэг,Хороо,СӨХ нэр,Дарга утас,Дарга нэр,Айлын тоо
//
// Rules (per user's call):
//  - Include all 8 district sheets (СХД, БГД, ХУд, БЗд, СБд, Чд, Нд, БНд).
//  - Skip dissolved entries (татан буугдсан / СӨХ-гүй / дахин төлөвлөлт).
//  - Forward-fill Хороо column (merged cells in source).
//  - Extract first 8-digit phone from a possibly-multi-phone cell.
//  - Strip surrounding quotes and collapse whitespace from SOKH name / chairman name.
//  - Output: sokh-clean.csv (importable) and sokh-skipped.csv (audit trail).

const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

const FILE = process.argv[2] || 'C:/Users/MNG/Downloads/СӨХолбоодын судалдаа2026.xlsx';
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_OUT = path.join(ROOT, 'data', 'sokh-clean.csv');
const OUT_DIR = path.dirname(process.argv[3] || DEFAULT_OUT);
const OUT_CLEAN = path.join(OUT_DIR, 'sokh-clean.csv');
const OUT_DIRECTORY = path.join(OUT_DIR, 'sokh-directory.csv');
const OUT_SKIP = path.join(OUT_DIR, 'sokh-skipped.csv');

// (col indices are 0-based; -1 means absent)
const SHEETS = [
  { sheet: 'СХД', district: 'Сонгинохайрхан', headerRow: 3, khoroo: 1, sokh: 2, darga: 3, phone: 4, units: -1 },
  { sheet: 'БГД', district: 'Баянгол',         headerRow: 3, khoroo: 1, sokh: 2, darga: 3, phone: 4, units: 6  },
  { sheet: 'ХУд', district: 'Хан-Уул',         headerRow: 2, khoroo: 1, sokh: 2, darga: 3, phone: 4, units: -1 },
  { sheet: 'БЗд', district: 'Баянзүрх',        headerRow: 4, khoroo: 2, sokh: 3, darga: 4, phone: 5, units: -1 },
  { sheet: 'СБд', district: 'Сүхбаатар',       headerRow: 3, khoroo: 1, sokh: 2, darga: 3, phone: 4, units: 6  },
  { sheet: 'Чд',  district: 'Чингэлтэй',       headerRow: 3, khoroo: 1, sokh: 2, darga: 3, phone: 4, units: 6  },
  { sheet: 'Нд',  district: 'Налайх',          headerRow: 2, khoroo: 1, sokh: 2, darga: 3, phone: 4, units: 6  },
  // БНд: Хороо багана хоосон, харин № багана (col 0) нь хорооны дугаараар бүлэглэгдсэн.
  { sheet: 'БНд', district: 'Багануур',        headerRow: 2, khoroo: 0, sokh: 2, darga: 3, phone: 4, units: -1 },
];

const DISSOLVED_PATTERNS = [
  /татан\s*буу/i,
  /сөх[-\s]*гүй/i,
  /дахин\s*төлөвлөлт/i,
  /буугдс/i,
];

function isDissolved(row) {
  for (const c of row) {
    const s = String(c ?? '').toLowerCase();
    if (!s) continue;
    if (DISSOLVED_PATTERNS.some(p => p.test(s))) return true;
  }
  return false;
}

function cleanName(s) {
  if (s == null) return '';
  let t = String(s).trim();
  // Strip a single layer of surrounding quotes (straight or smart)
  t = t.replace(/^["“”'`]+|["“”'`]+$/g, '');
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

function cleanPhone(s) {
  if (s == null) return '';
  const raw = String(s);
  // Find all groups of 8 consecutive digits
  const matches = raw.match(/\d{8}/g);
  if (!matches) return '';
  // Prefer one starting with 7,8,9 (Mongolian valid prefixes)
  const valid = matches.find(m => /^[789]/.test(m));
  return valid || matches[0];
}

function cleanKhoroo(s) {
  if (s == null) return '';
  const raw = String(s).trim();
  if (!raw) return '';
  const m = raw.match(/(\d+)/);
  if (!m) return '';
  return `${m[1]}-р хороо`;
}

function cleanUnits(s) {
  if (s == null) return '';
  const raw = String(s).trim();
  if (!raw) return '';
  const m = raw.match(/\d+/);
  return m ? m[0] : '';
}

function csvEscape(s) {
  const v = String(s ?? '');
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function csvLine(arr) {
  return arr.map(csvEscape).join(',');
}

const wb = XLSX.readFile(FILE, { cellDates: true });

const cleanRows = [];
const directoryRows = []; // phoneless entries, go to /admin/directory/import
const skipRows = [];
const summary = [];

for (const cfg of SHEETS) {
  const ws = wb.Sheets[cfg.sheet];
  if (!ws) {
    summary.push({ sheet: cfg.sheet, found: false });
    continue;
  }
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });

  let lastKhoroo = '';
  let total = 0, kept = 0, skipped = 0;

  for (let i = cfg.headerRow + 1; i < rows.length; i++) {
    const row = rows[i] || [];

    // Forward-fill хороо BEFORE checking SOKH name, so building-only rows
    // (e.g. Налайх) still update the last-seen хороо value.
    const khorooThis = cleanKhoroo(row[cfg.khoroo]);
    if (khorooThis) lastKhoroo = khorooThis;
    const khoroo = lastKhoroo;

    const sokhRaw = row[cfg.sokh];
    const sokh = cleanName(sokhRaw);
    if (!sokh) continue; // empty rows: silently skip (don't count as "skipped due to rule")
    total++;

    const darga = cleanName(row[cfg.darga]);
    const phone = cleanPhone(row[cfg.phone]);
    const units = cfg.units >= 0 ? cleanUnits(row[cfg.units]) : '';

    // Hard skips (truly unusable rows)
    let reason = '';
    if (isDissolved(row) || /сөх[-\s]*гүй/i.test(sokh) || /татан\s*буу/i.test(sokh)) {
      reason = 'татан буугдсан/СӨХ-гүй';
    } else if (!khoroo) {
      reason = 'хороо тодорхойгүй';
    }

    if (reason) {
      skipped++;
      skipRows.push({
        sheet: cfg.sheet,
        excelRow: i + 1,
        district: cfg.district,
        khoroo,
        sokh,
        darga,
        phone,
        units,
        reason,
      });
      continue;
    }

    // Phoneless entries → directory-import (master list, no activation code).
    if (!phone) {
      directoryRows.push({
        district: cfg.district,
        khoroo,
        sokh,
        darga,
        units,
      });
      kept++;
      continue;
    }

    // Phoned entries → bulk-onboard (creates SOKH + activation code).
    kept++;
    cleanRows.push({
      district: cfg.district,
      khoroo,
      sokh,
      phone,
      darga,
      units,
    });
  }

  summary.push({ sheet: cfg.sheet, district: cfg.district, total, kept, skipped });
}

// Write clean CSV for bulk-onboard (UTF-8 BOM so Excel reads Cyrillic correctly)
const cleanLines = ['Дүүрэг,Хороо,СӨХ нэр,Дарга утас,Дарга нэр,Айлын тоо'];
for (const r of cleanRows) {
  cleanLines.push(csvLine([r.district, r.khoroo, r.sokh, r.phone, r.darga, r.units]));
}
fs.writeFileSync(OUT_CLEAN, '﻿' + cleanLines.join('\n'), 'utf8');

// Write directory CSV for /admin/directory/import (phoneless entries)
// Header keys per public/templates/soh-directory-template.csv
const dirLines = ['official_name,display_name,district,khoroo,address,phone,soh_code,building_count,unit_count,alias_1,alias_2,alias_3,alias_4,alias_5,status'];
for (const r of directoryRows) {
  dirLines.push(csvLine([
    r.sokh,           // official_name
    '',               // display_name
    r.district,       // district
    r.khoroo,         // khoroo
    '',               // address
    '',               // phone (empty by definition)
    '',               // soh_code
    '',               // building_count
    r.units,          // unit_count
    '', '', '', '', '', // alias_1..5
    'PENDING',        // status — chairman not verified yet
  ]));
}
fs.writeFileSync(OUT_DIRECTORY, '﻿' + dirLines.join('\n'), 'utf8');

const skipLines = ['Хуудас,Excel мөр,Дүүрэг,Хороо,СӨХ нэр,Дарга нэр,Утас,Айлын тоо,Шалтгаан'];
for (const s of skipRows) {
  skipLines.push(csvLine([s.sheet, s.excelRow, s.district, s.khoroo, s.sokh, s.darga, s.phone, s.units, s.reason]));
}
fs.writeFileSync(OUT_SKIP, '﻿' + skipLines.join('\n'), 'utf8');

// Report
console.log('Хуудас бүрийн хураангуй:');
console.log('Хуудас  | Дүүрэг          | Нийт | Орох | Алгасах');
console.log('--------|-----------------|------|------|--------');
let totalAll = 0, keptAll = 0, skippedAll = 0;
for (const s of summary) {
  if (!s.total && !s.kept) continue;
  console.log(
    `${s.sheet.padEnd(7)} | ${(s.district || '').padEnd(15)} | ${String(s.total).padStart(4)} | ${String(s.kept).padStart(4)} | ${String(s.skipped).padStart(6)}`
  );
  totalAll += s.total; keptAll += s.kept; skippedAll += s.skipped;
}
console.log('--------|-----------------|------|------|--------');
console.log(`НИЙТ                     | ${String(totalAll).padStart(4)} | ${String(keptAll).padStart(4)} | ${String(skippedAll).padStart(6)}`);

console.log(`\nҮндсэн хуваарилалт:`);
console.log(`  Утастай (bulk-onboard руу):     ${cleanRows.length}`);
console.log(`  Утасгүй (directory-import руу): ${directoryRows.length}`);
console.log(`  Алгассан:                       ${skipRows.length}`);

// Skip-reason breakdown
const reasonCount = {};
for (const s of skipRows) reasonCount[s.reason] = (reasonCount[s.reason] || 0) + 1;
console.log('\nАлгассан шалтгаан:');
for (const [k, v] of Object.entries(reasonCount).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(28)} ${v}`);
}

console.log('\nГаргасан файлууд:');
console.log('  Утастай (bulk-onboard):    ', OUT_CLEAN);
console.log('  Утасгүй (directory-import):', OUT_DIRECTORY);
console.log('  Алгассан (аудит):           ', OUT_SKIP);
