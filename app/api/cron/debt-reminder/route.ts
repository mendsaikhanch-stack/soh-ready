import { NextRequest, NextResponse } from 'next/server';
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

// Cron: Сар бүрийн 1, 15, 25-нд өртэй айлуудад автомат push + scheduled_notification үүсгэнэ
// Vercel Cron эсвэл гаднаас GET /api/cron/debt-reminder?key=SECRET дуудна
export async function GET(request: NextRequest) {
  // Хамгаалалт — CRON_SECRET заавал тохируулсан байх ёстой
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[cron/debt-reminder] CRON_SECRET тохируулаагүй байна');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }
  const key = request.nextUrl.searchParams.get('key');
  if (key !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  ensureVapid();

  try {
    // Бүх СӨХ-ын өртэй оршин суугчдыг олох
    const { data: sokhOrgs } = await supabaseAdmin
      .from('sokh_organizations')
      .select('id, name');

    if (!sokhOrgs || sokhOrgs.length === 0) {
      return NextResponse.json({ message: 'No organizations found' });
    }

    let totalNotifs = 0;
    let totalPush = 0;

    for (const org of sokhOrgs) {
      // Өртэй оршин суугчдыг тоолох
      const { data: debtors } = await supabaseAdmin
        .from('residents')
        .select('id, debt')
        .eq('sokh_id', org.id)
        .gt('debt', 0);

      if (!debtors || debtors.length === 0) continue;

      const totalDebt = debtors.reduce((s, r) => s + Number(r.debt), 0);

      // Scheduled notification бичих
      await supabaseAdmin.from('scheduled_notifications').insert({
        sokh_id: org.id,
        title: 'Төлбөрийн сануулга',
        message: `${debtors.length} тоот нийт ${totalDebt.toLocaleString()}₮ өртэй байна. Хугацаандаа төлнө үү.`,
        type: 'debt',
        scheduled_at: new Date().toISOString(),
        status: 'sent',
        target: 'debtors',
      });
      totalNotifs++;

      // Push илгээх
      const { data: subs } = await supabaseAdmin
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .eq('sokh_id', org.id);

      if (subs && subs.length > 0) {
        const payload = JSON.stringify({
          title: 'Төлбөрийн сануулга',
          body: `${debtors.length} тоот ${totalDebt.toLocaleString()}₮ өртэй байна`,
          url: `/sokh/${org.id}/payments`,
          tag: `debt-reminder-${org.id}`,
        });

        for (const sub of subs) {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload
            );
            totalPush++;
          } catch (err: unknown) {
            const statusCode = (err as { statusCode?: number }).statusCode;
            if (statusCode === 410 || statusCode === 404) {
              await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      notifications: totalNotifs,
      pushSent: totalPush,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    console.error('[cron/debt-reminder]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
