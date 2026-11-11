import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { checkAnyAuth } from '@/app/lib/session-token';
import { workPlanAdminLimiter } from '@/app/lib/rate-limit';
import { DEMO_READONLY_MESSAGE } from '@/app/lib/demo-admin';
import {
  ALLOWED_EXT,
  CATEGORIES,
  ITEM_STATUS,
  MAX_FILE_BYTES,
  MAX_ITEM_FILES,
  WORK_PLAN_BUCKET,
  isWorkPlanEnabled,
} from '@/app/lib/work-plan/shared';
import { approveIfMajority, loadPlans } from '@/app/lib/work-plan/server';

// /api/admin/work-plan — дарга жилийн ажлын төлөвлөгөө гаргах, ТУЗ-д илгээх,
// гүйцэтгэлээ тайлагнах. Туршилтын СӨХ-д л ажиллана (shared.ts → WORK_PLAN_SOKH_IDS).
//
// Төлөв:  draft ──submit──▶ review ──(ТУЗ олонх / approve_manual)──▶ approved ──archive──▶ archived
//            ▲                 │                                         │
//            └──── reopen ─────┴─────────────────────────────────────────┘
// Ажлын бүтэц (гарчиг, улирал, төсөв...) зөвхөн draft үед засагдана.
// Гүйцэтгэлийн тайлан (report_item, файл) зөвхөн approved үед.

async function auth(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rl = workPlanAdminLimiter.check(ip);
  if (!rl.allowed) {
    return { error: NextResponse.json({ error: `Хэт олон хүсэлт. ${rl.retryAfterSec}с хүлээнэ үү` }, { status: 429 }) };
  }
  const a = await checkAnyAuth('admin', 'superadmin');
  if (!a.valid) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const sokhId = a.sokhId ? parseInt(a.sokhId, 10) : 0;
  if (!sokhId) return { error: NextResponse.json({ error: 'Session-д СӨХ тодорхойгүй' }, { status: 403 }) };
  if (a.role !== 'superadmin' && !isWorkPlanEnabled(sokhId)) {
    return { error: NextResponse.json({ error: 'Энэ СӨХ-д ажлын төлөвлөгөө идэвхжээгүй' }, { status: 403 }) };
  }
  return { sokhId, role: a.role, userId: a.userId, demo: !!a.demo };
}

const extOf = (name: string) => name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || '';
const txt = (v: unknown, max = 4000) => {
  const s = String(v ?? '').trim();
  return s ? s.slice(0, max) : null;
};
const money = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[\s,₮]/g, ''));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN;
};
const bad = (msg: string, status = 400) => NextResponse.json({ error: msg }, { status });
const now = () => new Date().toISOString();

async function getPlan(sokhId: number, id: number) {
  const { data } = await supabaseAdmin
    .from('work_plans').select('id, status, revision').eq('id', id).eq('sokh_id', sokhId).maybeSingle();
  return data as { id: number; status: string; revision: number } | null;
}

async function getItem(sokhId: number, id: number) {
  const { data } = await supabaseAdmin
    .from('work_plan_items').select('id, plan_id').eq('id', id).eq('sokh_id', sokhId).maybeSingle();
  if (!data) return null;
  const plan = await getPlan(sokhId, data.plan_id as number);
  return plan ? { id: data.id as number, plan } : null;
}

// Ажлын талбаруудыг шалгаж мөр болгоно (add_item / update_item)
function itemFields(b: Record<string, unknown>): Record<string, unknown> | string {
  const title = txt(b.title, 300);
  if (!title || title.length < 2) return 'Ажлын нэр оруулна уу';
  const quarter = Number(b.quarter);
  if (![1, 2, 3, 4].includes(quarter)) return 'Улирал буруу';
  const category = String(b.category || 'other');
  if (!CATEGORIES[category]) return 'Ангилал буруу';
  const budget = money(b.budget);
  if (Number.isNaN(budget)) return 'Төсөв буруу';
  return { title, quarter, category, description: txt(b.description), owner: txt(b.owner, 200), budget };
}

export async function GET(req: NextRequest) {
  const a = await auth(req);
  if ('error' in a) return a.error;
  try {
    const id = parseInt(req.nextUrl.searchParams.get('id') || '', 10);
    const plans = await loadPlans(a.sokhId, id ? { planId: id } : {}, { kind: 'admin' });
    if (id) {
      if (!plans[0]) return bad('Төлөвлөгөө олдсонгүй', 404);
      return NextResponse.json({ plan: plans[0] });
    }
    return NextResponse.json({ plans });
  } catch (err) {
    console.error('[work-plan] admin GET', err instanceof Error ? err.message : err);
    return bad('Ачаалж чадсангүй (миграц ажиллуулсан эсэхийг шалгана уу)', 500);
  }
}

