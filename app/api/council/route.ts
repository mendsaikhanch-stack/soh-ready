import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { councilLimiter } from '@/app/lib/rate-limit';
import { resolveCouncil, clientIp, type CouncilMember } from '@/app/lib/council';
import { castVote, computeTally, finalizeIfNeeded, VALID_VOTES } from '@/app/lib/board-server';

// /api/council — апп дахь «🏛 Зөвлөл» хэсэг.
//   ТУЗ (board)   : бүгдийг харна + санал өгнө + чатад бичнэ
//   Хяналт (audit): бүгдийг ЗӨВХӨН харна
// Эрхийг resolveCouncil (дарга тэмдэглэсэн resident_id + утас таарах) шийднэ.

type Ctx = { sokhId: number; m: CouncilMember };

async function guard(req: NextRequest, sokhIdRaw: unknown): Promise<Ctx | NextResponse> {
  const rl = councilLimiter.check(clientIp(req));
  if (!rl.allowed) {
    return NextResponse.json({ error: `Хэт олон хүсэлт. ${rl.retryAfterSec}с хүлээнэ үү` }, { status: 429 });
  }
  const sokhId = parseInt(String(sokhIdRaw || ''), 10);
  if (!sokhId) return NextResponse.json({ error: 'sokhId шаардлагатай' }, { status: 400 });
  const m = await resolveCouncil(req, sokhId);
  if (m === 'unauth') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!m) return NextResponse.json({ member: false });
  return { sokhId, m };
}

// ---------------- GET ----------------
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const g = await guard(req, sp.get('sokhId'));
  if (g instanceof NextResponse) return g;
  const { sokhId, m } = g;
  const view = sp.get('view') || 'summary';

  try {
    if (view === 'summary') return NextResponse.json(await summary(sokhId, m));
    if (view === 'proposals') return NextResponse.json({ ...me(m), proposals: await proposals(sokhId, m) });
    if (view === 'finance') {
      const now = new Date();
      const year = parseInt(sp.get('year') || '', 10) || now.getFullYear();
      const month = parseInt(sp.get('month') || '', 10) || now.getMonth() + 1;
      return NextResponse.json({ ...me(m), ...(await finance(sokhId, year, month)) });
    }
    if (view === 'issues') return NextResponse.json({ ...me(m), ...(await issues(sokhId)) });
    if (view === 'chat') {
      const after = parseInt(sp.get('after') || '', 10) || 0;
      let q = supabaseAdmin
        .from('board_chat_messages')
        .select('id, resident_id, author_name, author_role, body, created_at')
        .eq('sokh_id', sokhId);
      q = after ? q.gt('id', after).order('id', { ascending: true }).limit(100) : q.order('id', { ascending: false }).limit(100);
      const { data } = await q;
      const rows = data || [];
      return NextResponse.json({
        ...me(m),
        my_resident_id: m.residentId,
        messages: after ? rows : rows.reverse(),
      });
    }
    return NextResponse.json({ error: 'view буруу' }, { status: 400 });
  } catch (err) {
    console.error('[council] GET', view, err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Серверийн алдаа' }, { status: 500 });
  }
}

// ---------------- POST ----------------
// { sokhId, action:'vote', proposalId, voteValue, comment? }
// { sokhId, action:'chat', body }
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'JSON буруу' }, { status: 400 }); }

  const g = await guard(req, body.sokhId);
  if (g instanceof NextResponse) return g;
  const { sokhId, m } = g;

  // Хяналтын зөвлөл зөвхөн харна
  if (m.council !== 'board') {
    return NextResponse.json({ error: 'Хяналтын зөвлөлийн гишүүн зөвхөн харах эрхтэй' }, { status: 403 });
  }

  try {
    if (body.action === 'vote') {
      const proposalId = parseInt(String(body.proposalId), 10);
      const voteValue = String(body.voteValue || '');
      if (!proposalId || !VALID_VOTES.has(voteValue)) {
        return NextResponse.json({ error: 'Санал буруу байна' }, { status: 400 });
      }
      const comment = body.comment ? String(body.comment).trim().slice(0, 1000) : null;
      const r = await castVote(proposalId, m.phone, voteValue, comment, { sokhId });
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.httpStatus });
      return NextResponse.json({ ok: true, status: r.status });
    }

    if (body.action === 'chat') {
      const text = String(body.body || '').trim().slice(0, 2000);
      if (!text) return NextResponse.json({ error: 'Хоосон мессеж' }, { status: 400 });
      const { data, error } = await supabaseAdmin
        .from('board_chat_messages')
        .insert({ sokh_id: sokhId, resident_id: m.residentId, author_name: m.name, author_role: m.council, body: text })
        .select('id, resident_id, author_name, author_role, body, created_at')
        .single();
      if (error) {
        console.error('[council] chat', error.message);
        return NextResponse.json({ error: 'Илгээж чадсангүй' }, { status: 500 });
      }
      return NextResponse.json({ message: data });
    }

    return NextResponse.json({ error: 'action буруу' }, { status: 400 });
  } catch (err) {
    console.error('[council] POST', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Серверийн алдаа' }, { status: 500 });
  }
}

// ---------------- туслах ----------------
const me = (m: CouncilMember) => ({ member: true, council: m.council, name: m.name, can_act: m.council === 'board' });

