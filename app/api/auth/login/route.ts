import { NextResponse } from 'next/server';

const USERS: Record<string, { password: string; role: string }> = {
  admin: { password: process.env.ADMIN_PASSWORD || 'Toot@2024!Secure', role: 'admin' },
  superadmin: { password: process.env.SUPER_PASSWORD || 'Super@Toot2024!', role: 'superadmin' },
  osnaa: { password: process.env.OSNAA_PASSWORD || 'Osnaa@Toot2024!', role: 'osnaa' },
};

// Rate limiting
const attempts = new Map<string, { count: number; lockUntil: number }>();

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const now = Date.now();

  // Rate limit шалгах
  const record = attempts.get(ip);
  if (record && record.lockUntil > now) {
    const waitSec = Math.ceil((record.lockUntil - now) / 1000);
    return NextResponse.json({ error: `${waitSec} секунд хүлээнэ үү` }, { status: 429 });
  }

  try {
    const { username, password, type } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Нэр, нууц үг оруулна уу' }, { status: 400 });
    }

    const user = USERS[username];
    const isCorrectType = type === 'superadmin' ? username === 'superadmin' : type === 'osnaa' ? username === 'osnaa' : username === 'admin';

    if (!user || user.password !== password || !isCorrectType) {
      // Бүртгэх
      const rec = attempts.get(ip) || { count: 0, lockUntil: 0 };
      rec.count++;
      if (rec.count >= 5) rec.lockUntil = now + 15 * 60 * 1000;
      attempts.set(ip, rec);

      return NextResponse.json({ error: 'Нэвтрэх нэр эсвэл нууц үг буруу' }, { status: 401 });
    }

    // Амжилттай — cookie тохируулах
    attempts.delete(ip);
    const token = `${now}:${Math.random().toString(36).slice(2)}`;
    const cookieName = type === 'superadmin' ? 'superadmin-session' : type === 'osnaa' ? 'osnaa-session' : 'admin-session';
    const maxAge = type === 'superadmin' ? 43200 : 86400;

    const response = NextResponse.json({ success: true, role: user.role });
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
