import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { checkAnyAuth } from '@/app/lib/session-token';

// Тодорхой import job-ийн дэлгэрэнгүй мэдээлэл + preview мөрүүд буцаана
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await checkAnyAuth('admin', 'superadmin');
  if (!auth.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const jobId = parseInt(id, 10);
  if (!Number.isFinite(jobId)) return NextResponse.json({ error: 'jobId буруу' }, { status: 400 });

  const { data: job, error: jobError } = await supabaseAdmin
    .from('directory_import_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (jobError || !job) return NextResponse.json({ error: 'Job олдсонгүй' }, { status: 404 });

  const { data: rows } = await supabaseAdmin
    .from('directory_import_rows')
    .select('id, row_number, mapped_json, raw_json, status, match_score, suggested_directory_id, error_message')
    .eq('import_job_id', jobId)
    .order('row_number', { ascending: true });

  // Suggested directory мэдээлэл татах
  const suggestedIds = Array.from(
    new Set((rows || []).map((r) => r.suggested_directory_id).filter(Boolean) as number[])
  );
  let directoryMap = new Map<number, { id: number; official_name: string; district: string | null; khoroo: string | null }>();
  if (suggestedIds.length > 0) {
    const { data: dirs } = await supabaseAdmin
      .from('hoa_directory')
      .select('id, official_name, district, khoroo')
      .in('id', suggestedIds);
    if (dirs) {
      directoryMap = new Map(
        dirs.map((d) => [d.id as number, {
          id: d.id as number,
          official_name: d.official_name as string,
          district: (d.district as string) || null,
          khoroo: (d.khoroo as string) || null,
        }])
      );
    }
  }

  const enrichedRows = (rows || []).map((r) => ({
    ...r,
    suggested_directory: r.suggested_directory_id ? directoryMap.get(r.suggested_directory_id as number) || null : null,
  }));

  return NextResponse.json({ job, rows: enrichedRows });
}
