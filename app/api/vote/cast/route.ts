import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { voteCastLimiter } from '@/app/lib/rate-limit';
import { finalizeIfNeeded } from '@/app/lib/board-server';
import { validateVoteTicket, ticketCookieName } from '@/app/lib/vote-ticket';

const VALID_VOTES = new Set(['approve', 'disapprove', 'abstain']);

// POST /api/vote/cast  { proposalId, voteValue, comment }
// OTP-оор баталгаажсан ticket cookie шаардана.
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

    // Ticket шалгах
    const cookieStore = await cookies();
    const ticket = cookieStore.get(ticketCookieName(proposalId))?.value;
    const check = validateVoteTicket(ticket, proposalId);
    if (!check.valid || !check.phone) {
      return NextResponse.json({ error: 'Баталгаажуулалт хүчингүй. Дахин код авна уу' }, { status: 401 });
    }
    const phone = check.phone;

    // Санал асуулга идэвхтэй + утас урьсан гишүүн мөн эсэх
    const { data: p } = await supabaseAdmin
      .from('proposals')
      .select('id, status, expires_at, sokh_id, pass_threshold_percentage, auto_approve_on_timeout')
      .eq('id', proposalId)
      .single();
    if (!p) return NextResponse.json({ error: 'Санал асуулга олдсонгүй' }, { status: 404 });
    if (p.status !== 'active' || new Date(p.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: 'Санал асуулга хаагдсан байна' }, { status: 400 });
    }

    const { data: voter } = await supabaseAdmin
      .from('proposal_voters')
      .select('id')
      .eq('proposal_id', proposalId)
      .eq('phone_number', phone)
      .single();
    if (!voter) return NextResponse.json({ error: 'Санал өгөх эрхгүй' }, { status: 403 });

    // Санал бүртгэх — UNIQUE(proposal_id, phone) давхар саналыг хорино
    const { error: insErr } = await supabaseAdmin.from('proposal_votes').insert({
      proposal_id: proposalId,
      sokh_id: p.sokh_id,
      phone_number: phone,
      vote_value: voteValue,
      comment,
    });

    if (insErr) {
      if (insErr.code === '23505') {
        return NextResponse.json({ error: 'Та аль хэдийн санал өгсөн байна' }, { status: 409 });
      }
      console.error('[vote/cast] insert', insErr.message);
      return NextResponse.json({ error: 'Санал бүртгэхэд алдаа гарлаа' }, { status: 500 });
    }

    // Бүх гишүүн санал өгсөн бол шийдвэрлэх
    const status = await finalizeIfNeeded({
      id: p.id,
      status: p.status,
      expires_at: p.expires_at,
      pass_threshold_percentage: p.pass_threshold_percentage,
      auto_approve_on_timeout: p.auto_approve_on_timeout,
      sokh_id: p.sokh_id,
    });

    // Ticket-ийг цэвэрлэх
    const res = NextResponse.json({ ok: true, status });
    res.cookies.delete(ticketCookieName(proposalId));
    return res;
  } catch (err) {
    console.error('[vote/cast] unexpected', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Серверийн алдаа' }, { status: 500 });
  }
}
