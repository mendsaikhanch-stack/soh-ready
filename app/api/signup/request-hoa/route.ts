import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { directoryRequestLimiter } from '@/app/lib/rate-limit';

interface RequestBody {
  fullName?: string;
  phone?: string;
  email?: string;
  requestedName: string;
  district?: string;
  khoroo?: string;
  address?: string;
  note?: string;
}

// Хэрэглэгчийн "СӨХ олдсонгүй" хүсэлтийг хадгалах endpoint
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  const rl = directoryRequestLimiter.check(ip);
  if (!rl.allowed) return NextResponse.json({ error: `${rl.retryAfterSec}с хүлээнэ үү` }, { status: 429 });

  try {
    const body: RequestBody = await req.json();
    const requestedName = (body.requestedName || '').trim();
    if (!requestedName || requestedName.length < 2) {
      return NextResponse.json({ error: 'СӨХ-ийн нэр шаардлагатай' }, { status: 400 });
    }
    if (requestedName.length > 200) {
      return NextResponse.json({ error: 'Нэр хэт урт' }, { status: 400 });
    }

    const phone = (body.phone || '').trim().slice(0, 32) || null;
    const email = (body.email || '').trim().slice(0, 200) || null;
    if (email && !/^.+@.+\..+$/.test(email)) {
      return NextResponse.json({ error: 'Имэйл буруу' }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from('user_signup_requests').insert({
      full_name: (body.fullName || '').trim().slice(0, 100) || null,
      phone,
      email,
      requested_name: requestedName,
      district: (body.district || '').trim().slice(0, 100) || null,
      khoroo: (body.khoroo || '').trim().slice(0, 100) || null,
      address: (body.address || '').trim().slice(0, 300) || null,
      note: (body.note || '').trim().slice(0, 500) || null,
      status: 'PENDING',
    });

    if (error) {
      console.error('[signup/request-hoa] error:', error.message);
      return NextResponse.json({ error: 'Хадгалж чадсангүй' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Серверийн алдаа' }, { status: 500 });
  }
}
