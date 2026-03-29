import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';
import { createSessionToken } from '@/app/lib/session-token';

// Rate limiting
const attempts = new Map<string, { count: number; lockUntil: number }>();

function rateLimitFail(ip: string, now: number) {
  const rec = attempts.get(ip) || { count: 0, lockUntil: 0 };
  rec.count++;
  if (rec.count >= 5) rec.lockUntil = now + 15 * 60 * 1000;
  attempts.set(ip, rec);
  return NextResponse.json({ error: 'Нэвтрэх нэр эсвэл нууц үг буруу' }, { status: 401 });
}

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const now = Date.now();

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

    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // ========== Байцаагч — inspectors хүснэгтээс ==========
    if (type === 'inspector') {
      const { data: inspector } = await sb
        .from('inspectors')
        .select('id, username, password, name, kontor_number')
        .eq('username', username)
        .eq('status', 'active')
        .single();

      // Timing attack-аас хамгаалах — хэрэглэгч байхгүй ч bcrypt ажиллуулна
      const dummyHash = '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012';
      const passwordMatch = await bcrypt.compare(password, inspector?.password || dummyHash);
      if (!inspector || !passwordMatch) return rateLimitFail(ip, now);

      attempts.delete(ip);
      const token = createSessionToken({ userId: inspector.id });
      const response = NextResponse.json({
        success: true, role: 'inspector', inspectorId: inspector.id, name: inspector.name,
        kontorNumber: inspector.kontor_number || null,
      });
      response.cookies.set('inspector-session', token, {
        httpOnly: true, secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict', maxAge: 86400, path: '/',
      });
      return response;
    }

    // ========== Админ / Супер Админ / ОСНАА — admin_users хүснэгтээс ==========
    const expectedRole = type === 'superadmin' ? 'superadmin' : type === 'osnaa' ? 'osnaa' : 'admin';

    const { data: adminUser } = await sb
      .from('admin_users')
      .select('id, username, password_hash, role, sokh_id, display_name')
      .eq('username', username)
      .eq('role', expectedRole)
      .eq('status', 'active')
      .single();

    // Timing attack-аас хамгаалах
    const dummyAdminHash = '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012';
    const passOk = await bcrypt.compare(password, adminUser?.password_hash || dummyAdminHash);
    if (!adminUser) return rateLimitFail(ip, now);
    if (!passOk) return rateLimitFail(ip, now);

    // Амжилттай — token-д sokh_id, user_id оруулах
    attempts.delete(ip);
    const sokhId = adminUser.sokh_id || 0;
    const token = createSessionToken({ userId: adminUser.id, sokhId });
    const cookieName = type === 'superadmin' ? 'superadmin-session' : type === 'osnaa' ? 'osnaa-session' : 'admin-session';
    const maxAge = type === 'superadmin' ? 43200 : 86400;

    const response = NextResponse.json({
      success: true, role: adminUser.role, sokhId, displayName: adminUser.display_name,
    });
    response.cookies.set(cookieName, token, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict', maxAge, path: '/',
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Серверийн алдаа' }, { status: 500 });
  }
}
