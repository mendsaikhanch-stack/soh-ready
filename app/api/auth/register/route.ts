import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { registerLimiter } from '@/app/lib/rate-limit';
import { linkManualSignupToUser, type LinkReport } from '@/app/lib/directory/link-manual-signup';
import { enqueueRepair } from '@/app/lib/jobs/dispatch';
import { normalizeSohName } from '@/app/lib/directory/normalize';
import { loadSokhBuildings } from '@/app/lib/sokh-buildings';

const CLAIM_COOKIE = 'manual-hoa-claim';

/**
 * Байрны дугаарыг зөөлөн харьцуулах хэлбэрт оруулна.
 * Дарга «9А», оршин суугч «9а», «9 A», «9A байр» гэж бичсэн ч таарах ёстой.
 * Латин a/b/c/e/o/p/x нь кирилл а/б/с/е/о/р/х-тэй ижил харагддаг тул хөрвүүлнэ.
 */
const LOOKALIKE: Record<string, string> = {
  a: 'а', b: 'б', c: 'с', e: 'е', o: 'о', p: 'р', x: 'х', y: 'у', k: 'к', m: 'м', t: 'т', h: 'н',
};
function normBuilding(v: unknown): string {
  return String(v ?? '')
    .toLowerCase()
    .replace(/байр|дугаар/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '')
    .replace(/[a-z]/g, (ch) => LOOKALIKE[ch] ?? ch)
    .replace(/^(\d+)р$/, '$1');   // «11-р байр» → «11»
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const { allowed, retryAfterSec } = registerLimiter.check(ip);
  if (!allowed) {
    return NextResponse.json({ error: `${retryAfterSec} секунд хүлээнэ үү` }, { status: 429 });
  }

  try {
    const { phone, password, name, apartment, unit, building, sokh_id: sokhIdRaw, sokh_name, khoroo_id } = await req.json();
    let sokh_id: number | undefined = sokhIdRaw;

    if (!phone || !password || !name) {
      return NextResponse.json({ error: 'Бүх талбарыг бөглөнө үү' }, { status: 400 });
    }

    // Input validation
    if (typeof phone !== 'string' || !/^\d{8}$/.test(phone.trim())) {
      return NextResponse.json({ error: 'Утасны дугаар 8 оронтой байна' }, { status: 400 });
    }
    if (typeof password !== 'string' || password.length < 6 || password.length > 128) {
      return NextResponse.json({ error: 'Нууц үг 6-128 тэмдэгт байна' }, { status: 400 });
    }
    if (typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 100) {
      return NextResponse.json({ error: 'Нэр 1-100 тэмдэгт байна' }, { status: 400 });
    }
    if (apartment && (typeof apartment !== 'string' || apartment.trim().length > 200)) {
      return NextResponse.json({ error: 'Хаяг хэт урт байна' }, { status: 400 });
    }
    if (unit && (typeof unit !== 'string' || unit.trim().length > 20)) {
      return NextResponse.json({ error: 'Тоот буруу байна' }, { status: 400 });
    }
    if (building && (typeof building !== 'string' || building.trim().length > 20)) {
      return NextResponse.json({ error: 'Байрны дугаар буруу байна' }, { status: 400 });
    }

    const cleanPhone = phone.trim();

    // sokh_id шалгах
    if (sokh_id) {
      if (typeof sokh_id !== 'number' || sokh_id <= 0) {
        return NextResponse.json({ error: 'sokh_id буруу' }, { status: 400 });
      }
      const { data: org } = await supabaseAdmin
        .from('sokh_organizations')
        .select('id')
        .eq('id', sokh_id)
        .single();
      if (!org) {
        return NextResponse.json({ error: 'Байгууллага олдсонгүй' }, { status: 400 });
      }
      // Олон байртай СӨХ-д байр нь жагсаалтын аль нэгтэй таарах ЁСТОЙ —
      // «33» гэж бичээд орохыг зөвшөөрвөл даргын мөртэй холбогдохгүй, давхар
      // мөр үүсдэг (Аман хуур, 2026-10-21). Аккаунт үүсгэхээс ӨМНӨ шалгана.
      const buildings = await loadSokhBuildings(sokh_id);
      if (buildings.length > 1) {
        const want = normBuilding(building);
        if (!want || !buildings.some((b) => normBuilding(b) === want)) {
          return NextResponse.json({
            error: `Байраа зөв сонгоно уу (${buildings.join(', ')}). Аппаа шинэчлээд дахин оролдоно уу.`,
          }, { status: 400 });
        }
      }
    } else if (sokh_name) {
      // Хэрэглэгч өөрөө СӨХ-ийн нэрээ оруулсан тохиолдолд шинэ байгууллага үүсгэх
      if (typeof sokh_name !== 'string' || sokh_name.trim().length < 2 || sokh_name.trim().length > 100) {
        return NextResponse.json({ error: 'СӨХ-ийн нэр 2-100 тэмдэгт байна' }, { status: 400 });
      }
      if (typeof khoroo_id !== 'number' || khoroo_id <= 0) {
        return NextResponse.json({ error: 'Хороо буруу' }, { status: 400 });
      }
      const { data: khoroo } = await supabaseAdmin
        .from('khoroos')
        .select('id')
        .eq('id', khoroo_id)
        .single();
      if (!khoroo) {
        return NextResponse.json({ error: 'Хороо олдсонгүй' }, { status: 400 });
      }
      // Давхардал шалгах: ижил хороонд нормчилсон нэр нь таарах СӨХ байвал
      // шинээр үүсгэхгүй, байгааг нь дахин ашиглана (дубль tenant үүсгэхгүй).
      // Зайг тооцохгүй — «Аманхуур Дижитал» нь «Аман хуур дижитал СӨХ» мөн
      // (2026-10-21-нд ингэж давхар СӨХ үүсэж, айлууд буруу СӨХ-д бүртгэгдсэн).
      const compact = (v: string) => normalizeSohName(v).replace(/\s+/g, '');
      const targetNorm = compact(sokh_name);
      // Аппын нэрийг СӨХ-ийн нэр гэж бичих тохиолдол гарсан («хотол сөх»)
      if (!targetNorm || ['хотол', 'khotol', 'тоот', 'toot'].includes(targetNorm)) {
        return NextResponse.json({ error: 'СӨХ-ийнхөө нэрийг бичнэ үү (аппын нэр биш)' }, { status: 400 });
      }
      const { data: sameKhorooOrgs } = await supabaseAdmin
        .from('sokh_organizations')
        .select('id, name, claim_status')
        .eq('khoroo_id', khoroo_id);
      const dup = (sameKhorooOrgs || []).find(
        (o) => compact(o.name as string) === targetNorm,
      );
      // Хороонд даргатай (идэвхтэй) СӨХ байвал шинийг ҮҮСГЭХГҮЙ — сонгуулна.
      // Нэрийн харьцуулалт латин «Ic town», үсгийн алдаатай «АЙ таун»-ыг
      // танихгүй тул АйСиТаун-д 3 давхар СӨХ үүсч, айлууд тарсан (2026-10-26).
      const active = (sameKhorooOrgs || []).filter((o) => o.claim_status === 'active');
      if (!dup && active.length > 0) {
        return NextResponse.json({
          error: 'Энэ хороонд бүртгэлтэй СӨХ байна — жагсаалтаас сонгоно уу. Таны СӨХ жагсаалтад байхгүй бол даргаасаа QR код авна уу.',
          code: 'sokh_exists_in_khoroo',
          suggestions: active.map((o) => ({ id: o.id, name: o.name })),
        }, { status: 409 });
      }
      if (dup) {
        sokh_id = dup.id as number;
      } else {
        const { data: newOrg, error: orgErr } = await supabaseAdmin
          .from('sokh_organizations')
          .insert([{ name: sokh_name.trim(), khoroo_id, address: '', phone: '' }])
          .select('id')
          .single();
        if (orgErr || !newOrg) {
          console.error('[register] sokh insert', orgErr?.message);
          return NextResponse.json({ error: 'СӨХ үүсгэж чадсангүй' }, { status: 500 });
        }
        sokh_id = newOrg.id as number;
      }
    }

    // Утаснаас имэйл автоматаар үүсгэх (Supabase auth шаардлага)
    const email = `${cleanPhone}@toot.app`;

    // Supabase auth хэрэглэгч үүсгэх
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: name.trim(), phone: cleanPhone },
    });

    if (authError) {
      if (authError.message.includes('already been registered')) {
        return NextResponse.json({ error: 'Энэ утасны дугаар бүртгэлтэй байна' }, { status: 400 });
      }
      console.error('[register]', authError.message);
      return NextResponse.json({ error: 'Бүртгэл амжилтгүй' }, { status: 400 });
    }

    // ── Даргын бүртгэлтэй тулгах ──
    // Өмнө нь энд болзолгүйгээр INSERT хийдэг байсан тул даргын импортолсон
    // айл өөр утсаар бүртгүүлбэл тэр тоот давхар мөр болж, айлын тоо ба нийт
    // дүн буруу гардаг байв. Одоо эхлээд байгаа мөрийг хайна.
    const cleanUnit = typeof unit === 'string' ? unit.trim() : '';
    const cleanBuilding = typeof building === 'string' ? building.trim() : '';
    let resident: { id: number } | null = null;
    let claimedExisting = false;
    let pending = false;

    if (sokh_id && cleanUnit) {
      const { data: matches } = await supabaseAdmin
        .from('residents')
        .select('id, auth_user_id, building')
        .eq('sokh_id', sokh_id)
        .eq('apartment', cleanUnit);

      let free = (matches || []).filter((m) => !m.auth_user_id);
      // Олон байртай СӨХ-д тоот давхцдаг (жишээ нь Өрнөлт: 9А-12, 9Б-12, 11-12).
      // Тийм үед бүртгүүлэгчийн бичсэн байраар нарийсгана.
      if (free.length > 1 && cleanBuilding) {
        const want = normBuilding(cleanBuilding);
        const narrowed = free.filter((m) => normBuilding(m.building) === want);
        if (narrowed.length === 1) free = narrowed;
      }
      // Яг нэг эзэнгүй мөр байвал л холбоно. Хэд хэдэн бол аль нь болох нь
      // тодорхойгүй тул даргад шийдүүлнэ.
      if (free.length === 1) {
        const { data: linked } = await supabaseAdmin
          .from('residents')
          .update({
            name: name.trim(),
            // auth-context нь профайлыг УТСААР хайдаг тул заавал шинэчилнэ
            phone: cleanPhone,
            auth_user_id: authData.user?.id ?? null,
          })
          .eq('id', free[0].id)
          .is('auth_user_id', null)   // зэрэг хоёр хүн бүртгүүлэхээс хамгаална
          .select('id')
          .single();
        if (linked) {
          resident = linked as { id: number };
          claimedExisting = true;
        }
      }
    }

    if (!resident) {
      // Холбогдох мөр олдсонгүй → шинэ мөр. Тухайн СӨХ-д баталгаажуулах дарга
      // байвал "хүлээгдэж буй" болгоно (тоо/дүнд орохгүй). Дарга байхгүй бол
      // баталгаажуулах хүн ч алга тул шууд хүчинтэй.
      if (sokh_id) {
        const { data: darga } = await supabaseAdmin
          .from('admin_users')
          .select('id')
          .eq('sokh_id', sokh_id)
          .eq('status', 'active')
          .limit(1);
        pending = !!(darga && darga.length);
      }

      const { data: created } = await supabaseAdmin
        .from('residents')
        .insert([{
          name: name.trim(),
          phone: cleanPhone,
          apartment: cleanUnit || apartment || '',
          // Байраа бичсэн бол хадгална — дарга давхардсан мөрийг ялгахад хэрэгтэй
          building: cleanBuilding || null,
          debt: 0,
          sokh_id,
          auth_user_id: authData.user?.id ?? null,
          pending_claim: pending,
        }])
        .select('id')
        .single();
      resident = created as { id: number } | null;
    }

    // Pre-auth manual signup-аас үлдсэн provisional бичлэгүүдийг тус хэрэглэгч рүү
    // claim хийж оролдох. Алдаа гарвал register-ийг fail хийхгүй.
    let claim: LinkReport | null = null;
    if (resident?.id) {
      const claimToken = req.cookies.get(CLAIM_COOKIE)?.value || null;
      try {
        claim = await linkManualSignupToUser({
          userId: resident.id as number,
          phone: cleanPhone,
          email,
          claimToken,
        });
      } catch (e) {
        console.error('[register] link error', e);
        // Self-healing: link бүтэлгүйтсэн бол retry job enqueue хийнэ
        await enqueueRepair('retry_manual_claim_link', {
          residentId: resident.id,
          phone: cleanPhone,
          email,
          claimToken,
        }, {
          idempotencyKey: `claim:resident:${resident.id}`,
          delaySec: 30,
        });
      }
    }

    const response = NextResponse.json({
      success: true, email, claim, sokh_id,
      linkedToExisting: claimedExisting,  // даргын бүртгэлтэй мөр рүү холбогдсон
      pendingApproval: pending,           // дарга баталгаажуулах хүртэл хүлээнэ
    });
    if (claim?.anythingLinked) {
      // Token-ыг нэгэнт хэрэглэсэн тул cookie-г цэвэрлэнэ
      response.cookies.delete(CLAIM_COOKIE);
    }
    return response;
  } catch {
    return NextResponse.json({ error: 'Серверийн алдаа' }, { status: 500 });
  }
}
