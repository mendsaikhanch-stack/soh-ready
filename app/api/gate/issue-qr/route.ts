import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createQrToken } from '@/app/lib/qr-token';
import { rateLimit } from '@/app/lib/rate-limit';

const issueLimiter = rateLimit({ name: 'gate-issue-qr', windowMs: 60 * 1000, maxRequests: 30 });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

interface IssueBody {
  sokhId: number;
  kind: 'self' | 'guest';
  guestName?: string;
  guestMinutes?: number;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rl = issueLimiter.check(ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Хэт олон оролдлого. ${rl.retryAfterSec}с хүлээнэ үү` },
      { status: 429 }
    );
  }

  const accessToken = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!accessToken) {
    return NextResponse.json({ error: 'Нэвтрэх шаардлагатай' }, { status: 401 });
  }

  const { data: { user }, error: userErr } = await sb.auth.getUser(accessToken);
  if (userErr || !user) {
    return NextResponse.json({ error: 'Нэвтрэх шаардлагатай' }, { status: 401 });
  }

  const body = (await req.json()) as IssueBody;
  if (!body.sokhId) {
    return NextResponse.json({ error: 'sokhId шаардлагатай' }, { status: 400 });
  }

  // Энэ хэрэглэгч тухайн СӨХ-д оршин суудаг эсэхийг шалгах (service role-аар)
  const sbAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const { data: resident } = await sbAdmin
    .from('residents')
    .select('id, apartment, sokh_id')
    .eq('auth_user_id', user.id)
    .eq('sokh_id', body.sokhId)
    .maybeSingle();

  if (!resident) {
    return NextResponse.json({ error: 'Энэ СӨХ-д оршин сууж байгаа нь баталгаажаагүй' }, { status: 403 });
  }

  if (body.kind === 'guest') {
    if (!body.guestName) {
      return NextResponse.json({ error: 'Зочны нэр шаардлагатай' }, { status: 400 });
    }
    const ttlSec = Math.min(Math.max(body.guestMinutes || 60, 5), 240) * 60;
    const token = createQrToken({
      kind: 'gate-guest',
      sokhId: body.sokhId,
      userId: user.id,
      guestName: body.guestName.slice(0, 60),
      apartment: resident.apartment,
      ttlSec,
    });
    return NextResponse.json({ token, expiresInSec: ttlSec });
  }

  const ttlSec = 60;
  const token = createQrToken({
    kind: 'gate',
    sokhId: body.sokhId,
    userId: user.id,
    apartment: resident.apartment,
    ttlSec,
  });
  return NextResponse.json({ token, expiresInSec: ttlSec });
}
