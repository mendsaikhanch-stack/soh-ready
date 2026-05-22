import { NextRequest, NextResponse } from 'next/server';
import { validateQrToken } from '@/app/lib/qr-token';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { rateLimit } from '@/app/lib/rate-limit';

const validateLimiter = rateLimit({ name: 'gate-validate', windowMs: 60 * 1000, maxRequests: 120 });

// Хаалганы скэннерээс ирэх validation хүсэлт.
// POST { token: string }
// Returns 200 { ok: true, sokhId, apartment, guestName? } or 4xx { ok: false, reason }
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rl = validateLimiter.check(ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, reason: 'rate_limited', retryAfterSec: rl.retryAfterSec },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null) as { token?: string } | null;
  if (!body?.token) {
    return NextResponse.json({ ok: false, reason: 'no_token' }, { status: 400 });
  }

  const result = validateQrToken(body.token);
  if (!result.valid || !result.payload) {
    return NextResponse.json({ ok: false, reason: result.reason }, { status: 401 });
  }

  if (result.payload.kind !== 'gate' && result.payload.kind !== 'gate-guest') {
    return NextResponse.json({ ok: false, reason: 'wrong_kind' }, { status: 401 });
  }

  // Гарын үсэг хүчинтэй — gate_events-д log хийнэ
  await supabaseAdmin.from('gate_events').insert({
    sokh_id: result.payload.sokhId,
    action: 'opened',
    source: result.payload.kind === 'gate-guest' ? 'guest' : 'qr',
    requester_apartment: result.payload.apartment,
    guest_name: result.payload.guestName || null,
  });

  return NextResponse.json({
    ok: true,
    sokhId: result.payload.sokhId,
    apartment: result.payload.apartment,
    guestName: result.payload.guestName,
    kind: result.payload.kind,
  });
}
