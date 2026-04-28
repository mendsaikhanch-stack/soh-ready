// Scheduled notification outbox: pending мэдэгдлүүдийг тухайн sokh-ийн
// бүх push subscription уруу илгээж амжилт/амжилтгүйг scheduled_notifications-д бичнэ.
// Failed (0 амжилттай) болсон notif дээр attempts++ + retry job enqueue.

import { supabaseAdmin } from '@/app/lib/supabase-admin';
import webpush from 'web-push';
import { enqueueRepair } from '@/app/lib/jobs/dispatch';

let vapidConfigured = false;
function ensureVapid() {
  if (vapidConfigured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (publicKey && privateKey) {
    webpush.setVapidDetails('mailto:info@toot.mn', publicKey, privateKey);
    vapidConfigured = true;
  }
}

export interface DeliveryResult {
  triggered: number;
  pushSent: number;
  failed: number;
}

/** Тухайн sokh-ийн scheduled_notifications.status='pending', scheduled_at <= now бичлэгүүдийг push илгээх. */
export async function deliverPendingForSokh(sokhId: number): Promise<DeliveryResult> {
  ensureVapid();

  const now = new Date().toISOString();
  const { data: pendingNotifs } = await supabaseAdmin
    .from('scheduled_notifications')
    .select('id, sokh_id, title, message, attempts')
    .eq('sokh_id', sokhId)
    .eq('status', 'pending')
    .lte('scheduled_at', now);

  if (!pendingNotifs || pendingNotifs.length === 0) {
    return { triggered: 0, pushSent: 0, failed: 0 };
  }

  const { data: subs } = await supabaseAdmin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('sokh_id', sokhId);

  let pushSent = 0;
  let failedNotifs = 0;

  for (const notif of pendingNotifs) {
    // Subscription байхгүй бол no-op амжилт — retry хэрэггүй
    if (!subs || subs.length === 0) {
      await supabaseAdmin
        .from('scheduled_notifications')
        .update({ status: 'sent', last_error: null })
        .eq('id', notif.id);
      continue;
    }

    const payload = JSON.stringify({
      title: notif.title,
      body: notif.message,
      url: `/sokh/${sokhId}/notifications`,
      tag: `scheduled-${notif.id}`,
    });

    let notifSent = 0;
    let lastError: string | null = null;
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        notifSent++;
        pushSent++;
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        lastError = (err as Error).message || `status=${statusCode}`;
        if (statusCode === 410 || statusCode === 404) {
          await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        }
      }
    }

    if (notifSent > 0) {
      await supabaseAdmin
        .from('scheduled_notifications')
        .update({ status: 'sent', last_error: null })
        .eq('id', notif.id);
    } else {
      const attempts = (notif.attempts ?? 0) + 1;
      await supabaseAdmin
        .from('scheduled_notifications')
        .update({
          status: 'failed',
          attempts,
          last_error: lastError || 'no successful delivery',
          failed_at: new Date().toISOString(),
        })
        .eq('id', notif.id);
      failedNotifs++;
    }
  }

  // Хэрэв failed үүссэн бол retry job-ыг enqueue (idempotent: 1 удаа per минут per sokh)
  if (failedNotifs > 0) {
    const minute = Math.floor(Date.now() / 60_000);
    await enqueueRepair('retry_notification_delivery', { sokhId }, {
      idempotencyKey: `notif-retry:${sokhId}:${minute}`,
      delaySec: 60,
    });
  }

  return { triggered: pendingNotifs.length, pushSent, failed: failedNotifs };
}
