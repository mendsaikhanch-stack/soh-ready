import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { debtAgreementSignLimiter } from '@/app/lib/rate-limit';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Оршин суугч өрөө хуваан төлөх гэрээг зөвшөөрнө: pending → signed.
//
// Клиентээс шууд UPDATE хийлгэхгүй (debt_agreements-д authenticated-ийн бичих
// эрхийг татсан) — эс бөгөөс өөрийн гэрээний дүн, хуваарийг ч зэрэг өөрчилж
// чадна. Энд ЗӨВХӨН төлвийг сольж, гарын үсгийн хашийг тооцно.
export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || 'unknown';
  const rl = debtAgreementSignLimiter.check(ip);
  if (!rl.allowed) {
    return NextResponse.json({ error: `Хэт олон хүсэлт. ${rl.retryAfterSec}с хүлээнэ үү` }, { status: 429 });
  }

  try {
    const { agreementId } = await request.json();
    if (!agreementId || typeof agreementId !== 'string') {
      return NextResponse.json({ error: 'agreementId шаардлагатай' }, { status: 400 });
    }

    // ── Оршин суугчийг Supabase токеноор баталгаажуулах ──
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

    const { data: me } = await sb
      .from('residents').select('id').eq('auth_user_id', user.id).limit(1).single();
    if (!me) {
      return NextResponse.json({ error: 'Оршин суугчийн бүртгэл олдсонгүй' }, { status: 404 });
    }

    // ── Гэрээ өөрийнх мөн эсэх, зөвшөөрөх боломжтой эсэх ──
    const { data: agreement } = await sb
      .from('debt_agreements')
      .select('id, resident_id, total_debt, agreed_payment_plan, status')
      .eq('id', agreementId)
      .single();

    if (!agreement) {
      return NextResponse.json({ error: 'Гэрээ олдсонгүй' }, { status: 404 });
    }
    if (Number(agreement.resident_id) !== Number(me.id)) {
      return NextResponse.json({ error: 'Энэ гэрээ таных биш байна' }, { status: 403 });
    }
    if (agreement.status === 'signed') {
      return NextResponse.json({ error: 'Энэ гэрээг аль хэдийн зөвшөөрсөн байна' }, { status: 409 });
    }
    if (agreement.status !== 'pending') {
      return NextResponse.json({ error: 'Энэ гэрээг зөвшөөрөх боломжгүй төлөвтэй байна' }, { status: 409 });
    }

    // ── Гарын үсгийн хаш ──
    // Зөвшөөрөх мөчид гэрээний нөхцөл ЯГ ЮУ байсныг тогтооно. Дараа нь дүн эсвэл
    // хуваарийг чимээгүй өөрчилбөл хаш таарахаа болино.
    const signedAt = new Date().toISOString();
    const signatureHash = createHash('sha256')
      .update([
        agreement.id,
        agreement.resident_id,
        agreement.total_debt,
        JSON.stringify(agreement.agreed_payment_plan ?? null),
        signedAt,
        user.id,
      ].join('|'))
      .digest('hex');

    // Төлвийг мөн шалгуурт нь оруулна — 2 таб зэрэг дарахад давхар бичихгүй
    const { data: updated, error } = await sb
      .from('debt_agreements')
      .update({ status: 'signed', signed_at: signedAt, digital_signature_hash: signatureHash })
      .eq('id', agreementId)
      .eq('status', 'pending')
      .select('id, status, signed_at')
      .single();

    if (error || !updated) {
      console.error('[debt-agreement/sign]', error?.message);
      return NextResponse.json({ error: 'Зөвшөөрч чадсангүй' }, { status: 500 });
    }

    return NextResponse.json({ success: true, agreement: updated });
  } catch {
    return NextResponse.json({ error: 'Серверийн алдаа' }, { status: 500 });
  }
}
