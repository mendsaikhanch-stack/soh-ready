import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function validateToken(token: string, maxAgeMs: number): boolean {
  try {
    const parts = token.split(':');
    // Шинэ format: timestamp:sokhId:userId:random (4 хэсэг)
    // Хуучин format: timestamp:random (2 хэсэг)
    if (parts.length < 2) return false;
    const timestamp = parseInt(parts[0]);
    if (isNaN(timestamp)) return false;
    return Date.now() - timestamp <= maxAgeMs;
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  // Admin route хамгаалалт
  if (pathname.startsWith('/admin')) {
    const adminToken = request.cookies.get('admin-session')?.value;
    if (adminToken && !validateToken(adminToken, 24 * 60 * 60 * 1000)) {
      const res = NextResponse.next();
      res.cookies.delete('admin-session');
      return res;
    }
  }

  // Super Admin route хамгаалалт
  if (pathname.startsWith('/superadmin')) {
    const superToken = request.cookies.get('superadmin-session')?.value;
    if (superToken && !validateToken(superToken, 12 * 60 * 60 * 1000)) {
      const res = NextResponse.next();
      res.cookies.delete('superadmin-session');
      return res;
    }
  }

  return response;
}

export const config = {
  matcher: ['/admin/:path*', '/superadmin/:path*'],
};
