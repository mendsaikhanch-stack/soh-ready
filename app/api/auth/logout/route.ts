import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { type } = await request.json().catch(() => ({ type: 'admin' }));

  const cookieName = type === 'superadmin' ? 'superadmin-session' : 'admin-session';

  const response = NextResponse.json({ success: true });
  response.cookies.set(cookieName, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  });

  return response;
}
