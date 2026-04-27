import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { linkManualSignupToUser } from '@/app/lib/directory/link-manual-signup';
import { enqueueRepair } from '@/app/lib/jobs/dispatch';

const CLAIM_COOKIE = 'manual-hoa-claim';

interface ClaimBody {
  // Resident-ийн утас (Supabase auth-аас гаргаж аваад дамжуулна).
  // Аль ч client-ээс дамжсан утсыг шууд итгэхгүй — `residents` хүснэгтээс
  // үнэндээ ийм утастай хэрэглэгч байгаа эсэхийг шалгана.
  phone: string;
}

// Login хийсний дараа нэмэлт claim хийх endpoint.
// Жишээ: хэрэглэгч аль хэдийн бүртгэлтэй байсан үед /find-hoa-аас manual signup
// илгээсэн ч тэр үед register дуудагдаагүй учраас claim хийгдээгүй байж болно.
// Энэ route-г client (auth-context) нэвтэрсний дараа дуудаж claim үлдэгдлийг арилгана.
//
// Аюулгүй байдал:
// - phone нь `residents` хүснэгтэд оршиж байх ёстой
// - claim_token cookie + phone хослолоор claim хийнэ
// - email-аар claim хийхгүй (Supabase автомат email <phone>@toot.app тул phone давтагдсан)
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ClaimBody;
    const phoneRaw = (body.phone || '').trim();
    if (!/^\d{8}$/.test(phoneRaw)) {
      return NextResponse.json({ error: 'phone буруу' }, { status: 400 });
    }

    // Resident оршин байгаа эсэхийг шалгах (claim_token cookie дангаараа итгэх боломжгүй)
    const { data: resident } = await supabaseAdmin
      .from('residents')
      .select('id, phone')
      .eq('phone', phoneRaw)
      .limit(1)
      .maybeSingle();

    if (!resident?.id) {
      return NextResponse.json({ error: 'Resident олдсонгүй' }, { status: 404 });
    }

    const claimToken = req.cookies.get(CLAIM_COOKIE)?.value || null;
    const email = `${phoneRaw}@toot.app`;

    let claim: Awaited<ReturnType<typeof linkManualSignupToUser>> | null = null;
    try {
      claim = await linkManualSignupToUser({
        userId: resident.id as number,
        phone: phoneRaw,
        email,
        claimToken,
      });
    } catch (e) {
      console.error('[claim-soh] link error', e);
      // Self-healing: link бүтэлгүйтсэн бол retry job enqueue хийнэ
      await enqueueRepair('retry_manual_claim_link', {
        residentId: resident.id,
        phone: phoneRaw,
        email,
        claimToken,
      }, {
        idempotencyKey: `claim:resident:${resident.id}`,
        delaySec: 30,
      });
      return NextResponse.json({ success: true, queued: true });
    }

    const response = NextResponse.json({ success: true, claim });
    if (claim.anythingLinked && claimToken) {
      response.cookies.delete(CLAIM_COOKIE);
    }
    return response;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    console.error('[auth/claim-soh] error', msg);
    return NextResponse.json({ error: 'Серверийн алдаа' }, { status: 500 });
  }
}
