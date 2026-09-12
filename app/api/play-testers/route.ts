// Play туршилтад оролцохыг зөвшөөрсөн оршин суугчийн Gmail хаягийг бүртгэнэ.
//
// POST — оршин суугч өөрөө илгээнэ (Supabase токеноор баталгаажина).
//        Зөвхөн ӨӨРИЙН мөрд холбогдоно; хаягийг бусдад харуулахгүй.
// GET  — зөвхөн супер админ. Play Console-д нэмэх жагсаалтыг уншина.
//
// ⚠️ Энэ хүснэгт нь хувийн имэйл хадгалдаг. `supabase-play-testers-migration.sql`
// дээр RLS асаалттай, policy байхгүй — өөрөөр хэлбэл ЗӨВХӨН энэ зам (service
// role) дамжина. Оршин суугч ч, СӨХ-ийн дарга ч жагсаалтыг харахгүй.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkAuth } from '@/app/lib/session-token';
import { profileLimiter } from '@/app/lib/rate-limit';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const PLATFORMS = ['android', 'ios', 'other'];

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || 'unknown';
  const rl = profileLimiter.check(ip);
  if (!rl.allowed) {
    return NextResponse.json({ error: `Хэт олон хүсэлт. ${rl.retryAfterSec}с хүлээнэ үү` }, { status: 429 });
  }

  try {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return NextResponse.json({ error: 'Нэвтэрч орно уу' }, { status: 401 });

    const userClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return NextResponse.json({ error: 'Нэвтэрч орно уу' }, { status: 401 });

    const { data: me } = await sb
      .from('residents').select('id, sokh_id').eq('auth_user_id', user.id).limit(1).single();
    if (!me) return NextResponse.json({ error: 'Оршин суугчийн бүртгэл олдсонгүй' }, { status: 404 });

    const body = await request.json();
    const email = String(body.email || '').trim().toLowerCase();
    const platform = PLATFORMS.includes(body.platform) ? body.platform : 'other';

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) {
      return NextResponse.json({ error: 'Имэйл хаяг буруу байна' }, { status: 400 });
    }
    // Play-д зөвхөн Google данстай хаяг нэмэгддэг. Gmail биш байж болох ч
    // (ажлын хаяг Google Workspace дээр байж болно) хамгийн түгээмэл алдааг
    // урьдчилан сануулна — блоклохгүй, зөвхөн тэмдэглээд авна.
    const looksGoogle = /@(gmail\.com|googlemail\.com)$/.test(email);

    const { error } = await sb
      .from('play_tester_signups')
      .upsert({
        resident_id: me.id,
        sokh_id: me.sokh_id,
        email,
        platform,
        status: 'new',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'email' });

    if (error) {
      console.error('[play-testers] insert', error.message);
      return NextResponse.json({ error: 'Хадгалж чадсангүй' }, { status: 500 });
    }

    return NextResponse.json({ success: true, looksGoogle });
  } catch {
    return NextResponse.json({ error: 'Серверийн алдаа' }, { status: 500 });
  }
}

export async function GET() {
  const auth = await checkAuth('superadmin');
  if (!auth.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await sb
    .from('play_tester_signups')
    .select('id, email, platform, status, note, created_at, sokh_id, resident_id')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    console.error('[play-testers] list', error.message);
    return NextResponse.json({ error: 'Татаж чадсангүй' }, { status: 500 });
  }
  return NextResponse.json({ rows: data || [] });
}
