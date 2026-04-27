import { findDirectoryMatches, type MatchResult } from '@/app/lib/directory/match';
import type { ParsedSheet } from './parse-xlsx';
import { buildLookup, validateDirectoryRow, type MappedDirectoryRow } from './validate-directory';

export type PreviewRowStatus = 'PENDING' | 'MATCHED' | 'NEW_RECORD' | 'DUPLICATE' | 'ERROR' | 'SKIPPED';

export interface DirectoryPreviewRow {
  rowNumber: number;
  raw: Record<string, unknown>;
  mapped?: MappedDirectoryRow;
  status: PreviewRowStatus;
  errorMessage?: string | null;
  warnings: string[];
  matchScore?: number | null;
  suggestedDirectoryId?: number | null;
  suggestedReasons?: string[];
}

export interface DirectoryPreviewSummary {
  total: number;
  newCount: number;
  matchedCount: number;
  duplicateCount: number;
  errorCount: number;
  reviewCount: number;
}

export interface DirectoryPreview {
  rows: DirectoryPreviewRow[];
  summary: DirectoryPreviewSummary;
}

// Sheet-ийн өгөгдлийг preview мөр болгон хувирган,
// мөр бүрд match эвристик ажиллуулна.
export async function buildDirectoryPreview(sheet: ParsedSheet): Promise<DirectoryPreview> {
  const lookup = buildLookup(sheet.headers);
  const rows: DirectoryPreviewRow[] = [];

  // Файл доторх давтагдсан нэрс хайх
  const seenNorm = new Map<string, number>(); // normalized name → first rowNumber

  for (const r of sheet.rows) {
    const validated = validateDirectoryRow(r.raw, lookup);
    if (!validated.ok || !validated.data) {
      rows.push({
        rowNumber: r.rowNumber,
        raw: r.raw,
        status: 'ERROR',
        errorMessage: validated.errors.join('; '),
        warnings: validated.warnings,
      });
      continue;
    }

    const data = validated.data;
    let match: MatchResult = { best: null, candidates: [], action: 'CREATE_NEW' };
    try {
      match = await findDirectoryMatches({
        officialName: data.officialName,
        district: data.district,
        khoroo: data.khoroo,
        address: data.address,
        sohCode: data.sohCode,
        aliases: data.aliases,
      });
    } catch (err) {
      console.error('[directory/preview] match error', err);
    }

    let status: PreviewRowStatus = 'NEW_RECORD';
    if (match.action === 'MATCH_EXISTING') status = 'MATCHED';
    else if (match.action === 'REVIEW_NEEDED') status = 'DUPLICATE';

    // Мөн файлын дотор нэр давхардсан бол DUPLICATE гэж тэмдэглэх
    const normKey = data.officialName.toLowerCase().trim();
    if (seenNorm.has(normKey)) {
      status = 'DUPLICATE';
      validated.warnings.push(`файлын ${seenNorm.get(normKey)}-р мөртэй давхцаж байна`);
    } else {
      seenNorm.set(normKey, r.rowNumber);
    }

    rows.push({
      rowNumber: r.rowNumber,
      raw: r.raw,
      mapped: data,
      status,
      warnings: validated.warnings,
      matchScore: match.best?.score ?? null,
      suggestedDirectoryId: match.best?.directory.id ?? null,
      suggestedReasons: match.best?.reasons ?? [],
    });
  }

  const summary: DirectoryPreviewSummary = {
    total: rows.length,
    newCount: rows.filter((r) => r.status === 'NEW_RECORD').length,
    matchedCount: rows.filter((r) => r.status === 'MATCHED').length,
    duplicateCount: rows.filter((r) => r.status === 'DUPLICATE').length,
    errorCount: rows.filter((r) => r.status === 'ERROR').length,
    reviewCount: rows.filter((r) => r.status === 'DUPLICATE').length,
  };

  return { rows, summary };
}
