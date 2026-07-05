import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { getAuthRole } from '@/app/lib/session-token';
import { computeTally, finalizeIfNeeded } from '@/app/lib/board-server';
import { maskPhone } from '@/app/lib/vote-ticket';

// GET /api/vote/[id]/protocol?k=<result_token>
// Хэн юу гэж санал өгсөн бүрэн протокол. Эрх: result_token (нууц линк)
// эсвэл тухайн СӨХ-ны админ session.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const proposalId = parseInt(id, 10);
  if (!proposalId) return NextResponse.json({ error: 'Буруу ID' }, { status: 400 });

  const k = req.nextUrl.searchParams.get('k');

  const { data: p } = await supabaseAdmin
    .from('proposals')
    .select('*')
    .eq('id', proposalId)
    .single();
  if (!p) return NextResponse.json({ error: 'Санал асуулга олдсонгүй' }, { status: 404 });

  // --- Эрх шалгах ---
  let authorized = !!k && k === p.result_token;
  if (!authorized) {
    const auth = await getAuthRole();
    if (auth) {
      if (auth.role === 'superadmin') authorized = true;
      else if (p.sokh_id && auth.sokhId && parseInt(auth.sokhId, 10) === Number(p.sokh_id)) {
        authorized = true;
      }
    }
  }
  if (!authorized) return NextResponse.json({ error: 'Хандах эрхгүй' }, { status: 403 });

  // Статусыг шинэчлэх
  const status = await finalizeIfNeeded(p);

  const { data: voters } = await supabaseAdmin
    .from('proposal_voters')
    .select('phone_number, full_name')
    .eq('proposal_id', proposalId)
    .order('full_name');

  const { data: votes } = await supabaseAdmin
    .from('proposal_votes')
    .select('phone_number, vote_value, comment, is_auto, voted_at')
    .eq('proposal_id', proposalId);

  const voteMap = new Map((votes || []).map((v) => [v.phone_number, v]));

  // Гишүүн бүрээр протокол мөр
  const rows = (voters || []).map((voter) => {
    const v = voteMap.get(voter.phone_number);
    return {
      full_name: voter.full_name,
      phone: maskPhone(voter.phone_number),
      voted: !!v,
      vote_value: v?.vote_value || null,
      comment: v?.comment || null,
      is_auto: v?.is_auto || false, // дүрмийн дагуу автоматаар зөвшөөрсөнд тооцогдсон
      voted_at: v?.voted_at || null,
    };
  });

  const tally = await computeTally(proposalId, rows.length);

  return NextResponse.json({
    proposal: {
      id: p.id,
      title: p.title,
      description: p.description,
      budget_amount: p.budget_amount,
      status,
      kind: p.kind,
      org_name: p.org_name,
      pass_threshold_percentage: p.pass_threshold_percentage,
      auto_approve_on_timeout: p.auto_approve_on_timeout,
      created_at: p.created_at,
      expires_at: p.expires_at,
      finalized_at: p.finalized_at,
    },
    tally,
    rows,
  });
}
