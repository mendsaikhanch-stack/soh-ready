import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { getAuthRole } from '@/app/lib/session-token';
import { isDemoSokh } from '@/app/lib/demo-orgs';
import {
  OVERDUE_ALERT_LEAD_DAYS,
  OVERDUE_NOTICE_DAYS,
  daysBetweenUb,
  overdueAlertLevel,
  ubDay,
  type OverdueAlertLevel,
} from '@/app/lib/platform-pricing';

// Төлөгдөөгүй нэхэмжлэхүүд — хугацаа нь ойртсон, эсвэл хэтэрсэн.
//
// Яагаад хэрэгтэй вэ: `/mng-ctrl/customers` дээр төлөгдөөгүй НИЙТ ДҮН
// харагддаг ч хэдэн хоног хэтэрснийг тооцдоггүй. Тоо нь харагдаад л байвал
// нүд дасаж, хэн ч арга хэмжээ авахгүй өнгөрдөг. Энэ endpoint нь хугацааг
// нь тоолж, гэрээний 30 хоногийн босгыг давсныг тусад нь ялгаж өгнө.
//
// Хоногийг ЗААВАЛ `due_date`-ээс тоолно, `created_at`-аас БИШ.

export const dynamic = 'force-dynamic';

export interface OverdueAlert {
  invoice_id: number;
  sokh_id: number;
  name: string;
  /** setup = суурилуулалт, monthly = сарын хураамж */
  kind: string;
  amount: number;
  /** Төлөх ёстой өдөр (UB, YYYY-MM-DD) */
  due_on: string;
  /** 0 = яг өнөөдөр, эерэг = үлдсэн хоног, сөрөг = хэтэрсэн хоног */
  days_left: number;
  level: OverdueAlertLevel;
}

export async function GET() {
  const auth = await getAuthRole();
  if (!auth || auth.role !== 'superadmin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: invoices, error } = await supabaseAdmin
    .from('platform_invoices')
    .select('id, sokh_id, kind, amount, status, due_date')
    .not('status', 'in', '("paid","cancelled")');

  if (error) {
    console.error('[superadmin/overdue-invoices]', error.message);
    return NextResponse.json({ error: 'Нэхэмжлэх уншиж чадсангүй' }, { status: 500 });
  }

  // due_date нь NOT NULL боловч хуучин мөр гараар засагдсан байж болно.
  // Огноогүй нэхэмжлэхийг хугацаа тоолохгүй тул алгасна.
  const rows = (invoices || []).filter(i => !isDemoSokh(Number(i.sokh_id)) && i.due_date);
  if (!rows.length) {
    return NextResponse.json({ alerts: [], counts: emptyCounts(), unpaid_total: 0, today: ubDay() });
  }

  const ids = [...new Set(rows.map(i => Number(i.sokh_id)))];
  const { data: orgs } = await supabaseAdmin
    .from('sokh_organizations')
    .select('id, name')
    .in('id', ids);
  const nameById = new Map<number, string>(
    (orgs || []).map(o => [Number(o.id), String(o.name)])
  );

  const now = new Date();
  const alerts: OverdueAlert[] = [];
  let unpaidTotal = 0;

  for (const inv of rows) {
    const amount = Number(inv.amount) || 0;
    unpaidTotal += amount;

    // due_date нь DATE тул цагийн бүсээр гулсахаас сэргийлж UB шөнө дундаар авна
    const due = new Date(`${inv.due_date}T00:00:00+08:00`);
    if (isNaN(due.getTime())) continue;

    const daysLeft = daysBetweenUb(due, now);
    const level = overdueAlertLevel(daysLeft);
    if (!level) continue;

    alerts.push({
      invoice_id: Number(inv.id),
      sokh_id: Number(inv.sokh_id),
      name: nameById.get(Number(inv.sokh_id)) || `СӨХ #${inv.sokh_id}`,
      kind: String(inv.kind || 'monthly'),
      amount,
      due_on: String(inv.due_date),
      days_left: daysLeft,
      level,
    });
  }

  // Хамгийн их хэтэрсэн нь эхэнд
  alerts.sort((a, b) => a.days_left - b.days_left);

  return NextResponse.json({
    alerts,
    counts: {
      critical: alerts.filter(a => a.level === 'critical').length,
      overdue: alerts.filter(a => a.level === 'overdue').length,
      soon: alerts.filter(a => a.level === 'soon').length,
      total: alerts.length,
    },
    /** Сануулгад ороогүй ч төлөгдөөгүй бүх нэхэмжлэхийн нийлбэр */
    unpaid_total: unpaidTotal,
    lead_days: OVERDUE_ALERT_LEAD_DAYS,
    notice_days: OVERDUE_NOTICE_DAYS,
    today: ubDay(now),
  });
}

function emptyCounts() {
  return { critical: 0, overdue: 0, soon: 0, total: 0 };
}
