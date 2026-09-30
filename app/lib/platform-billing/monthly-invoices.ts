// Хотол → СӨХ-ийн САРЫН нэхэмжлэхийг АВТОМАТ үүсгэх.
//
// Яагаад: үнэгүй хугацаа дуусмагц сар бүр СӨХ бүрийн карт дээрх «N сарын
// нэхэмжлэх үүсгэх» товчийг гараар дарах ёстой байв. 10 СӨХ, сар бүр — мартвал
// самбарт «тооцоо хийгээгүй» улаан тэмдэг гараад л зогсоно, сануулга ч
// явахгүй (нэхэмжлэхгүй сард сануулах юм байхгүй).
//
// Одоо cron өдөр бүр (сануулгын cron-той нэг алхамд) идэвхтэй СӨХ бүрийн
// тооцоот САР БҮРИЙГ шалгаж, нэхэмжлэхгүй сар олдвол «pending»-ээр үүсгэнэ.
//
// Дүрэм — гараар үүсгэдэг `create` үйлдэлтэй (app/api/superadmin/invoices)
// ЯГ ИЖИЛ: тариф + СӨХ-ийн үнэгүй сарын сунгалт, айлын тоог тухайн мөчид
// тоолно, төлөх хугацаа = дараа сарын 15. Хоёр зам зөрвөл нэг сарын дүн хоёр
// янз гарна.
//
// Давтагдахгүй байх баталгаа: uniq_platform_invoices_period_kind
// (sokh_id, period_year, period_month, kind). Cron хэд дуудагдсан ч, супер
// админ гараар зэрэг үүсгэсэн ч давхар мөр орохгүй.
//
// Юуг ҮҮСГЭХГҮЙ:
//   - суурилуулалтын нэхэмжлэх (гэрээ, хөнгөлөлт хүний тохиролцоо)
//   - ирээдүйн сар (болоогүй сарын мөнгө нэхэхгүй — billableMonths ийм)
//   - айлгүй СӨХ (0 × тариф = 0₮ нэхэмжлэх утгагүй)
//   - туршилтын СӨХ

import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { isDemoSokh } from '@/app/lib/demo-orgs';
import { sendEmail, SUPERADMIN_EMAIL } from '@/app/lib/email';
import {
  DEFAULT_TARIFF,
  billableMonths,
  formatPeriod,
  monthlyFee,
  orgTariff,
  periodKey,
  type PlatformTariff,
} from '@/app/lib/platform-pricing';

export interface CreatedInvoice {
  invoice_id: number | null;
  sokh_id: number;
  name: string;
  year: number;
  month: number;
  amount: number;
  apartments: number;
}

export interface MonthlyInvoiceRunResult {
  ok: boolean;
  /** Шалгасан идэвхтэй СӨХ-ийн тоо (туршилтын ороогүй) */
  checked: number;
  created: CreatedInvoice[];
  /** Айлгүй тул алгассан СӨХ */
  skippedNoApartments: { sokh_id: number; name: string }[];
  errors: string[];
}

/** Тухайн сарын дараа сарын 15 — гараар үүсгэх замтай ижил.
 *  Тэмдэгтээр угсарна: Date→toISOString бол серверийн цагийн бүсээс хамаарч
 *  14 эсвэл 15 гэж хоёр янз гардаг (UTC+8 машинд 14 болдог). */
export function monthlyDueDate(year: number, month: number): string {
  const y = month === 12 ? year + 1 : year;
  const m = month === 12 ? 1 : month + 1;
  return `${y}-${String(m).padStart(2, '0')}-15`;
}

/** Нэг сарын нэхэмжлэхийн мөр — `platform_invoices` руу шууд орно. */
export function monthlyInvoiceRow(
  sokhId: number,
  tariff: PlatformTariff,
  apartments: number,
  year: number,
  month: number,
) {
  const amount = monthlyFee(tariff, apartments);
  return {
    sokh_id: sokhId,
    kind: 'monthly' as const,
    period_year: year,
    period_month: month,
    amount,
    calculation_details: {
      apartments,
      per_unit_fee: tariff.monthly_per_unit,
      unit_total: amount,
      plan_name: 'Сарын хураамж',
      source: 'auto',
    },
    status: 'pending' as const,
    due_date: monthlyDueDate(year, month),
  };
}

interface OrgRow {
  id: number;
  name: string;
  activated_at: string | null;
  free_months_override?: number | null;
}

const money = (n: number) => `${Math.round(n).toLocaleString('en-US')}₮`;

