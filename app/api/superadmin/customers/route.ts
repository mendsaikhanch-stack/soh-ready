import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { getAuthRole } from '@/app/lib/session-token';
import { isDemoSokh } from '@/app/lib/demo-orgs';
import { loadSignIns } from '@/app/lib/auth-signins';
import {
  DEFAULT_TARIFF,
  orgTariff,
  billableMonths,
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
// ⚠️ Лавлахын СӨХ энд ОРОХГҮЙ. Өмнө нь `claim_status in (active, pending)`
// гэж шүүдэг байсан ч лавлахаар импортолсон 1190 СӨХ БҮГД `pending` тул
// жагсаалт тэднээр дүүрч (Supabase-ийн 1000 мөрийн таазанд хүрч) жинхэнэ
// хэрэглэгч алга болдог байв.
//
// Жинхэнэ хэрэглэгчийн шинж: идэвхжсэн (`active`) ЭСВЭЛ даргын нэвтрэх
// бүртгэлтэй. Лавлахын мөрд аль нь ч байхгүй.

const ORG_FIELDS =
  'id, name, phone, contact_email, address, claim_status, activated_at, created_at, unit_count';

interface CustomerAdmin {
  id: number;
  username: string;
  role: string;
  status: string;
  display_name: string | null;
  last_login_at: string | null;
}

interface AdminRow {
  id: number;
  username: string;
  role: string;
  status: string;
  display_name: string | null;
  sokh_id: number | string | null;
  last_login_at?: string | null;
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

// Төлбөрийн гар удирдлагын талбарууд (supabase-billing-control-migration.sql).
// Миграц ажиллаагүй бол баганууд байхгүй тул select унана — тэр үед бүх утга
// null болж, дэлгэц дээр «миграц ажиллуулна уу» гэж гарна.
interface BillingState {
  free_months_override: number | null;
  billing_note: string | null;
  settled_at: string | null;
  settled_note: string | null;
  settled_by: string | null;
}

/** Тухайн сарын тооцооны төлөв */
type MonthStatus = 'paid' | 'pending' | 'missing';

interface MonthRow {
  year: number;
  month: number;
  amount: number;
  status: MonthStatus;
  invoice_id: number | null;
  due_date: string | null;
  paid_at: string | null;
}

interface ContractState {
  number: string | null;
  unlocked_at: string | null;
  downloaded_at: string | null;
}

interface OrgRow {
  id: number;
  name: string;
  phone: string | null;
  contact_email: string | null;
  address: string | null;
  claim_status: string;
  activated_at: string | null;
  created_at: string | null;
  unit_count: number | null;
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

  // 1) Идэвхжсэн СӨХ
  const { data: activeOrgs, error: orgErr } = await supabaseAdmin
    .from('sokh_organizations')
    .select(ORG_FIELDS)
    .eq('claim_status', 'active');

  if (orgErr) {
    console.error('[superadmin/customers]', orgErr.message);
    return NextResponse.json({ error: 'Байгууллага уншиж чадсангүй' }, { status: 500 });
  }

  // 2) Даргын бүртгэлтэй ч идэвхжээгүй СӨХ (онбординг явж байгаа)
  const ADMIN_FIELDS = 'id, username, role, status, display_name, sokh_id';
  // last_login_at баганыг миграц ажиллаагүй бол select унана — тэр үед
  // баганагүйгээр дахин уншиж, дэлгэц дээр «—» гэж харагдана.
  let allAdmins: AdminRow[] = [];
  const withLogin = await supabaseAdmin
    .from('admin_users')
    .select(`${ADMIN_FIELDS}, last_login_at`)
    .not('sokh_id', 'is', null);
  if (withLogin.error) {
    const plain = await supabaseAdmin
      .from('admin_users')
      .select(ADMIN_FIELDS)
      .not('sokh_id', 'is', null);
    allAdmins = (plain.data || []) as AdminRow[];
  } else {
    allAdmins = (withLogin.data || []) as AdminRow[];
  }

  const orgs: OrgRow[] = [...((activeOrgs || []) as OrgRow[])];
  const haveIds = new Set(orgs.map(o => o.id));
  const adminOnlyIds = Array.from(
    new Set(allAdmins.map(a => Number(a.sokh_id)).filter(id => !haveIds.has(id)))
  );
  if (adminOnlyIds.length) {
    const { data: extra } = await supabaseAdmin
      .from('sokh_organizations')
      .select(ORG_FIELDS)
      .in('id', adminOnlyIds);
    orgs.push(...((extra || []) as OrgRow[]));
  }

  // Лавлахад нийт хэдэн бүртгэл байгаа (хянах самбарын «Лавлахад» карт)
  const { count: directoryTotal } = await supabaseAdmin
    .from('sokh_organizations')
    .select('id', { count: 'exact', head: true });

  const orgIds = orgs.map(o => o.id);
  if (!orgIds.length) {
    return NextResponse.json({
      tariff,
      migrated,
      customers: [],
      totals: emptyTotals(directoryTotal || 0),
    });
  }

  // Айлын тоо — unit_count нь гараар бичсэн тоо, бодит мөрөөр тоолно
  const { data: residents } = await supabaseAdmin
    .from('residents')
    .select('sokh_id, debt, created_at, name, auth_user_id')
    .in('sokh_id', orgIds);

  // Апп ашиглалт — нэвтрэх бүртгэлтэй айл, тэдгээрийн сүүлийн нэвтрэлт
  const signIns = await loadSignIns('superadmin/customers');

  const aptCount = new Map<number, number>();
  const debtSum = new Map<number, number>();
  const debtors = new Map<number, number>();
  const acctCount = new Map<number, number>();
  const signedInCount = new Map<number, number>();
  const active7Count = new Map<number, number>();
  const active30Count = new Map<number, number>();
  const lastLoginByOrg = new Map<number, string>();

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const nowMs = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  const bump = (m: Map<number, number>, id: number) => m.set(id, (m.get(id) || 0) + 1);
  let newResidentsThisMonth = 0;

  for (const r of residents || []) {
    const id = Number(r.sokh_id);
    aptCount.set(id, (aptCount.get(id) || 0) + 1);
    const d = Number(r.debt) || 0;
    debtSum.set(id, (debtSum.get(id) || 0) + d);
    if (d > 0) bump(debtors, id);
    if (!isDemoSokh(id) && r.created_at && new Date(r.created_at) >= monthStart) {
      newResidentsThisMonth++;
    }

    if (r.auth_user_id) {
      bump(acctCount, id);
      const last = signIns.get(String(r.auth_user_id));
      if (last) {
        bump(signedInCount, id);
        const age = nowMs - new Date(last).getTime();
        if (age < 7 * DAY) bump(active7Count, id);
        if (age < 30 * DAY) bump(active30Count, id);
        const prev = lastLoginByOrg.get(id);
        if (!prev || last > prev) lastLoginByOrg.set(id, last);
      }
    }
  }

  const orgIdSet = new Set(orgIds);
  const adminsByOrg = new Map<number, CustomerAdmin[]>();
  for (const a of allAdmins) {
    const id = Number(a.sokh_id);
    // Устгагдсан байгууллага руу заасан эзэнгүй бүртгэл байж болно
    if (!orgIdSet.has(id)) continue;
    if (!adminsByOrg.has(id)) adminsByOrg.set(id, []);
    adminsByOrg.get(id)!.push({
      id: a.id, username: a.username, role: a.role,
      status: a.status, display_name: a.display_name,
      last_login_at: a.last_login_at ?? null,
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

  // Гэрээ татах эрхийн төлөв. Миграц ажиллаагүй бол багана байхгүй тул
  // алдаа буцна — тэр тохиолдолд хуудас унахгүй, зүгээр л «гэрээ» хэсэг
  // нээгдээгүй байдлаар харагдана.
  const contractByOrg = new Map<number, ContractState>();
  const { data: contractRows, error: contractErr } = await supabaseAdmin
    .from('sokh_organizations')
    .select('id, contract_number, contract_unlocked_at, contract_downloaded_at')
    .in('id', orgIds);
  const contractMigrated = !contractErr;
  for (const r of contractRows || []) {
    contractByOrg.set(Number(r.id), {
      number: (r.contract_number as string) ?? null,
      unlocked_at: (r.contract_unlocked_at as string) ?? null,
      downloaded_at: (r.contract_downloaded_at as string) ?? null,
    });
  }

  // Төлбөрийн гар удирдлага (үнэгүй сарын сунгалт, тооцооны тэмдэглэгээ)
  const billingByOrg = new Map<number, BillingState>();
  const { data: billRows, error: billErr } = await supabaseAdmin
    .from('sokh_organizations')
    .select('id, free_months_override, billing_note, settled_at, settled_note, settled_by')
    .in('id', orgIds);
  const billingMigrated = !billErr;
  for (const r of billRows || []) {
    billingByOrg.set(Number(r.id), {
      free_months_override: (r.free_months_override as number) ?? null,
      billing_note: (r.billing_note as string) ?? null,
      settled_at: (r.settled_at as string) ?? null,
      settled_note: (r.settled_note as string) ?? null,
      settled_by: (r.settled_by as string) ?? null,
    });
  }

  const now = new Date();

  const customers = orgs.map(o => {
    const apartments = aptCount.get(o.id) || 0;
    const orgInvoices = invByOrg.get(o.id) || [];
    const billing = billingByOrg.get(o.id) || null;

    // Үнэгүй сарыг тухайн СӨХ-д сунгасан бол тарифыг нь тэрүүгээр солино
    const t = orgTariff(tariff, billing?.free_months_override);

    const setupInvoice = orgInvoices.find(i => i.kind === 'setup') || null;
    const monthlyInvoices = orgInvoices.filter(i => i.kind !== 'setup');
    const billed = new Set(monthlyInvoices.map(i => periodKey(i.period_year, i.period_month)));

    const start = billingStartDate(o.activated_at, t, apartments);
    const next = nextBillingPeriod(o.activated_at, t, apartments, billed, now);

    // Тооцооны хуанли: төлбөр эхэлснээс хойшхи сар бүр нэхэмжлэгдсэн үү,
    // төлөгдсөн үү. «missing» = тухайн сарын тооцоо огт хийгдээгүй.
    const invByPeriod = new Map<string, CustomerInvoice>();
    for (const inv of monthlyInvoices) {
      invByPeriod.set(periodKey(inv.period_year, inv.period_month), inv);
    }
    const months: MonthRow[] = billableMonths(o.activated_at, t, apartments, now).map(m => {
      const inv = invByPeriod.get(periodKey(m.year, m.month)) || null;
      return {
        year: m.year,
        month: m.month,
        amount: inv ? Number(inv.amount) : monthlyFee(t, apartments),
        status: !inv ? 'missing' : inv.status === 'paid' ? 'paid' : 'pending',
        invoice_id: inv ? inv.id : null,
        due_date: inv ? inv.due_date : null,
        paid_at: inv ? inv.paid_at : null,
      };
    });
    const unbilledMonths = months.filter(m => m.status === 'missing').length;
    const unpaidMonths = months.filter(m => m.status === 'pending').length;

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
      is_demo: isDemoSokh(o.id),

      apartments,
      registered_units: o.unit_count,
      debt_total: debtSum.get(o.id) || 0,
      debtors: debtors.get(o.id) || 0,

      // Апп ашиглалт
      accounts: acctCount.get(o.id) || 0,
      signed_in: signedInCount.get(o.id) || 0,
      active_7d: active7Count.get(o.id) || 0,
      active_30d: active30Count.get(o.id) || 0,
      last_login_at: lastLoginByOrg.get(o.id) || null,

      admins: adminsByOrg.get(o.id) || [],
      activation_token: tk
        ? {
            expires_at: tk.expires_at,
            used: !!tk.used_at,
            expired: !tk.used_at && new Date(tk.expires_at) < now,
          }
        : null,

      // Тарифаар тооцсон дүн (нэхэмжлэх үүсгэхээс өмнө ч харагдана)
      setup_fee: setupFee(t, apartments),
      monthly_fee: monthlyFee(t, apartments),
      free_months: freeMonths(t, apartments),
      free_months_default: freeMonths(tariff, apartments),
      free_months_override: billing?.free_months_override ?? null,
      billing_starts_at: start ? start.toISOString() : null,
      billing_active: start ? now >= start : false,

      // Тооцоо
      months,
      unbilled_months: unbilledMonths,
      unpaid_months: unpaidMonths,
      settled_at: billing?.settled_at ?? null,
      settled_note: billing?.settled_note ?? null,
      settled_by: billing?.settled_by ?? null,
      billing_note: billing?.billing_note ?? null,

      // Үйлчилгээний гэрээ — нээгдсэн эсэх, дугаар, сүүлд татсан
      contract: contractByOrg.get(o.id) || null,

      setup_invoice: setupInvoice,
      next_period: next,
      invoices: orgInvoices,
      unpaid_total: unpaid,
      paid_total: paidTotal,
    };
  });

  // Айл ихтэйг нь эхэнд — жагсаалтын дараалал хаана ч ижил байх ёстой
  customers.sort((a, b) => {
    if (a.is_demo !== b.is_demo) return a.is_demo ? 1 : -1;
    return b.apartments - a.apartments;
  });

  // Нийлбэрийг сервер тооцно — дэлгэц бүр өөрөө нэмж эхэлбэл зөрнө.
  // Туршилтын СӨХ нийлбэрт ОРОХГҮЙ.
  const real = customers.filter(c => !c.is_demo);
  const activeReal = real.filter(c => c.claim_status === 'active');

  const totals = {
    customers: real.length,
    active: activeReal.length,
    apartments: activeReal.reduce((s, c) => s + c.apartments, 0),
    residents: real.reduce((s, c) => s + c.apartments, 0),
    resident_debt: real.reduce((s, c) => s + c.debt_total, 0),
    debtors: real.reduce((s, c) => s + c.debtors, 0),
    new_residents_this_month: newResidentsThisMonth,
    // Апп ашиглалт — нэвтрэх бүртгэлтэй болсон, нэвтэрч үзсэн, идэвхтэй айл
    accounts: real.reduce((s, c) => s + c.accounts, 0),
    signed_in: real.reduce((s, c) => s + c.signed_in, 0),
    active_7d: real.reduce((s, c) => s + c.active_7d, 0),
    active_30d: real.reduce((s, c) => s + c.active_30d, 0),
    admin_accounts: real.reduce((s, c) => s + c.admins.filter(a => a.status === 'active').length, 0),
    admins_signed_in: real.reduce(
      (s, c) => s + c.admins.filter(a => a.last_login_at).length, 0),
    admins_active_30d: real.reduce(
      (s, c) => s + c.admins.filter(
        a => a.last_login_at && nowMs - new Date(a.last_login_at).getTime() < 30 * DAY
      ).length, 0),
    new_customers_this_month: activeReal.filter(
      c => c.activated_at && new Date(c.activated_at) >= monthStart
    ).length,
    // Хотол руу орох мөнгө
    monthly_billable: activeReal.filter(c => c.billing_active).reduce((s, c) => s + c.monthly_fee, 0),
    monthly_when_all_billing: activeReal.reduce((s, c) => s + c.monthly_fee, 0),
    setup_expected: activeReal.reduce((s, c) => s + c.setup_fee, 0),
    paid_total: real.reduce((s, c) => s + c.paid_total, 0),
    unpaid_total: real.reduce((s, c) => s + c.unpaid_total, 0),
    // Тооцоо — нэхэмжлээгүй өнгөрсөн сар, тооцоо хийгээгүй СӨХ
    unbilled_months: real.reduce((s, c) => s + c.unbilled_months, 0),
    orgs_unbilled: real.filter(c => c.unbilled_months > 0).length,
    orgs_unsettled: activeReal.filter(c => !c.settled_at).length,
    directory_total: directoryTotal || 0,
  };

  // Хянах самбарын «Сүүлийн үйл ажиллагаа» — хамгийн сүүлд бүртгүүлсэн айлууд
  const recentResidents = (residents || [])
    .filter(r => r.created_at)
    .sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime())
    .slice(0, 10)
    .map(r => ({ sokh_id: Number(r.sokh_id), name: r.name as string | null, created_at: r.created_at as string }));

  return NextResponse.json({
    tariff, migrated, customers, totals,
    contract_migrated: contractMigrated,
    billing_migrated: billingMigrated,
    recent_residents: recentResidents,
  });
}

function emptyTotals(directoryTotal: number) {
  return {
    customers: 0, active: 0, apartments: 0, residents: 0,
    resident_debt: 0, debtors: 0,
    accounts: 0, signed_in: 0, active_7d: 0, active_30d: 0,
    unbilled_months: 0, orgs_unbilled: 0, orgs_unsettled: 0,
    admin_accounts: 0, admins_signed_in: 0, admins_active_30d: 0,
    new_residents_this_month: 0, new_customers_this_month: 0,
    monthly_billable: 0, monthly_when_all_billing: 0, setup_expected: 0,
    paid_total: 0, unpaid_total: 0,
    directory_total: directoryTotal,
  };
}
