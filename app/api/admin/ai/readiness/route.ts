import { NextRequest, NextResponse } from 'next/server';
import { checkAnyAuth } from '@/app/lib/session-token';
import { gatherReadiness } from '@/app/lib/ai/data-readiness';

// ============================================================
// GET /api/admin/ai/readiness
// ------------------------------------------------------------
// Admin-ийн СӨХ-ийн AI-д ашиглагдах хүснэгтүүдийн төлөв.
// AI provider дуудахгүй, зөвхөн count() query.
// Superadmin нь ?sokh_id=... query param-р тодорхой СӨХ сонгож болно.
// ============================================================

export async function GET(req: NextRequest) {
  const auth = await checkAnyAuth('admin', 'superadmin');
  if (!auth.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const sokhParam = url.searchParams.get('sokh_id');
  const fromQuery = sokhParam ? parseInt(sokhParam, 10) : NaN;

  let sokhId: number;
  if (auth.role === 'superadmin' && Number.isFinite(fromQuery) && fromQuery > 0) {
    sokhId = fromQuery;
  } else {
    const fromSession = auth.sokhId ? parseInt(auth.sokhId, 10) : NaN;
    if (!Number.isFinite(fromSession) || fromSession <= 0) {
      return NextResponse.json(
        { error: 'Session-д sokh_id байхгүй' },
        { status: 400 },
      );
    }
    sokhId = fromSession;
  }

  const snapshot = await gatherReadiness(sokhId);
  return NextResponse.json(snapshot);
}
