import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { voteCastLimiter } from '@/app/lib/rate-limit';
import { castVote, VALID_VOTES } from '@/app/lib/board-server';
import { validateVoteTicket, ticketCookieName } from '@/app/lib/vote-ticket';

// POST /api/vote/cast  { proposalId, voteValue, comment }
// OTP эсвэл хувийн линкээр баталгаажсан ticket cookie шаардана.
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rl = voteCastLimiter.check(ip);
  if (!rl.allowed) {
    return NextResponse.json({ error: `Хэт олон хүсэлт. ${rl.retryAfterSec}с хүлээнэ үү` }, { status: 429 });
  }

  try {
    const body = await req.json();
    const proposalId = parseInt(String(body.proposalId), 10);
    const voteValue = String(body.voteValue || '');
    const comment = body.comment ? String(body.comment).trim().slice(0, 1000) : null;

    if (!proposalId || !VALID_VOTES.has(voteValue)) {
      return NextResponse.json({ error: 'Санал буруу байна' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const ticket = cookieStore.get(ticketCookieName(proposalId))?.value;
    const check = validateVoteTicket(ticket, proposalId);
    if (!check.valid || !check.phone) {
      return NextResponse.json({ error: 'Баталгаажуулалт хүчингүй. Дахин код авна уу' }, { status: 401 });
    }

    const result = await castVote(proposalId, check.phone, voteValue, comment);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.httpStatus });

    const res = NextResponse.json({ ok: true, status: result.status });
    res.cookies.delete(ticketCookieName(proposalId));
    return res;
  } catch (err) {
    console.error('[vote/cast] unexpected', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Серверийн алдаа' }, { status: 500 });
  }
}
