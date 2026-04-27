import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { leadClaimLimiter } from '@/app/lib/rate-limit';

const VALID_ROLES = new Set(['darga', 'nyarav', 'member', 'other']);

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown';
  const rl = leadClaimLimiter.check(ip);
  if (!rl.allowed) {
    return NextResponse.json({ error: `Хэт олон хүсэлт. ${rl.retryAfterSec}с хүлээнэ үү` }, { status: 429 });
  }

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Хүсэлт буруу' }, { status: 400 });

  const sokhIdRaw = body.sokh_id;
  const sokhId = sokhIdRaw === null || sokhIdRaw === undefined || sokhIdRaw === '' ? null : Number(sokhIdRaw);
  const sokhName = typeof body.sokh_name === 'string' ? body.sokh_name.trim() : '';
  const khorooIdRaw = body.khoroo_id;
  const khorooId = khorooIdRaw === null || khorooIdRaw === undefined || khorooIdRaw === '' ? null : Number(khorooIdRaw);
  const contactName = typeof body.contact_name === 'string' ? body.contact_name.trim() : '';
  const contactPhone = typeof body.contact_phone === 'string' ? body.contact_phone.trim() : '';
  const role = typeof body.role === 'string' ? body.role.trim() : 'darga';
  const note = typeof body.note === 'string' ? body.note.trim() : '';

  // Аль алинаас нэг нь заавал
  if (sokhId === null && !sokhName) {
    return NextResponse.json({ error: 'СӨХ сонгох эсвэл нэр оруулна уу' }, { status: 400 });
  }
  if (sokhId !== null && (!Number.isFinite(sokhId) || sokhId <= 0)) {
    return NextResponse.json({ error: 'СӨХ id буруу' }, { status: 400 });
  }
  if (sokhName && (sokhName.length < 2 || sokhName.length > 100)) {
    return NextResponse.json({ error: 'СӨХ нэр 2-100 тэмдэгт байна' }, { status: 400 });
  }
  if (khorooId !== null && (!Number.isFinite(khorooId) || khorooId <= 0)) {
    return NextResponse.json({ error: 'Хороо id буруу' }, { status: 400 });
  }
  if (contactName.length < 2 || contactName.length > 100) {
    return NextResponse.json({ error: 'Нэр 2-100 тэмдэгт байна' }, { status: 400 });
  }
  if (!/^\d{8}$/.test(contactPhone)) {
    return NextResponse.json({ error: 'Утасны дугаар 8 оронтой байна' }, { status: 400 });
  }
  if (!VALID_ROLES.has(role)) {
    return NextResponse.json({ error: 'Үүрэг буруу' }, { status: 400 });
  }
  if (note.length > 1000) {
    return NextResponse.json({ error: 'Тэмдэглэл 1000 тэмдэгт хүртэл' }, { status: 400 });
  }

  // Хэрэв sokh_id өгөгдсөн бол үнэхээр байгаа эсэхийг шалгана
  if (sokhId !== null) {
    const { data: org } = await supabaseAdmin
      .from('sokh_organizations')
      .select('id')
      .eq('id', sokhId)
      .maybeSingle();
    if (!org) return NextResponse.json({ error: 'СӨХ олдсонгүй' }, { status: 400 });
  }
  if (khorooId !== null) {
    const { data: kh } = await supabaseAdmin
      .from('khoroos')
      .select('id')
      .eq('id', khorooId)
      .maybeSingle();
    if (!kh) return NextResponse.json({ error: 'Хороо олдсонгүй' }, { status: 400 });
  }

  // Хэт ойрхон давхар хүсэлт ирэхээс хамгаалах: тухайн утаснаас сүүлийн 1 цагт ирсэн pending lead байвал давхар үүсгэхгүй
  const { data: dup } = await supabaseAdmin
    .from('sokh_leads')
    .select('id')
    .eq('contact_phone', contactPhone)
    .eq('status', 'pending')
    .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .maybeSingle();
  if (dup) {
    return NextResponse.json({
      success: true,
      duplicate: true,
      message: 'Таны хүсэлт хүлээн авагдсан байна. Удахгүй эргэн холбогдох болно.',
    });
  }

  const { error: insErr } = await supabaseAdmin
    .from('sokh_leads')
    .insert([{
      sokh_id: sokhId,
      sokh_name: sokhName || null,
      khoroo_id: khorooId,
      contact_name: contactName,
      contact_phone: contactPhone,
      role,
      note: note || null,
    }]);

  if (insErr) {
    console.error('[lead-claim insert]', insErr.message);
    return NextResponse.json({ error: 'Хадгалж чадсангүй' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: 'Таны хүсэлт хүлээн авагдлаа. Хотол баг удахгүй эргэн холбогдох болно.',
  });
}
