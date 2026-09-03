// Гэрээ бэлтгэхэд хэрэгтэй өгөгдлийг DB-ээс цуглуулна (зөвхөн сервер тал).
//
// Даргын тал (/api/admin/contract) ба супер админы тал
// (/api/superadmin/customers/contract) хоёул эндээс уншина — тэгж байж
// хоёр талд ижил айлын тоо, ижил дүн харагдана.
//
// Миграц ажиллаагүй байж болно (`contract_unlocked_at` багана байхгүй).
// Тэр тохиолдолд `migrated: false` буцаана, юу ч унахгүй.

import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { DEFAULT_TARIFF, orgTariff, type PlatformTariff } from '@/app/lib/platform-pricing';
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
  setupDiscountPercent: number | null;
  setupListPerUnit: number | null;
  /** Тухайн СӨХ-д үйлчлэх тариф — үнэгүй сарыг нь сунгасан бол тэрүүгээр */
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

/** Тухайн СӨХ-д сунгасан үнэгүй сар. Гэрээнд бичигдэх «Үнэгүй хугацаа», төлбөр
 *  эхлэх өдөр хоёр нь /mng-ctrl/customers картын тоотой заавал таарах ёстой —
 *  эс бөгөөс дарга гэрээгээрээ нэг огноог, бид самбар дээр өөр огноог харна.
 *
 *  Тусад нь уншиж байгаа шалтгаан: billing-control миграц ажиллаагүй орчинд
 *  энэ багана байхгүй. Үндсэн select-д нийлүүлбэл алдаа нь гэрээний бусад
 *  талбарыг «миграц ажиллаагүй» гэж буруу тэмдэглэнэ. */
async function loadFreeMonthsOverride(sokhId: number): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .from('sokh_organizations')
    .select('free_months_override')
    .eq('id', sokhId)
    .maybeSingle();
  if (error || !data) return null;
  return (data.free_months_override as number) ?? null;
}

/** Суурилуулалтын хөнгөлөлт (%). Гэрээ ба нэхэмжлэх ижил дүн харуулахын тулд
 *  хэрэгтэй. free_months_override-той ижил шалтгаанаар тусад нь уншина —
 *  миграц ажиллаагүй орчинд багана нь байхгүй. */
async function loadSetupDiscount(sokhId: number): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .from('sokh_organizations')
    .select('setup_discount_percent')
    .eq('id', sokhId)
    .maybeSingle();
  if (error || !data) return null;
  return (data.setup_discount_percent as number) ?? null;
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

  const listTariff = await loadTariff();
  const discount = await loadSetupDiscount(sokhId);

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
    setupDiscountPercent: discount,
    setupListPerUnit: discount ? listTariff.setup_per_unit : null,
    tariff: orgTariff(listTariff, await loadFreeMonthsOverride(sokhId), discount),
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
    setupDiscountPercent: state.setupDiscountPercent,
    setupListPerUnit: state.setupListPerUnit,
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
