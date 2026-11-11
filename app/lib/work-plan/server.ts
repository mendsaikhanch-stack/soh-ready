import { supabaseAdmin } from '@/app/lib/supabase-admin';
import {
  WORK_PLAN_BUCKET,
  isMajorityApproved,
  type Decision,
  type FileOut,
  type ItemOut,
  type PlanOut,
  type PlanStatus,
  type Rating,
} from './shared';

// Ажлын төлөвлөгөөг уншиж PlanOut болгох (зөвхөн сервер).

const SIGNED_URL_TTL_SEC = 60 * 60;

export type Viewer =
  | { kind: 'admin' }                       // дарга: бүх санал, үнэлгээ нэртэй
  | { kind: 'council'; residentId: number } // ТУЗ/Хяналт: нэртэй + өөрийн санал
  | { kind: 'resident' };                   // оршин суугч: зөвхөн тоо

/** ТУЗ-ийн гишүүдийн тоо (Хяналтын зөвлөл ороогүй) — олонхын суурь. */
export async function boardSize(sokhId: number): Promise<number> {
  const { count } = await supabaseAdmin
    .from('board_members')
    .select('id', { count: 'exact', head: true })
    .eq('sokh_id', sokhId)
    .eq('council', 'board');
  return count || 0;
}

export async function loadPlans(
  sokhId: number,
  opts: { statuses?: PlanStatus[]; planId?: number },
  viewer: Viewer,
): Promise<PlanOut[]> {
  let q = supabaseAdmin
    .from('work_plans')
    .select('id, year, title, intro, status, revision, submitted_at, approved_at, approved_via, approved_note, summary')
    .eq('sokh_id', sokhId)
    .order('year', { ascending: false })
    .limit(20);
  if (opts.planId) q = q.eq('id', opts.planId);
  if (opts.statuses) q = q.in('status', opts.statuses);
  const { data: plans, error } = await q;
  if (error) throw new Error(error.message);
  if (!plans || plans.length === 0) return [];
  const planIds = plans.map((p) => p.id as number);

  const { data: items } = await supabaseAdmin
    .from('work_plan_items')
    .select('id, plan_id, quarter, category, title, description, owner, budget, sort, status, progress, report, actual_cost, reported_at')
    .eq('sokh_id', sokhId)
    .in('plan_id', planIds)
    .order('quarter')
    .order('sort')
    .order('id');
  const itemIds = (items || []).map((i) => i.id as number);

  const [filesRes, ratingsRes, reviewsRes] = await Promise.all([
    itemIds.length
      ? supabaseAdmin.from('work_plan_files').select('id, item_id, path, file_name, mime_type, size_bytes').eq('sokh_id', sokhId).in('item_id', itemIds).order('id')
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    itemIds.length
      ? supabaseAdmin.from('work_plan_ratings').select('item_id, resident_id, member_name, rating, comment').in('item_id', itemIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    viewer.kind === 'resident'
      ? Promise.resolve({ data: [] as Record<string, unknown>[] })
      : supabaseAdmin.from('work_plan_reviews').select('plan_id, revision, resident_id, member_name, decision, comment, created_at').in('plan_id', planIds).order('created_at'),
  ]);

  const files = (filesRes.data || []) as { id: number; item_id: number; path: string; file_name: string; mime_type: string | null; size_bytes: number | null }[];
  const urlByPath = new Map<string, string>();
  if (files.length > 0) {
    const { data: signed } = await supabaseAdmin.storage
      .from(WORK_PLAN_BUCKET)
      .createSignedUrls(files.map((f) => f.path), SIGNED_URL_TTL_SEC);
    for (const s of signed || []) if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl);
  }
  const ratings = (ratingsRes.data || []) as { item_id: number; resident_id: number; member_name: string | null; rating: Rating; comment: string | null }[];
  const reviews = (reviewsRes.data || []) as { plan_id: number; revision: number; resident_id: number; member_name: string | null; decision: Decision; comment: string | null; created_at: string }[];
  const size = viewer.kind === 'resident' ? undefined : await boardSize(sokhId);

  return plans.map((p) => {
    const planItems: ItemOut[] = (items || [])
      .filter((i) => i.plan_id === p.id)
      .map((i) => {
        const r = ratings.filter((x) => x.item_id === i.id);
        const fileOut: FileOut[] = files
          .filter((f) => f.item_id === i.id)
          .map((f) => ({ id: f.id, file_name: f.file_name, mime_type: f.mime_type, size_bytes: f.size_bytes, url: urlByPath.get(f.path) || null }));
        return {
          id: i.id as number,
          quarter: i.quarter as number,
          category: i.category as string,
          title: i.title as string,
          description: (i.description as string | null) || null,
          owner: (i.owner as string | null) || null,
          budget: i.budget == null ? null : Number(i.budget),
          sort: i.sort as number,
          status: i.status as ItemOut['status'],
          progress: Number(i.progress) || 0,
          report: (i.report as string | null) || null,
          actual_cost: i.actual_cost == null ? null : Number(i.actual_cost),
          reported_at: (i.reported_at as string | null) || null,
          files: fileOut,
          ratings: {
            done: r.filter((x) => x.rating === 'done').length,
            partial: r.filter((x) => x.rating === 'partial').length,
            not_done: r.filter((x) => x.rating === 'not_done').length,
          },
          ...(viewer.kind !== 'resident' && {
            rating_list: r.map((x) => ({ member_name: x.member_name, rating: x.rating, comment: x.comment })),
          }),
          ...(viewer.kind === 'council' && {
            my_rating: r.find((x) => x.resident_id === viewer.residentId)?.rating || null,
          }),
        };
      });

    const cur = reviews.filter((x) => x.plan_id === p.id && x.revision === p.revision);
    return {
      id: p.id as number,
      year: p.year as number,
      title: p.title as string,
      intro: (p.intro as string | null) || null,
      status: p.status as PlanStatus,
      revision: p.revision as number,
      submitted_at: (p.submitted_at as string | null) || null,
      approved_at: (p.approved_at as string | null) || null,
      approved_via: (p.approved_via as 'app' | 'meeting' | null) || null,
      approved_note: (p.approved_note as string | null) || null,
      summary: (p.summary as string | null) || null,
      items: planItems,
      ...(viewer.kind !== 'resident' && {
        reviews: cur.map((x) => ({ member_name: x.member_name, decision: x.decision, comment: x.comment, created_at: x.created_at })),
        board_size: size,
      }),
      ...(viewer.kind === 'council' && {
        my_review: cur.find((x) => x.resident_id === viewer.residentId)?.decision || null,
      }),
    };
  });
}

