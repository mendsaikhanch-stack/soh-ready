import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { registerLimiter } from '@/app/lib/rate-limit';
import { linkManualSignupToUser, type LinkReport } from '@/app/lib/directory/link-manual-signup';

const CLAIM_COOKIE = 'manual-hoa-claim';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const { allowed, retryAfterSec } = registerLimiter.check(ip);
  if (!allowed) {
    return NextResponse.json({ error: `${retryAfterSec} секунд хүлээнэ үү` }, { status: 429 });
  }

  try {
    const { phone, password, name, apartment, sokh_id } = await req.json();

    if (!phone || !password || !name) {
      return NextResponse.json({ error: 'Бүх талбарыг бөглөнө үү' }, { status: 400 });
    }

    // Input validation
    if (typeof phone !== 'string' || !/^\d{8}$/.test(phone.trim())) {
      return NextResponse.json({ error: 'Утасны дугаар 8 оронтой байна' }, { status: 400 });
    }
    if (typeof password !== 'string' || password.length < 6 || password.length > 128) {
      return NextResponse.json({ error: 'Нууц үг 6-128 тэмдэгт байна' }, { status: 400 });
    }
    if (typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 100) {
      return NextResponse.json({ error: 'Нэр 1-100 тэмдэгт байна' }, { status: 400 });
    }
    if (apartment && (typeof apartment !== 'string' || apartment.trim().length > 200)) {
      return NextResponse.json({ error: 'Хаяг хэт урт байна' }, { status: 400 });
    }

    const cleanPhone = phone.trim();

    // sokh_id шалгах
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

    // Утаснаас имэйл автоматаар үүсгэх (Supabase auth шаардлага)
    const email = `${cleanPhone}@toot.app`;

    // Supabase auth хэрэглэгч үүсгэх
    const { error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: name.trim(), phone: cleanPhone },
    });

    if (authError) {
      if (authError.message.includes('already been registered')) {
        return NextResponse.json({ error: 'Энэ утасны дугаар бүртгэлтэй байна' }, { status: 400 });
      }
      console.error('[register]', authError.message);
      return NextResponse.json({ error: 'Бүртгэл амжилтгүй' }, { status: 400 });
    }

    // Оршин суугчийн мэдээлэл хадгалах. id-г буцааж авч claim хийхэд ашиглана.
    const { data: resident } = await supabaseAdmin
      .from('residents')
      .insert([{
        name: name.trim(),
        phone: cleanPhone,
        apartment: apartment || '',
        debt: 0,
        sokh_id,
      }])
      .select('id')
      .single();

    // Pre-auth manual signup-аас үлдсэн provisional бичлэгүүдийг тус хэрэглэгч рүү
    // claim хийж оролдох. Алдаа гарвал register-ийг fail хийхгүй.
    let claim: LinkReport | null = null;
    if (resident?.id) {
      const claimToken = req.cookies.get(CLAIM_COOKIE)?.value || null;
      try {
        claim = await linkManualSignupToUser({
          userId: resident.id as number,
          phone: cleanPhone,
          email,
          claimToken,
        });
      } catch (e) {
        console.error('[register] link error', e);
      }
    }

    const response = NextResponse.json({ success: true, email, claim });
    if (claim?.anythingLinked) {
      // Token-ыг нэгэнт хэрэглэсэн тул cookie-г цэвэрлэнэ
      response.cookies.delete(CLAIM_COOKIE);
    }
    return response;
  } catch {
    return NextResponse.json({ error: 'Серверийн алдаа' }, { status: 500 });
  }
}
