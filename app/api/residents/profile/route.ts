import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { validateSessionToken } from '@/app/lib/session-token';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const adminToken = cookieStore.get('admin-session')?.value;
  const superToken = cookieStore.get('superadmin-session')?.value;
  const token = adminToken || superToken;
  if (!token) return false;
  return validateSessionToken(token, 24 * 60 * 60 * 1000).valid;
}

export async function PUT(request: Request) {
  try {
    if (!await isAuthenticated()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { residentId, name, phone } = await request.json();

    if (!residentId || typeof residentId !== 'number') {
      return NextResponse.json({ error: 'residentId шаардлагатай (тоо)' }, { status: 400 });
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
