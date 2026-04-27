import { NextRequest, NextResponse } from 'next/server';
import { checkAnyAuth } from '@/app/lib/session-token';
import { searchHoaDirectory } from '@/app/lib/directory/search';

export async function GET(req: NextRequest) {
  const auth = await checkAnyAuth('admin', 'superadmin', 'osnaa');
  if (!auth.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const q = url.searchParams.get('q') || '';
  const district = url.searchParams.get('district');
  const khoroo = url.searchParams.get('khoroo');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10) || 20, 50);

  const results = await searchHoaDirectory({
    query: q,
    district,
    khoroo,
    limit,
    includeHidden: true,
  });
  return NextResponse.json({ results });
}
