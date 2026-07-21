import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { checkAuth, createSessionToken } from '@/app/lib/session-token';

// Нэвтэрсэн ДАРГА (админ) өөрийнхөө нэвтрэх нэр / нууц үгээ өөрчилнө.
// Аюулгүй байдал: аль ч өөрчлөлтөд ОДООГИЙН нууц үгээ давтан оруулах шаардлагатай.

const ADMIN_MAX_AGE = 86400; // 24 цаг (login route-тэй ижил)

// Энгийн brute-force хамгаалалт (нэг session-д хэт олон оролдлого)
const attempts = new Map<string, { count: number; lockUntil: number }>();

async function currentAdmin() {
  const auth = await checkAuth('admin');
  if (!auth.valid || !auth.userId) return null;
  const { data } = await supabaseAdmin
    .from('admin_users')
    .select('id, username, password_hash, display_name, sokh_id, status')
    .eq('id', Number(auth.userId))
    .single();
  if (!data || data.status !== 'active') return null;
  return data;
}

// GET — одоогийн нэвтрэлтийн мэдээллээ харах (нууц үг буцаахгүй)
export async function GET() {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: 'Нэвтрээгүй байна' }, { status: 401 });
  return NextResponse.json({
    username: admin.username,
    display_name: admin.display_name,
  });
}

// POST — { action: 'password' | 'username', currentPassword, newPassword?, newUsername? }
export async function POST(request: Request) {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: 'Нэвтрээгүй байна' }, { status: 401 });

  const now = Date.now();
  const key = String(admin.id);
  const rec = attempts.get(key);
  if (rec && rec.lockUntil > now) {
    const waitSec = Math.ceil((rec.lockUntil - now) / 1000);
    return NextResponse.json({ error: `${waitSec} секунд хүлээнэ үү` }, { status: 429 });
  }

  const { action, currentPassword, newPassword, newUsername } = await request.json();

  // Одоогийн нууц үг заавал зөв байх ёстой
  const passOk = await bcrypt.compare(String(currentPassword || ''), admin.password_hash);
  if (!passOk) {
    const r = attempts.get(key) || { count: 0, lockUntil: 0 };
    r.count++;
    if (r.count >= 5) r.lockUntil = now + 15 * 60 * 1000;
    attempts.set(key, r);
    return NextResponse.json({ error: 'Одоогийн нууц үг буруу байна' }, { status: 401 });
  }
  attempts.delete(key);

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (action === 'password') {
    if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128) {
      return NextResponse.json({ error: 'Шинэ нууц үг 8-128 тэмдэгт байна' }, { status: 400 });
    }
    if (newPassword === currentPassword) {
      return NextResponse.json({ error: 'Шинэ нууц үг хуучинтайгаа ижил байна' }, { status: 400 });
    }
    updates.password_hash = await bcrypt.hash(newPassword, 12);
  } else if (action === 'username') {
    const uname = typeof newUsername === 'string' ? newUsername.trim() : '';
    if (!/^[a-zA-Z0-9_.-]{3,40}$/.test(uname)) {
      return NextResponse.json({ error: 'Нэвтрэх нэр 3-40 тэмдэгт (тоо/латин үсэг) байна' }, { status: 400 });
    }
    if (uname !== admin.username) {
      const { data: clash } = await supabaseAdmin
        .from('admin_users')
        .select('id')
        .eq('username', uname)
        .maybeSingle();
      if (clash) {
        return NextResponse.json({ error: 'Энэ нэвтрэх нэр аль хэдийн бүртгэлтэй байна' }, { status: 409 });
      }
    }
    updates.username = uname;
  } else {
    return NextResponse.json({ error: 'action буруу' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('admin_users').update(updates).eq('id', admin.id);
  if (error) {
    console.error('[admin/account POST]', error.message);
    return NextResponse.json({ error: 'Хадгалж чадсангүй' }, { status: 500 });
  }

  // Session-ийг шинэчилж, дарга нэвтэрсэн хэвээр үлдэнэ (userId өөрчлөгдөхгүй)
  const token = createSessionToken({ userId: admin.id, sokhId: admin.sokh_id || 0 });
  const response = NextResponse.json({ success: true });
  response.cookies.set('admin-session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: ADMIN_MAX_AGE,
    path: '/',
  });
  return response;
}
