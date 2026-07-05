import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { voteOtpSendLimiter, voteOtpVerifyLimiter } from '@/app/lib/rate-limit';
import { sendSms } from '@/app/lib/sms';
import {
  createVoteTicket,
  ticketCookieName,
  normalizePhone,
  maskPhone,
} from '@/app/lib/vote-ticket';

const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 минут
const MAX_ATTEMPTS = 5;

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Санал асуулга идэвхтэй бөгөөд утас урьсан гишүүдийн жагсаалтад буй эсэхийг шалгах
async function checkVoter(proposalId: number, phone: string) {
  const { data: p } = await supabaseAdmin
    .from('proposals')
    .select('id, status, expires_at')
    .eq('id', proposalId)
    .single();
  if (!p) return { ok: false as const, error: 'Санал асуулга олдсонгүй', status: 404 };
  if (p.status !== 'active' || new Date(p.expires_at).getTime() <= Date.now()) {
    return { ok: false as const, error: 'Санал асуулга хаагдсан байна', status: 400 };
  }

  const { data: voter } = await supabaseAdmin
    .from('proposal_voters')
    .select('id')
    .eq('proposal_id', proposalId)
    .eq('phone_number', phone)
    .single();
  if (!voter) {
    return { ok: false as const, error: 'Энэ дугаар санал өгөх эрхгүй байна', status: 403 };
  }
  return { ok: true as const };
}

// POST /api/vote/otp  { proposalId, phone, action:'send'|'verify', code? }
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  try {
    const body = await req.json();
    const proposalId = parseInt(String(body.proposalId), 10);
    const phone = normalizePhone(body.phone || '');
    const action = body.action;

    if (!proposalId || phone.length !== 8) {
      return NextResponse.json({ error: 'Утасны дугаар буруу байна' }, { status: 400 });
    }

    // -------- OTP илгээх --------
    if (action === 'send') {
      const rl = voteOtpSendLimiter.check(`${ip}:${phone}`);
      if (!rl.allowed) {
        return NextResponse.json(
          { error: `Хэт олон код хүслээ. ${rl.retryAfterSec}с хүлээнэ үү` },
          { status: 429 },
        );
      }

      const voter = await checkVoter(proposalId, phone);
      if (!voter.ok) return NextResponse.json({ error: voter.error }, { status: voter.status });

      const code = generateOTP();
      const codeHash = await bcrypt.hash(code, 10);

      // Хуучин ашиглаагүй кодуудыг устгах
      await supabaseAdmin
        .from('proposal_otps')
        .delete()
        .eq('proposal_id', proposalId)
        .eq('phone_number', phone)
        .is('consumed_at', null);

      await supabaseAdmin.from('proposal_otps').insert({
        proposal_id: proposalId,
        phone_number: phone,
        code_hash: codeHash,
        expires_at: new Date(Date.now() + OTP_EXPIRY_MS).toISOString(),
      });

      await sendSms(phone, `Хотол: Санал өгөх баталгаажуулах код: ${code} (5 мин хүчинтэй)`);

      return NextResponse.json({ sent: true, phone: maskPhone(phone) });
    }

    // -------- OTP шалгах --------
    if (action === 'verify') {
      const rl = voteOtpVerifyLimiter.check(`${ip}:${phone}`);
      if (!rl.allowed) {
        return NextResponse.json(
          { error: `Хэт олон оролдлого. ${rl.retryAfterSec}с хүлээнэ үү` },
          { status: 429 },
        );
      }

      const code = String(body.code || '').trim();
      if (!/^\d{6}$/.test(code)) {
        return NextResponse.json({ error: 'Код 6 оронтой байна' }, { status: 400 });
      }

      const { data: otp } = await supabaseAdmin
        .from('proposal_otps')
        .select('id, code_hash, expires_at, attempts, consumed_at')
        .eq('proposal_id', proposalId)
        .eq('phone_number', phone)
        .is('consumed_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!otp) return NextResponse.json({ error: 'Код олдсонгүй. Дахин авна уу' }, { status: 400 });
      if (new Date(otp.expires_at).getTime() <= Date.now()) {
        return NextResponse.json({ error: 'Кодын хугацаа дууссан' }, { status: 400 });
      }
      if (otp.attempts >= MAX_ATTEMPTS) {
        return NextResponse.json({ error: 'Хэт олон буруу оролдлого. Шинэ код авна уу' }, { status: 429 });
      }

      const match = await bcrypt.compare(code, otp.code_hash);
      if (!match) {
        await supabaseAdmin
          .from('proposal_otps')
          .update({ attempts: otp.attempts + 1 })
          .eq('id', otp.id);
        return NextResponse.json({ error: 'Код буруу байна' }, { status: 400 });
      }

      // Амжилттай — код хэрэглэсэн болгож тэмдэглэх + ticket cookie тавих
      await supabaseAdmin
        .from('proposal_otps')
        .update({ consumed_at: new Date().toISOString() })
        .eq('id', otp.id);

      const ticket = createVoteTicket(proposalId, phone);
      const res = NextResponse.json({ verified: true });
      res.cookies.set(ticketCookieName(proposalId), ticket, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60,
        path: '/',
      });
      return res;
    }

    return NextResponse.json({ error: 'action шаардлагатай' }, { status: 400 });
  } catch (err) {
    console.error('[vote/otp] unexpected', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Серверийн алдаа' }, { status: 500 });
  }
}