export async function POST(req: NextRequest) {
  const a = await auth(req);
  if ('error' in a) return a.error;
  if (a.demo) return bad(DEMO_READONLY_MESSAGE, 403);

  try {
    const b = (await req.json()) as Record<string, unknown>;
    const planId = parseInt(String(b.planId ?? ''), 10) || 0;
    const itemId = parseInt(String(b.itemId ?? ''), 10) || 0;

    switch (b.action) {
      // ---------- Төлөвлөгөө ----------
      case 'create_plan': {
        const year = Number(b.year);
        if (!Number.isInteger(year) || year < 2020 || year > 2100) return bad('Он буруу');
        const title = txt(b.title, 300) || `${year} оны ажлын төлөвлөгөө`;
        const { data, error } = await supabaseAdmin
          .from('work_plans')
          .insert({ sokh_id: a.sokhId, year, title, intro: txt(b.intro), created_by: `${a.role}:${a.userId || '0'}` })
          .select('id').single();
        if (error) {
          if (error.code === '23505') return bad(`${year} оны төлөвлөгөө аль хэдийн байна`, 409);
          console.error('[work-plan] create_plan', error.message);
          return bad('Хадгалахад алдаа (миграц ажиллуулсан эсэхийг шалгана уу)', 500);
        }
        return NextResponse.json({ id: data.id });
      }

      case 'update_plan': {
        const plan = await getPlan(a.sokhId, planId);
        if (!plan) return bad('Төлөвлөгөө олдсонгүй', 404);
        const patch: Record<string, unknown> = { updated_at: now() };
        // Жилийн дүгнэлтийг хэзээ ч бичиж болно; гарчиг, танилцуулгыг зөвхөн ноорог үед
        if ('summary' in b) patch.summary = txt(b.summary, 8000);
        if ('title' in b || 'intro' in b) {
          if (plan.status !== 'draft') return bad('Гарчиг, танилцуулгыг зөвхөн ноорог үед засна');
          const title = txt(b.title, 300);
          if (!title) return bad('Гарчиг оруулна уу');
          patch.title = title;
          patch.intro = txt(b.intro);
        }
        await supabaseAdmin.from('work_plans').update(patch).eq('id', plan.id).eq('sokh_id', a.sokhId);
        return NextResponse.json({ ok: true });
      }

      case 'delete_plan': {
        const plan = await getPlan(a.sokhId, planId);
        if (!plan) return bad('Төлөвлөгөө олдсонгүй', 404);
        if (plan.status !== 'draft' || plan.revision > 0) return bad('Зөвхөн ТУЗ-д илгээж байгаагүй ноорог устгана');
        await supabaseAdmin.from('work_plans').delete().eq('id', plan.id).eq('sokh_id', a.sokhId);
        return NextResponse.json({ ok: true });
      }

      case 'submit': {
        const plan = await getPlan(a.sokhId, planId);
        if (!plan) return bad('Төлөвлөгөө олдсонгүй', 404);
        if (plan.status !== 'draft') return bad('Зөвхөн ноорог илгээнэ');
        const { count } = await supabaseAdmin
          .from('work_plan_items').select('id', { count: 'exact', head: true }).eq('plan_id', plan.id);
        if (!count) return bad('Төлөвлөгөөнд ажил нэмнэ үү');
        await supabaseAdmin.from('work_plans')
          .update({ status: 'review', revision: plan.revision + 1, submitted_at: now(), updated_at: now() })
          .eq('id', plan.id).eq('sokh_id', a.sokhId).eq('status', 'draft');
        return NextResponse.json({ ok: true });
      }

      case 'reopen': {
        const plan = await getPlan(a.sokhId, planId);
        if (!plan) return bad('Төлөвлөгөө олдсонгүй', 404);
        if (plan.status === 'draft') return NextResponse.json({ ok: true });
        // Батлагдсан төлөвлөгөөг засварлахад ТУЗ дахин батална (гүйцэтгэлийн тайлан хадгалагдана)
        await supabaseAdmin.from('work_plans')
          .update({ status: 'draft', approved_at: null, approved_via: null, approved_note: null, updated_at: now() })
          .eq('id', plan.id).eq('sokh_id', a.sokhId);
        return NextResponse.json({ ok: true });
      }

      case 'approve_manual': {
        const plan = await getPlan(a.sokhId, planId);
        if (!plan) return bad('Төлөвлөгөө олдсонгүй', 404);
        if (plan.status !== 'review') return bad('Эхлээд ТУЗ-д илгээнэ үү');
        const note = txt(b.note, 1000);
        if (!note || note.length < 5) return bad('ТУЗ-ийн хурлын огноо, шийдвэрийн дугаарыг бичнэ үү');
        await supabaseAdmin.from('work_plans')
          .update({ status: 'approved', approved_at: now(), approved_via: 'meeting', approved_note: note, updated_at: now() })
          .eq('id', plan.id).eq('sokh_id', a.sokhId).eq('status', 'review');
        return NextResponse.json({ ok: true });
      }

      case 'check_approval': {
        // ТУЗ-ийн гишүүдийн жагсаалт өөрчлөгдсөний дараа олонхыг дахин тооцох
        const approved = await approveIfMajority(a.sokhId, planId);
        return NextResponse.json({ approved });
      }

      case 'archive': {
        const plan = await getPlan(a.sokhId, planId);
        if (!plan) return bad('Төлөвлөгөө олдсонгүй', 404);
        if (plan.status !== 'approved') return bad('Зөвхөн батлагдсан төлөвлөгөөг хаана');
        await supabaseAdmin.from('work_plans').update({ status: 'archived', updated_at: now() }).eq('id', plan.id).eq('sokh_id', a.sokhId);
        return NextResponse.json({ ok: true });
      }

      // ---------- Ажил ----------
      case 'add_item': {
        const plan = await getPlan(a.sokhId, planId);
        if (!plan) return bad('Төлөвлөгөө олдсонгүй', 404);
        if (plan.status !== 'draft') return bad('Ажлыг зөвхөн ноорог үед нэмнэ («Засварлах» дарна уу)');
        const f = itemFields(b);
        if (typeof f === 'string') return bad(f);
        const { count } = await supabaseAdmin
          .from('work_plan_items').select('id', { count: 'exact', head: true }).eq('plan_id', plan.id);
        if ((count || 0) >= 200) return bad('Хамгийн ихдээ 200 ажил');
        const { data, error } = await supabaseAdmin
          .from('work_plan_items').insert({ ...f, plan_id: plan.id, sokh_id: a.sokhId, sort: count || 0 }).select('id').single();
        if (error) { console.error('[work-plan] add_item', error.message); return bad('Хадгалахад алдаа', 500); }
        return NextResponse.json({ id: data.id });
      }

      case 'update_item': {
        const it = await getItem(a.sokhId, itemId);
        if (!it) return bad('Ажил олдсонгүй', 404);
        if (it.plan.status !== 'draft') return bad('Ажлыг зөвхөн ноорог үед засна («Засварлах» дарна уу)');
        const f = itemFields(b);
        if (typeof f === 'string') return bad(f);
        await supabaseAdmin.from('work_plan_items').update({ ...f, updated_at: now() }).eq('id', it.id).eq('sokh_id', a.sokhId);
        return NextResponse.json({ ok: true });
      }

      case 'delete_item': {
        const it = await getItem(a.sokhId, itemId);
        if (!it) return bad('Ажил олдсонгүй', 404);
        if (it.plan.status !== 'draft') return bad('Ажлыг зөвхөн ноорог үед устгана');
        const { data: fs } = await supabaseAdmin.from('work_plan_files').select('path').eq('item_id', it.id);
        const paths = (fs || []).map((x) => x.path as string);
        if (paths.length) await supabaseAdmin.storage.from(WORK_PLAN_BUCKET).remove(paths);
        await supabaseAdmin.from('work_plan_items').delete().eq('id', it.id).eq('sokh_id', a.sokhId);
        return NextResponse.json({ ok: true });
      }

      case 'report_item': {
        const it = await getItem(a.sokhId, itemId);
        if (!it) return bad('Ажил олдсонгүй', 404);
        if (it.plan.status !== 'approved') return bad('Гүйцэтгэлийг батлагдсан төлөвлөгөөнд л тайлагнана');
        const status = String(b.status || '');
        if (!(status in ITEM_STATUS)) return bad('Төлөв буруу');
        const progress = Math.round(Number(b.progress));
        if (!Number.isFinite(progress) || progress < 0 || progress > 100) return bad('Гүйцэтгэлийн хувь 0–100');
        const actual = money(b.actual_cost);
        if (Number.isNaN(actual)) return bad('Бодит зардал буруу');
        await supabaseAdmin.from('work_plan_items').update({
          status,
          progress: status === 'done' ? 100 : progress,
          report: txt(b.report, 8000),
          actual_cost: actual,
          reported_at: now(),
          updated_at: now(),
        }).eq('id', it.id).eq('sokh_id', a.sokhId);
        return NextResponse.json({ ok: true });
      }

      // ---------- Файл ----------
      case 'sign_upload': {
        const files = Array.isArray(b.files) ? (b.files as { name?: string; size?: number }[]) : [];
        if (files.length === 0) return bad('Файл алга');
        if (files.length > MAX_ITEM_FILES) return bad(`Хамгийн ихдээ ${MAX_ITEM_FILES} файл`);
        const out: { path: string; token: string }[] = [];
        for (const f of files) {
          const ext = extOf(String(f.name || ''));
          if (!ALLOWED_EXT[ext]) return bad(`«${f.name}» төрөл зөвшөөрөгдөхгүй (зураг, PDF, Excel, Word)`);
          if (Number(f.size) > MAX_FILE_BYTES) return bad(`«${f.name}» 20MB-аас их байна`);
          const path = `${a.sokhId}/${randomUUID()}.${ext}`;
          const { data, error } = await supabaseAdmin.storage.from(WORK_PLAN_BUCKET).createSignedUploadUrl(path);
          if (error || !data) {
            console.error('[work-plan] sign_upload', error?.message);
            return bad('Файл хадгалах сан бэлэн биш байна (миграц ажиллуулсан эсэхийг шалгана уу)', 500);
          }
          out.push({ path, token: data.token });
        }
        return NextResponse.json({ uploads: out });
      }

      case 'attach_files': {
        const it = await getItem(a.sokhId, itemId);
        if (!it) return bad('Ажил олдсонгүй', 404);
        if (it.plan.status !== 'approved') return bad('Баримтыг батлагдсан төлөвлөгөөнд л хавсаргана');
        const files = (Array.isArray(b.files) ? b.files : []) as { path?: string; file_name?: string; size_bytes?: number }[];
        if (files.length === 0) return NextResponse.json({ ok: true });
        const { count } = await supabaseAdmin
          .from('work_plan_files').select('id', { count: 'exact', head: true }).eq('item_id', it.id);
        if ((count || 0) + files.length > MAX_ITEM_FILES) return bad(`Нэг ажилд хамгийн ихдээ ${MAX_ITEM_FILES} файл`);
        const prefix = `${a.sokhId}/`;
        const pathRe = /^\d+\/[0-9a-f-]{36}\.[a-z0-9]+$/;
        for (const f of files) {
          const p = String(f.path || '');
          if (!p.startsWith(prefix) || !pathRe.test(p)) return bad('Файлын зам буруу', 403);
        }
        const { error } = await supabaseAdmin.from('work_plan_files').insert(files.map((f) => {
          const ext = extOf(String(f.path));
          return {
            item_id: it.id,
            sokh_id: a.sokhId,
            path: String(f.path),
            file_name: String(f.file_name || `файл.${ext}`).slice(0, 200),
            mime_type: ALLOWED_EXT[ext] || null,
            size_bytes: Number(f.size_bytes) || null,
          };
        }));
        if (error) { console.error('[work-plan] attach_files', error.message); return bad('Хавсралт бүртгэхэд алдаа', 500); }
        return NextResponse.json({ ok: true });
      }

      case 'delete_file': {
        const fileId = parseInt(String(b.fileId ?? ''), 10) || 0;
        const { data: f } = await supabaseAdmin
          .from('work_plan_files').select('id, path').eq('id', fileId).eq('sokh_id', a.sokhId).maybeSingle();
        if (!f) return bad('Файл олдсонгүй', 404);
        await supabaseAdmin.storage.from(WORK_PLAN_BUCKET).remove([f.path as string]);
        await supabaseAdmin.from('work_plan_files').delete().eq('id', f.id).eq('sokh_id', a.sokhId);
        return NextResponse.json({ ok: true });
      }

      default:
        return bad('action буруу');
    }
  } catch (err) {
    console.error('[work-plan] admin POST', err instanceof Error ? err.message : err);
    return bad('Серверийн алдаа', 500);
  }
}
