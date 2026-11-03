import { supabaseAdmin } from '@/app/lib/supabase-admin';

// Сервер талын санал тооллого / шийдвэрлэлтийн логик.
// GET болон cast route-д давхардуулахгүйн тулд энд төвлөрүүлэв.

export interface Tally {
  approve: number;
  disapprove: number;
  abstain: number;
  auto: number; // хугацаа хэтэрч автоматаар зөвшөөрсөнд тооцогдсон
  voted: number; // нийт бүртгэгдсэн санал (авто орно)
  total: number; // эрх бүхий нийт гишүүн
}

export interface ProposalRow {
  id: number;
  status: string;
  expires_at: string;
  pass_threshold_percentage: number;
  auto_approve_on_timeout: boolean;
  sokh_id: number | null;
}

// Санал асуулгын тооллого гаргах
export async function computeTally(proposalId: number, totalVoters?: number): Promise<Tally> {
  const { data: votes } = await supabaseAdmin
    .from('proposal_votes')
    .select('vote_value, is_auto')
    .eq('proposal_id', proposalId);

  let approve = 0;
  let disapprove = 0;
  let abstain = 0;
  let auto = 0;
  for (const v of votes || []) {
    if (v.vote_value === 'approve') approve++;
    else if (v.vote_value === 'disapprove') disapprove++;
    else abstain++;
    if (v.is_auto) auto++;
  }

  let total = totalVoters;
  if (total == null) {
    const { count } = await supabaseAdmin
      .from('proposal_voters')
      .select('*', { count: 'exact', head: true })
      .eq('proposal_id', proposalId);
    total = count || 0;
  }

  return { approve, disapprove, abstain, auto, voted: approve + disapprove + abstain, total };
}

/**
 * ДҮРЭМ 2 — Хугацаа хэтэрсэн үед санал өгөөгүй гишүүдийг автоматаар
 * "Зөвшөөрсөн" болгож бүртгэнэ (auto_approve_on_timeout=true үед).
 * Санал өгсөн гишүүдийн phone-г алгасна.
 */
async function autoApproveNonVoters(proposalId: number, sokhId: number | null): Promise<void> {
  const { data: voters } = await supabaseAdmin
    .from('proposal_voters')
    .select('id, phone_number')
    .eq('proposal_id', proposalId)
    .eq('auto_processed', false);
  if (!voters || voters.length === 0) return;

  const { data: votes } = await supabaseAdmin
    .from('proposal_votes')
    .select('phone_number')
    .eq('proposal_id', proposalId);
  const votedPhones = new Set((votes || []).map((v) => v.phone_number));

  const nonVoters = voters.filter((v) => !votedPhones.has(v.phone_number));
  if (nonVoters.length === 0) return;

  await supabaseAdmin.from('proposal_votes').insert(
    nonVoters.map((v) => ({
      proposal_id: proposalId,
      sokh_id: sokhId,
      phone_number: v.phone_number,
      vote_value: 'approve',
      comment: 'Автомат зөвшөөрөл — хугацаанд хариу өгөөгүй',
      is_auto: true,
    })),
  );

  await supabaseAdmin
    .from('proposal_voters')
    .update({ auto_processed: true })
    .in('id', nonVoters.map((v) => v.id));
}

/**
 * Хугацаа дуусах эсвэл бүх гишүүн санал өгсөн бол статусыг шийдвэрлэнэ.
 * ДҮРЭМ 1 (босго): зөвшөөрсөн / нийт эрхтэй гишүүн * 100 >= pass_threshold_percentage.
 * ДҮРЭМ 2 (авто зөвшөөрөл): хугацаа хэтэрсэн үед идэвхжинэ.
 * Идэвхтэй хэвээр байвал 'active' буцаана.
 */
export async function finalizeIfNeeded(proposal: ProposalRow): Promise<string> {
  if (proposal.status !== 'active') return proposal.status;

  const expired = new Date(proposal.expires_at).getTime() <= Date.now();

  // Эхлээд хугацаа хэтэрсэн эсэхийг шалгаж, авто зөвшөөрлийг оруулна
  if (expired && proposal.auto_approve_on_timeout) {
    await autoApproveNonVoters(proposal.id, proposal.sokh_id);
  }

  const tally = await computeTally(proposal.id);
  const allVoted = tally.total > 0 && tally.voted >= tally.total;

  if (!expired && !allVoted) return 'active';

  const percentApprove = tally.total > 0 ? (tally.approve / tally.total) * 100 : 0;
  const newStatus = percentApprove >= Number(proposal.pass_threshold_percentage || 50) ? 'passed' : 'rejected';

  await supabaseAdmin
    .from('proposals')
    .update({ status: newStatus, finalized_at: new Date().toISOString() })
    .eq('id', proposal.id);

  return newStatus;
}

export const VALID_VOTES = new Set(['approve', 'disapprove', 'abstain']);

export type CastResult =
  | { ok: true; status: string }
  | { ok: false; error: string; httpStatus: number };

/**
 * Санал бүртгэх — линкээр (ticket) болон апп доторх зөвлөлийн гишүүнээс
 * ижил дүрмээр. Санал асуулга идэвхтэй + утас урьсан гишүүдэд байх ёстой.
 */
export async function castVote(
  proposalId: number,
  phone: string,
  voteValue: string,
  comment: string | null,
  opts?: { sokhId?: number },
): Promise<CastResult> {
  if (!VALID_VOTES.has(voteValue)) return { ok: false, error: 'Санал буруу байна', httpStatus: 400 };

  const { data: p } = await supabaseAdmin
    .from('proposals')
    .select('id, status, expires_at, sokh_id, pass_threshold_percentage, auto_approve_on_timeout')
    .eq('id', proposalId)
    .single();
  if (!p) return { ok: false, error: 'Санал асуулга олдсонгүй', httpStatus: 404 };
  if (opts?.sokhId && Number(p.sokh_id) !== opts.sokhId) {
    return { ok: false, error: 'Санал асуулга олдсонгүй', httpStatus: 404 };
  }
  if (p.status !== 'active' || new Date(p.expires_at).getTime() <= Date.now()) {
    return { ok: false, error: 'Санал асуулга хаагдсан байна', httpStatus: 400 };
  }

  const { data: voter } = await supabaseAdmin
    .from('proposal_voters')
    .select('id')
    .eq('proposal_id', proposalId)
    .eq('phone_number', phone)
    .maybeSingle();
  if (!voter) return { ok: false, error: 'Энэ саналд таныг санал өгөгчөөр оруулаагүй байна', httpStatus: 403 };

  const { error: insErr } = await supabaseAdmin.from('proposal_votes').insert({
    proposal_id: proposalId,
    sokh_id: p.sokh_id,
    phone_number: phone,
    vote_value: voteValue,
    comment,
  });
  if (insErr) {
    if (insErr.code === '23505') return { ok: false, error: 'Та аль хэдийн санал өгсөн байна', httpStatus: 409 };
    console.error('[castVote] insert', insErr.message);
    return { ok: false, error: 'Санал бүртгэхэд алдаа гарлаа', httpStatus: 500 };
  }

  const status = await finalizeIfNeeded({
    id: p.id,
    status: p.status,
    expires_at: p.expires_at,
    pass_threshold_percentage: p.pass_threshold_percentage,
    auto_approve_on_timeout: p.auto_approve_on_timeout,
    sokh_id: p.sokh_id,
  });
  return { ok: true, status };
}
