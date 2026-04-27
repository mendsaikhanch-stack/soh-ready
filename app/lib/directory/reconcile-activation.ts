// Activation summaries reconciliation
// Зорилго: hoa_activation_summaries дахь counter-ууд hoa_activation_requests-тэй
// тохирохгүй болсон бол recompute хийх. Source of truth = requests.

import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { recomputeActivationSummary } from './activation';

export interface ActivationReconcileReport {
  scanned: number;
  recomputed: number;
  matched: number;
  errors: number;
  mismatches: Array<{ summaryId: number; before: number; after: number }>;
}

/**
 * Бүх idэвхтэй summary-уудыг скан хийгээд тооноос зөрсэн бол recompute.
 * Том SOH count-той бол `limit`-ээр batched хийнэ.
 */
export async function reconcileAllActivationSummaries(opts: { limit?: number } = {}): Promise<ActivationReconcileReport> {
  const limit = opts.limit ?? 500;
  const report: ActivationReconcileReport = { scanned: 0, recomputed: 0, matched: 0, errors: 0, mismatches: [] };

  const { data: summaries, error } = await supabaseAdmin
    .from('hoa_activation_summaries')
    .select('id, directory_id, provisional_hoa_id, interest_count')
    .limit(limit);
  if (error) {
    console.error('[reconcileAllActivationSummaries]', error.message);
    report.errors++;
    return report;
  }

  for (const s of summaries || []) {
    report.scanned++;
    const filterCol = s.directory_id ? 'directory_id' : 'provisional_hoa_id';
    const filterId = (s.directory_id ?? s.provisional_hoa_id) as number;
    if (!filterId) continue;

    // Зөрөө шалгахын тулд real count авна
    const { count: realCount } = await supabaseAdmin
      .from('hoa_activation_requests')
      .select('id', { count: 'exact', head: true })
      .eq(filterCol, filterId);

    const before = Number(s.interest_count) || 0;
    const after = realCount ?? 0;
    if (before === after) {
      report.matched++;
      continue;
    }

    try {
      await recomputeActivationSummary({
        directoryId: s.directory_id || undefined,
        provisionalId: s.provisional_hoa_id || undefined,
      });
      report.recomputed++;
      report.mismatches.push({ summaryId: s.id as number, before, after });
    } catch (e) {
      console.error('[reconcileAllActivationSummaries row]', s.id, e);
      report.errors++;
    }
  }

  return report;
}
