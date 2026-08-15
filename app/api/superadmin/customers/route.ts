import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { getAuthRole } from '@/app/lib/session-token';
import {
  DEFAULT_TARIFF,
  setupFee,
  monthlyFee,
  freeMonths,
  billingStartDate,
  nextBillingPeriod,
  periodKey,
  type PlatformTariff,
} from '@/app/lib/platform-pricing';

// Хэрэглэгч болсон СӨХ бүрийн нэгдсэн карт: айлын тоо, нэвтрэх бүртгэл,
// идэвхжүүлэх кодын хугацаа, тариф, төлсөн/төлөх төлбөр.
//
// Лавлахад л байгаа 1000+ СӨХ энд ОРОХГҮЙ — зөвхөн идэвхжсэн эсвэл оршин
// суугчтай нь. Эс бөгөөс жагсаалт лавлахаар дүүрч, хянах утгаа алдана.

interface CustomerAdmin {
  id: number;
  username: string;
  role: string;
  status: string;
  display_name: string | null;
}

interface CustomerInvoice {
  id: number;
  kind: string;
  period_year: number;
  period_month: number;
  amount: number;
  status: string;
  due_date: string;
  paid_at: string | null;
  paid_amount: number | null;
}

export async function GET() {
  const auth = await getAuthRole();
  if (!auth || auth.role !== 'superadmin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Тариф (миграц ажиллаагүй бол үндсэн утгаар)
  let tariff: PlatformTariff = DEFAULT_TARIFF;
  let migrated = true;
  const { data: tRow, error: tErr } = await supabaseAdmin
    .from('platform_tariff')
    .select('*')
    .eq('id', 1)
    .maybeSingle();
  if (tErr) migrated = false;
  else if (tRow) tariff = { ...DEFAULT_TARIFF, ...tRow };

  const { data: orgs, error: orgErr } = await supabaseAdmin
    .from('sokh_organizations')
    .select('id, name, phone, contact_email, address, claim_status, activated_at, created_at, unit_count')
    .in('claim_status', ['active', 'pending'])
    .order('activated_at', { ascending: true });

  if (orgErr) {
    console.error('[superadmin/customers]', orgErr.message);
    return NextResponse.json({ error: 'Байгууллага уншиж чадсангүй' }, { status: 500 });
  }

  const orgIds = (orgs || []).map(o => o.id);
  if (!orgIds.length) return NextResponse.json({ tariff, migrated, customers: [] });

  // Айлын тоо — unit_count нь гараар бичсэн тоо, бодит мөрөөр тоолно
  const { data: residents } = await supabaseAdmin
    .from('residents')
    .select('sokh_id, debt')
    .in('sokh_id', orgIds);

  const aptCount = new Map<number, number>();
  const debtSum = new Map<number, number>();
  const debtors = new Map<number, number>();
  for (const r of residents || []) {
    const id = Number(r.sokh_id);
    aptCount.set(id, (aptCount.get(id) || 0) + 1);
    const d = Number(r.debt) || 0;
    debtSum.set(id, (debtSum.get(id) || 0) + d);
    if (d > 0) debtors.set(id, (debtors.get(id) || 0) + 1);
  }

  const { data: admins } = await supabaseAdmin
    .from('admin_users')
    .select('id, username, role, status, display_name, sokh_id')
    .in('sokh_id', orgIds);

  const adminsByOrg = new Map<number, CustomerAdmin[]>();
  for (const a of admins || []) {
    const id = Number(a.sokh_id);
    if (!adminsByOrg.has(id)) adminsByOrg.set(id, []);
    adminsByOrg.get(id)!.push({
      id: a.id, username: a.username, role: a.role,
      status: a.status, display_name: a.display_name,
    });
  }

  // Идэвхжүүлэх код — кодыг өөрийг нь хадгалдаггүй (bcrypt hash), зөвхөн
  // хүчинтэй эсэх + хугацаа харагдана.
  const { data: tokens } = await supabaseAdmin
    .from('sokh_activation_tokens')
    .select('sokh_id, expires_at, used_at')
    .in('sokh_id', orgIds)
    .order('expires_at', { ascending: false });

  const tokenByOrg = new Map<number, { expires_at: string; used_at: string | null }>();
  for (const t of tokens || []) {
    const id = Number(t.sokh_id);
    if (!tokenByOrg.has(id)) tokenByOrg.set(id, { expires_at: t.expires_at, used_at: t.used_at });
  }

  const { data: invoices } = await supabaseAdmin
    .from('platform_invoices')
    .select('id, sokh_id, kind, period_year, period_month, amount, status, due_date, paid_at, paid_amount')
    .in('sokh_id', orgIds)
    .order('period_year', { ascending: false })
    .order('period_month', { ascending: false });

  const invByOrg = new Map<number, CustomerInvoice[]>();
  for (const inv of invoices || []) {
    const id = Number(inv.sokh_id);
    if (!invByOrg.has(id)) invByOrg.set(id, []);
    invByOrg.get(id)!.push(inv as CustomerInvoice);
  }

  const now = new Date();

  const customers = (orgs || []).map(o => {
    const apartments = aptCount.get(o.id) || 0;
    const orgInvoices = invByOrg.get(o.id) || [];

    const setupInvoice = orgInvoices.find(i => i.kind === 'setup') || null;
    const monthlyInvoices = orgInvoices.filter(i => i.kind !== 'setup');
    const billed = new Set(monthlyInvoices.map(i => periodKey(i.period_year, i.period_month)));

    const start = billingStartDate(o.activated_at, tariff, apartments);
    const next = nextBillingPeriod(o.activated_at, tariff, apartments, billed, now);

    const unpaid = orgInvoices
      .filter(i => i.status !== 'paid' && i.status !== 'cancelled')
      .reduce((s, i) => s + Number(i.amount), 0);
    const paidTotal = orgInvoices
      .filter(i => i.status === 'paid')
      .reduce((s, i) => s + Number(i.paid_amount ?? i.amount), 0);

    const tk = tokenByOrg.get(o.id) || null;

    return {
      id: o.id,
      name: o.name,
      phone: o.phone,
      email: o.contact_email,
      address: o.address,
      claim_status: o.claim_status,
      activated_at: o.activated_at,
      created_at: o.created_at,

      apartments,
      registered_units: o.unit_count,
      debt_total: debtSum.get(o.id) || 0,
      debtors: debtors.get(o.id) || 0,

      admins: adminsByOrg.get(o.id) || [],
      activation_token: tk
        ? {
            expires_at: tk.expires_at,
            used: !!tk.used_at,
            expired: !tk.used_at && new Date(tk.expires_at) < now,
          }
        : null,

      // Тарифаар тооцсон дүн (нэхэмжлэх үүсгэхээс өмнө ч харагдана)
      setup_fee: setupFee(tariff, apartments),
      monthly_fee: monthlyFee(tariff, apartments),
      free_months: freeMonths(tariff, apartments),
      billing_starts_at: start ? start.toISOString() : null,
      billing_active: start ? now >= start : false,

      setup_invoice: setupInvoice,
      next_period: next,
      invoices: orgInvoices,
      unpaid_total: unpaid,
      paid_total: paidTotal,
    };
  });

  return NextResponse.json({ tariff, migrated, customers });
}
