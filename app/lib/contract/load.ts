// Гэрээ бэлтгэхэд хэрэгтэй өгөгдлийг DB-ээс цуглуулна (зөвхөн сервер тал).
//
// Даргын тал (/api/admin/contract) ба супер админы тал
// (/api/superadmin/customers/contract) хоёул эндээс уншина — тэгж байж
// хоёр талд ижил айлын тоо, ижил дүн харагдана.
//
// Миграц ажиллаагүй байж болно (`contract_unlocked_at` багана байхгүй).
// Тэр тохиолдолд `migrated: false` буцаана, юу ч унахгүй.

import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { DEFAULT_TARIFF, type PlatformTariff } from '@/app/lib/platform-pricing';
import { contractNumberFor, type ContractInput } from './service-agreement';

const BASE_FIELDS = 'id, name, address, phone, contact_email, activated_at, claim_status';
const CONTRACT_FIELDS = `${BASE_FIELDS}, contract_number, contract_unlocked_at, contract_downloaded_at`;

export interface ContractState {
  org: {
    id: number;
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    activated_at: string | null;
    claim_status: string;
  };
  apartments: number;
  tariff: PlatformTariff;
  /** Гэрээ татах эрх нээгдсэн эсэх */
  unlocked_at: string | null;
  number: string | null;
  downloaded_at: string | null;
  /** contract_* багана DB-д байгаа эсэх */
  migrated: boolean;
}

async function loadTariff(): Promise<PlatformTariff> {
  const { data, error } = await supabaseAdmin
    .from('platform_tariff')
    .select('*')
    .eq('id', 1)
    .maybeSingle();
  if (error || !data) return DEFAULT_TARIFF;
  return { ...DEFAULT_TARIFF, ...data };
}

export async function loadContractState(sokhId: number): Promise<ContractState | null> {
  let migrated = true;
  let row: Record<string, unknown> | null = null;

  const withContract = await supabaseAdmin
    .from('sokh_organizations')
    .select(CONTRACT_FIELDS)
    .eq('id', sokhId)
    .maybeSingle();

  if (withContract.error) {
    // Багана байхгүй — миграц ажиллаагүй. Үндсэн талбараар дахин уншина.
    migrated = false;
    const base = await supabaseAdmin
      .from('sokh_organizations')
      .select(BASE_FIELDS)
      .eq('id', sokhId)
      .maybeSingle();
    if (base.error || !base.data) return null;
    row = base.data as Record<string, unknown>;
  } else {
    row = withContract.data as Record<string, unknown> | null;
  }

  if (!row) return null;

  // Айлын тоо — `unit_count` гараар бичсэн тоо тул бодит мөрөөр тоолно
  // (/mng-ctrl/customers-тэй ижил арга).
  const { count } = await supabaseAdmin
    .from('residents')
    .select('id', { count: 'exact', head: true })
    .eq('sokh_id', sokhId);

  return {
    org: {
      id: Number(row.id),
      name: String(row.name || ''),
      address: (row.address as string) ?? null,
      phone: (row.phone as string) ?? null,
      email: (row.contact_email as string) ?? null,
      activated_at: (row.activated_at as string) ?? null,
      claim_status: String(row.claim_status || ''),
    },
    apartments: count || 0,
    tariff: await loadTariff(),
    unlocked_at: migrated ? ((row.contract_unlocked_at as string) ?? null) : null,
    number: migrated ? ((row.contract_number as string) ?? null) : null,
    downloaded_at: migrated ? ((row.contract_downloaded_at as string) ?? null) : null,
    migrated,
  };
}

/** DB-ийн төлөв + гараар бөглөх талбаруудаас гэрээний оролт угсарна */
export function buildContractInput(
  state: ContractState,
  fill: { register?: string | null; chairman?: string | null; date?: Date } = {},
): ContractInput {
  const date = fill.date && !isNaN(fill.date.getTime()) ? fill.date : new Date();
  return {
    number: state.number || contractNumberFor(state.org.id, date),
    date,
    org: {
      id: state.org.id,
      name: state.org.name,
      address: state.org.address,
      phone: state.org.phone,
      email: state.org.email,
      register: fill.register ?? null,
      chairman: fill.chairman ?? null,
    },
    apartments: state.apartments,
    tariff: state.tariff,
    activatedAt: state.org.activated_at,
  };
}

/** Word/HTML-ээр татахад ашиглах хариу. Cyrillic нэрийг RFC 5987-ээр өгнө. */
export function contractFileResponse(html: string, fileName: string, asDoc: boolean): Response {
  const encoded = encodeURIComponent(fileName);
  return new Response('﻿' + html, {
    headers: {
      'Content-Type': asDoc
        ? 'application/msword; charset=utf-8'
        : 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="contract.${asDoc ? 'doc' : 'html'}"; filename*=UTF-8''${encoded}`,
      'Cache-Control': 'no-store',
    },
  });
}
