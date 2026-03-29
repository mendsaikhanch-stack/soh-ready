import { NextResponse } from 'next/server';
import { checkAuth, type AuthRole } from '@/app/lib/session-token';

export async function GET(request: Request) {
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
