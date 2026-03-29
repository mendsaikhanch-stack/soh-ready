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

  // API route-уудыг алгасах (тэдгээр өөрсдөө auth шалгана)
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Admin route хамгаалалт
  if (pathname.startsWith('/admin')) {
    const adminToken = request.cookies.get('admin-session')?.value;
    if (!adminToken || !validateToken(adminToken, 24 * 60 * 60 * 1000)) {
      // Token байхгүй эсвэл хугацаа дууссан — layout login форм харуулна
      // Cookie цэвэрлэх (хугацаа дууссан бол)
      if (adminToken) {
        const res = NextResponse.next();
        res.cookies.delete('admin-session');
        return res;
      }
    }
  }

  // Super Admin route хамгаалалт
  if (pathname.startsWith('/superadmin')) {
    const superToken = request.cookies.get('superadmin-session')?.value;
    if (!superToken || !validateToken(superToken, 12 * 60 * 60 * 1000)) {
      if (superToken) {
        const res = NextResponse.next();
        res.cookies.delete('superadmin-session');
        return res;
      }
    }
  }

  // OSNAA route хамгаалалт
  if (pathname.startsWith('/osnaa')) {
    const osnaaToken = request.cookies.get('osnaa-session')?.value;
    if (osnaaToken && !validateToken(osnaaToken, 24 * 60 * 60 * 1000)) {
      const res = NextResponse.next();
      res.cookies.delete('osnaa-session');
      return res;
    }
  }

  // Inspector route хамгаалалт
  if (pathname.startsWith('/inspector')) {
    const inspToken = request.cookies.get('inspector-session')?.value;
    if (inspToken && !validateToken(inspToken, 24 * 60 * 60 * 1000)) {
      const res = NextResponse.next();
      res.cookies.delete('inspector-session');
      return res;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/superadmin/:path*', '/osnaa/:path*', '/inspector/:path*'],
};
