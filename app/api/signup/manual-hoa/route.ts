import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { manualHoaLimiter } from '@/app/lib/rate-limit';
import { normalizeSohName } from '@/app/lib/directory/normalize';
import { incrementActivationSummary } from '@/app/lib/directory/activation';
import { normalizePhone, normalizeEmail } from '@/app/lib/directory/link-manual-signup';

const CLAIM_COOKIE = 'manual-hoa-claim';
const CLAIM_TTL_DAYS = 30;

interface ManualBody {
  // SOH identity
  sohName: string;
  city?: string;
  district?: string;
  khoroo?: string;
  townName?: string;
  building?: string;
  unitNumber?: string;
  address?: string;
  // Хүний контакт
  fullName?: string;
  phone?: string;
  email?: string;
  note?: string;
  // Хэрэв хэрэглэгч аль хэдийн нэвтэрсэн бол user_id-г дамжуулж болно
  userId?: number;
}

// Хэрэглэгч master directory-аас өөрийн СӨХ-ийг олж чадаагүй үед
// гар оролтоор СӨХ + хаягаа бүртгүүлэх endpoint.
//
// Үүсгэх / шинэчлэх бичлэгүүд:
//   1. hoa_provisional (нэр + дүүрэг + хороогоор upsert байдлаар)
//   2. user_signup_requests (хуучин дохио хэвээр үлдээх)
//   3. resident_memberships (тус хэрэглэгчийн membership)
//   4. hoa_activation_requests (албан ёсны "идэвхжүүлэх" дохио)
//   5. hoa_activation_summaries (interest_count нэмэх)
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  const rl = manualHoaLimiter.check(ip);
  if (!rl.allowed) return NextResponse.json({ error: `${rl.retryAfterSec}с хүлээнэ үү` }, { status: 429 });

  try {
    const body: ManualBody = await req.json();
    const sohName = (body.sohName || '').trim();
    if (!sohName || sohName.length < 2) {
      return NextResponse.json({ error: 'СӨХ-ийн нэр шаардлагатай' }, { status: 400 });
    }
    if (sohName.length > 200) {
      return NextResponse.json({ error: 'СӨХ-ийн нэр хэт урт' }, { status: 400 });
    }

    const normalized = normalizeSohName(sohName);
    if (!normalized) {
      return NextResponse.json({ error: 'СӨХ-ийн нэр хүчингүй' }, { status: 400 });
    }

    const city = clean(body.city, 100);
    const district = clean(body.district, 100);
    const khoroo = clean(body.khoroo, 100);
    const townName = clean(body.townName, 200);
    const building = clean(body.building, 100);
    const unitNumber = clean(body.unitNumber, 50);
    const address = clean(body.address, 300);
    const contactPhone = normalizePhone(body.phone);
    const contactEmail = normalizeEmail(body.email);

    // Браузер дотроос дараа бүртгэл хийсэн ч ижил session-ы хүн гэдгийг
    // тогтоох туслах claim_token. Cookie дотор хадгална.
    const existingToken = req.cookies.get(CLAIM_COOKIE)?.value || null;
    const claimToken = (existingToken && existingToken.length >= 16) ? existingToken : randomUUID().replace(/-/g, '');

    // 1) Provisional СӨХ — байгаа бол upsert (status PENDING/HAS_DEMAND үед нэг бичлэг)
    const provisionalId = await upsertProvisional({
      sohName,
      normalized,
      city,
      district,
      khoroo,
      townName,
      building,
      address,
    });

    // 2) Backward-compat: user_signup_requests дотор бас хадгалах
    await supabaseAdmin.from('user_signup_requests').insert({
      full_name: clean(body.fullName, 100),
      phone: contactPhone,
      email: contactEmail,
      requested_name: sohName,
      district,
      khoroo,
      address: address || joinAddress({ townName, building, unitNumber }),
      note: clean(body.note, 500),
      status: 'PENDING',
      claim_token: claimToken,
    });

    // 3) Resident membership (хэрэглэгч ID-гүй ч байж болно — дараа login үед холбоно)
    await supabaseAdmin.from('resident_memberships').insert({
      user_id: body.userId ?? null,
      directory_id: null,
      provisional_hoa_id: provisionalId,
      city,
      district,
      khoroo,
      building,
      unit_number: unitNumber,
      status: 'PENDING_HOA',
      contact_phone: contactPhone,
      contact_email: contactEmail,
      claim_token: claimToken,
    });

    // 4) Activation request (демонд дохио)
    await supabaseAdmin.from('hoa_activation_requests').insert({
      user_id: body.userId ?? null,
      directory_id: null,
      provisional_hoa_id: provisionalId,
      city,
      district,
      khoroo,
      building,
      unit_number: unitNumber,
      note: clean(body.note, 500),
      status: 'NEW',
      contact_phone: contactPhone,
      contact_email: contactEmail,
      claim_token: claimToken,
    });

    // 5) Activation summary шинэчлэх
    await incrementActivationSummary({ provisionalId, building });

    const response = NextResponse.json({
      success: true,
      provisionalId,
      claimToken,
      message:
        'Таны СӨХ одоогоор үндсэн жагсаалтад байхгүй байна. Бид таны бүртгэлийг хадгаллаа. ' +
        'Энэ нь танай СӨХ дээр Khotol ашиглах хүсэлтийн албан ёсны дохио болж бүртгэгдэнэ. ' +
        'Жагсаалт шинэчлэгдэхэд таныг зөв СӨХ-тэй автоматаар холбоно.',
    });
    response.cookies.set(CLAIM_COOKIE, claimToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: CLAIM_TTL_DAYS * 24 * 60 * 60,
      path: '/',
    });
    return response;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    console.error('[signup/manual-hoa] unexpected:', msg);
    return NextResponse.json({ error: 'Серверийн алдаа' }, { status: 500 });
  }
}

