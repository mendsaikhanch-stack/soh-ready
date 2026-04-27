import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { findDirectoryMatches, type MatchCandidate } from './match';
import { recomputeActivationSummary } from './activation';

export interface ProvisionalRow {
  id: number;
  entered_name: string;
  normalized_name: string;
  city: string | null;
  district: string | null;
  khoroo: string | null;
  town_name: string | null;
  building: string | null;
  address: string | null;
  status: 'PENDING' | 'HAS_DEMAND' | 'MATCH_CANDIDATE' | 'MERGED' | 'REJECTED';
  matched_directory_id: number | null;
  match_score: number | null;
}

export interface ProvisionalSuggestion {
  provisional: ProvisionalRow;
  best: MatchCandidate | null;
  candidates: MatchCandidate[];
  action: 'AUTO_MERGE' | 'REVIEW_NEEDED' | 'KEEP_SEPARATE';
}

const AUTO_MERGE_THRESHOLD = 0.92;
const REVIEW_THRESHOLD = 0.7;

// Нэг provisional СӨХ-д тохирох directory candidate олох
export async function suggestProvisionalMatch(provisional: ProvisionalRow): Promise<ProvisionalSuggestion> {
  const result = await findDirectoryMatches({
    officialName: provisional.entered_name,
    district: provisional.district,
    khoroo: provisional.khoroo,
    address: provisional.address ?? provisional.town_name,
  });

  let action: ProvisionalSuggestion['action'] = 'KEEP_SEPARATE';
  if (result.best) {
    if (result.best.score >= AUTO_MERGE_THRESHOLD) action = 'AUTO_MERGE';
    else if (result.best.score >= REVIEW_THRESHOLD) action = 'REVIEW_NEEDED';
  }

  return { provisional, best: result.best, candidates: result.candidates, action };
}

interface MergeOptions {
  provisionalId: number;
  directoryId: number;
  score?: number | null;
  reason?: string;
  mergedBy?: string;
}

interface MergeResult {
  movedMemberships: number;
  movedActivationRequests: number;
  removedProvisionalSummary: boolean;
  alreadyMerged: boolean;
}

// Provisional СӨХ-ийг albанчилсан hoa_directory мөртэй нэгтгэх.
// Idempotent: дахин дуудсан ч давхар тоолохгүй (memberships/activation_requests-ыг
// зөвхөн provisional_hoa_id заасан мөрүүдийг шилжүүлнэ — анх нэгтгэсний дараа провишн
// руу заагаагүй болохоор noop болно).
export async function mergeProvisionalIntoDirectory(opts: MergeOptions): Promise<MergeResult> {
  const { provisionalId, directoryId } = opts;

  // 1) provisional + directory оршин байгааг шалгах
  const [{ data: provisional }, { data: directory }] = await Promise.all([
    supabaseAdmin.from('hoa_provisional').select('id, status').eq('id', provisionalId).single(),
    supabaseAdmin.from('hoa_directory').select('id, linked_tenant_id').eq('id', directoryId).single(),
  ]);

  if (!provisional) throw new Error('Provisional row not found');
  if (!directory) throw new Error('Directory row not found');
  if (provisional.status === 'MERGED') {
    return { movedMemberships: 0, movedActivationRequests: 0, removedProvisionalSummary: false, alreadyMerged: true };
  }

  const isLinkedTenant = !!directory.linked_tenant_id;
  const newMembershipStatus = isLinkedTenant ? 'ACTIVE_TENANT' : 'LINKED_TO_DIRECTORY';

  // 2) resident_memberships шилжүүлэх
  const { data: memberships } = await supabaseAdmin
    .from('resident_memberships')
    .select('id')
    .eq('provisional_hoa_id', provisionalId);
  const membershipIds = (memberships || []).map((m) => m.id as number);

  if (membershipIds.length > 0) {
    await supabaseAdmin
      .from('resident_memberships')
      .update({
        directory_id: directoryId,
        provisional_hoa_id: null,
        status: newMembershipStatus,
      })
      .in('id', membershipIds);
  }

  // 3) hoa_activation_requests шилжүүлэх
  const { data: requests } = await supabaseAdmin
    .from('hoa_activation_requests')
    .select('id')
    .eq('provisional_hoa_id', provisionalId);
  const requestIds = (requests || []).map((r) => r.id as number);

  if (requestIds.length > 0) {
    await supabaseAdmin
      .from('hoa_activation_requests')
      .update({ directory_id: directoryId, provisional_hoa_id: null })
      .in('id', requestIds);
  }

  // 4) Provisional-ийн summary-г устгана (provisional row устсан хойно cascade
  //    хийгдэх ч одоогоор бид зөвхөн status-г MERGED болгож үлдээж байна)
  let removedSummary = false;
  const { data: provSummary } = await supabaseAdmin
    .from('hoa_activation_summaries')
    .select('id')
    .eq('provisional_hoa_id', provisionalId)
    .maybeSingle();
  if (provSummary?.id) {
    await supabaseAdmin.from('hoa_activation_summaries').delete().eq('id', provSummary.id);
    removedSummary = true;
  }

  // 5) Directory-н summary-г шинэчлэх
  await recomputeActivationSummary({ directoryId });

  // 6) Provisional-ийг MERGED болгох
  await supabaseAdmin
    .from('hoa_provisional')
    .update({
      status: 'MERGED',
      matched_directory_id: directoryId,
      match_score: opts.score ?? null,
    })
    .eq('id', provisionalId);

  // 7) Audit log
  await supabaseAdmin.from('hoa_merge_logs').insert({
    provisional_hoa_id: provisionalId,
    directory_id: directoryId,
    score: opts.score ?? null,
    reason: opts.reason ?? null,
    merged_by: opts.mergedBy ?? null,
  });

  return {
    movedMemberships: membershipIds.length,
    movedActivationRequests: requestIds.length,
    removedProvisionalSummary: removedSummary,
    alreadyMerged: false,
  };
}

