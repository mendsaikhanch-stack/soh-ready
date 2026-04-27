// Merge reconciliation + manual-signup repair
// Зорилго:
//   1. hoa_provisional MERGED боловч resident_memberships эсвэл
//      hoa_activation_requests дотор тэр provisional_hoa_id хэвээр үлдсэн бичлэг
//      байвал directory_id рүү шилжүүлэх.
//   2. hoa_merge_logs-д бичлэг алга бол сэргээх.
//   3. resident-ийн manual signup flow-ыг бүхэлд нь тулгаж засах.

import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { recomputeActivationSummary } from './activation';
import { linkManualSignupToUser } from './link-manual-signup';

export interface MergeReconcileReport {
  scanned: number;
  cleanedMemberships: number;
  cleanedRequests: number;
  recomputedSummaries: number;
  logsRepaired: number;
  errors: number;
}

/**
 * MERGED статустай боловч orphan rows үлдсэн provisional-уудыг олж засна.
 */
export async function reconcileOrphanMerges(opts: { limit?: number } = {}): Promise<MergeReconcileReport> {
  const limit = opts.limit ?? 100;
  const report: MergeReconcileReport = {
    scanned: 0,
    cleanedMemberships: 0,
    cleanedRequests: 0,
    recomputedSummaries: 0,
    logsRepaired: 0,
    errors: 0,
  };

  const { data: merged, error } = await supabaseAdmin
    .from('hoa_provisional')
    .select('id, matched_directory_id')
    .eq('status', 'MERGED')
    .not('matched_directory_id', 'is', null)
    .limit(limit);
  if (error) {
    console.error('[reconcileOrphanMerges]', error.message);
    report.errors++;
    return report;
  }

  for (const p of merged || []) {
    report.scanned++;
    const provisionalId = p.id as number;
    const directoryId = p.matched_directory_id as number;

    try {
      // Memberships-ыг directory руу шилжүүлэх
      const { data: movedM } = await supabaseAdmin
        .from('resident_memberships')
        .update({ provisional_hoa_id: null, directory_id: directoryId })
        .eq('provisional_hoa_id', provisionalId)
        .select('id');
      if (movedM) report.cleanedMemberships += movedM.length;

      // Activation requests-г directory руу шилжүүлэх
      const { data: movedR } = await supabaseAdmin
        .from('hoa_activation_requests')
        .update({ provisional_hoa_id: null, directory_id: directoryId })
        .eq('provisional_hoa_id', provisionalId)
        .select('id');
      if (movedR) report.cleanedRequests += movedR.length;

      // Provisional summary үлдсэн бол устгана
      await supabaseAdmin
        .from('hoa_activation_summaries')
        .delete()
        .eq('provisional_hoa_id', provisionalId);

      // Directory summary recompute
      await recomputeActivationSummary({ directoryId });
      report.recomputedSummaries++;

      // Merge log байгаа эсэхийг шалгана
      const { data: log } = await supabaseAdmin
        .from('hoa_merge_logs')
        .select('id')
        .eq('provisional_hoa_id', provisionalId)
        .eq('directory_id', directoryId)
        .maybeSingle();
      if (!log) {
        await supabaseAdmin.from('hoa_merge_logs').insert([{
          provisional_hoa_id: provisionalId,
          directory_id: directoryId,
          score: 1,
          reason: 'reconciliation:repair',
          merged_by: 'system:reconcile',
        }]);
        report.logsRepaired++;
      }
    } catch (e) {
      console.error('[reconcileOrphanMerges row]', provisionalId, e);
      report.errors++;
    }
  }

  return report;
}

/**
 * Тодорхой нэг resident-ийн manual signup flow-ыг бүхэлд нь шалгаж засна.
 * Job: repair_manual_signup_flow-аас дуудна.
 *
 * Безопасность:
 * - resident байхгүй бол no-op
 * - claim хийгдсэн (user_id-той) row-уудыг хөндөхгүй
 * - linkManualSignupToUser нь өөрөө идэмпотент
 */
export async function repairResidentSignupFlow(residentId: number): Promise<{
  linked: boolean;
  noteOnFlow: string;
}> {
  const { data: r } = await supabaseAdmin
    .from('residents')
    .select('id, phone, sokh_id')
    .eq('id', residentId)
    .maybeSingle();
  if (!r) return { linked: false, noteOnFlow: 'resident not found' };

  // 1. linkManualSignupToUser идэмпотент дуудалт — claim хийнэ
  const link = await linkManualSignupToUser({
    userId: r.id,
    phone: r.phone || undefined,
  });

  // 2. Resident-н sokh_id байгаа боловч resident_memberships rolling unlinked
  // байх нөхцөлийг шалгана. Ийм тохиолдолд simply linked цаашаа sokh_organization-той
  // resident-н sokh_id-аар тэгш үлдээх.
  if (r.sokh_id) {
    const { data: dirRow } = await supabaseAdmin
      .from('hoa_directory')
      .select('id')
      .eq('linked_tenant_id', r.sokh_id)
      .maybeSingle();
    if (dirRow) {
      // Зөвхөн user_id null талбарыг хөдөлгөнө
      const { data: existingMember } = await supabaseAdmin
        .from('resident_memberships')
        .select('id, user_id')
        .eq('user_id', r.id)
        .eq('directory_id', dirRow.id)
        .maybeSingle();
      if (!existingMember) {
        // Нэмж membership үүсгэхгүй — current logic-ыг хүндэтгэх. Зөвхөн log хийнэ.
        return {
          linked: link.anythingLinked,
          noteOnFlow: `directory ${dirRow.id} linked to sokh ${r.sokh_id}, no membership backfilled (manual review)`,
        };
      }
    }
  }

  return { linked: link.anythingLinked, noteOnFlow: 'idempotent link applied' };
}
