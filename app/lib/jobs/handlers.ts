// Recovery job handlers — бүгд идэмпотент.
// Worker-аас runJob-оор дуудна; throw → retry.

import type { JobHandler, JobType } from './types';
import { linkManualSignupToUser } from '@/app/lib/directory/link-manual-signup';
import { recomputeActivationSummary } from '@/app/lib/directory/activation';
import { mergeProvisionalIntoDirectory, autoMergeProvisionals } from '@/app/lib/directory/merge-provisional';
import { reconcileClaimsForResident } from '@/app/lib/directory/reconcile-claims';
import { repairResidentSignupFlow } from '@/app/lib/directory/reconcile-merges';
import { raiseAlert } from '@/app/lib/alerts';
import { deliverPendingForSokh } from '@/app/lib/notifications/deliver';

// 1. repair_manual_signup_flow
// Payload: { residentId: number }
// Хэрэв хэдэн алхам бүтэлгүйтсэн бол hoa_provisional, user_signup_requests,
// resident_memberships, hoa_activation_requests, hoa_activation_summaries-ыг
// resident-н одоогийн төлөв байдалд тулгуурлан буцаах
const repair_manual_signup_flow: JobHandler<{ residentId: number }> = async (payload) => {
  if (!payload.residentId) throw new Error('residentId required');
  await repairResidentSignupFlow(payload.residentId);
};

// 2. retry_manual_claim_link
// Payload: { residentId: number, phone?: string, email?: string, claimToken?: string }
const retry_manual_claim_link: JobHandler<{
  residentId: number;
  phone?: string;
  email?: string;
  claimToken?: string;
}> = async (payload) => {
  if (!payload.residentId) throw new Error('residentId required');
  await linkManualSignupToUser({
    userId: payload.residentId,
    phone: payload.phone || null,
    email: payload.email || null,
    claimToken: payload.claimToken || null,
  });
  // Дашрамд тухайн resident-ийн ямар нэг ямар нэг "user_id null but should be claimed"
  // мембершип үлдсэн бол давтан claim-ыг оролдоно
  await reconcileClaimsForResident(payload.residentId);
};

// 3. rebuild_activation_summary
// Payload: { directoryId?: number, provisionalId?: number }
// Аль алийг өгөөгүй бол no-op (caller буруу payload явуулсан гэж үзэн алдаа throw)
const rebuild_activation_summary: JobHandler<{
  directoryId?: number;
  provisionalId?: number;
}> = async (payload) => {
  if (!payload.directoryId && !payload.provisionalId) {
    throw new Error('directoryId or provisionalId required');
  }
  await recomputeActivationSummary({
    directoryId: payload.directoryId,
    provisionalId: payload.provisionalId,
  });
};

// 4. retry_provisional_merge
// Payload: { provisionalId: number, directoryId: number, score?: number, reason?: string, mergedBy?: string }
const retry_provisional_merge: JobHandler<{
  provisionalId: number;
  directoryId: number;
  score?: number;
  reason?: string;
  mergedBy?: string;
}> = async (payload) => {
  if (!payload.provisionalId || !payload.directoryId) {
    throw new Error('provisionalId and directoryId required');
  }
  // mergeProvisionalIntoDirectory нь алдаа гарвал throw хийдэг, амжилттай бол
  // тоонуудтай үр дүн буцаана. Worker нь throw-г retry болгоно.
  await mergeProvisionalIntoDirectory({
    provisionalId: payload.provisionalId,
    directoryId: payload.directoryId,
    score: payload.score ?? 1,
    reason: payload.reason || 'auto-retry',
    mergedBy: payload.mergedBy || 'system:retry',
  });
};

// 5. auto_merge_provisionals_scan
// Payload: { limit?: number, mergedBy?: string }
const auto_merge_provisionals_scan: JobHandler<{
  limit?: number;
  mergedBy?: string;
}> = async (payload) => {
  await autoMergeProvisionals({
    limit: payload.limit ?? 50,
    mergedBy: payload.mergedBy || 'system:scan',
  });
};

// 6. retry_notification_delivery
// Payload: { sokhId?: number, scheduledNotificationId?: number }
// Бодит outbox retry: failed бичлэгүүдийг attempts < max_attempts бол pending руу буцаана,
// дараагийн trigger-scheduled дуудлагад дахин илгээгдэнэ. Max давсан бол dead alert raise хийнэ.
const retry_notification_delivery: JobHandler<{
  sokhId?: number;
  scheduledNotificationId?: number;
}> = async (payload, { supabase }) => {
  // Тодорхой нэг notif-ыг target хийсэн бол түүн дээр л ажиллана
  let q = supabase
    .from('scheduled_notifications')
    .select('id, sokh_id, attempts, max_attempts, last_error')
    .eq('status', 'failed');
  if (payload.scheduledNotificationId) {
    q = q.eq('id', payload.scheduledNotificationId);
  } else if (payload.sokhId) {
    q = q.eq('sokh_id', payload.sokhId);
  }

  const { data: failedNotifs, error: selErr } = await q.limit(100);
  if (selErr) throw new Error(`select failed notifs: ${selErr.message}`);
  if (!failedNotifs || failedNotifs.length === 0) return;

  const retryIds: number[] = [];
  const deadIds: Array<{ id: number; sokhId: number; attempts: number; lastError: string | null }> = [];

  for (const n of failedNotifs) {
    const max = Number(n.max_attempts ?? 3);
    const attempts = Number(n.attempts ?? 0);
    if (attempts >= max) {
      deadIds.push({
        id: n.id as number,
        sokhId: n.sokh_id as number,
        attempts,
        lastError: (n.last_error as string | null) ?? null,
      });
    } else {
      retryIds.push(n.id as number);
    }
  }

  if (retryIds.length > 0) {
    const { error: upErr } = await supabase
      .from('scheduled_notifications')
      .update({ status: 'pending', failed_at: null })
      .in('id', retryIds);
    if (upErr) throw new Error(`reset to pending failed: ${upErr.message}`);

    // pending-д буцаасан notif-уудыг шууд push-аар дахин илгээнэ
    const sokhIds = Array.from(new Set(failedNotifs
      .filter(n => retryIds.includes(n.id as number))
      .map(n => n.sokh_id as number)));
    for (const sokhId of sokhIds) {
      await deliverPendingForSokh(sokhId);
    }
  }

  for (const dead of deadIds) {
    await raiseAlert({
      severity: 'critical',
      source: 'notif:dead',
      message: `Scheduled notification #${dead.id} (sokh ${dead.sokhId}) max retries (${dead.attempts}) давлаа: ${dead.lastError || 'unknown'}`,
      payload: dead,
      dedupKey: `notif:dead:${dead.id}`,
    });
  }
};

export const handlers: Record<JobType, JobHandler<never>> = {
  repair_manual_signup_flow: repair_manual_signup_flow as JobHandler<never>,
  retry_manual_claim_link: retry_manual_claim_link as JobHandler<never>,
  rebuild_activation_summary: rebuild_activation_summary as JobHandler<never>,
  retry_provisional_merge: retry_provisional_merge as JobHandler<never>,
  auto_merge_provisionals_scan: auto_merge_provisionals_scan as JobHandler<never>,
  retry_notification_delivery: retry_notification_delivery as JobHandler<never>,
};
