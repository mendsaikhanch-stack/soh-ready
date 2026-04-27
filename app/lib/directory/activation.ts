import { supabaseAdmin } from '@/app/lib/supabase-admin';

export type ActivationStatus = 'INTEREST' | 'WARM_LEAD' | 'ACTIVATION_READY' | 'ACTIVE';

// Эрэлтийн тоо + барилгын тоо дээр үндэслэн status тооцох threshold-ууд.
// Эдгээрийг settings-аас уншуулж тохируулах боломжтой бөгөөд код дээр default.
export const ACTIVATION_THRESHOLDS = {
  warmLeadInterest: 3,
  activationReadyInterest: 6,
  multiBuildingActivation: 2, // 2-оос дээш барилгатай бол шууд ACTIVATION_READY
};

export function deriveActivationStatus(args: {
  interestCount: number;
  buildingCount: number;
  isLinkedTenant?: boolean;
}): ActivationStatus {
  if (args.isLinkedTenant) return 'ACTIVE';
  if (args.interestCount >= ACTIVATION_THRESHOLDS.activationReadyInterest) return 'ACTIVATION_READY';
  if (args.buildingCount >= ACTIVATION_THRESHOLDS.multiBuildingActivation) return 'ACTIVATION_READY';
  if (args.interestCount >= ACTIVATION_THRESHOLDS.warmLeadInterest) return 'WARM_LEAD';
  return 'INTEREST';
}

interface IncrementArgs {
  directoryId?: number | null;
  provisionalId?: number | null;
  building?: string | null;
}

// Activation summary-г аюулгүйгээр нэмэх (idempotent биш — дуудсан болгонд тоолуур нэмнэ).
// Барилга өвөрмөц гэж тооцох замаар building_count-ыг тооцоолно.
export async function incrementActivationSummary({ directoryId, provisionalId, building }: IncrementArgs): Promise<void> {
  if (!directoryId && !provisionalId) return;

  // 1) Хамгийн сүүлийн request building-уудаас өвөрмөц барилгуудын тоог тооцох
  const buildingCount = await countDistinctBuildings({ directoryId, provisionalId });

  // 2) Идэвхтэй tenant-той эсэхийг шалгах
  let isLinkedTenant = false;
  if (directoryId) {
    const { data } = await supabaseAdmin
      .from('hoa_directory')
      .select('linked_tenant_id')
      .eq('id', directoryId)
      .single();
    isLinkedTenant = !!data?.linked_tenant_id;
  }

  // 3) Одоогийн summary-г татах
  const filterCol = directoryId ? 'directory_id' : 'provisional_hoa_id';
  const filterId = directoryId ?? provisionalId;
  const { data: existing } = await supabaseAdmin
    .from('hoa_activation_summaries')
    .select('*')
    .eq(filterCol, filterId as number)
    .maybeSingle();

  const newCount = (existing?.interest_count ?? 0) + 1;
  const status = deriveActivationStatus({
    interestCount: newCount,
    buildingCount,
    isLinkedTenant,
  });

  if (existing) {
    await supabaseAdmin
      .from('hoa_activation_summaries')
      .update({
        interest_count: newCount,
        building_count: buildingCount,
        latest_request_at: new Date().toISOString(),
        status,
      })
      .eq('id', existing.id);
  } else {
    await supabaseAdmin.from('hoa_activation_summaries').insert({
      directory_id: directoryId ?? null,
      provisional_hoa_id: provisionalId ?? null,
      interest_count: 1,
      building_count: buildingCount,
      latest_request_at: new Date().toISOString(),
      status,
    });
  }

  // 4) Provisional төлөвийг шинэчлэх (HAS_DEMAND)
  if (provisionalId) {
    await supabaseAdmin
      .from('hoa_provisional')
      .update({ status: 'HAS_DEMAND' })
      .eq('id', provisionalId)
      .neq('status', 'MERGED')
      .neq('status', 'REJECTED');
  }
}

async function countDistinctBuildings({ directoryId, provisionalId }: IncrementArgs): Promise<number> {
  const filterCol = directoryId ? 'directory_id' : 'provisional_hoa_id';
  const filterId = directoryId ?? provisionalId;
  if (!filterId) return 0;
  const { data } = await supabaseAdmin
    .from('hoa_activation_requests')
    .select('building')
    .eq(filterCol, filterId);
  if (!data) return 0;
  const set = new Set<string>();
  for (const r of data) {
    const b = (r as { building?: string | null }).building;
    if (b && b.trim()) set.add(b.trim().toLowerCase());
  }
  return set.size;
}

// Activation summary-г бүрэн дахин тооцоолох (merge-ийн дараа эсвэл backfill үед)
export async function recomputeActivationSummary(args: { directoryId?: number; provisionalId?: number }): Promise<void> {
  const { directoryId, provisionalId } = args;
  if (!directoryId && !provisionalId) return;

  const filterCol = directoryId ? 'directory_id' : 'provisional_hoa_id';
  const filterId = directoryId ?? provisionalId;

  const { count: interestCount } = await supabaseAdmin
    .from('hoa_activation_requests')
    .select('id', { count: 'exact', head: true })
    .eq(filterCol, filterId as number);

  const buildingCount = await countDistinctBuildings({ directoryId, provisionalId });

  const { data: latest } = await supabaseAdmin
    .from('hoa_activation_requests')
    .select('created_at')
    .eq(filterCol, filterId as number)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let isLinkedTenant = false;
  if (directoryId) {
    const { data } = await supabaseAdmin
      .from('hoa_directory')
      .select('linked_tenant_id')
      .eq('id', directoryId)
      .single();
    isLinkedTenant = !!data?.linked_tenant_id;
  }

  const status = deriveActivationStatus({
    interestCount: interestCount ?? 0,
    buildingCount,
    isLinkedTenant,
  });

  const { data: existing } = await supabaseAdmin
    .from('hoa_activation_summaries')
    .select('id')
    .eq(filterCol, filterId as number)
    .maybeSingle();

  const payload = {
    directory_id: directoryId ?? null,
    provisional_hoa_id: provisionalId ?? null,
    interest_count: interestCount ?? 0,
    building_count: buildingCount,
    latest_request_at: latest?.created_at ?? null,
    status,
  };

  if (existing) {
    await supabaseAdmin.from('hoa_activation_summaries').update(payload).eq('id', existing.id);
  } else if ((interestCount ?? 0) > 0) {
    await supabaseAdmin.from('hoa_activation_summaries').insert(payload);
  }
}
