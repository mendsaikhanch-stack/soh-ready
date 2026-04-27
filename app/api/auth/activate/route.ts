import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { activationConsumeLimiter } from '@/app/lib/rate-limit';
import { createSessionToken } from '@/app/lib/session-token';

const ADMIN_SESSION_MAX_AGE = 24 * 60 * 60; // 24 цаг (login route-ийн цаг)

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown';
  const rl = activationConsumeLimiter.check(ip);
  if (!rl.allowed) {
    return NextResponse.json({ error: `Хэт олон оролдлого. ${rl.retryAfterSec}с хүлээнэ үү` }, { status: 429 });
  }

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Хүсэлт буруу' }, { status: 400 });

  const sokhId = Number(body.sokh_id);
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  const contactPhone = typeof body.contact_phone === 'string' ? body.contact_phone.trim() : '';
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const displayName = typeof body.display_name === 'string' ? body.display_name.trim() : '';

  if (!Number.isFinite(sokhId) || sokhId <= 0) {
    return NextResponse.json({ error: 'СӨХ сонгоогүй байна' }, { status: 400 });
  }
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: 'Код 6 оронтой байна' }, { status: 400 });
  }
  if (!/^\d{8}$/.test(contactPhone)) {
    return NextResponse.json({ error: 'Утасны дугаар 8 оронтой байна' }, { status: 400 });
  }
  if (username.length < 3 || username.length > 40 || !/^[a-zA-Z0-9_.-]+$/.test(username)) {
    return NextResponse.json({ error: 'Хэрэглэгчийн нэр 3-40 тэмдэгт, латин үсэг/тоо/_-. зөвшөөрнө' }, { status: 400 });
  }
  if (password.length < 8 || password.length > 128) {
    return NextResponse.json({ error: 'Нууц үг 8-128 тэмдэгт байна' }, { status: 400 });
  }

  // Идэвхтэй token-уудыг авч ирээд код таарахыг шалгана (timing-stable bcrypt compare)
  const { data: tokens, error: tokErr } = await supabaseAdmin
    .from('sokh_activation_tokens')
    .select('id, code_hash, expires_at, used_at')
    .eq('sokh_id', sokhId)
    .eq('contact_phone', contactPhone)
    .is('used_at', null)
    .order('created_at', { ascending: false })
    .limit(5);

  if (tokErr) {
    console.error('[activate select]', tokErr.message);
    return NextResponse.json({ error: 'Серверийн алдаа' }, { status: 500 });
  }

  let matched: { id: number; expires_at: string } | null = null;
  for (const t of tokens || []) {
    const ok = await bcrypt.compare(code, t.code_hash);
    if (ok) {
      matched = { id: t.id, expires_at: t.expires_at };
      break;
    }
  }
  if (!matched) {
    return NextResponse.json({ error: 'Код буруу эсвэл дууссан' }, { status: 401 });
  }
  if (new Date(matched.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: 'Кодны хүчинтэй хугацаа дууссан' }, { status: 401 });
  }

  // Username давхардал
  const { data: existing } = await supabaseAdmin
    .from('admin_users')
    .select('id')
    .eq('username', username)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: 'Энэ нэвтрэх нэр аль хэдийн бүртгэлтэй байна' }, { status: 409 });
  }

  const password_hash = await bcrypt.hash(password, 12);

  const { data: newAdmin, error: createErr } = await supabaseAdmin
    .from('admin_users')
    .insert([{
      username,
      password_hash,
      sokh_id: sokhId,
      role: 'admin',
      display_name: displayName || username,
      status: 'active',
    }])
    .select('id, username, sokh_id, role, display_name')
    .single();

  if (createErr || !newAdmin) {
    console.error('[activate create admin]', createErr?.message);
    return NextResponse.json({ error: 'Админ үүсгэж чадсангүй' }, { status: 500 });
  }

  // Token ашигласан гэж тэмдэглэх
  await supabaseAdmin
    .from('sokh_activation_tokens')
    .update({ used_at: new Date().toISOString(), used_by_admin_id: newAdmin.id })
    .eq('id', matched.id);

  // СӨХ-г active болгох
  await supabaseAdmin
    .from('sokh_organizations')
    .update({ claim_status: 'active', activated_at: new Date().toISOString() })
    .eq('id', sokhId);

  // Шинэ админыг шууд login хийлгэх
  const token = createSessionToken({ userId: newAdmin.id, sokhId });
  const response = NextResponse.json({
    success: true,
    role: 'admin',
    sokhId,
    displayName: newAdmin.display_name,
  });
  response.cookies.set('admin-session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: ADMIN_SESSION_MAX_AGE,
    path: '/',
  });
  return response;
}
