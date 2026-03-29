import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { registerLimiter } from '@/app/lib/rate-limit';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const { allowed, retryAfterSec } = registerLimiter.check(ip);
  if (!allowed) {
    return NextResponse.json({ error: `${retryAfterSec} секунд хүлээнэ үү` }, { status: 429 });
  }

  try {
    const { email, password, name, phone, apartment, sokh_id } = await req.json();

    if (!email || !password || !name || !phone) {
      return NextResponse.json({ error: 'Бүх талбарыг бөглөнө үү' }, { status: 400 });
    }

    // Input validation
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Имэйл формат буруу' }, { status: 400 });
    }
    if (typeof password !== 'string' || password.length < 6 || password.length > 128) {
      return NextResponse.json({ error: 'Нууц үг 6-128 тэмдэгт байна' }, { status: 400 });
    }
    if (typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 100) {
      return NextResponse.json({ error: 'Нэр 1-100 тэмдэгт байна' }, { status: 400 });
    }
    if (typeof phone !== 'string' || !/^\d{8}$/.test(phone.trim())) {
      return NextResponse.json({ error: 'Утасны дугаар 8 оронтой байна' }, { status: 400 });
    }
    if (apartment && (typeof apartment !== 'string' || apartment.trim().length > 20)) {
      return NextResponse.json({ error: 'Байрны дугаар хэт урт байна' }, { status: 400 });
    }

    // sokh_id бодитоор байгаа эсэхийг шалгах
    if (sokh_id) {
      if (typeof sokh_id !== 'number' || sokh_id <= 0) {
        return NextResponse.json({ error: 'sokh_id буруу' }, { status: 400 });
      }
      const { data: org } = await supabaseAdmin
        .from('sokh_organizations')
        .select('id')
        .eq('id', sokh_id)
        .single();
      if (!org) {
        return NextResponse.json({ error: 'Байгууллага олдсонгүй' }, { status: 400 });
      }
    }

    // Admin client-ээр хэрэглэгч үүсгэх — имэйл шууд баталгаажна
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, phone },
    });

    if (authError) {
      if (authError.message.includes('already been registered')) {
        return NextResponse.json({ error: 'Энэ имэйл бүртгэлтэй байна' }, { status: 400 });
      }
      console.error('[register]', authError.message);
      return NextResponse.json({ error: 'Бүртгэл амжилтгүй' }, { status: 400 });
    }

    // Оршин суугчийн мэдээлэл хадгалах
    await supabaseAdmin.from('residents').insert([{
      name,
      phone,
      apartment,
      debt: 0,
      sokh_id,
    }]);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Серверийн алдаа' }, { status: 500 });
  }
}
