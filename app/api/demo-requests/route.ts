import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { demoRequestLimiter } from '@/app/lib/rate-limit';
import { ROLE_OPTIONS, CHANNEL_OPTIONS, PROBLEM_OPTIONS, RENTER_ISSUE_OPTIONS } from '@/app/lib/demo-requests/constants';

const CHANNEL_SET = new Set(CHANNEL_OPTIONS);
const PROBLEM_SET = new Set(PROBLEM_OPTIONS);
const ROLE_SET = new Set(ROLE_OPTIONS);
const RENTER_SET = new Set(RENTER_ISSUE_OPTIONS);
const YESNO = new Set(['Тийм', 'Үгүй', 'Мэдэхгүй']);

function str(v: unknown, max = 500): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function cleanArray(v: unknown, allowed: Set<string>): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    if (typeof item === 'string' && allowed.has(item) && !out.includes(item)) out.push(item);
  }
  return out;
}

// POST /api/demo-requests — олон нийтийн demo хүсэлт (нэвтрэлт шаардахгүй)
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown';
  const rl = demoRequestLimiter.check(ip);
  if (!rl.allowed) {
    return NextResponse.json({ error: `Хэт олон хүсэлт. ${rl.retryAfterSec}с хүлээнэ үү` }, { status: 429 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Хүсэлт буруу' }, { status: 400 });

  // Spam honeypot: бот website_url-г бөглөвөл амжилттай мэт хариулаад хадгалахгүй.
  if (str(body.website_url)) {
    return NextResponse.json({ success: true });
  }

  const soh_name = str(body.soh_name, 200);
  const city = str(body.city, 100);
  const district = str(body.district, 100);
  const khoroo = str(body.khoroo, 100);
  const contact_name = str(body.contact_name, 100);
  const phone = str(body.phone, 20);
  const role = str(body.role, 60);
  const notes = str(body.notes, 2000);
  const improvement_suggestions = str(body.improvement_suggestions, 2000);
  const consent = body.consent === true;

  // Заавал талбарууд
  if (soh_name.length < 2) return NextResponse.json({ error: 'СӨХ / байрны нэр оруулна уу' }, { status: 400 });
  if (!city) return NextResponse.json({ error: 'Хот / аймаг оруулна уу' }, { status: 400 });
  if (!district) return NextResponse.json({ error: 'Дүүрэг / сум оруулна уу' }, { status: 400 });
  if (contact_name.length < 2) return NextResponse.json({ error: 'Холбогдох хүний нэр оруулна уу' }, { status: 400 });
  if (!/^\d{6,8}$/.test(phone.replace(/\D/g, '')) || !phone) {
    return NextResponse.json({ error: 'Утасны дугаараа зөв оруулна уу' }, { status: 400 });
  }
  if (!consent) {
    return NextResponse.json({ error: 'Мэдээлэл хадгалахыг зөвшөөрнө үү' }, { status: 400 });
  }

  // household_count
  let household_count: number | null = null;
  const hcRaw = body.household_count;
  if (hcRaw !== null && hcRaw !== undefined && hcRaw !== '') {
    const n = Number(hcRaw);
    if (Number.isFinite(n) && n >= 0 && n < 1000000) household_count = Math.floor(n);
  }

  const record = {
    soh_name,
    city,
    district,
    khoroo: khoroo || null,
    contact_name,
    phone: phone.replace(/\s/g, ''),
    role: ROLE_SET.has(role) ? role : (role || null),
    household_count,
    current_channels: cleanArray(body.current_channels, CHANNEL_SET),
    main_problems: cleanArray(body.main_problems, PROBLEM_SET),
    has_facebook_group: YESNO.has(str(body.has_facebook_group, 20)) ? str(body.has_facebook_group, 20) : null,
    has_excel: YESNO.has(str(body.has_excel, 20)) ? str(body.has_excel, 20) : null,
    renter_issue_level: RENTER_SET.has(str(body.renter_issue_level, 20)) ? str(body.renter_issue_level, 20) : null,
    notes: notes || null,
    improvement_suggestions: improvement_suggestions || null,
    consent,
    source_page: '/demo-request',
    referrer: str(body.referrer, 500) || req.headers.get('referer') || null,
    user_agent: req.headers.get('user-agent')?.slice(0, 500) || null,
    utm_source: str(body.utm_source, 100) || null,
    utm_medium: str(body.utm_medium, 100) || null,
    utm_campaign: str(body.utm_campaign, 100) || null,
  };

  const { error } = await supabaseAdmin.from('soh_demo_requests').insert([record]);
  if (error) {
    console.error('[demo-requests insert]', error.message);
    return NextResponse.json({ error: 'Хадгалж чадсангүй' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message:
      'Баярлалаа. Таны demo хүсэлтийг хүлээн авлаа. Манай талаас тантай холбогдож богино танилцуулга хийх цаг тохирно.',
  });
}
