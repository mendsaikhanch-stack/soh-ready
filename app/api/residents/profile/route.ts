import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function PUT(request: Request) {
  try {
    const { residentId, name, phone } = await request.json();

    if (!residentId) {
      return NextResponse.json({ error: 'residentId шаардлагатай' }, { status: 400 });
    }

    const updates: Record<string, string> = {};
    if (name?.trim()) updates.name = name.trim();
    if (phone?.trim()) updates.phone = phone.trim();

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
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, resident: data });
  } catch {
    return NextResponse.json({ error: 'Серверийн алдаа' }, { status: 500 });
  }
}
