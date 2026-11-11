import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { workPlanMemberLimiter } from '@/app/lib/rate-limit';
import { resolveCouncil, userFromRequest } from '@/app/lib/council';
import { isWorkPlanEnabled, RATING_LABEL } from '@/app/lib/work-plan/shared';
import { approveIfMajority, loadPlans } from '@/app/lib/work-plan/server';

// /api/work-plan — оршин суугчийн апп.
//   Оршин суугч: батлагдсан / хаагдсан төлөвлөгөө, гүйцэтгэл, ТУЗ-ийн дүгнэлтийн ТОО.
//   ТУЗ / Хяналт: дээрхээс гадна ТУЗ хянаж буй ноорог, гишүүдийн санал нэртэй.
//   ТУЗ (board) л санал өгч (review), ажлыг дүгнэнэ (rate). Хяналт зөвхөн харна.

function rateLimited(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rl = workPlanMemberLimiter.check(ip);
  return rl.allowed ? null : NextResponse.json({ error: `Хэт олон хүсэлт. ${rl.retryAfterSec}с хүлээнэ үү` }, { status: 429 });
}

/** Нэвтэрсэн хэрэглэгч энэ СӨХ-ийн баталгаажсан оршин суугч мөн эсэх */
async function isResidentOf(req: NextRequest, sokhId: number): Promise<boolean | 'unauth'> {
  const userId = await userFromRequest(req);
  if (!userId) return 'unauth';
  const { data } = await supabaseAdmin
    .from('residents').select('id').eq('auth_user_id', userId).eq('sokh_id', sokhId).eq('pending_claim', false).limit(1);
  return !!data && data.length > 0;
}

// GET ?sokhId=1            → { enabled, council, plans[] }
// GET ?sokhId=1&summary=1  → { enabled, pending }  (ТУЗ-ийн санал хүлээж буй төлөвлөгөөний тоо)
export async function GET(req: NextRequest) {
  const limited = rateLimited(req);
  if (limited) return limited;
  const sokhId = parseInt(req.nextUrl.searchParams.get('sokhId') || '', 10);
  if (!sokhId) return NextResponse.json({ error: 'sokhId шаардлагатай' }, { status: 400 });
  if (!isWorkPlanEnabled(sokhId)) return NextResponse.json({ enabled: false });

  try {
    const member = await resolveCouncil(req, sokhId);
    if (member === 'unauth') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (req.nextUrl.searchParams.get('summary')) {
      if (!member || member.council !== 'board') return NextResponse.json({ enabled: true, pending: 0 });
      const { data: plans } = await supabaseAdmin
        .from('work_plans').select('id, revision').eq('sokh_id', sokhId).eq('status', 'review');
      let pending = 0;
      for (const p of plans || []) {
        const { data: mine } = await supabaseAdmin.from('work_plan_reviews').select('plan_id')
          .eq('plan_id', p.id).eq('revision', p.revision).eq('resident_id', member.residentId).limit(1);
        if (!mine || mine.length === 0) pending++;
      }
      return NextResponse.json({ enabled: true, pending });
    }

    if (member) {
      const plans = await loadPlans(sokhId, { statuses: ['review', 'approved', 'archived'] }, { kind: 'council', residentId: member.residentId });
      return NextResponse.json({ enabled: true, council: member.council, can_act: member.council === 'board', plans });
    }

    const ok = await isResidentOf(req, sokhId);
    if (ok === 'unauth') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!ok) return NextResponse.json({ error: 'Энэ СӨХ-ийн оршин суугч биш' }, { status: 403 });
    const plans = await loadPlans(sokhId, { statuses: ['approved', 'archived'] }, { kind: 'resident' });
    return NextResponse.json({ enabled: true, council: null, can_act: false, plans });
  } catch (err) {
    console.error('[work-plan] GET', err instanceof Error ? err.message : err);
    return NextResponse.json({ enabled: true, plans: [], error: 'Ачаалж чадсангүй' }, { status: 500 });
  }
}

