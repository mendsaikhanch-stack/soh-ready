// Танилцуулгын демо сешн — нууц үггүй.
//
// СӨХ-ийн удирдлагад «энэ линкийг дараад үзээрэй» гэж нэг л хаяг өгөхийн тулд
// бий болгов. Нууц үг асуухгүй ч аюулгүй, учир нь энэ зам ЗӨВХӨН `demo`
// бүртгэлийн сешнийг олгоно — өөр ямар ч хэрэглэгч рүү нэвтрэх боломжгүй —
// бөгөөд олгосон token нь үргэлж демо тэмдэгтэй, өөрөөр хэлбэл зөвхөн харах
// эрхтэй (`app/lib/demo-admin.ts` тайлбарыг үз).
//
// GET биш POST байгаа шалтгаан: гуравдагч этгээд `<img src=...>` мэтээр
// СӨХ-ийн жинхэнэ даргын хөтөч дээр демо cookie чимээгүй суулгаж, түүнийг
// өөрийнх нь эрхээс гаргах боломжгүй байх ёстой.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSessionToken } from '@/app/lib/session-token';
import { DEMO_ADMIN_USERNAME } from '@/app/lib/demo-admin';
import { demoSessionLimiter } from '@/app/lib/rate-limit';

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]
    || request.headers.get('x-real-ip')
    || 'unknown';
  const rl = demoSessionLimiter.check(ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Хэт олон хүсэлт. ${rl.retryAfterSec}с хүлээнэ үү` },
      { status: 429 },
    );
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: demoAdmin } = await sb
    .from('admin_users')
    .select('id, sokh_id, display_name')
    .eq('username', DEMO_ADMIN_USERNAME)
    .eq('role', 'admin')
    .eq('status', 'active')
    .single();

  // Демо бүртгэлийг унтраасан/устгасан бол линк чимээгүй ажиллах ёсгүй
  if (!demoAdmin) {
    return NextResponse.json({ error: 'Демо эрх одоогоор боломжгүй байна' }, { status: 404 });
  }

  const sokhId = demoAdmin.sokh_id || 0;
  const token = createSessionToken({
    userId: demoAdmin.id,
    sokhId,
    role: 'admin',
    demo: true,
  });

  const response = NextResponse.json({ success: true, sokhId });
  response.cookies.set('admin-session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 4, // 4 цаг — танилцуулга үзэхэд хангалттай
    path: '/',
  });
  return response;
}
