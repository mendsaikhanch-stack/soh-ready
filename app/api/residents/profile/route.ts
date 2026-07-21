import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkAnyAuth } from '@/app/lib/session-token';
import { profileLimiter } from '@/app/lib/rate-limit';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const RESIDENT_TYPES = ['owner', 'tenant', 'family'];

// Оршин суугч ба админ хоёулаа өөрийн/удирдаж буй мөрийн профайлыг засна.
// Оршин суугч → Supabase токеноор баталгаажиж, ЗӨВХӨН өөрийн мөрийг, тодорхой
// талбарыг л засна (өр, тоот, sokh_id-г засахгүй).
// Админ/суперадмин → residentId-аар (өөрийн СӨХ-ийн хүрээнд).
export async function PUT(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || 'unknown';
  const rl = profileLimiter.check(ip);
  if (!rl.allowed) {
    return NextResponse.json({ error: `Хэт олон хүсэлт. ${rl.retryAfterSec}с хүлээнэ үү` }, { status: 429 });
  }

  try {
    const body = await request.json();
    const admin = await checkAnyAuth('admin', 'superadmin');

    // ── Аль мөрийг засахыг тодорхойлох ──
    let residentId: number | null = null;
    let isResidentSelf = false;

    if (admin.valid) {
      residentId = typeof body.residentId === 'number' ? body.residentId : null;
      if (!residentId) {
        return NextResponse.json({ error: 'residentId шаардлагатай (тоо)' }, { status: 400 });
      }
      // Админ зөвхөн өөрийн СӨХ-ийн оршин суугчийг өөрчилнө (superadmin бүгдийг).
      if (admin.role === 'admin') {
        const callerSokhId = admin.sokhId ? parseInt(admin.sokhId, 10) : 0;
        if (!callerSokhId) {
          return NextResponse.json({ error: 'Session-д sokh_id байхгүй' }, { status: 403 });
        }
        const { data: target } = await sb.from('residents').select('sokh_id').eq('id', residentId).single();
        if (!target) {
          return NextResponse.json({ error: 'Resident олдсонгүй' }, { status: 404 });
        }
        if (Number(target.sokh_id) !== callerSokhId) {
          return NextResponse.json({ error: 'Cross-tenant access denied' }, { status: 403 });
        }
      }
    } else {
      // Оршин суугч — Supabase токеноор баталгаажуулна
      const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
      if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const userClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${token}` } } },
      );
      const { data: { user }, error: userErr } = await userClient.auth.getUser();
      if (userErr || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const { data: me } = await sb.from('residents').select('id').eq('auth_user_id', user.id).limit(1).single();
      if (!me) {
        return NextResponse.json({ error: 'Оршин суугчийн бүртгэл олдсонгүй' }, { status: 404 });
      }
      residentId = me.id as number;
      isResidentSelf = true;
    }

    // ── Зөвшөөрөгдсөн талбаруудыг цуглуулах ──
    const updates: Record<string, string | number | null> = {};
    const { name, phone, resident_type, household_size, move_in_date } = body;

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
    if (resident_type !== undefined && resident_type !== null && resident_type !== '') {
      if (!RESIDENT_TYPES.includes(resident_type)) {
        return NextResponse.json({ error: 'Эзэмшлийн төрөл буруу' }, { status: 400 });
      }
      updates.resident_type = resident_type;
    }
    if (household_size !== undefined && household_size !== null && household_size !== '') {
      const n = Number(household_size);
      if (!Number.isInteger(n) || n < 1 || n > 50) {
        return NextResponse.json({ error: 'Гэр бүлийн гишүүдийн тоо 1-50 байна' }, { status: 400 });
      }
      updates.household_size = n;
    }
    if (move_in_date !== undefined && move_in_date !== null && move_in_date !== '') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(move_in_date)) {
        return NextResponse.json({ error: 'Огноо буруу форматтай байна' }, { status: 400 });
      }
      updates.move_in_date = move_in_date;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Өөрчлөх мэдээлэл байхгүй' }, { status: 400 });
    }

    // Профайл гүйцээгдсэн гэж тэмдэглэх (нэр ба эзэмшил орсон үед)
    if (updates.name && updates.resident_type) {
      updates.profile_completed_at = new Date().toISOString();
    }

    // Утасны дугаар давхардах эсэхийг шалгах
    if (updates.phone) {
      const { data: existing } = await sb
        .from('residents')
        .select('id')
        .eq('phone', updates.phone as string)
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

    return NextResponse.json({ success: true, resident: data, self: isResidentSelf });
  } catch {
    return NextResponse.json({ error: 'Серверийн алдаа' }, { status: 500 });
  }
}