async function summary(sokhId: number, m: CouncilMember) {
  const [{ data: reports }, { data: active }] = await Promise.all([
    supabaseAdmin.from('board_reports').select('id').eq('sokh_id', sokhId).order('created_at', { ascending: false }).limit(50),
    supabaseAdmin.from('proposals').select('id').eq('sokh_id', sokhId).eq('status', 'active').gt('expires_at', new Date().toISOString()),
  ]);

  let unreadReports = 0;
  const reportIds = (reports || []).map((r) => r.id as number);
  if (reportIds.length > 0) {
    const { data: reads } = await supabaseAdmin
      .from('board_report_reads').select('report_id').eq('resident_id', m.residentId).in('report_id', reportIds);
    unreadReports = reportIds.length - (reads || []).length;
  }

  let pendingVotes = 0;
  const activeIds = (active || []).map((p) => p.id as number);
  if (m.council === 'board' && activeIds.length > 0) {
    const [{ data: invited }, { data: voted }] = await Promise.all([
      supabaseAdmin.from('proposal_voters').select('proposal_id').eq('phone_number', m.phone).in('proposal_id', activeIds),
      supabaseAdmin.from('proposal_votes').select('proposal_id').eq('phone_number', m.phone).in('proposal_id', activeIds),
    ]);
    const votedSet = new Set((voted || []).map((v) => v.proposal_id as number));
    pendingVotes = (invited || []).filter((i) => !votedSet.has(i.proposal_id as number)).length;
  }

  return { ...me(m), unread_reports: unreadReports, pending_votes: pendingVotes };
}

async function proposals(sokhId: number, m: CouncilMember) {
  const { data: list } = await supabaseAdmin
    .from('proposals')
    .select('id, title, description, budget_amount, status, pass_threshold_percentage, auto_approve_on_timeout, expires_at, created_at, sokh_id, result_token')
    .eq('sokh_id', sokhId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (!list || list.length === 0) return [];

  const ids = list.map((p) => p.id as number);
  const [{ data: invited }, { data: myVotes }] = await Promise.all([
    supabaseAdmin.from('proposal_voters').select('proposal_id').eq('phone_number', m.phone).in('proposal_id', ids),
    supabaseAdmin.from('proposal_votes').select('proposal_id, vote_value').eq('phone_number', m.phone).in('proposal_id', ids),
  ]);
  const invitedSet = new Set((invited || []).map((i) => i.proposal_id as number));
  const myVote = new Map((myVotes || []).map((v) => [v.proposal_id as number, v.vote_value as string]));

  return Promise.all(
    list.map(async (p) => {
      const status = await finalizeIfNeeded(p);
      const tally = await computeTally(p.id);
      return {
        id: p.id,
        title: p.title,
        description: p.description,
        budget_amount: p.budget_amount,
        status,
        pass_threshold_percentage: p.pass_threshold_percentage,
        expires_at: p.expires_at,
        created_at: p.created_at,
        tally,
        invited: invitedSet.has(p.id),
        my_vote: myVote.get(p.id) || null,
        // Зөвлөлийн гишүүн бүрэн протоколыг (хэн юу гэж) харах эрхтэй
        protocol_url: `/vote/${p.id}/result?k=${p.result_token}`,
      };
    }),
  );
}

async function finance(sokhId: number, year: number, month: number) {
  const [inv, debt, items, payables, reserve] = await Promise.all([
    supabaseAdmin.from('invoices').select('amount, paid_amount, status').eq('sokh_id', sokhId).eq('year', year).eq('month', month),
    supabaseAdmin.from('residents').select('debt').eq('sokh_id', sokhId).gt('debt', 0),
    supabaseAdmin.from('budget_items').select('id, type, category, name, description, amount')
      .eq('sokh_id', sokhId).eq('year', year).eq('month', month).order('amount', { ascending: false }),
    supabaseAdmin.from('payables').select('id, vendor, category, amount, paid_amount, due_date, status, description')
      .eq('sokh_id', sokhId).neq('status', 'paid').order('due_date', { ascending: true }).limit(50),
    supabaseAdmin.from('reserve_fund').select('type, amount, description, occurred_at')
      .eq('sokh_id', sokhId).order('occurred_at', { ascending: false }).limit(500),
  ]);

  const invoices = inv.data || [];
  const billed = invoices.reduce((s, i) => s + Number(i.amount || 0), 0);
  const collected = invoices.reduce((s, i) => s + Number(i.paid_amount || 0), 0);
  const paidCount = invoices.filter((i) => i.status === 'paid').length;

  const debtRows = debt.data || [];
  const reserveRows = reserve.data || [];
  const reserveBalance = reserveRows.reduce(
    (s, r) => s + (r.type === 'withdrawal' ? -1 : 1) * Number(r.amount || 0), 0,
  );

  const budget = items.data || [];
  return {
    year,
    month,
    invoices: { count: invoices.length, paid_count: paidCount, billed, collected },
    // Айл тус бүрийн өрийг биш, нийлбэрийг л харуулна (хувийн мэдээлэл)
    debt: { debtors: debtRows.length, total: debtRows.reduce((s, r) => s + Number(r.debt || 0), 0) },
    income: budget.filter((b) => b.type === 'income'),
    expense: budget.filter((b) => b.type !== 'income'),
    payables: payables.data || [],
    reserve: { balance: reserveBalance, recent: reserveRows.slice(0, 10) },
  };
}

async function issues(sokhId: number) {
  const [c, mr] = await Promise.all([
    supabaseAdmin.from('complaints').select('id, category, title, description, status, admin_reply, created_at')
      .eq('sokh_id', sokhId).order('created_at', { ascending: false }).limit(50),
    supabaseAdmin.from('maintenance_requests').select('id, title, description, status, created_at')
      .eq('sokh_id', sokhId).order('created_at', { ascending: false }).limit(50),
  ]);
  return { complaints: c.data || [], maintenance: mr.data || [] };
}
