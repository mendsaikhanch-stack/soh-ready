import { NextRequest, NextResponse } from 'next/server';
import { searchHoaDirectory } from '@/app/lib/directory/search';
import { directorySearchLimiter } from '@/app/lib/rate-limit';

// Олон нийтийн хайлтын endpoint
// Бүртгэл хэсэгт тухайн хэрэглэгч өөрийн СӨХ-ийг хайхад зориулагдсан.
export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  const rl = directorySearchLimiter.check(ip);
  if (!rl.allowed) return NextResponse.json({ error: `${rl.retryAfterSec}с хүлээнэ үү` }, { status: 429 });

  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').slice(0, 200);
  const district = url.searchParams.get('district');
  const khoroo = url.searchParams.get('khoroo');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '15', 10) || 15, 30);

  if (!q && !district && !khoroo) {
    return NextResponse.json({ results: [] });
  }

  const results = await searchHoaDirectory({
    query: q,
    district,
    khoroo,
    limit,
    includeHidden: false,
  });

  // Олон нийтэд илрүүлэх талбар хязгаарлах
  const filtered = results.map((r) => ({
    id: r.id,
    official_name: r.official_name,
    display_name: r.display_name,
    district: r.district,
    khoroo: r.khoroo,
    address: r.address,
    score: r.score,
    is_active_tenant: r.is_active_tenant,
    linked_tenant_id: r.linked_tenant_id,
    matched_alias: r.matched_alias,
  }));

  return NextResponse.json({ results: filtered });
}
