// One-shot inspector for the SOKH research Excel file.
// Reports: sheet names, headers, sample rows, column non-empty counts, and total rows.
const path = require('path');
const XLSX = require('xlsx');

const FILE = process.argv[2] || 'C:/Users/MNG/Downloads/СӨХолбоодын судалдаа2026.xlsx';

const wb = XLSX.readFile(FILE, { cellDates: true });

console.log('FILE:', FILE);
console.log('SHEETS:', wb.SheetNames.length);
console.log('--------------------------------------');

for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  const ref = ws['!ref'] || '(empty)';
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
  const merged = ws['!merges'] || [];

  console.log('\n=== SHEET:', JSON.stringify(name), '===');
  console.log('range:', ref, '| rows:', rows.length, '| merges:', merged.length);

  // Show first 8 rows verbatim so we can spot the real header location
  const head = rows.slice(0, 8);
  head.forEach((r, i) => {
    const cells = r.map(c => (c === '' ? '∅' : String(c).slice(0, 40)));
    console.log(`  r${i}:`, JSON.stringify(cells));
  });

  // Try to detect a header row: pick the row in the first 6 with the most filled cells
  let headerIdx = 0, headerScore = -1;
  for (let i = 0; i < Math.min(6, rows.length); i++) {
    const filled = rows[i].filter(c => String(c).trim() !== '').length;
    if (filled > headerScore) { headerScore = filled; headerIdx = i; }
  }
  console.log('  guessed header row:', headerIdx);
  const headers = (rows[headerIdx] || []).map(h => String(h).trim());
  console.log('  headers:', JSON.stringify(headers));

  // Column non-empty counts and a sample value per column
  const dataRows = rows.slice(headerIdx + 1);
  const ncols = Math.max(...rows.map(r => r.length), headers.length);
  const stats = [];
  for (let c = 0; c < ncols; c++) {
    let filled = 0;
    let sample = '';
    for (const r of dataRows) {
      const v = r[c];
      if (v !== undefined && String(v).trim() !== '') {
        filled++;
        if (!sample) sample = String(v).slice(0, 40);
      }
    }
    stats.push({ col: c, header: headers[c] || '(no header)', filled, total: dataRows.length, sample });
  }
  console.log('  column stats (col | header | filled/total | sample):');
  stats.forEach(s => {
    console.log(`    ${String(s.col).padStart(2)} | ${s.header.padEnd(28).slice(0, 28)} | ${s.filled}/${s.total} | ${s.sample}`);
  });

  // Show 3 mid-file data rows so we see what real data looks like
  const mid = Math.floor(dataRows.length / 2);
  const samples = [dataRows[0], dataRows[mid], dataRows[dataRows.length - 1]].filter(Boolean);
  console.log('  sample data rows:');
  samples.forEach((r, i) => {
    console.log(`    s${i}:`, JSON.stringify(r.map(c => (c === '' ? '∅' : String(c).slice(0, 40)))));
  });
}
