import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

// Dev горимд бүх роль-д нэг дор нэвтрэх
export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available' }, { status: 403 });
  }

  const token = `${Date.now()}:${randomUUID()}`;
  const inspectorToken = `${Date.now()}:1:${randomUUID()}`;

  const response = NextResponse.json({ success: true, message: 'Бүх роль-д нэвтэрлээ' });

  const opts = {
    httpOnly: true,
    secure: false,
    sameSite: 'strict' as const,
    maxAge: 86400,
    path: '/',
  };

  response.cookies.set('admin-session', token, opts);
  response.cookies.set('superadmin-session', token, opts);
  response.cookies.set('osnaa-session', token, opts);
  response.cookies.set('inspector-session', inspectorToken, opts);

  return response;
}
