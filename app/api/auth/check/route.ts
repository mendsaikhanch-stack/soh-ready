import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSessionToken } from '@/app/lib/session-token';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get('type') || 'admin';
  const cookieName = type === 'superadmin' ? 'superadmin-session' : type === 'osnaa' ? 'osnaa-session' : type === 'inspector' ? 'inspector-session' : 'admin-session';

  const cookieStore = await cookies();
  const token = cookieStore.get(cookieName)?.value;

  if (!token) {
    return NextResponse.json({ authenticated: false });
  }

  const maxAge = type === 'superadmin' ? 12 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const result = validateSessionToken(token, maxAge);

  if (!result.valid) {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({
    authenticated: true,
    sokhId: parseInt(result.sokhId || '0'),
    userId: parseInt(result.userId || '0'),
  });
}