/** Одоогийн хувилбарт ТУЗ-ийн олонх баталсан бол төлөвлөгөөг батлагдсан болгоно. */
export async function approveIfMajority(sokhId: number, planId: number): Promise<boolean> {
  const { data: plan } = await supabaseAdmin
    .from('work_plans').select('id, status, revision').eq('id', planId).eq('sokh_id', sokhId).maybeSingle();
  if (!plan || plan.status !== 'review') return false;

  // Зөвхөн ТУЗ (board) гишүүний «батлах» санал тоологдоно
  const { data: board } = await supabaseAdmin
    .from('board_members').select('resident_id').eq('sokh_id', sokhId).eq('council', 'board');
  const boardIds = new Set((board || []).map((b) => b.resident_id as number).filter(Boolean));
  const { data: revs } = await supabaseAdmin
    .from('work_plan_reviews').select('resident_id, decision').eq('plan_id', planId).eq('revision', plan.revision);
  const approvals = (revs || []).filter((r) => r.decision === 'approve' && boardIds.has(r.resident_id as number)).length;
  if (!isMajorityApproved(approvals, (board || []).length)) return false;

  const { error } = await supabaseAdmin
    .from('work_plans')
    .update({ status: 'approved', approved_at: new Date().toISOString(), approved_via: 'app', updated_at: new Date().toISOString() })
    .eq('id', planId).eq('sokh_id', sokhId).eq('status', 'review');
  return !error;
}
