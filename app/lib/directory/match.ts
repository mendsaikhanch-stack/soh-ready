import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { normalizeSohName, similarity } from './normalize';
import type { DirectoryRow } from './search';

export type MatchAction = 'MATCH_EXISTING' | 'CREATE_NEW' | 'REVIEW_NEEDED';

export interface MatchCandidate {
  directory: DirectoryRow;
  score: number;
  reasons: string[];
}

export interface MatchResult {
  best: MatchCandidate | null;
  candidates: MatchCandidate[];
  action: MatchAction;
}

export interface MatchInput {
  officialName: string;
  district?: string | null;
  khoroo?: string | null;
  address?: string | null;
  sohCode?: string | null;
  aliases?: string[];
}

const HIGH_CONFIDENCE = 0.92;
const REVIEW_THRESHOLD = 0.7;

// Олон СӨХ дотроос таарах магадлалтайг сонгох эвристик scorer
// Нийт оноо: 0..1 (~)
function scoreCandidate(input: MatchInput, candidate: DirectoryRow): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  const normInput = normalizeSohName(input.officialName);
  const normCand = candidate.normalized_name || normalizeSohName(candidate.official_name);

  if (normInput && normCand && normInput === normCand) {
    score += 0.7;
    reasons.push('exact-normalized-name');
  } else if (normInput && normCand) {
    const sim = similarity(normInput, normCand);
    score += sim * 0.6;
    if (sim > 0.85) reasons.push(`name-fuzzy:${sim.toFixed(2)}`);
  }

  if (input.sohCode && candidate.soh_code && input.sohCode === candidate.soh_code) {
    score += 0.3;
    reasons.push('same-soh-code');
  }

  if (input.district && candidate.district && input.district === candidate.district) {
    score += 0.1;
    reasons.push('same-district');
  }

  if (input.khoroo && candidate.khoroo && input.khoroo === candidate.khoroo) {
    score += 0.1;
    reasons.push('same-khoroo');
  }

  if (input.address && candidate.address) {
    const addrSim = similarity(normalizeSohName(input.address), normalizeSohName(candidate.address));
    if (addrSim > 0.8) {
      score += 0.1;
      reasons.push(`address-similar:${addrSim.toFixed(2)}`);
    }
  }

  return { score: Math.min(score, 1.2), reasons };
}

// Импортын мөр / signup хайлтад нэг оролт өгч,
// directory дотроос магадлалтай таарлуудыг буцаана.
export async function findDirectoryMatches(input: MatchInput, opts: { limit?: number } = {}): Promise<MatchResult> {
  const limit = opts.limit ?? 10;
  const normInput = normalizeSohName(input.officialName);

  // Нэрний илрэх боломжтой бичлэгүүдийг өргөн filter-ээр татах
  const orParts: string[] = [];
  if (normInput) {
    orParts.push(`normalized_name.ilike.%${normInput}%`);
    orParts.push(`search_text.ilike.%${normInput}%`);
  }
  if (input.sohCode) orParts.push(`soh_code.eq.${input.sohCode}`);

  let q = supabaseAdmin
    .from('hoa_directory')
    .select('id, official_name, normalized_name, display_name, district, khoroo, address, phone, soh_code, status, linked_tenant_id')
    .limit(40);
  if (orParts.length > 0) q = q.or(orParts.join(','));
  if (input.district) {
    // Дүүрэг таарах нь чухал ч заавал биш — улмаар filter биш bonus-аар тооцно.
  }

  const { data, error } = await q;
  if (error) {
    console.error('[directory/match] candidate query error:', error.message);
    return { best: null, candidates: [], action: 'CREATE_NEW' };
  }

  // Alias-аар таарсан бичлэгүүдийг бас нэмэх
  let aliasDirectoryIds = new Set<number>();
  if (normInput) {
    const { data: aliasRows } = await supabaseAdmin
      .from('hoa_directory_aliases')
      .select('directory_id')
      .ilike('normalized_alias', `%${normInput}%`)
      .limit(50);
    aliasDirectoryIds = new Set((aliasRows || []).map((r) => r.directory_id as number));
  }

  let candidatesData = (data || []) as DirectoryRow[];
  if (aliasDirectoryIds.size > 0) {
    const missing = [...aliasDirectoryIds].filter((id) => !candidatesData.some((c) => c.id === id));
    if (missing.length > 0) {
      const { data: extra } = await supabaseAdmin
        .from('hoa_directory')
        .select('id, official_name, normalized_name, display_name, district, khoroo, address, phone, soh_code, status, linked_tenant_id')
        .in('id', missing);
      if (extra) candidatesData = candidatesData.concat(extra as DirectoryRow[]);
    }
  }

  const candidates: MatchCandidate[] = candidatesData
    .map((c) => {
      const { score, reasons } = scoreCandidate(input, c);
      if (aliasDirectoryIds.has(c.id)) {
        reasons.push('alias-match');
      }
      return { directory: c, score, reasons };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const best = candidates[0] || null;

  let action: MatchAction = 'CREATE_NEW';
  if (best) {
    if (best.score >= HIGH_CONFIDENCE) action = 'MATCH_EXISTING';
    else if (best.score >= REVIEW_THRESHOLD) action = 'REVIEW_NEEDED';
  }

  return { best, candidates, action };
}
