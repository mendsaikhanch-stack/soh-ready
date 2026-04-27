// Recovery job handlers — бүгд идэмпотент.
// Worker-аас runJob-оор дуудна; throw → retry.

import type { JobHandler, JobType } from './types';
import { linkManualSignupToUser } from '@/app/lib/directory/link-manual-signup';
import { recomputeActivationSummary } from '@/app/lib/directory/activation';
import { mergeProvisionalIntoDirectory, autoMergeProvisionals } from '@/app/lib/directory/merge-provisional';
import { reconcileClaimsForResident } from '@/app/lib/directory/reconcile-claims';
import { repairResidentSignupFlow } from '@/app/lib/directory/reconcile-merges';

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
// Payload: { notificationId?: number, scheduledNotificationId?: number }
// Одоогоор scaffold — push retry хэрэв scheduled_notifications хүснэгтэд retryable төлөв байвал
const retry_notification_delivery: JobHandler<{
  scheduledNotificationId?: number;
}> = async (payload, { supabase }) => {
  if (!payload.scheduledNotificationId) {
    // Scaffold — одоохон notification дахин илгээх логик систем дотор бэлэн биш.
    // Ирээдүйд notifications outbox-той болсон үед энд retry логик нэмэгдэнэ.
    return;
  }
  // Scheduled-ыг "PENDING" руу буцаагаад debt-reminder cron эргэн илгээнэ
  const { error } = await supabase
    .from('scheduled_notifications')
    .update({ status: 'PENDING' })
    .eq('id', payload.scheduledNotificationId)
    .in('status', ['FAILED']);
  if (error) throw new Error(`Notification reset failed: ${error.message}`);
};

export const handlers: Record<JobType, JobHandler<never>> = {
  repair_manual_signup_flow: repair_manual_signup_flow as JobHandler<never>,
  retry_manual_claim_link: retry_manual_claim_link as JobHandler<never>,
  rebuild_activation_summary: rebuild_activation_summary as JobHandler<never>,
  retry_provisional_merge: retry_provisional_merge as JobHandler<never>,
  auto_merge_provisionals_scan: auto_merge_provisionals_scan as JobHandler<never>,
  retry_notification_delivery: retry_notification_delivery as JobHandler<never>,
};
