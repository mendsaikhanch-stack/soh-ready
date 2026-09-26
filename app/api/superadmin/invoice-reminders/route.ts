// Супер админ: нэхэмжлэхийн автомат сануулгын бүртгэл харах (GET),
// cron-ыг хүлээлгүй одоо ажиллуулах (POST).

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { getAuthRole } from '@/app/lib/session-token';
import { runInvoiceReminders, stageLabel } from '@/app/lib/platform-billing/invoice-reminders';

export const dynamic = 'force-dynamic';

async function requireSuperadmin() {
  const auth = await getAuthRole();
  return auth && auth.role === 'superadmin' ? auth : null;
}

export async function GET() {
  if (!(await requireSuperadmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { data, error } = await supabaseAdmin
    .from('platform_invoice_reminders')
    .select('id, invoice_id, sokh_id, stage, days_left, channels, message, created_at, sokh_organizations(name)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) {
    return NextResponse.json({ reminders: [], migrated: false, error: error.message });
  }
  const reminders = (data || []).map(r => ({
    ...r,
    stage_label: stageLabel(String(r.stage)),
    name: (r.sokh_organizations as unknown as { name?: string } | null)?.name || `СӨХ #${r.sokh_id}`,
    sokh_organizations: undefined,
  }));
  return NextResponse.json({ reminders, migrated: true });
}

export async function POST() {
  if (!(await requireSuperadmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await runInvoiceReminders();
  return NextResponse.json(result, { status: result.migrated ? 200 : 409 });
}
