import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { getAuthRole } from '@/app/lib/session-token';
import { isDemoSokh } from '@/app/lib/demo-orgs';
import { stageLabel, type ChannelResult } from '@/app/lib/platform-billing/invoice-reminders';
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
  /** Энэ нэхэмжлэхэд илгээсэн автомат сануулгууд (сүүлийнх нь эхэнд) */
  reminders: { stage: string; label: string; sent_at: string; ok: boolean }[];
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

  // Илгээсэн сануулгууд — миграц ажиллаагүй бол хоосон (reminders_ready=false)
  const { data: remRows, error: remErr } = await supabaseAdmin
    .from('platform_invoice_reminders')
    .select('invoice_id, stage, channels, created_at')
    .in('invoice_id', rows.map(i => Number(i.id)))
    .order('created_at', { ascending: false });
  const remByInvoice = new Map<number, OverdueAlert['reminders']>();
  for (const r of remRows || []) {
    const list = remByInvoice.get(Number(r.invoice_id)) || [];
    const ch = (r.channels as ChannelResult[] | null) || [];
    list.push({
      stage: String(r.stage),
      label: stageLabel(String(r.stage)),
      sent_at: String(r.created_at),
      // Хүлээн авагч огт олдоогүй бол «илгээгдээгүй» гэж харуулна
      ok: ch.some(c => c.ok),
    });
    remByInvoice.set(Number(r.invoice_id), list);
  }

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
      reminders: remByInvoice.get(Number(inv.id)) || [],
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
    /** false = supabase-invoice-reminders-migration.sql ажиллаагүй, автомат сануулга явахгүй */
    reminders_ready: !remErr,
    today: ubDay(now),
  });
}

function emptyCounts() {
  return { critical: 0, overdue: 0, soon: 0, total: 0 };
}
