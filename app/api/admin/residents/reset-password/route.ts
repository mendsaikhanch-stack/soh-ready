import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { checkAnyAuth } from '@/app/lib/session-token';
import { residentPwResetLimiter } from '@/app/lib/rate-limit';

// Дарга оршин суугчийн нууц үгийг ТҮР нууц үг (= утасны дугаар) болгож сэргээнэ.
// Оршин суугч нэвтэрсний дараа "Миний мэдээлэл"-ээс өөрөө солино.
//
// Яагаад SMS/имэйл биш вэ: оршин суугчийн нэвтрэх бүртгэл нь <утас>@toot.app гэсэн
// дотоод хаягтай (жинхэнэ имэйл биш) тул имэйлээр сэргээх боломжгүй, SMS үйлчилгээ
// хараахан холбогдоогүй. Тиймээс сэргээлтийг дарга дамжуулж хийнэ.

interface ResidentRow {
  id: number;
  name: string | null;
  apartment: string | null;
  phone: string | null;
  sokh_id: number;
  auth_user_id: string | null;
}

export async function POST(request: Request) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const rl = residentPwResetLimiter.check(ip);
  if (!rl.allowed) {
    return NextResponse.json({ error: `Хэт олон хүсэлт. ${rl.retryAfterSec}с хүлээнэ үү` }, { status: 429 });
  }

  const auth = await checkAnyAuth('admin', 'superadmin');
  if (!auth.valid) {
    return NextResponse.json({ error: 'Нэвтрээгүй байна' }, { status: 401 });
  }

  let residentId: number | null = null;
  try {
    const body = await request.json();
    residentId = typeof body.residentId === 'number' ? body.residentId : null;
  } catch {
    return NextResponse.json({ error: 'Хүсэлт буруу' }, { status: 400 });
  }
  if (!residentId) {
    return NextResponse.json({ error: 'residentId шаардлагатай (тоо)' }, { status: 400 });
  }

  const { data: resident } = await supabaseAdmin
    .from('residents')
    .select('id, name, apartment, phone, sokh_id, auth_user_id')
    .eq('id', residentId)
    .single<ResidentRow>();

  if (!resident) {
    return NextResponse.json({ error: 'Оршин суугч олдсонгүй' }, { status: 404 });
  }

  // Дарга зөвхөн ӨӨРИЙН СӨХ-ийн оршин суугчийг сэргээнэ (superadmin бүгдийг).
  if (auth.role === 'admin') {
    const callerSokhId = auth.sokhId ? parseInt(auth.sokhId, 10) : 0;
    if (!callerSokhId) {
      return NextResponse.json({ error: 'Session-д sokh_id байхгүй' }, { status: 403 });
    }
    if (Number(resident.sokh_id) !== callerSokhId) {
      return NextResponse.json({ error: 'Өөр СӨХ-ийн оршин суугч байна' }, { status: 403 });
    }
  }

  const phone = (resident.phone || '').trim();
  if (!/^\d{8}$/.test(phone)) {
    return NextResponse.json(
      { error: 'Утасны дугаар бүртгэгдээгүй тул сэргээх боломжгүй. Эхлээд утасны дугаарыг нь оруулна уу.' },
      { status: 400 },
    );
  }

  const email = `${phone}@toot.app`;
  let authUserId = resident.auth_user_id;

  // Нэвтрэх бүртгэл байхгүй бол шинээр үүсгэнэ (утасгүй импортлогдсон хуучин мөрүүдэд).
  if (!authUserId) {
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: phone,
      email_confirm: true,
      user_metadata: { name: resident.name, phone },
    });
    if (created?.user?.id) {
      authUserId = created.user.id;
    } else if (createErr?.message?.includes('already been registered')) {
      // Бүртгэл нь бий боловч residents мөртэй холбогдоогүй байна — олж холбоно.
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      authUserId = (list?.users || []).find((u) => u.email === email)?.id || null;
      if (!authUserId) {
        return NextResponse.json(
          { error: 'Нэвтрэх бүртгэлийг олж чадсангүй. Хотол-ийн техникийн багт хандана уу.' },
          { status: 409 },
        );
      }
    } else {
      console.error('[residents/reset-password createUser]', createErr?.message);
      return NextResponse.json({ error: 'Нэвтрэх бүртгэл үүсгэж чадсангүй' }, { status: 500 });
    }
    await supabaseAdmin.from('residents').update({ auth_user_id: authUserId }).eq('id', resident.id);
  } else {
    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
      password: phone,
    });
    if (updErr) {
      console.error('[residents/reset-password updateUser]', updErr.message);
      return NextResponse.json({ error: 'Нууц үгийг сэргээж чадсангүй' }, { status: 500 });
    }
  }

  console.log(`[reset-password] admin=${auth.userId} resident=${resident.id} sokh=${resident.sokh_id}`);

  return NextResponse.json({
    success: true,
    apartment: resident.apartment,
    phone,
    tempPassword: phone,
  });
}
