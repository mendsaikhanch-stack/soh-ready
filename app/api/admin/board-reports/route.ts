import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { checkAnyAuth } from '@/app/lib/session-token';
import { boardReportAdminLimiter } from '@/app/lib/rate-limit';
import { DEMO_READONLY_MESSAGE } from '@/app/lib/demo-admin';
import {
  ALLOWED_EXT,
  BOARD_REPORTS_BUCKET,
  MAX_REPORT_FILES,
  MAX_REPORT_FILE_BYTES,
  listReportsWithFiles,
} from '@/app/lib/board-reports';

// /api/admin/board-reports — дарга ТУЗ / Хяналтын зөвлөлд тайлан илгээх.
// Файл Vercel-ээр дамжихгүй (4.5MB body хязгаар): сервер signed upload URL
// олгож, клиент шууд private bucket руу хуулна. Дараа нь 'create'-ээр
// зөвхөн өөрийн СӨХ-ийн хавтас дахь path-уудыг бүртгэнэ.

async function auth(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rl = boardReportAdminLimiter.check(ip);
  if (!rl.allowed) {
    return { error: NextResponse.json({ error: `Хэт олон хүсэлт. ${rl.retryAfterSec}с хүлээнэ үү` }, { status: 429 }) };
  }
  const a = await checkAnyAuth('admin', 'superadmin');
  if (!a.valid) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const sokhId = a.sokhId ? parseInt(a.sokhId, 10) : 0;
  if (!sokhId) return { error: NextResponse.json({ error: 'Session-д СӨХ тодорхойгүй' }, { status: 403 }) };
  return { sokhId, role: a.role, userId: a.userId, demo: !!a.demo };
}

function extOf(name: string): string {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : '';
}

export async function GET(req: NextRequest) {
  const a = await auth(req);
  if ('error' in a) return a.error;
  const reports = await listReportsWithFiles(a.sokhId);

  // Гишүүн бүр уншсан эсэхийг харуулахын тулд уншилтын тоо
  const ids = reports.map((r) => r.id);
  const readCount = new Map<number, number>();
  if (ids.length > 0) {
    const { data: reads } = await supabaseAdmin.from('board_report_reads').select('report_id').in('report_id', ids);
    for (const r of reads || []) readCount.set(r.report_id as number, (readCount.get(r.report_id as number) || 0) + 1);
  }
  return NextResponse.json({ reports: reports.map((r) => ({ ...r, read_count: readCount.get(r.id) || 0 })) });
}