/** Идэвхтэй СӨХ бүрийн нэхэмжлэхгүй тооцоот сарыг олж, нэхэмжлэх үүсгэнэ. */
export async function generateMonthlyInvoices(now: Date = new Date()): Promise<MonthlyInvoiceRunResult> {
  const result: MonthlyInvoiceRunResult = {
    ok: true, checked: 0, created: [], skippedNoApartments: [], errors: [],
  };

  // Тариф (миграц ажиллаагүй бол үндсэн утгаар — гар зам ч ингэдэг)
  let tariff: PlatformTariff = DEFAULT_TARIFF;
  const { data: tRow } = await supabaseAdmin
    .from('platform_tariff').select('*').eq('id', 1).maybeSingle();
  if (tRow) tariff = { ...DEFAULT_TARIFF, ...tRow };

  // Идэвхтэй СӨХ. free_months_override багана байхгүй орчинд (billing-control
  // миграц ажиллаагүй) select унана — тэр үед баганагүйгээр дахин уншина.
  let orgs: OrgRow[] = [];
  const withOverride = await supabaseAdmin
    .from('sokh_organizations')
    .select('id, name, activated_at, free_months_override')
    .eq('claim_status', 'active')
    .not('activated_at', 'is', null);
  if (withOverride.error) {
    const plain = await supabaseAdmin
      .from('sokh_organizations')
      .select('id, name, activated_at')
      .eq('claim_status', 'active')
      .not('activated_at', 'is', null);
    if (plain.error) {
      result.ok = false;
      result.errors.push(`СӨХ уншиж чадсангүй: ${plain.error.message}`);
      return result;
    }
    orgs = (plain.data || []) as OrgRow[];
  } else {
    orgs = (withOverride.data || []) as OrgRow[];
  }
  orgs = orgs.filter(o => !isDemoSokh(Number(o.id)));
  result.checked = orgs.length;
  if (!orgs.length) return result;

  const orgIds = orgs.map(o => Number(o.id));

  // Аль хэдийн үүссэн сарын нэхэмжлэхүүд (төлөв хамаагүй — cancelled ч
  // давхар үүсгэхгүй: супер админ зориуд цуцалсан сарыг дахин нэхэхгүй)
  const { data: existing, error: exErr } = await supabaseAdmin
    .from('platform_invoices')
    .select('sokh_id, period_year, period_month')
    .eq('kind', 'monthly')
    .in('sokh_id', orgIds);
  if (exErr) {
    result.ok = false;
    result.errors.push(`Нэхэмжлэх уншиж чадсангүй: ${exErr.message}`);
    return result;
  }
  const billed = new Set(
    (existing || []).map(i => `${i.sokh_id}:${periodKey(Number(i.period_year), Number(i.period_month))}`)
  );

  for (const o of orgs) {
    const sokhId = Number(o.id);
    const t = orgTariff(tariff, o.free_months_override ?? null);

    // Айлын тоог ҮРГЭЛЖ тухайн мөчид тоолно — сар дунд айл нэмэгдвэл
    // дараагийн сарын нэхэмжлэх шинэ тоогоор гарна.
    const { count, error: cntErr } = await supabaseAdmin
      .from('residents')
      .select('id', { count: 'exact', head: true })
      .eq('sokh_id', sokhId);
    if (cntErr) {
      result.errors.push(`${o.name}: айл тоолж чадсангүй — ${cntErr.message}`);
      continue;
    }
    const apartments = count || 0;

    const months = billableMonths(o.activated_at, t, apartments, now)
      .filter(m => !billed.has(`${sokhId}:${periodKey(m.year, m.month)}`));
    if (!months.length) continue;

    if (apartments === 0) {
      result.skippedNoApartments.push({ sokh_id: sokhId, name: o.name });
      continue;
    }

    for (const m of months) {
      const row = monthlyInvoiceRow(sokhId, t, apartments, m.year, m.month);
      // ignoreDuplicates: зэрэг ажилласан хоёр cron, эсвэл гараар үүсгэсэн
      // мөртэй мөргөлдвөл байгааг нь ХӨНДӨХГҮЙ (upsert бол дүнг нь дарж бичнэ).
      const { data, error } = await supabaseAdmin
        .from('platform_invoices')
        .upsert([row], { onConflict: 'sokh_id,period_year,period_month,kind', ignoreDuplicates: true })
        .select('id')
        .maybeSingle();
      if (error) {
        result.errors.push(`${o.name} ${formatPeriod(m.year, m.month)}: ${error.message}`);
        continue;
      }
      // data == null → давхардсан тул алгассан (аль хэдийн байсан)
      if (!data) continue;
      result.created.push({
        invoice_id: Number(data.id),
        sokh_id: sokhId,
        name: o.name,
        year: m.year,
        month: m.month,
        amount: row.amount,
        apartments,
      });
    }
  }

  // Супер админд мэдэгдэнэ — юу үүссэнийг мэдэхгүй бол «автомат» гэдэг нь
  // «хараагүй» болж хувирна. Юу ч үүсээгүй өдөр имэйл явуулахгүй.
  if (result.created.length) {
    const total = result.created.reduce((s, c) => s + c.amount, 0);
    const lines = result.created
      .map(c =>
        `• ${c.name} — ${formatPeriod(c.year, c.month)}: ${money(c.amount)} ` +
        `(${c.apartments} айл, төлөх хугацаа ${monthlyDueDate(c.year, c.month).replace(/-/g, '.')})`)
      .join('\n');
    const skipped = result.skippedNoApartments.length
      ? `\n\nАйлгүй тул алгассан: ${result.skippedNoApartments.map(s => s.name).join(', ')}`
      : '';
    const r = await sendEmail({
      to: SUPERADMIN_EMAIL,
      subject: `[Хотол] ${result.created.length} сарын нэхэмжлэх автоматаар үүслээ — ${money(total)}`,
      text:
        `Өнөөдрийн шалгалтаар дараах сарын нэхэмжлэх үүслээ (төлөв: төлөгдөөгүй):\n\n` +
        `${lines}\n\nНийт: ${money(total)}${skipped}\n\n` +
        `Даргад төлөх хугацаа дөхөхөд автомат сануулга явна. ` +
        `Мөнгө орсны дараа картаас «төлсөн» дарж бодит огноогоор нь тэмдэглэнэ.\n` +
        `https://khotol.com/mng-ctrl/customers`,
    });
    if (!r.ok) result.errors.push(`Имэйл: ${r.error || 'илгээгдсэнгүй'}`);
  }

  result.ok = result.errors.length === 0;
  return result;
}
