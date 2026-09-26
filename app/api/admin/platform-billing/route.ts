// СӨХ-ийн даргын тал — Хотолд төлөх ёстой нэхэмжлэхүүд (хянах самбарын баннер).
//
// SMS/имэйл хүрээгүй ч дарга самбартаа нэвтрэхэд төлөгдөөгүй нэхэмжлэх
// хугацааныхаа хамт харагдана. sokh_id-г ЗӨВХӨН сешнээс уншина.

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { checkAuth } from '@/app/lib/session-token';
import { isDemoSokh } from '@/app/lib/demo-orgs';
import { PROVIDER } from '@/app/lib/contract/service-agreement';
import { daysBetweenUb, overdueAlertLevel, OVERDUE_ALERT_LEAD_DAYS } from '@/app/lib/platform-pricing';

export const dynamic = 'force-dynamic';

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

  return NextResponse.json({
    invoices,
    lead_days: OVERDUE_ALERT_LEAD_DAYS,
    bank: { name: PROVIDER.bank, account: PROVIDER.bankAccount, holder: PROVIDER.bankAccountHolder },
    contact: PROVIDER.phone,
  });
}
