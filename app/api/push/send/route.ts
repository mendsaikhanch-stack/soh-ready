import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import webpush from 'web-push';
import { checkAnyAuth } from '@/app/lib/session-token';
import { pushSendLimiter } from '@/app/lib/rate-limit';

// VAPID тохиргоо — runtime-д lazy init
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

// Push notification илгээх
export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || 'unknown';
  const rl = pushSendLimiter.check(ip);
  if (!rl.allowed) {
    return NextResponse.json({ error: `Хэт олон хүсэлт. ${rl.retryAfterSec}с хүлээнэ үү` }, { status: 429 });
  }

  if (!(await checkAnyAuth('admin', 'superadmin')).valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  ensureVapid();

  try {
    const { title, body, url, sokh_id } = await request.json();

    if (!title) {
      return NextResponse.json({ error: 'title required' }, { status: 400 });
    }

    // Subscription-ууд авах
    let query = supabaseAdmin.from('push_subscriptions').select('endpoint, p256dh, auth, sokh_id');
    if (sokh_id) {
      query = query.eq('sokh_id', sokh_id);
    }
    const { data: subs } = await query;

    if (!subs || subs.length === 0) {
      return NextResponse.json({ sent: 0, message: 'No subscribers' });
    }

    const payload = JSON.stringify({
      title,
      body: body || '',
      url: url || '/',
      tag: `toot-${Date.now()}`,
    });

    let sent = 0;
    let failed = 0;

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payload
        );
        sent++;
      } catch (err: unknown) {
        failed++;
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 410 || statusCode === 404) {
          await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        }
      }
    }

    return NextResponse.json({ sent, failed, total: subs.length });
  } catch (err: unknown) {
    console.error('[push/send]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
