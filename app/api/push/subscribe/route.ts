import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { pushSubscribeLimiter } from '@/app/lib/rate-limit';

// Push subscription хадгалах
export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const { allowed, retryAfterSec } = pushSubscribeLimiter.check(ip);
  if (!allowed) {
    return NextResponse.json({ error: `Rate limited. Retry after ${retryAfterSec}s` }, { status: 429 });
  }

  try {
    const { subscription, sokh_id } = await request.json();

    if (!subscription?.endpoint || typeof subscription.endpoint !== 'string') {
      return NextResponse.json({ error: 'subscription required' }, { status: 400 });
    }

    if (sokh_id && (typeof sokh_id !== 'number' || sokh_id <= 0)) {
      return NextResponse.json({ error: 'Invalid sokh_id' }, { status: 400 });
    }

    // endpoint URL формат шалгах
    try {
      new URL(subscription.endpoint);
    } catch {
      return NextResponse.json({ error: 'Invalid endpoint URL' }, { status: 400 });
    }

    // Upsert: endpoint давхардахгүй
    const { error } = await supabaseAdmin
      .from('push_subscriptions')
      .upsert(
        {
          endpoint: subscription.endpoint,
          p256dh: subscription.keys?.p256dh || '',
          auth: subscription.keys?.auth || '',
          sokh_id: sokh_id || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint' }
      );

    if (error) {
      console.error('[push/subscribe]', error.message);
      return NextResponse.json({ error: 'Subscription failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
