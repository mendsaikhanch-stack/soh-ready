import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { registerLimiter } from '@/app/lib/rate-limit';
import { linkManualSignupToUser, type LinkReport } from '@/app/lib/directory/link-manual-signup';
import { enqueueRepair } from '@/app/lib/jobs/dispatch';
import { normalizeSohName } from '@/app/lib/directory/normalize';
import { loadSokhBuildings } from '@/app/lib/sokh-buildings';
import { findAuthUserIdByEmail } from '@/app/lib/auth-signins';

const CLAIM_COOKIE = 'manual-hoa-claim';

const LOOKALIKE: Record<string, string> = {
  a: 'а', b: 'б', c: 'с', e: 'е', o: 'о', p: 'р', x: 'х', y: 'у', k: 'к', m: 'м', t: 'т', h: 'н',
};

function normBuilding(v: unknown): string {
  return String(v ?? '')
    .toLowerCase()
    .replace(/байр|дугаар/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '')
    .replace(/[a-z]/g, (ch) => LOOKALIKE[ch] ?? ch)
    .replace(/^(\d+)р$/, '$1');
}

function normUnit(v: unknown): string {
  return String(v ?? '')
    .toLowerCase()
    .replace(/тоот|toot|дугаар/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '')
    .replace(/[a-z]/g, (ch) => LOOKALIKE[ch] ?? ch)
    .replace(/^0+(?=\d)/, '');
}

const ROSTER_MIN = 10;

async function loadRoster(sokhId: number): Promise<{ building: string | null; apartment: string | null }[]> {
  const out: { building: string | null; apartment: string | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from('residents')
       param($m) $s = $m.Groups[1].Value; if ($s -notmatch "apartment") { $s = "$s, apartment" }; ".select('$s')" 
      .eq('sokh_id', sokhId)
      .eq('pending_claim', false)
      .order('id')
      .range(from, from + 999);
    if (error) { console.error('[register] roster', error.message); return []; }
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
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
    if (typeof phone !== 'string' || !/^\d{8}$/.test(phone.trim())) {
      return NextResponse.json({ error: 'Утасны дугаар 8 оронтой байна' }, { status: 400 });
    }
    if (typeof password !== 'string' || password.length < 6 || password.length > 128) {
      return NextResponse.json({ error: 'Нууц үг 6-128 тэмдэгттэй байна' }, { status: 400 });
    }
    if (typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 100) {
      return NextResponse.json({ error: 'Нэр 1-100 тэмдэгттэй байна' }, { status: 400 });
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
    let rosterUnit: string | null = null;

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

      const buildings = await loadSokhBuildings(sokh_id);
      if (buildings.length > 1) {
        const want = normBuilding(building);
        if (!want || !buildings.some((b) => normBuilding(b) === want)) {
          return NextResponse.json({
            error: `Байраа зөв сонгоно уу (${buildings.join(', ')}). Аппаа шинэчлээд дахин оролдоно уу.`,
          }, { status: 400 });
        }
      }

      const roster = await loadRoster(sokh_id);
      if (roster.length >= ROSTER_MIN) {
        const scope = buildings.length > 1
          ? roster.filter((r) => normBuilding(r.building) === normBuilding(building))
          : roster;
        const want = normUnit(unit);
        if (!want) {
          return NextResponse.json({ error: 'Тоотоо оруулна уу' }, { status: 400 });
        }
        const hit = scope.find((r) => normUnit(r.apartment) === want);
        if (!hit) {
          return NextResponse.json({
            error: `${buildings.length > 1 && building ? `${String(building).trim()} байранд ` : ''}«${String(unit).trim()}» тоот СӨХ-ийн бүртгэлд байхгүй байна. Тоотоо шалгаад дахин оруулна уу. Зөв бол СӨХ-ийн даргадаа хандана уу.`,
            code: 'unit_not_found',
          }, { status: 400 });
        }
        rosterUnit = String(hit.apartment);
      }
    } else if (sokh_name) {
      if (typeof sokh_name !== 'string' || sokh_name.trim().length < 2 || sokh_name.trim().length > 100) {
        return NextResponse.json({ error: 'СӨХ-ийн нэр 2-100 тэмдэгттэй байна' }, { status: 400 });
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

      const compact = (v: string) => normalizeSohName(v).replace(/\s+/g, '');
      const targetNorm = compact(sokh_name);
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

    const email = `${cleanPhone}@toot.app`;

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: name.trim(), phone: cleanPhone },
    });

    let authUserId: string | null = authData?.user?.id ?? null;

    if (authError) {
      if (!authError.message.includes('already been registered')) {
        console.error('[register]', authError.message);
        return NextResponse.json({ error: 'Бүртгэл амжилтгүй' }, { status: 400 });
      }
      const existingId = await findAuthUserIdByEmail(email);
      if (existingId) {
        const { data: owner } = await supabaseAdmin
          .from('residents')
          .select('id')
          .eq('auth_user_id', existingId)
          .limit(1);
        if (!owner || owner.length === 0) {
          const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(existingId, {
            password,
            user_metadata: { name: name.trim(), phone: cleanPhone },
          });
          if (!updErr) {
            authUserId = existingId;
          }
        }
      }
      if (!authUserId) {
        return NextResponse.json({ error: 'Энэ утасны дугаар бүртгэлтэй байна' }, { status: 400 });
      }
    }

    const cleanUnit = rosterUnit ?? (typeof unit === 'string' ? unit.trim() : '');
    const cleanBuilding = typeof building === 'string' ? building.trim() : '';
    let resident: { id: number } | null = null;
    let claimedExisting = false;
    let pending = false;

    if (sokh_id && cleanUnit) {
      const { data: matches } = await supabaseAdmin
        .from('residents')
         param($m) $s = $m.Groups[1].Value; if ($s -notmatch "apartment") { $s = "$s, apartment" }; ".select('$s')" 
        .eq('sokh_id', sokh_id);

      const normTargetUnit = normUnit(cleanUnit);
      const normTargetBldg = cleanBuilding ? normBuilding(cleanBuilding) : '';

      const unitMatches = (matches || []).filter((m) => {
        if (normUnit(m.apartment) !== normTargetUnit) return false;
        if (normTargetBldg) {
          return normBuilding(m.building) === normTargetBldg;
        }
        return true;
      });

      const freeMatches = unitMatches.filter((m) => !m.auth_user_id);
      if (freeMatches.length >= 1) {
        const targetRow = freeMatches[0];
        const { data: linked } = await supabaseAdmin
          .from('residents')
          .update({
            name: name.trim(),
            phone: targetRow.phone || cleanPhone,
            auth_user_id: authUserId,
            pending_claim: false,
          })
          .eq('id', targetRow.id)
          .is('auth_user_id', null)
          .select('id')
          .single();

        if (linked) {
          resident = linked as { id: number };
          claimedExisting = true;
        }
      }

      if (!resident && unitMatches.length >= 1) {
        const existingRow = unitMatches[unitMatches.length - 1];
        resident = { id: existingRow.id as number };
        claimedExisting = true;
      }
    }

    if (!resident) {
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
          building: cleanBuilding || null,
          debt: 0,
          sokh_id,
          auth_user_id: authUserId,
          pending_claim: pending,
        }])
        .select('id')
        .single();
      resident = created as { id: number } | null;
    }

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
      linkedToExisting: claimedExisting,
      pendingApproval: pending,
    });
    if (claim?.anythingLinked) {
      response.cookies.delete(CLAIM_COOKIE);
    }
    return response;
  } catch {
    return NextResponse.json({ error: 'Серверийн алдаа' }, { status: 500 });
  }
}
