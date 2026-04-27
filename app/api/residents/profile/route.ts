import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkAnyAuth } from '@/app/lib/session-token';
import { profileLimiter } from '@/app/lib/rate-limit';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function PUT(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || 'unknown';
  const rl = profileLimiter.check(ip);
  if (!rl.allowed) {
    return NextResponse.json({ error: `Хэт олон хүсэлт. ${rl.retryAfterSec}с хүлээнэ үү` }, { status: 429 });
  }

  try {
    const auth = await checkAnyAuth('admin', 'superadmin');
    if (!auth.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { residentId, name, phone } = await request.json();

    if (!residentId || typeof residentId !== 'number') {
      return NextResponse.json({ error: 'residentId шаардлагатай (тоо)' }, { status: 400 });
    }

    // Tenant ownership шалгах: admin зөвхөн өөрийн СӨХ-ийн оршин суугчийг өөрчилнө.
    // Superadmin аль ч resident-ыг өөрчилж чадна.
    if (auth.role === 'admin') {
      const callerSokhId = auth.sokhId ? parseInt(auth.sokhId, 10) : 0;
      if (!callerSokhId) {
        return NextResponse.json({ error: 'Session-д sokh_id байхгүй' }, { status: 403 });
      }
      const { data: target } = await sb
        .from('residents')
        .select('sokh_id')
        .eq('id', residentId)
        .single();
      if (!target) {
        return NextResponse.json({ error: 'Resident олдсонгүй' }, { status: 404 });
      }
      if (Number(target.sokh_id) !== callerSokhId) {
        return NextResponse.json({ error: 'Cross-tenant access denied' }, { status: 403 });
      }
    }

    const updates: Record<string, string> = {};
    if (name?.trim()) {
      if (name.trim().length > 100) {
        return NextResponse.json({ error: 'Нэр хэт урт байна' }, { status: 400 });
      }
      updates.name = name.trim();
    }
    if (phone?.trim()) {
      if (!/^\d{8}$/.test(phone.trim())) {
        return NextResponse.json({ error: 'Утасны дугаар 8 оронтой тоо байна' }, { status: 400 });
      }
      updates.phone = phone.trim();
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Өөрчлөх мэдээлэл байхгүй' }, { status: 400 });
    }

    // Утасны дугаар давхардах эсэхийг шалгах
    if (updates.phone) {
      const { data: existing } = await sb
        .from('residents')
        .select('id')
        .eq('phone', updates.phone)
        .neq('id', residentId)
        .limit(1)
        .single();

      if (existing) {
        return NextResponse.json({ error: 'Энэ утасны дугаар бүртгэлтэй байна' }, { status: 409 });
      }
    }

    const { data, error } = await sb
      .from('residents')
      .update(updates)
      .eq('id', residentId)
      .select()
      .single();

    if (error) {
      console.error('[residents/profile]', error.message);
      return NextResponse.json({ error: 'Profile update failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true, resident: data });
  } catch {
    return NextResponse.json({ error: 'Серверийн алдаа' }, { status: 500 });
  }
}
