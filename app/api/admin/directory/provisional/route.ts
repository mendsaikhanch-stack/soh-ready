import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { checkAnyAuth } from '@/app/lib/session-token';
import { suggestProvisionalMatch, type ProvisionalRow } from '@/app/lib/directory/merge-provisional';

// Provisional СӨХ-ийн жагсаалт + suggested матч-уудыг буцаана
export async function GET(req: NextRequest) {
  const auth = await checkAnyAuth('admin', 'superadmin');
  if (!auth.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const district = url.searchParams.get('district');
  const includeSuggestions = url.searchParams.get('suggest') === '1';

  let q = supabaseAdmin
    .from('hoa_provisional')
    .select('id, entered_name, normalized_name, city, district, khoroo, town_name, building, address, status, matched_directory_id, match_score, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(200);

  if (status) q = q.eq('status', status);
  else q = q.in('status', ['PENDING', 'HAS_DEMAND', 'MATCH_CANDIDATE']);
  if (district) q = q.eq('district', district);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: 'Татаж чадсангүй' }, { status: 500 });

  const rows = (data || []) as ProvisionalRow[];

  // Activation summary-уудыг хавсралтаар татах
  const ids = rows.map((r) => r.id);
  const summaryMap = new Map<number, { interest_count: number; building_count: number; status: string }>();
  if (ids.length > 0) {
    const { data: summaries } = await supabaseAdmin
      .from('hoa_activation_summaries')
      .select('provisional_hoa_id, interest_count, building_count, status')
      .in('provisional_hoa_id', ids);
    for (const s of summaries || []) {
      summaryMap.set(s.provisional_hoa_id as number, {
        interest_count: s.interest_count as number,
        building_count: s.building_count as number,
        status: s.status as string,
      });
    }
  }

  // Suggested матч-уудыг (хүсэлт байвал) тооцоолох
  const enriched = await Promise.all(
    rows.map(async (row) => {
      const summary = summaryMap.get(row.id) || { interest_count: 0, building_count: 0, status: 'INTEREST' };
      let suggestion = null;
      if (includeSuggestions) {
        try {
          const s = await suggestProvisionalMatch(row);
          suggestion = {
            best: s.best
              ? {
                  directory: s.best.directory,
                  score: s.best.score,
                  reasons: s.best.reasons,
                }
              : null,
            action: s.action,
          };
        } catch (e) {
          console.error('[admin/provisional] suggestion error', e);
        }
      }
      return { ...row, summary, suggestion };
    })
  );

  return NextResponse.json({ rows: enriched });
}
