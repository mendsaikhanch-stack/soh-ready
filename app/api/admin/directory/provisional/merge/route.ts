import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { checkAnyAuth } from '@/app/lib/session-token';
import { mergeProvisionalIntoDirectory, autoMergeProvisionals } from '@/app/lib/directory/merge-provisional';

interface MergeBody {
  // Нэг бүтэн merge: provisional → directory
  provisionalId?: number;
  directoryId?: number;
  reason?: string;
  // Эсвэл бүх боломжит merge-ийг автоматаар running
  auto?: boolean;
}

// POST: provisional СӨХ-ийг directory мөртэй нэгтгэх (manual эсвэл auto)
export async function POST(req: NextRequest) {
  const auth = await checkAnyAuth('admin', 'superadmin');
  if (!auth.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body: MergeBody = await req.json();
    const mergedBy = `${auth.role || 'admin'}:${auth.userId || ''}`;

    if (body.auto) {
      const report = await autoMergeProvisionals({ mergedBy });
      return NextResponse.json({ ok: true, auto: report });
    }

    if (!body.provisionalId || !body.directoryId) {
      return NextResponse.json({ error: 'provisionalId болон directoryId шаардлагатай' }, { status: 400 });
    }

    const result = await mergeProvisionalIntoDirectory({
      provisionalId: body.provisionalId,
      directoryId: body.directoryId,
      reason: body.reason || 'manual',
      mergedBy,
    });

    return NextResponse.json({ ok: true, merge: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    console.error('[admin/provisional/merge]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PATCH: provisional-ийг REJECTED болгох (татгалзсан)
export async function PATCH(req: NextRequest) {
  const auth = await checkAnyAuth('admin', 'superadmin');
  if (!auth.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { provisionalId, status } = body as { provisionalId: number; status: 'PENDING' | 'HAS_DEMAND' | 'MATCH_CANDIDATE' | 'REJECTED' };
    if (!provisionalId || !status) return NextResponse.json({ error: 'provisionalId болон status шаардлагатай' }, { status: 400 });
    if (!['PENDING', 'HAS_DEMAND', 'MATCH_CANDIDATE', 'REJECTED'].includes(status)) {
      return NextResponse.json({ error: 'status буруу' }, { status: 400 });
    }
    const { error } = await supabaseAdmin.from('hoa_provisional').update({ status }).eq('id', provisionalId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Серверийн алдаа' }, { status: 500 });
  }
}
