import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import webpush from 'web-push';

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

async function isAdminOrCron(request: NextRequest): Promise<boolean> {
  // Cron secret шалгах (Vercel cron гэх мэт)
  const cronSecret = request.headers.get('x-cron-secret');
  if (cronSecret && cronSecret === process.env.CRON_SECRET) return true;

  // Admin session шалгах
  const cookieStore = await cookies();
  const adminToken = cookieStore.get('admin-session')?.value;
  if (!adminToken) return false;
  const parts = adminToken.split(':');
  if (parts.length < 2) return false;
  const timestamp = parseInt(parts[0], 10);
  return !isNaN(timestamp) && Date.now() - timestamp <= 24 * 60 * 60 * 1000;
}

// Товлосон мэдэгдлүүдийг шалгаж push илгээх
export async function POST(request: NextRequest) {
  if (!await isAdminOrCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  ensureVapid();

  try {
    const { sokh_id } = await request.json();

    if (!sokh_id || typeof sokh_id !== 'number' || sokh_id <= 0) {
      return NextResponse.json({ error: 'Valid sokh_id required' }, { status: 400 });
    }

    // Хугацаа болсон pending мэдэгдлүүдийг олох
    const now = new Date().toISOString();
    const { data: pendingNotifs } = await supabaseAdmin
      .from('scheduled_notifications')
      .select('*')
      .eq('sokh_id', sokh_id)
      .eq('status', 'pending')
      .lte('scheduled_at', now);

    if (!pendingNotifs || pendingNotifs.length === 0) {
      return NextResponse.json({ triggered: 0 });
    }

    // pending → sent
    const ids = pendingNotifs.map(n => n.id);
    await supabaseAdmin
      .from('scheduled_notifications')
      .update({ status: 'sent' })
      .in('id', ids);

    // Push илгээх
    const { data: subs } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .eq('sokh_id', sokh_id);

    let totalSent = 0;

    if (subs && subs.length > 0) {
      for (const notif of pendingNotifs) {
        const payload = JSON.stringify({
          title: notif.title,
          body: notif.message,
          url: `/sokh/${sokh_id}/notifications`,
          tag: `scheduled-${notif.id}`,
        });

        for (const sub of subs) {
          try {
            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth },
              },
              payload
            );
            totalSent++;
          } catch (err: any) {
            if (err.statusCode === 410 || err.statusCode === 404) {
              await supabaseAdmin
                .from('push_subscriptions')
                .delete()
                .eq('endpoint', sub.endpoint);
            }
          }
        }
      }
    }

    return NextResponse.json({
      triggered: pendingNotifs.length,
      pushSent: totalSent,
    });
  } catch (err: any) {
    console.error('[push/trigger-scheduled]', err.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
