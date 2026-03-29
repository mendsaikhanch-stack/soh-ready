import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import webpush from 'web-push';
import { validateSessionToken } from '@/app/lib/session-token';

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

// Admin session шалгах
async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin-session')?.value || cookieStore.get('superadmin-session')?.value;
  if (!token) return false;
  return validateSessionToken(token, 24 * 60 * 60 * 1000).valid;
}

// Push notification илгээх
export async function POST(request: NextRequest) {
  if (!(await isAdmin())) {
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
      } catch (err: any) {
        failed++;
        // 410 Gone = subscription хүчингүй болсон → устгах
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        }
      }
    }

    return NextResponse.json({ sent, failed, total: subs.length });
  } catch (err: any) {
    console.error('[push/send]', err.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
