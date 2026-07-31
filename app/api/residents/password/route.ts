import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { residentPwChangeLimiter } from '@/app/lib/rate-limit';

// Оршин суугч ӨӨРИЙН нууц үгээ солино.
// Одоогийн нууц үгээ заавал давтан оруулна — утас нь бусдын гарт орсон ч
// нууц үгийг шууд сольж чадахгүй байх давхар шалгалт.

const MIN_LEN = 6;
const MAX_LEN = 128;

export async function POST(request: Request) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const rl = residentPwChangeLimiter.check(ip);
  if (!rl.allowed) {
    return NextResponse.json({ error: `Хэт олон оролдлого. ${rl.retryAfterSec}с хүлээнэ үү` }, { status: 429 });
  }

  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) {
    return NextResponse.json({ error: 'Нэвтрээгүй байна' }, { status: 401 });
  }

  let currentPassword = '';
  let newPassword = '';
  try {
    const body = await request.json();
    currentPassword = String(body.currentPassword || '');
    newPassword = String(body.newPassword || '');
  } catch {
    return NextResponse.json({ error: 'Хүсэлт буруу' }, { status: 400 });
  }

  if (newPassword.length < MIN_LEN || newPassword.length > MAX_LEN) {
    return NextResponse.json({ error: `Шинэ нууц үг ${MIN_LEN}-${MAX_LEN} тэмдэгт байна` }, { status: 400 });
  }
  if (newPassword === currentPassword) {
    return NextResponse.json({ error: 'Шинэ нууц үг хуучинтайгаа ижил байна' }, { status: 400 });
  }

  // Токеноор хэн болохыг нь тогтооно
  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user?.email) {
    return NextResponse.json({ error: 'Нэвтрээгүй байна' }, { status: 401 });
  }

  // Одоогийн нууц үг зөв эсэхийг шалгана
  const checkClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { error: signInErr } = await checkClient.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (signInErr) {
    return NextResponse.json({ error: 'Одоогийн нууц үг буруу байна' }, { status: 401 });
  }

  const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    password: newPassword,
  });
  if (updErr) {
    console.error('[residents/password]', updErr.message);
    return NextResponse.json({ error: 'Нууц үг солиж чадсангүй' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