// POST { sokhId, action:'review', planId, decision:'approve'|'changes', comment }
// POST { sokhId, action:'rate', itemId, rating:'done'|'partial'|'not_done', comment }
export async function POST(req: NextRequest) {
  const limited = rateLimited(req);
  if (limited) return limited;
  try {
    const b = await req.json();
    const sokhId = parseInt(String(b.sokhId), 10);
    if (!sokhId || !isWorkPlanEnabled(sokhId)) return NextResponse.json({ error: 'Идэвхжээгүй' }, { status: 403 });

    const member = await resolveCouncil(req, sokhId);
    if (member === 'unauth') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!member || member.council !== 'board') {
      return NextResponse.json({ error: 'Зөвхөн ТУЗ-ийн гишүүн санал өгнө' }, { status: 403 });
    }
    const comment = String(b.comment || '').trim().slice(0, 2000) || null;

    if (b.action === 'review') {
      const decision = b.decision === 'approve' || b.decision === 'changes' ? b.decision : null;
      if (!decision) return NextResponse.json({ error: 'Санал буруу' }, { status: 400 });
      if (decision === 'changes' && !comment) {
        return NextResponse.json({ error: 'Юуг засах хэрэгтэйг сэтгэгдэлд бичнэ үү' }, { status: 400 });
      }
      const planId = parseInt(String(b.planId), 10);
      const { data: plan } = await supabaseAdmin
        .from('work_plans').select('id, status, revision').eq('id', planId).eq('sokh_id', sokhId).maybeSingle();
      if (!plan) return NextResponse.json({ error: 'Төлөвлөгөө олдсонгүй' }, { status: 404 });
      if (plan.status !== 'review') return NextResponse.json({ error: 'Энэ төлөвлөгөө санал авахгүй байна' }, { status: 409 });

      // Нэг хувилбарт нэг л санал (дахин илгээвэл шинэ хувилбарт дахин өгнө)
      const { error } = await supabaseAdmin.from('work_plan_reviews').insert({
        plan_id: plan.id, revision: plan.revision, resident_id: member.residentId, member_name: member.name, decision, comment,
      });
      if (error) {
        if (error.code === '23505') return NextResponse.json({ error: 'Та энэ хувилбарт санал өгсөн байна' }, { status: 409 });
        console.error('[work-plan] review', error.message);
        return NextResponse.json({ error: 'Санал бүртгэхэд алдаа' }, { status: 500 });
      }
      const approved = decision === 'approve' ? await approveIfMajority(sokhId, plan.id) : false;
      return NextResponse.json({ ok: true, approved });
    }

    if (b.action === 'rate') {
      const rating = String(b.rating || '');
      if (!(rating in RATING_LABEL)) return NextResponse.json({ error: 'Үнэлгээ буруу' }, { status: 400 });
      const itemId = parseInt(String(b.itemId), 10);
      const { data: item } = await supabaseAdmin
        .from('work_plan_items').select('id, plan_id, reported_at').eq('id', itemId).eq('sokh_id', sokhId).maybeSingle();
      if (!item) return NextResponse.json({ error: 'Ажил олдсонгүй' }, { status: 404 });
      const { data: plan } = await supabaseAdmin
        .from('work_plans').select('status').eq('id', item.plan_id).eq('sokh_id', sokhId).maybeSingle();
      if (!plan || plan.status !== 'approved') return NextResponse.json({ error: 'Батлагдсан төлөвлөгөөний ажлыг л дүгнэнэ' }, { status: 409 });
      if (!item.reported_at) return NextResponse.json({ error: 'Дарга гүйцэтгэлээ тайлагнаагүй байна' }, { status: 409 });

      const { error } = await supabaseAdmin.from('work_plan_ratings').upsert({
        item_id: item.id, resident_id: member.residentId, member_name: member.name, rating, comment, updated_at: new Date().toISOString(),
      }, { onConflict: 'item_id,resident_id' });
      if (error) { console.error('[work-plan] rate', error.message); return NextResponse.json({ error: 'Хадгалахад алдаа' }, { status: 500 }); }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'action буруу' }, { status: 400 });
  } catch (err) {
    console.error('[work-plan] POST', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Серверийн алдаа' }, { status: 500 });
  }
}
