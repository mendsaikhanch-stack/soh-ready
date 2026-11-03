import { supabaseAdmin } from '@/app/lib/supabase-admin';

// Зөвлөлийн тайлангийн хуваалцсан тогтмол, туслах функцууд (зөвхөн сервер).

export const BOARD_REPORTS_BUCKET = 'board-reports';
export const MAX_REPORT_FILES = 15;
export const MAX_REPORT_FILE_BYTES = 20 * 1024 * 1024; // bucket-ийн хязгаартай ижил
export const SIGNED_URL_TTL_SEC = 60 * 60; // 1 цаг

// Зураг + PDF + Excel/Word (санхүүгийн баримт)
export const ALLOWED_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
};

export interface ReportFileOut {
  id: number;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  url: string | null;
}

export interface ReportOut {
  id: number;
  title: string;
  body: string | null;
  created_at: string;
  files: ReportFileOut[];
}

/** СӨХ-ийн тайлангуудыг хавсралтын signed URL-тэй нь буцаана. */
export async function listReportsWithFiles(sokhId: number, limit = 50): Promise<ReportOut[]> {
  const { data: reports } = await supabaseAdmin
    .from('board_reports')
    .select('id, title, body, created_at')
    .eq('sokh_id', sokhId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (!reports || reports.length === 0) return [];

  const { data: files } = await supabaseAdmin
    .from('board_report_files')
    .select('id, report_id, path, file_name, mime_type, size_bytes')
    .eq('sokh_id', sokhId)
    .in('report_id', reports.map((r) => r.id));

  const paths = (files || []).map((f) => f.path as string);
  const urlByPath = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await supabaseAdmin.storage
      .from(BOARD_REPORTS_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL_SEC);
    for (const s of signed || []) {
      if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl);
    }
  }

  return reports.map((r) => ({
    id: r.id as number,
    title: r.title as string,
    body: (r.body as string | null) || null,
    created_at: r.created_at as string,
    files: (files || [])
      .filter((f) => f.report_id === r.id)
      .map((f) => ({
        id: f.id as number,
        file_name: f.file_name as string,
        mime_type: (f.mime_type as string | null) || null,
        size_bytes: (f.size_bytes as number | null) ?? null,
        url: urlByPath.get(f.path as string) || null,
      })),
  }));
}
