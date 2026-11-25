import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { checkAuth, createSessionToken, tokenIssuedAt, type AuthRole } from '@/app/lib/session-token';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { authCheckLimiter } from '@/app/lib/rate-limit';
import { OTP_DISABLED } from '@/app/lib/auth-flags';

export async function GET(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || 'unknown';
  const rl = authCheckLimiter.check(ip);
  if (!rl.allowed) {
    return NextResponse.json({ error: `Хэт олон хүсэлт. ${rl.retryAfterSec}с хүлээнэ үү` }, { status: 429 });
  }

  const url = new URL(request.url);
  const type = (url.searchParams.get('type') || 'admin') as AuthRole;
  const validRoles: AuthRole[] = ['admin', 'superadmin', 'osnaa', 'inspector'];

  if (!validRoles.includes(type)) {
    return NextResponse.json({ authenticated: false });
  }

  const result = await checkAuth(type);

  if (!result.valid) {
    return NextResponse.json({ authenticated: false });
  }

  // Superadmin-ийн 2-р шат (OTP эсвэл passkey) баталгаажсан эсэхийг
  // httpOnly cookie-оос сервер талд уншиж буцаана (refresh-д тогтвортой).
  // Мэйл код ТҮР хаалттай үед суперадминыг шууд баталгаажсан гэж үзнэ.
  const otpVerified =
    (type === 'superadmin' && OTP_DISABLED) ||
    (await cookies()).get('sa-otp-verified')?.value === 'true';

  const response = NextResponse.json({
    authenticated: true,
    sokhId: parseInt(result.sokhId || '0'),
    userId: parseInt(result.userId || '0'),
    otpVerified,
    // Танилцуулгын демо (зөвхөн харах) эрх эсэх — админ дэлгэц үүгээр
    // тайлбар мэдэгдэл харуулж, бусад СӨХ-ийн цэсийг нуудаг.
    demo: result.demo === true,
  });

  // Гулсдаг session: СӨХ-ийн дарга (admin) системээ хэрэглэж л байвал
  // нэвтрэлт нь хэзээ ч дуусахгүй — 1 хоногоос хуучин token-г шинэ 30 хоногийн
  // token-оор солино. 30 хоног огт ороогүй л бол дахин нэвтэрнэ.
  // (ICTown дарга 10-24-нд нэвтэрснээс хойш 11-23-нд гарчихсан, 2026-11-25.)
  // Бүртгэл идэвхгүй болсон бол сунгахгүй.
  if (type === 'admin' && !result.demo) {
    const token = (await cookies()).get('admin-session')?.value;
    const issued = token ? tokenIssuedAt(token) : null;
    if (issued && Date.now() - issued > RENEW_AFTER_MS) {
      const { data: au } = await supabaseAdmin
        .from('admin_users').select('id').eq('id', parseInt(result.userId || '0'))
        .eq('role', 'admin').eq('status', 'active').maybeSingle();
      if (au) {
        const fresh = createSessionToken({ userId: au.id, sokhId: result.sokhId || 0, role: 'admin' });
        response.cookies.set('admin-session', fresh, {
          httpOnly: true, secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict', maxAge: 60 * 60 * 24 * 30, path: '/',
        });
      }
    }
  }

  return response;
}

const RENEW_AFTER_MS = 24 * 60 * 60 * 1000;