// Олон provisional-ыг шалгаж, AUTO_MERGE-д тохирохыг автоматаар нэгтгэх.
// REVIEW_NEEDED-ийг status='MATCH_CANDIDATE' болгож тэмдэглэнэ.
export interface AutoMergeReport {
  scanned: number;
  autoMerged: number;
  flaggedForReview: number;
  keptSeparate: number;
  errors: number;
}

export async function autoMergeProvisionals(opts: { mergedBy?: string; limit?: number } = {}): Promise<AutoMergeReport> {
  const { mergedBy = 'system', limit = 200 } = opts;
  const report: AutoMergeReport = { scanned: 0, autoMerged: 0, flaggedForReview: 0, keptSeparate: 0, errors: 0 };

  const { data: rows } = await supabaseAdmin
    .from('hoa_provisional')
    .select('id, entered_name, normalized_name, city, district, khoroo, town_name, building, address, status, matched_directory_id, match_score')
    .in('status', ['PENDING', 'HAS_DEMAND', 'MATCH_CANDIDATE'])
    .limit(limit);

  for (const row of (rows || []) as ProvisionalRow[]) {
    report.scanned++;
    try {
      const suggestion = await suggestProvisionalMatch(row);
      if (suggestion.action === 'AUTO_MERGE' && suggestion.best) {
        await mergeProvisionalIntoDirectory({
          provisionalId: row.id,
          directoryId: suggestion.best.directory.id,
          score: suggestion.best.score,
          reason: `auto-merge:${suggestion.best.reasons.join('|')}`,
          mergedBy,
        });
        report.autoMerged++;
      } else if (suggestion.action === 'REVIEW_NEEDED' && suggestion.best) {
        await supabaseAdmin
          .from('hoa_provisional')
          .update({
            status: 'MATCH_CANDIDATE',
            matched_directory_id: suggestion.best.directory.id,
            match_score: suggestion.best.score,
          })
          .eq('id', row.id);
        report.flaggedForReview++;
      } else {
        report.keptSeparate++;
      }
    } catch (e) {
      console.error('[auto-merge] error for provisional', row.id, e);
      report.errors++;
    }
  }

  return report;
}
