import { NextResponse } from 'next/server';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';

// Environment variable-аас нууц үг авах, эсвэл хүчтэй default
const ADMIN_USER = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASS_HASH = process.env.ADMIN_PASSWORD_HASH || hashPassword('Toot@2024!Secure');
const SUPER_USER = process.env.SUPER_USERNAME || 'superadmin';
const SUPER_PASS_HASH = process.env.SUPER_PASSWORD_HASH || hashPassword('Super@Toot2024!');

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

function safeCompare(a: string, b: string): boolean {
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

// Rate limiting
const attempts = new Map<string, { count: number; lockUntil: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

function checkRate(ip: string): { ok: boolean; waitSec?: number } {
  const now = Date.now();
  const record = attempts.get(ip);

  if (record && record.lockUntil > now) {
    return { ok: false, waitSec: Math.ceil((record.lockUntil - now) / 1000) };
  }

  if (record && record.lockUntil <= now) {
    attempts.delete(ip);
  }

  return { ok: true };
}

function recordFailure(ip: string) {
  const record = attempts.get(ip) || { count: 0, lockUntil: 0 };
  record.count++;
  if (record.count >= MAX_ATTEMPTS) {
    record.lockUntil = Date.now() + LOCKOUT_MS;
  }
  attempts.set(ip, record);
}

function clearAttempts(ip: string) {
  attempts.delete(ip);
}

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';

  // Rate limit шалгах
  const rateCheck = checkRate(ip);
  if (!rateCheck.ok) {
    return NextResponse.json(
      { error: `Хэт олон оролдлого. ${rateCheck.waitSec} секунд хүлээнэ үү.` },
      { status: 429 }
    );
  }

  try {
    const { username, password, type } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Нэр, нууц үг оруулна уу' }, { status: 400 });
    }

    const inputHash = hashPassword(password);
    let authenticated = false;
    let role = '';

    if (type === 'superadmin') {
      authenticated = safeCompare(username, SUPER_USER) && safeCompare(inputHash, SUPER_PASS_HASH);
      role = 'superadmin';
    } else {
      authenticated = safeCompare(username, ADMIN_USER) && safeCompare(inputHash, ADMIN_PASS_HASH);
      role = 'admin';
    }

    if (!authenticated) {
      recordFailure(ip);
      return NextResponse.json({ error: 'Нэвтрэх нэр эсвэл нууц үг буруу' }, { status: 401 });
    }

    clearAttempts(ip);

    // Secure session token үүсгэх
    const timestamp = Date.now();
    const secret = process.env.SESSION_SECRET || 'toot-session-secret-change-me';
    const tokenData = `${timestamp}:${role}:${randomBytes(16).toString('hex')}`;
    const signature = createHash('sha256').update(tokenData + secret).digest('hex');
    const token = `${timestamp}:${signature}`;

    const cookieName = type === 'superadmin' ? 'superadmin-session' : 'admin-session';
    const maxAge = type === 'superadmin' ? 12 * 60 * 60 : 24 * 60 * 60;

    const response = NextResponse.json({ success: true, role });
    response.cookies.set(cookieName, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge,
      path: '/',
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Серверийн алдаа' }, { status: 500 });
  }
}
