import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { normalizeSohName, similarity } from './normalize';

export interface DirectoryRow {
  id: number;
  official_name: string;
  normalized_name: string;
  display_name: string | null;
  district: string | null;
  khoroo: string | null;
  address: string | null;
  phone: string | null;
  soh_code: string | null;
  status: 'ACTIVE' | 'PENDING' | 'HIDDEN';
  linked_tenant_id: number | null;
}

export interface DirectorySearchResult extends DirectoryRow {
  score: number;
  matched_alias?: string | null;
  is_active_tenant: boolean;
}

export interface SearchOptions {
  query: string;
  district?: string | null;
  khoroo?: string | null;
  limit?: number;
  // HIDDEN status байгаа бичлэг хайлтад харагдахгүй
  includeHidden?: boolean;
}

// Master directory дотор хайх
// Нэр, alias, хаяг, дүүрэг, хороогоор оноо тооцоолсон жагсаалт буцаана.
export async function searchHoaDirectory(opts: SearchOptions): Promise<DirectorySearchResult[]> {
  const { query, district, khoroo, limit = 25, includeHidden = false } = opts;
  const normQ = normalizeSohName(query || '');
  if (!normQ && !district && !khoroo) return [];

  // Хайлтын анхдагч filter
  // Нэр эсвэл нормалчлагдсан нэр эсвэл хаяг-аар чанх таарал
  const orFilters: string[] = [];
  if (normQ) {
    orFilters.push(`normalized_name.ilike.%${normQ}%`);
    orFilters.push(`search_text.ilike.%${normQ}%`);
    orFilters.push(`official_name.ilike.%${query}%`);
  }

  let q = supabaseAdmin
    .from('hoa_directory')
    .select('id, official_name, normalized_name, display_name, district, khoroo, address, phone, soh_code, status, linked_tenant_id')
    .limit(Math.min(limit * 4, 200));

  if (!includeHidden) q = q.neq('status', 'HIDDEN');
  if (district) q = q.eq('district', district);
  if (khoroo) q = q.eq('khoroo', khoroo);
  if (orFilters.length > 0) q = q.or(orFilters.join(','));

  const { data: directoryRows, error } = await q;
  if (error) {
    console.error('[directory/search] directory query error:', error.message);
    return [];
  }

  const rows = (directoryRows || []) as DirectoryRow[];

  // Alias-аас нэмэлт нэр дагуулж нэмэх
  const aliasMap = new Map<number, string>();
  if (normQ) {
    const { data: aliasRows } = await supabaseAdmin
      .from('hoa_directory_aliases')
      .select('directory_id, alias, normalized_alias')
      .ilike('normalized_alias', `%${normQ}%`)
      .limit(100);
    for (const ar of aliasRows || []) {
      aliasMap.set(ar.directory_id as number, ar.alias as string);
    }
  }

  // Onyio тооцоолох
  const scored: DirectorySearchResult[] = rows.map((row) => {
    let score = 0;
    if (normQ) {
      const nameSim = similarity(normQ, row.normalized_name || '');
      score += nameSim * 0.7;
      // exact match-ийг өсгөнө
      if (row.normalized_name === normQ) score += 0.3;
    }
    if (district && row.district === district) score += 0.05;
    if (khoroo && row.khoroo === khoroo) score += 0.05;
    if (aliasMap.has(row.id)) score += 0.2;
    if (row.linked_tenant_id) score += 0.02;

    return {
      ...row,
      score: Math.min(score, 1.5),
      matched_alias: aliasMap.get(row.id) || null,
      is_active_tenant: !!row.linked_tenant_id,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}
