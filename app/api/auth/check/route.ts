import { NextResponse } from 'next/server';
import { checkAuth, type AuthRole } from '@/app/lib/session-token';
import { authCheckLimiter } from '@/app/lib/rate-limit';

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

  return NextResponse.json({
    authenticated: true,
    sokhId: parseInt(result.sokhId || '0'),
    userId: parseInt(result.userId || '0'),
  });
}
