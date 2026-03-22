import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  // Admin route хамгаалалт — cookie шалгах
  if (pathname.startsWith('/admin')) {
    const adminToken = request.cookies.get('admin-session')?.value;
    if (!adminToken) {
      // Layout дотор login form харуулна
      return response;
    }

    // Token бүтцийг шалгах (timestamp:hash)
    try {
      const parts = adminToken.split(':');
      if (parts.length !== 2) return response;
      const timestamp = parseInt(parts[0]);
      const now = Date.now();
      // 24 цагийн дараа session дуусна
      if (now - timestamp > 24 * 60 * 60 * 1000) {
        const res = NextResponse.next();
        res.cookies.delete('admin-session');
        return res;
      }
    } catch {
      return response;
    }
  }

  // Super Admin route хамгаалалт
  if (pathname.startsWith('/superadmin')) {
    const superToken = request.cookies.get('superadmin-session')?.value;
    if (!superToken) {
      return response;
    }

    try {
      const parts = superToken.split(':');
      if (parts.length !== 2) return response;
      const timestamp = parseInt(parts[0]);
      const now = Date.now();
      if (now - timestamp > 12 * 60 * 60 * 1000) {
        const res = NextResponse.next();
        res.cookies.delete('superadmin-session');
        return res;
      }
    } catch {
      return response;
    }
  }

  return response;
}

export const config = {
  matcher: ['/admin/:path*', '/superadmin/:path*'],
};
