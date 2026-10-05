// СӨХ-ийн даргын тал — Хотолд төлөх ёстой нэхэмжлэхүүд (хянах самбарын баннер).
//
// SMS/имэйл хүрээгүй ч дарга самбартаа нэвтрэхэд төлөгдөөгүй нэхэмжлэх
// хугацааныхаа хамт харагдана. sokh_id-г ЗӨВХӨН сешнээс уншина.

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { checkAuth } from '@/app/lib/session-token';
import { isDemoSokh } from '@/app/lib/demo-orgs';
import { PROVIDER } from '@/app/lib/contract/service-agreement';
import {
  DEFAULT_TARIFF,
  daysBetweenUb,
  firstBillableMonth,
  monthlyFee,
  orgTariff,
  overdueAlertLevel,
  OVERDUE_ALERT_LEAD_DAYS,
  type PlatformTariff,
} from '@/app/lib/platform-pricing';
import { monthlyDueDate } from '@/app/lib/platform-billing/monthly-invoices';

export const dynamic = 'force-dynamic';

/** Сарын хураамж эхлэхээс хэдэн хоногийн өмнөөс мэдэгдлийг харуулах */
const START_NOTICE_LEAD_DAYS = 30;

interface StartNotice {
  year: number;
  month: number;       // 1-12
  apartments: number;
  per_unit: number;
  amount: number;
  first_due_on: string; // эхний сарын төлөх хугацаа (YYYY-MM-DD)
}

/**
 * «Сарын хураамж N сараас эхэлнэ» мэдэгдэл.
 *
 * Эхний тооцоот сар эхлэхээс 30 хоногийн өмнөөс тэр сарын төлөх хугацаа
 * (дараа сарын 15) дуусах хүртэл харагдана. Эхний сарын нэхэмжлэх
 * төлөгдмөгц алга болно. Тооцоо нь cron-ы нэхэмжлэхтэй ижил функцээс.
 */
async function startNotice(sokhId: number, now: Date): Promise<StartNotice | null> {
  let tariff: PlatformTariff = DEFAULT_TARIFF;
  const { data: tRow } = await supabaseAdmin
    .from('platform_tariff').select('*').eq('id', 1).maybeSingle();
  if (tRow) tariff = { ...DEFAULT_TARIFF, ...tRow };

  // free_months_override багана байхгүй орчинд баганагүйгээр дахин уншина
  let org: { activated_at: string | null; free_months_override?: number | null } | null = null;
  const withOverride = await supabaseAdmin
    .from('sokh_organizations')
    .select('activated_at, free_months_override, claim_status')
    .eq('id', sokhId)
    .maybeSingle();
  if (withOverride.error) {
    const plain = await supabaseAdmin
      .from('sokh_organizations')
      .select('activated_at, claim_status')
      .eq('id', sokhId)
      .maybeSingle();
    if (plain.data?.claim_status === 'active') org = plain.data;
  } else if (withOverride.data?.claim_status === 'active') {
    org = withOverride.data;
  }
  if (!org?.activated_at) return null;

  const { count } = await supabaseAdmin
    .from('residents')
    .select('id', { count: 'exact', head: true })
    .eq('sokh_id', sokhId);
  const apartments = count || 0;
  if (!apartments) return null;

  const t = orgTariff(tariff, org.free_months_override ?? null);
  const first = firstBillableMonth(org.activated_at, t, apartments);
  if (!first) return null;
  const year = first.getFullYear();
  const month = first.getMonth() + 1;
  const firstDue = monthlyDueDate(year, month);

  const startsIn = daysBetweenUb(new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00+08:00`), now);
  const dueIn = daysBetweenUb(new Date(`${firstDue}T00:00:00+08:00`), now);
  if (startsIn > START_NOTICE_LEAD_DAYS || dueIn < 0) return null;

  const { data: firstInv } = await supabaseAdmin
    .from('platform_invoices')
    .select('status')
    .eq('sokh_id', sokhId)
    .eq('kind', 'monthly')
    .eq('period_year', year)
    .eq('period_month', month)
    .maybeSingle();
  if (firstInv?.status === 'paid') return null;

  return {
    year,
    month,
    apartments,
    per_unit: t.monthly_per_unit,
    amount: monthlyFee(t, apartments),
    first_due_on: firstDue,
  };
}

export async function GET() {
  const auth = await checkAuth('admin');
  const sokhId = Number(auth.sokhId);
  if (!auth.valid || !sokhId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Демо СӨХ-д Хотолын нэхэмжлэх байхгүй
  if (auth.demo || isDemoSokh(sokhId)) return NextResponse.json({ invoices: [] });

  const { data, error } = await supabaseAdmin
    .from('platform_invoices')
    .select('id, kind, amount, due_date, status')
    .eq('sokh_id', sokhId)
    .not('status', 'in', '("paid","cancelled")')
    .order('due_date', { ascending: true });
  if (error) return NextResponse.json({ invoices: [] });

  const now = new Date();
  const invoices = (data || [])
    .filter(i => i.due_date && Number(i.amount) > 0)
    .map(i => {
      const daysLeft = daysBetweenUb(new Date(`${i.due_date}T00:00:00+08:00`), now);
      return {
        id: Number(i.id),
        kind: String(i.kind || 'monthly'),
        amount: Number(i.amount),
        due_on: String(i.due_date),
        days_left: daysLeft,
        level: overdueAlertLevel(daysLeft),
      };
    });

  const notice = await startNotice(sokhId, now).catch(() => null);

  return NextResponse.json({
    invoices,
    notice,
    lead_days: OVERDUE_ALERT_LEAD_DAYS,
    bank: { name: PROVIDER.bank, account: PROVIDER.bankAccount, holder: PROVIDER.bankAccountHolder },
    contact: PROVIDER.phone,
  });
}
