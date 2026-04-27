import * as XLSX from 'xlsx';

export interface RawSheetRow {
  rowNumber: number; // 1-based, header-аас доош 1-ээс эхлэн
  raw: Record<string, unknown>;
}

export interface ParsedSheet {
  sheetName: string;
  headers: string[];
  rows: RawSheetRow[];
}

// Excel/CSV файлаас нэгдүгээр sheet эсвэл бүх sheet-ийг
// header → row объект болгон уншина.
// Эхний хоосон бус мөрийг header гэж үзнэ.
export function parseWorkbookBuffer(buffer: ArrayBuffer): ParsedSheet[] {
  const wb = XLSX.read(buffer, { type: 'array' });
  return wb.SheetNames.map((name) => parseSheet(wb.Sheets[name], name)).filter(Boolean) as ParsedSheet[];
}

function parseSheet(ws: XLSX.WorkSheet, sheetName: string): ParsedSheet | null {
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
  if (!aoa || aoa.length === 0) return null;

  // Эхний хоосон бус мөрийг header гэж үзэх (эхний 5 мөрийг хайх)
  let headerIdx = -1;
  for (let i = 0; i < Math.min(5, aoa.length); i++) {
    const row = aoa[i] || [];
    if (row.filter((c) => String(c ?? '').trim()).length >= 2) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return null;

  const headerRow = aoa[headerIdx] as unknown[];
  const headers = headerRow.map((h, i) => String(h ?? `col_${i}`).trim());

  const rows: RawSheetRow[] = [];
  for (let i = headerIdx + 1; i < aoa.length; i++) {
    const r = aoa[i] || [];
    if (r.every((c) => String(c ?? '').trim() === '')) continue;
    const obj: Record<string, unknown> = {};
    headers.forEach((h, j) => {
      obj[h] = r[j] ?? '';
    });
    rows.push({ rowNumber: i - headerIdx, raw: obj });
  }

  return { sheetName, headers, rows };
}

// Энгийн CSV (запятай/таб/цэг) задлал
export function parseCsvText(text: string): ParsedSheet | null {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return null;
  const detectDelimiter = (line: string): string => {
    if (line.includes('\t')) return '\t';
    if (line.includes(';')) return ';';
    return ',';
  };
  const delim = detectDelimiter(lines[0]);
  const split = (line: string): string[] => {
    const out: string[] = [];
    let cur = '';
    let inQ = false;
    for (const ch of line) {
      if (ch === '"') inQ = !inQ;
      else if (ch === delim && !inQ) {
        out.push(cur.trim());
        cur = '';
      } else cur += ch;
    }
    out.push(cur.trim());
    return out;
  };
  const headers = split(lines[0]);
  const rows: RawSheetRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = split(lines[i]);
    const obj: Record<string, unknown> = {};
    headers.forEach((h, j) => (obj[h] = cells[j] ?? ''));
    rows.push({ rowNumber: i, raw: obj });
  }
  return { sheetName: 'CSV', headers, rows };
}
