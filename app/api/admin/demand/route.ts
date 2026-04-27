import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { checkAnyAuth } from '@/app/lib/session-token';

export interface DemandRow {
  kind: 'directory' | 'provisional';
  id: number;
  name: string;
  district: string | null;
  khoroo: string | null;
  city?: string | null;
  interest_count: number;
  building_count: number;
  latest_request_at: string | null;
  status: 'INTEREST' | 'WARM_LEAD' | 'ACTIVATION_READY' | 'ACTIVE';
  is_active_tenant?: boolean;
  matched_directory_id?: number | null;
  match_score?: number | null;
  // Phase 3: pre-auth submission-аас хэдэн нь user account-той холбогдсон
  claimed_count: number;
  unclaimed_count: number;
}

// Activation summary бүрийг харгалзах СӨХ-ийн нэртэй хослуулж буцаана.
// Эрэлтийн dashboard-д ашиглана.
export async function GET(req: NextRequest) {
  const auth = await checkAnyAuth('admin', 'superadmin');
  if (!auth.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const district = url.searchParams.get('district');
  const khoroo = url.searchParams.get('khoroo');
  const status = url.searchParams.get('status');

  const { data: summaries, error } = await supabaseAdmin
    .from('hoa_activation_summaries')
    .select('id, directory_id, provisional_hoa_id, interest_count, building_count, latest_request_at, status, updated_at')
    .order('interest_count', { ascending: false })
    .limit(500);

  if (error) {
    return NextResponse.json({ error: 'Татаж чадсангүй' }, { status: 500 });
  }

  const directoryIds = Array.from(
    new Set((summaries || []).map((s) => s.directory_id).filter((v): v is number => v != null))
  );
  const provisionalIds = Array.from(
    new Set((summaries || []).map((s) => s.provisional_hoa_id).filter((v): v is number => v != null))
  );

  const [directoryMap, provisionalMap, claimMap] = await Promise.all([
    fetchDirectoryMap(directoryIds),
    fetchProvisionalMap(provisionalIds),
    fetchClaimCounts(directoryIds, provisionalIds),
  ]);

  const rows: DemandRow[] = [];
  for (const s of summaries || []) {
    if (s.directory_id) {
      const d = directoryMap.get(s.directory_id as number);
      if (!d) continue;
      const c = claimMap.directory.get(s.directory_id as number) || { claimed: 0, unclaimed: 0 };
      rows.push({
        kind: 'directory',
        id: d.id,
        name: d.official_name,
        district: d.district,
        khoroo: d.khoroo,
        interest_count: s.interest_count as number,
        building_count: s.building_count as number,
        latest_request_at: (s.latest_request_at as string | null) ?? null,
        status: s.status as DemandRow['status'],
        is_active_tenant: !!d.linked_tenant_id,
        claimed_count: c.claimed,
        unclaimed_count: c.unclaimed,
      });
    } else if (s.provisional_hoa_id) {
      const p = provisionalMap.get(s.provisional_hoa_id as number);
      if (!p) continue;
      const c = claimMap.provisional.get(s.provisional_hoa_id as number) || { claimed: 0, unclaimed: 0 };
      rows.push({
        kind: 'provisional',
        id: p.id,
        name: p.entered_name,
        city: p.city,
        district: p.district,
        khoroo: p.khoroo,
        interest_count: s.interest_count as number,
        building_count: s.building_count as number,
        latest_request_at: (s.latest_request_at as string | null) ?? null,
        status: s.status as DemandRow['status'],
        matched_directory_id: p.matched_directory_id,
        match_score: p.match_score,
        claimed_count: c.claimed,
        unclaimed_count: c.unclaimed,
      });
    }
  }

  // Filter
  let filtered = rows;
  if (district) filtered = filtered.filter((r) => (r.district || '').toLowerCase() === district.toLowerCase());
  if (khoroo) filtered = filtered.filter((r) => (r.khoroo || '').toLowerCase() === khoroo.toLowerCase());
  if (status) filtered = filtered.filter((r) => r.status === status);

  // Aggregate stats
  const totals = {
    total: filtered.length,
    interest: filtered.filter((r) => r.status === 'INTEREST').length,
    warm: filtered.filter((r) => r.status === 'WARM_LEAD').length,
    ready: filtered.filter((r) => r.status === 'ACTIVATION_READY').length,
    active: filtered.filter((r) => r.status === 'ACTIVE').length,
    totalInterest: filtered.reduce((acc, r) => acc + r.interest_count, 0),
    totalClaimed: filtered.reduce((acc, r) => acc + r.claimed_count, 0),
    totalUnclaimed: filtered.reduce((acc, r) => acc + r.unclaimed_count, 0),
  };

  return NextResponse.json({ rows: filtered, totals });
}

async function fetchDirectoryMap(ids: number[]) {
  const map = new Map<number, { id: number; official_name: string; district: string | null; khoroo: string | null; linked_tenant_id: number | null }>();
  if (ids.length === 0) return map;
  const { data } = await supabaseAdmin
    .from('hoa_directory')
    .select('id, official_name, district, khoroo, linked_tenant_id')
    .in('id', ids);
  for (const d of data || []) {
    map.set(d.id as number, {
      id: d.id as number,
      official_name: d.official_name as string,
      district: (d.district as string) || null,
      khoroo: (d.khoroo as string) || null,
      linked_tenant_id: (d.linked_tenant_id as number) || null,
    });
  }
  return map;
}

interface ClaimCount { claimed: number; unclaimed: number; }

// hoa_activation_requests хүснэгтээс СӨХ бүрд харгалзах claimed/unclaimed бичлэгийн тоог авах.
async function fetchClaimCounts(directoryIds: number[], provisionalIds: number[]) {
  const out = {
    directory: new Map<number, ClaimCount>(),
    provisional: new Map<number, ClaimCount>(),
  };
  if (directoryIds.length === 0 && provisionalIds.length === 0) return out;

  // Нэг query-д баг талбараар татаж аль аль талд хувааж тоолно.
  const [{ data: dirRows }, { data: provRows }] = await Promise.all([
    directoryIds.length > 0
      ? supabaseAdmin
          .from('hoa_activation_requests')
          .select('directory_id, user_id')
          .in('directory_id', directoryIds)
          .limit(5000)
      : Promise.resolve({ data: [] as { directory_id: number | null; user_id: number | null }[] }),
    provisionalIds.length > 0
      ? supabaseAdmin
          .from('hoa_activation_requests')
          .select('provisional_hoa_id, user_id')
          .in('provisional_hoa_id', provisionalIds)
          .limit(5000)
      : Promise.resolve({ data: [] as { provisional_hoa_id: number | null; user_id: number | null }[] }),
  ]);

  for (const r of (dirRows || []) as { directory_id: number | null; user_id: number | null }[]) {
    if (!r.directory_id) continue;
    const c = out.directory.get(r.directory_id) || { claimed: 0, unclaimed: 0 };
    if (r.user_id) c.claimed++;
    else c.unclaimed++;
    out.directory.set(r.directory_id, c);
  }
  for (const r of (provRows || []) as { provisional_hoa_id: number | null; user_id: number | null }[]) {
    if (!r.provisional_hoa_id) continue;
    const c = out.provisional.get(r.provisional_hoa_id) || { claimed: 0, unclaimed: 0 };
    if (r.user_id) c.claimed++;
    else c.unclaimed++;
    out.provisional.set(r.provisional_hoa_id, c);
  }

  return out;
}

async function fetchProvisionalMap(ids: number[]) {
  const map = new Map<number, {
    id: number;
    entered_name: string;
    city: string | null;
    district: string | null;
    khoroo: string | null;
    matched_directory_id: number | null;
    match_score: number | null;
  }>();
  if (ids.length === 0) return map;
  const { data } = await supabaseAdmin
    .from('hoa_provisional')
    .select('id, entered_name, city, district, khoroo, matched_directory_id, match_score')
    .in('id', ids);
  for (const p of data || []) {
    map.set(p.id as number, {
      id: p.id as number,
      entered_name: p.entered_name as string,
      city: (p.city as string) || null,
      district: (p.district as string) || null,
      khoroo: (p.khoroo as string) || null,
      matched_directory_id: (p.matched_directory_id as number) || null,
      match_score: (p.match_score as number) || null,
    });
  }
  return map;
}
