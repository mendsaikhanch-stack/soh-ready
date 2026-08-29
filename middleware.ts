import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function validateToken(token: string, maxAgeMs: number): boolean {
  try {
    // HMAC signed format: payload.signature — payload хэсгийг авах
    const dotIdx = token.lastIndexOf('.');
    const payload = dotIdx !== -1 ? token.slice(0, dotIdx) : token;
    const parts = payload.split(':');
    if (parts.length < 2) return false;
    const timestamp = parseInt(parts[0]);
    if (isNaN(timestamp)) return false;
    return Date.now() - timestamp <= maxAgeMs;
  } catch {
    return false;
  }
}

// Нийтлэг аюулгүй байдлын header нэмэх
function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  return response;
}

// Хугацаа дууссан cookie цэвэрлэх helper
function clearExpiredCookie(request: NextRequest, cookieName: string, maxAgeMs: number): NextResponse | null {
  const token = request.cookies.get(cookieName)?.value;
  if (token && !validateToken(token, maxAgeMs)) {
    const res = NextResponse.next();
    res.cookies.delete(cookieName);
    addSecurityHeaders(res);
    return res;
  }
  return null;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // API route-уудад аюулгүй байдлын header нэмэх
  if (pathname.startsWith('/api/')) {
    const response = NextResponse.next();
    addSecurityHeaders(response);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }

  // Admin/SuperAdmin/OSNAA/Inspector — layout нь login form харуулдаг (client-side auth gate)
  // Middleware зөвхөн хугацаа дууссан cookie цэвэрлэнэ
  // 30 хоног — session-token.ts дахь ROLE_MAX_AGE-тэй тэнцүү. Нэвтрэлтийн
  // бодит хугацааг cookie-гийн maxAge ("Намайг сана") удирдана; middleware
  // зөвхөн үнэхээр хугацаа дууссаныг цэвэрлэнэ, эрт биш.
  const SESSION_TTL = 30 * 24 * 60 * 60 * 1000;
  const routeConfig: Record<string, { cookie: string; maxAge: number }> = {
    '/admin': { cookie: 'admin-session', maxAge: SESSION_TTL },
    '/superadmin': { cookie: 'superadmin-session', maxAge: SESSION_TTL },
    '/osnaa': { cookie: 'osnaa-session', maxAge: SESSION_TTL },
    '/inspector': { cookie: 'inspector-session', maxAge: SESSION_TTL },
  };

  for (const [prefix, config] of Object.entries(routeConfig)) {
    if (pathname.startsWith(prefix)) {
      const cleared = clearExpiredCookie(request, config.cookie, config.maxAge);
      if (cleared) return cleared;
      break;
    }
  }

  const response = NextResponse.next();
  addSecurityHeaders(response);
  return response;
}

export const config = {
  matcher: ['/api/:path*', '/admin/:path*', '/superadmin/:path*', '/osnaa/:path*', '/inspector/:path*'],
};
