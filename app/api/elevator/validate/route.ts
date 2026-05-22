import { NextRequest, NextResponse } from 'next/server';
import { validateQrToken } from '@/app/lib/qr-token';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { rateLimit } from '@/app/lib/rate-limit';

const validateLimiter = rateLimit({ name: 'elevator-validate', windowMs: 60 * 1000, maxRequests: 120 });

// Лифтний скэннерээс ирэх validation хүсэлт.
// POST { token, elevatorName? } → 200 OK эсвэл 4xx
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rl = validateLimiter.check(ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, reason: 'rate_limited', retryAfterSec: rl.retryAfterSec },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null) as { token?: string; elevatorName?: string } | null;
  if (!body?.token) {
    return NextResponse.json({ ok: false, reason: 'no_token' }, { status: 400 });
  }

  const result = validateQrToken(body.token);
  if (!result.valid || !result.payload) {
    return NextResponse.json({ ok: false, reason: result.reason }, { status: 401 });
  }

  if (result.payload.kind !== 'elevator') {
    return NextResponse.json({ ok: false, reason: 'wrong_kind' }, { status: 401 });
  }

  await supabaseAdmin.from('elevator_calls').insert({
    sokh_id: result.payload.sokhId,
    elevator_name: body.elevatorName || 'Лифт',
    from_floor: 1,
    to_floor: result.payload.floor || null,
    caller_apartment: result.payload.apartment,
    status: 'requested',
  });

  return NextResponse.json({
    ok: true,
    sokhId: result.payload.sokhId,
    apartment: result.payload.apartment,
    floor: result.payload.floor,
  });
}
