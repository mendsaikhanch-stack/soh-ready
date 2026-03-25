import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';

export async function POST(req: NextRequest) {
  try {
    const { email, password, name, phone, apartment, sokh_id } = await req.json();

    if (!email || !password || !name || !phone) {
      return NextResponse.json({ error: 'Бүх талбарыг бөглөнө үү' }, { status: 400 });
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
      return NextResponse.json({ error: authError.message }, { status: 400 });
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