export async function POST(req: NextRequest) {
  const a = await auth(req);
  if ('error' in a) return a.error;
  if (a.demo) return NextResponse.json({ error: DEMO_READONLY_MESSAGE }, { status: 403 });

  try {
    const body = await req.json();

    // ---- 1. Upload URL олгох ----
    if (body.action === 'sign_upload') {
      const files = Array.isArray(body.files) ? (body.files as { name?: string; size?: number }[]) : [];
      if (files.length === 0) return NextResponse.json({ error: 'Файл алга' }, { status: 400 });
      if (files.length > MAX_REPORT_FILES) {
        return NextResponse.json({ error: `Хамгийн ихдээ ${MAX_REPORT_FILES} файл` }, { status: 400 });
      }
      const out: { path: string; token: string }[] = [];
      for (const f of files) {
        const ext = extOf(String(f.name || ''));
        if (!ALLOWED_EXT[ext]) {
          return NextResponse.json({ error: `«${f.name}» төрөл зөвшөөрөгдөхгүй (зураг, PDF, Excel, Word)` }, { status: 400 });
        }
        if (Number(f.size) > MAX_REPORT_FILE_BYTES) {
          return NextResponse.json({ error: `«${f.name}» 20MB-аас их байна` }, { status: 400 });
        }
        const path = `${a.sokhId}/${randomUUID()}.${ext}`;
        const { data, error } = await supabaseAdmin.storage.from(BOARD_REPORTS_BUCKET).createSignedUploadUrl(path);
        if (error || !data) {
          console.error('[board-reports] sign_upload', error?.message);
          return NextResponse.json({ error: 'Файл хадгалах сан бэлэн биш байна (миграц ажиллуулсан эсэхийг шалгана уу)' }, { status: 500 });
        }
        out.push({ path, token: data.token });
      }
      return NextResponse.json({ uploads: out });
    }

    // ---- 2. Тайлан бүртгэх ----
    if (body.action === 'create') {
      const title = String(body.title || '').trim();
      const text = String(body.body || '').trim();
      if (title.length < 3) return NextResponse.json({ error: 'Гарчиг доод тал нь 3 тэмдэгт' }, { status: 400 });

      const files = (Array.isArray(body.files) ? body.files : []) as {
        path?: string; file_name?: string; size_bytes?: number;
      }[];
      if (files.length > MAX_REPORT_FILES) {
        return NextResponse.json({ error: `Хамгийн ихдээ ${MAX_REPORT_FILES} файл` }, { status: 400 });
      }
      const prefix = `${a.sokhId}/`;
      const pathRe = /^\d+\/[0-9a-f-]{36}\.[a-z0-9]+$/;
      for (const f of files) {
        const p = String(f.path || '');
        if (!p.startsWith(prefix) || !pathRe.test(p)) {
          return NextResponse.json({ error: 'Файлын зам буруу' }, { status: 403 });
        }
      }

      const { data: report, error: rErr } = await supabaseAdmin
        .from('board_reports')
        .insert({ sokh_id: a.sokhId, title, body: text || null, created_by: `${a.role}:${a.userId || '0'}` })
        .select('id')
        .single();
      if (rErr || !report) {
        console.error('[board-reports] create', rErr?.message);
        return NextResponse.json({ error: 'Тайлан хадгалахад алдаа (миграц ажиллуулсан эсэхийг шалгана уу)' }, { status: 500 });
      }

      if (files.length > 0) {
        const { error: fErr } = await supabaseAdmin.from('board_report_files').insert(
          files.map((f) => {
            const ext = extOf(String(f.path));
            return {
              report_id: report.id,
              sokh_id: a.sokhId,
              path: String(f.path),
              file_name: String(f.file_name || `файл.${ext}`).slice(0, 200),
              mime_type: ALLOWED_EXT[ext] || null,
              size_bytes: Number(f.size_bytes) || null,
            };
          }),
        );
        if (fErr) {
          console.error('[board-reports] files', fErr.message);
          await supabaseAdmin.from('board_reports').delete().eq('id', report.id);
          return NextResponse.json({ error: 'Хавсралт бүртгэхэд алдаа' }, { status: 500 });
        }
      }

      return NextResponse.json({ id: report.id });
    }

    return NextResponse.json({ error: 'action буруу' }, { status: 400 });
  } catch (err) {
    console.error('[board-reports] unexpected', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Серверийн алдаа' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const a = await auth(req);
  if ('error' in a) return a.error;
  if (a.demo) return NextResponse.json({ error: DEMO_READONLY_MESSAGE }, { status: 403 });

  const id = parseInt(req.nextUrl.searchParams.get('id') || '', 10);
  if (!id) return NextResponse.json({ error: 'id шаардлагатай' }, { status: 400 });

  const { data: report } = await supabaseAdmin
    .from('board_reports').select('id').eq('id', id).eq('sokh_id', a.sokhId).maybeSingle();
  if (!report) return NextResponse.json({ error: 'Тайлан олдсонгүй' }, { status: 404 });

  const { data: files } = await supabaseAdmin.from('board_report_files').select('path').eq('report_id', id);
  const paths = (files || []).map((f) => f.path as string);
  if (paths.length > 0) await supabaseAdmin.storage.from(BOARD_REPORTS_BUCKET).remove(paths);
  await supabaseAdmin.from('board_reports').delete().eq('id', id);
  return NextResponse.json({ ok: true });
}
