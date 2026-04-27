import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { checkAuth } from '@/app/lib/session-token';
import { activationIssueLimiter } from '@/app/lib/rate-limit';

const CODE_TTL_DAYS = 7;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown';
  const rl = activationIssueLimiter.check(ip);
  if (!rl.allowed) {
    return NextResponse.json({ error: `Хэт олон хүсэлт. ${rl.retryAfterSec}с хүлээнэ үү` }, { status: 429 });
  }

  const auth = await checkAuth('superadmin');
  if (!auth.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const sokhId = parseInt(id, 10);
  if (!Number.isFinite(sokhId) || sokhId <= 0) {
    return NextResponse.json({ error: 'СӨХ id буруу' }, { status: 400 });
  }

  const body = await req.json().catch(() => null) as { contact_phone?: unknown } | null;
  const phoneRaw = body?.contact_phone;
  if (typeof phoneRaw !== 'string' || !/^\d{8}$/.test(phoneRaw.trim())) {
    return NextResponse.json({ error: 'Утасны дугаар 8 оронтой байна' }, { status: 400 });
  }
  const contact_phone = phoneRaw.trim();

  const { data: org, error: orgErr } = await supabaseAdmin
    .from('sokh_organizations')
    .select('id, name, claim_status')
    .eq('id', sokhId)
    .single();
  if (orgErr || !org) return NextResponse.json({ error: 'СӨХ олдсонгүй' }, { status: 404 });
  if (org.claim_status === 'active') {
    return NextResponse.json({ error: 'Энэ СӨХ нэгэнт идэвхтэй байна' }, { status: 409 });
  }

  // 6 оронтой код — randomInt нь crypto-secure
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const code_hash = await bcrypt.hash(code, 12);
  const expires_at = new Date(Date.now() + CODE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Тухайн утсаар үлдсэн ашиглаагүй token-уудыг хүчингүй болгоно (нэг тоот дээр 1 идэвхтэй код)
  await supabaseAdmin
    .from('sokh_activation_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('sokh_id', sokhId)
    .eq('contact_phone', contact_phone)
    .is('used_at', null);

  const superId = auth.userId ? parseInt(auth.userId, 10) : null;

  const { error: insErr } = await supabaseAdmin
    .from('sokh_activation_tokens')
    .insert([{
      sokh_id: sokhId,
      code_hash,
      contact_phone,
      expires_at,
      created_by_superadmin_id: superId,
    }]);
  if (insErr) {
    console.error('[issue-activation insert]', insErr.message);
    return NextResponse.json({ error: 'Код үүсгэж чадсангүй' }, { status: 500 });
  }

  if (org.claim_status === 'unclaimed') {
    await supabaseAdmin
      .from('sokh_organizations')
      .update({ claim_status: 'pending' })
      .eq('id', sokhId);
  }

  return NextResponse.json({
    success: true,
    code,
    expires_at,
    contact_phone,
    sokh: { id: org.id, name: org.name },
  });
}
