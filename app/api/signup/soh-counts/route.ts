import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';

interface Row {
  khoroos?: { name: string | null; districts?: { name: string | null } | null } | null;
}

// Дүүрэг + хороо тус бүрд бүртгэлтэй СӨХ-н тоог буцаах олон нийтийн endpoint.
// Зарим дүүрэгт 300+ СӨХ-той учир /find-hoa-д сонголтын badge болгож харуулна.
export async function GET() {
  let all: Row[] = [];
  for (let from = 0; from < 5000; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from('sokh_organizations')
      .select('khoroos(name, districts(name))')
      .range(from, from + 999);
    if (error) {
      console.error('[soh-counts] error:', error.message);
      return NextResponse.json({ byDistrict: {}, byKhoroo: {} });
    }
    if (!data || data.length === 0) break;
    all = all.concat(data as unknown as Row[]);
    if (data.length < 1000) break;
  }

  const byDistrict: Record<string, number> = {};
  const byKhoroo: Record<string, Record<string, number>> = {};
  for (const r of all) {
    const d = r.khoroos?.districts?.name;
    const k = r.khoroos?.name;
    if (!d) continue;
    byDistrict[d] = (byDistrict[d] || 0) + 1;
    if (k) {
      byKhoroo[d] = byKhoroo[d] || {};
      byKhoroo[d][k] = (byKhoroo[d][k] || 0) + 1;
    }
  }

  return NextResponse.json({ byDistrict, byKhoroo, total: all.length });
}
