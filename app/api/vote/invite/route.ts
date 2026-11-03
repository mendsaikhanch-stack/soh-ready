import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { voteOtpVerifyLimiter } from '@/app/lib/rate-limit';
import { createVoteTicket, ticketCookieName, maskPhone } from '@/app/lib/vote-ticket';

// POST /api/vote/invite  { proposalId, token }
// Гишүүн бүрийн хувийн урилгын линк (proposal_voters.invite_token)-ээр
// OTP-гүйгээр санал өгөх ticket олгоно. SMS провайдер шаардахгүй —
// дарга линкийг өөрийн утаснаас SMS/Messenger-ээр илгээнэ.
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rl = voteOtpVerifyLimiter.check(`invite:${ip}`);
  if (!rl.allowed) {
    return NextResponse.json({ error: `Хэт олон оролдлого. ${rl.retryAfterSec}с хүлээнэ үү` }, { status: 429 });
  }

  try {
    const body = await req.json();
    const proposalId = parseInt(String(body.proposalId), 10);
    const token = String(body.token || '').trim();
    if (!proposalId || !/^[0-9a-f-]{36}$/i.test(token)) {
      return NextResponse.json({ error: 'Линк буруу байна' }, { status: 400 });
    }

    const { data: voter } = await supabaseAdmin
      .from('proposal_voters')
      .select('phone_number, full_name')
      .eq('proposal_id', proposalId)
      .eq('invite_token', token)
      .maybeSingle();
    if (!voter) return NextResponse.json({ error: 'Линк хүчингүй байна' }, { status: 403 });

    const { data: p } = await supabaseAdmin
      .from('proposals')
      .select('status, expires_at')
      .eq('id', proposalId)
      .single();
    if (!p) return NextResponse.json({ error: 'Санал асуулга олдсонгүй' }, { status: 404 });
    if (p.status !== 'active' || new Date(p.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: 'Санал асуулга хаагдсан байна' }, { status: 400 });
    }

    const { data: existing } = await supabaseAdmin
      .from('proposal_votes')
      .select('vote_value')
      .eq('proposal_id', proposalId)
      .eq('phone_number', voter.phone_number)
      .maybeSingle();

    const res = NextResponse.json({
      verified: true,
      name: voter.full_name,
      phone: maskPhone(voter.phone_number),
      already_voted: !!existing,
    });
    if (!existing) {
      res.cookies.set(ticketCookieName(proposalId), createVoteTicket(proposalId, voter.phone_number), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60,
        path: '/',
      });
    }
    return res;
  } catch (err) {
    console.error('[vote/invite] unexpected', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Серверийн алдаа' }, { status: 500 });
  }
}
