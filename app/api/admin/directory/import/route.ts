import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { checkAnyAuth } from '@/app/lib/session-token';
import { directoryImportLimiter } from '@/app/lib/rate-limit';
import { parseWorkbookBuffer, parseCsvText } from '@/app/lib/import/parse-xlsx';
import { buildDirectoryPreview } from '@/app/lib/import/build-directory-preview';
import { normalizeSohName } from '@/app/lib/directory/normalize';

// xlsx/csv файл хүлээн авч preview job үүсгэнэ.
// Бодит бичилт ХИЙХГҮЙ — ердөө preview мөрүүдийг хадгална.
export async function POST(req: NextRequest) {
  const auth = await checkAnyAuth('admin', 'superadmin');
  if (!auth.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  const rl = directoryImportLimiter.check(ip);
  if (!rl.allowed) {
    return NextResponse.json({ error: `${rl.retryAfterSec}с хүлээнэ үү` }, { status: 429 });
  }

  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Файл олдсонгүй' }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Файл хэт том (5MB-аас бага)' }, { status: 400 });
    }

    const lower = file.name.toLowerCase();
    let sheets;
    if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
      const text = await file.text();
      const sheet = parseCsvText(text);
      sheets = sheet ? [sheet] : [];
    } else {
      const buffer = await file.arrayBuffer();
      sheets = parseWorkbookBuffer(buffer);
    }

    if (sheets.length === 0) {
      return NextResponse.json({ error: 'Файлаас өгөгдөл уншиж чадсангүй' }, { status: 400 });
    }

    // Эхний sheet-ийг ашиглана. Бусад sheet-ийг warning-аар бүртгэнэ.
    const primary = sheets[0];

    // Job үүсгэх
    const { data: jobRow, error: jobError } = await supabaseAdmin
      .from('directory_import_jobs')
      .insert({
        file_name: file.name,
        source_type: 'manual',
        status: 'PENDING',
        total_rows: primary.rows.length,
      })
      .select('id')
      .single();

    if (jobError || !jobRow) {
      console.error('[directory/import] job insert error:', jobError?.message);
      return NextResponse.json({ error: 'Импорт ажил үүсгэж чадсангүй' }, { status: 500 });
    }

    const jobId = jobRow.id as number;

    // Preview мөрүүдийг бэлдэх
    const preview = await buildDirectoryPreview(primary);

    // Preview мөрүүдийг хадгалах (batch insert)
    const insertRows = preview.rows.map((r) => ({
      import_job_id: jobId,
      row_number: r.rowNumber,
      raw_json: r.raw,
      mapped_json: r.mapped
        ? {
            ...r.mapped,
            normalized_name: normalizeSohName(r.mapped.officialName),
          }
        : null,
      status: r.status,
      match_score: r.matchScore ?? null,
      suggested_directory_id: r.suggestedDirectoryId ?? null,
      error_message: r.errorMessage ?? null,
    }));

    if (insertRows.length > 0) {
      // 500 мөр тутамд хувааж insert хийнэ
      const CHUNK = 500;
      for (let i = 0; i < insertRows.length; i += CHUNK) {
        const chunk = insertRows.slice(i, i + CHUNK);
        const { error } = await supabaseAdmin.from('directory_import_rows').insert(chunk);
        if (error) {
          console.error('[directory/import] rows insert error:', error.message);
          await supabaseAdmin
            .from('directory_import_jobs')
            .update({ status: 'FAILED', summary_json: { error: error.message } })
            .eq('id', jobId);
          return NextResponse.json({ error: 'Мөрүүдийг хадгалахад алдаа гарлаа' }, { status: 500 });
        }
      }
    }

    await supabaseAdmin
      .from('directory_import_jobs')
      .update({
        status: 'REVIEW',
        total_rows: preview.summary.total,
        imported_rows: 0,
        skipped_rows: 0,
        duplicate_rows: preview.summary.duplicateCount,
        error_rows: preview.summary.errorCount,
        summary_json: {
          new: preview.summary.newCount,
          matched: preview.summary.matchedCount,
          duplicate: preview.summary.duplicateCount,
          error: preview.summary.errorCount,
          extra_sheets: sheets.slice(1).map((s) => s.sheetName),
        },
      })
      .eq('id', jobId);

    return NextResponse.json({ jobId, summary: preview.summary });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    console.error('[directory/import] unexpected:', msg);
    return NextResponse.json({ error: 'Серверийн алдаа' }, { status: 500 });
  }
}
