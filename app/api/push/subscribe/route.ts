import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';

// Push subscription хадгалах
export async function POST(request: NextRequest) {
  try {
    const { subscription, sokh_id } = await request.json();

    if (!subscription?.endpoint) {
      return NextResponse.json({ error: 'subscription required' }, { status: 400 });
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
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
