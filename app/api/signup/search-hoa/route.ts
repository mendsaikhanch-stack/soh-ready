import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { normalizeSohName } from '@/app/lib/directory/normalize';
import { directorySearchLimiter } from '@/app/lib/rate-limit';

interface SokhOrgRow {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  claim_status: string | null;
  khoroos?: { name: string | null; districts?: { name: string | null } | null } | null;
}

// Олон нийтийн хайлтын endpoint
// Бүртгэл хэсэгт тухайн хэрэглэгч өөрийн СӨХ-ийг хайхад зориулагдсан.
// sokh_organizations table-аас шууд хайна — 1000+ бодит СӨХ-ийн бүртгэлтэй.
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

  // sokh_organizations + khoroos→districts join-ээр fetch
  // inner-join (!inner) ашиглавал nested filter ажиллана
  let query = supabaseAdmin
    .from('sokh_organizations')
    .select('id, name, phone, address, claim_status, khoroos!inner(name, districts!inner(name))')
    .limit(Math.min(limit * 4, 500));

  if (q) {
    query = query.ilike('name', `%${q}%`);
  }
  if (khoroo) {
    query = query.eq('khoroos.name', khoroo);
  }
  if (district) {
    query = query.eq('khoroos.districts.name', district);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[search-hoa] sokh_organizations error:', error.message);
    return NextResponse.json({ results: [] });
  }

  const rows = (data || []) as unknown as SokhOrgRow[];
  const normQ = normalizeSohName(q);
  const filtered = rows;

  // Score тооцоолох: нэрийн ойролцоо таарал + claim_status bonus
  const scored = filtered.map(r => {
    const norm = normalizeSohName(r.name);
    let score = 0;
    if (normQ) {
      if (norm === normQ) score = 1.0;
      else if (norm.includes(normQ) || normQ.includes(norm)) score = 0.7;
      else score = 0.3;
    } else {
      score = 0.5;
    }
    if (r.claim_status === 'active') score += 0.1;

    return {
      id: r.id,
      official_name: r.name,
      display_name: null,
      district: r.khoroos?.districts?.name || null,
      khoroo: r.khoroos?.name || null,
      address: r.address,
      score,
      is_active_tenant: r.claim_status === 'active',
      linked_tenant_id: r.id,
      matched_alias: null,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  return NextResponse.json({ results: scored.slice(0, limit) });
}