function clean(v: string | undefined | null, max: number): string | null {
  if (!v) return null;
  const t = String(v).trim().slice(0, max);
  return t || null;
}

function joinAddress(parts: { townName?: string | null; building?: string | null; unitNumber?: string | null }): string | null {
  const out = [parts.townName, parts.building ? `${parts.building}-р байр` : null, parts.unitNumber ? `${parts.unitNumber} тоот` : null]
    .filter(Boolean)
    .join(', ');
  return out || null;
}

async function upsertProvisional(args: {
  sohName: string;
  normalized: string;
  city: string | null;
  district: string | null;
  khoroo: string | null;
  townName: string | null;
  building: string | null;
  address: string | null;
}): Promise<number> {
  // Одоо байгаа active provisional хайх (district + khoroo + normalized_name ижил).
  // NULL утгыг is null-аар хайх ёстой тул eq биш filter ашиглана.
  let q = supabaseAdmin
    .from('hoa_provisional')
    .select('id, status, address, town_name, building, city')
    .eq('normalized_name', args.normalized)
    .in('status', ['PENDING', 'HAS_DEMAND', 'MATCH_CANDIDATE']);
  q = args.district ? q.eq('district', args.district) : q.is('district', null);
  q = args.khoroo ? q.eq('khoroo', args.khoroo) : q.is('khoroo', null);
  const { data: existing } = await q.maybeSingle();

  if (existing?.id) {
    // Хоосон талбаруудыг нөхөх
    const update: Record<string, unknown> = {};
    if (!existing.address && args.address) update.address = args.address;
    if (!existing.town_name && args.townName) update.town_name = args.townName;
    if (!existing.building && args.building) update.building = args.building;
    if (!existing.city && args.city) update.city = args.city;
    if (Object.keys(update).length > 0) {
      await supabaseAdmin.from('hoa_provisional').update(update).eq('id', existing.id);
    }
    return existing.id as number;
  }

  const { data: created, error } = await supabaseAdmin
    .from('hoa_provisional')
    .insert({
      entered_name: args.sohName,
      normalized_name: args.normalized,
      city: args.city,
      district: args.district,
      khoroo: args.khoroo,
      town_name: args.townName,
      building: args.building,
      address: args.address,
      status: 'PENDING',
    })
    .select('id')
    .single();

  if (error || !created?.id) {
    // Race condition үед дахин хайж олох
    let retryQ = supabaseAdmin
      .from('hoa_provisional')
      .select('id')
      .eq('normalized_name', args.normalized)
      .in('status', ['PENDING', 'HAS_DEMAND', 'MATCH_CANDIDATE']);
    retryQ = args.district ? retryQ.eq('district', args.district) : retryQ.is('district', null);
    retryQ = args.khoroo ? retryQ.eq('khoroo', args.khoroo) : retryQ.is('khoroo', null);
    const { data: retry } = await retryQ.maybeSingle();
    if (retry?.id) return retry.id as number;
    throw new Error(error?.message || 'provisional upsert failed');
  }
  return created.id as number;
}
