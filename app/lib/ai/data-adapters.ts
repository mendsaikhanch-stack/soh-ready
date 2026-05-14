// Khotol AI Data Adapters
// ============================================================
// Зорилго: AI prompts/-н бүх input-ыг үүсгэх tenant-scoped DB query
// layer. Ирээдүйд схем өөрчлөгдсөн ч зөвхөн ЭНЭ файлыг засна.
//
// Зарчим:
//   1. Бүх adapter `{ sokhId, month }` авна
//   2. KHOTOL_DEMO_MODE=1 байх үед demo fixtures-аас уншина
//   3. Бодит query нь зөвхөн өгөгдсөн sokhId-ийн дотор (tenant isolation)
//   4. Хүснэгт хоосон бол `source: 'empty'` буцаана — input нь зүгээр
//      хоосон утгуудтай, prompts/template нь "өгөгдөл алга" гэж дүрэх
//   5. AI/template аль нь ч энэ input-ын тоог зохиогоор өөрчилж болохгүй
//
// Хэрэглэдэг хүснэгтүүд (SOURCE OF TRUTH):
//   - sokh_organizations         (name)
//   - residents                  (id, name, debt, sokh_id)
//   - invoices                   (sokh_id, year, month, amount, status, paid_amount, paid_at)
//   - payments                   (resident_id, amount, paid_at)  ← join via residents
//   - reserve_fund               (sokh_id, type, amount, occurred_at)
//   - maintenance_requests       (sokh_id, title, status, created_at)
//   - complaints                 (sokh_id, category, title, status, created_at)
//   - announcements              (sokh_id, type, created_at)
//
// Хэрэв шинэ хүснэгт нэмэгдэх / хуучин нь rename хийгдэх бол:
//   - Зөвхөн энэ файл доторх SQL query-уудыг засна
//   - Adapter function-ы гадаа signature болон output shape-ыг өөрчилөхгүй

import { supabaseAdmin } from '@/app/lib/supabase-admin';
import type {
  DebtReminderInput,
  FinancialReportInput,
  MonthlyInsightInput,
  IssueInsightInput,
  IssueRow,
  BoardReportInput,
} from './prompts/soh-operations';
import {
  DEMO_DEBT_REMINDER_INPUT,
  DEMO_FINANCIAL_REPORT_INPUT,
  DEMO_MONTHLY_INSIGHT_INPUT,
  DEMO_ISSUE_INSIGHT_INPUT,
  DEMO_BOARD_REPORT_INPUT,
} from './demo-data';

// ============================================================
// Common types
// ============================================================

export interface AdapterContext {
  /** Аль СӨХ-ийн өгөгдөл — admin session-аас */
  sokhId: number;
  /** "YYYY-MM" формат. Өгөгдөөгүй бол одоогийн сар. */
  month?: string;
}

export type AdapterSource = 'real' | 'demo' | 'empty';

export interface AdapterResult<T> {
  input: T;
  source: AdapterSource;
  /** Хэрэглэгчид харуулах нэмэлт тэмдэглэл (хоосон хүснэгт, г.м.) */
  notes?: string[];
}

// ============================================================
// Helpers
// ============================================================

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function currentMonthLabel(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

function parseMonth(label: string | undefined): { year: number; month: number; label: string } {
  const fallback = currentMonthLabel();
  const target = label && /^\d{4}-\d{1,2}$/.test(label) ? label : fallback;
  const [y, m] = target.split('-').map((n) => parseInt(n, 10));
  return { year: y, month: m, label: `${y}-${pad(m)}` };
}

function monthDateRange(year: number, month: number): { start: string; end: string } {
  return {
    start: new Date(Date.UTC(year, month - 1, 1)).toISOString(),
    end: new Date(Date.UTC(year, month, 1)).toISOString(),
  };
}

function isDemoMode(): boolean {
  return process.env.KHOTOL_DEMO_MODE === '1';
}

async function fetchSokhName(sokhId: number): Promise<string> {
  if (!sokhId || sokhId <= 0) return 'СӨХ';
  const { data } = await supabaseAdmin
    .from('sokh_organizations')
    .select('name')
    .eq('id', sokhId)
    .maybeSingle();
  return (data?.name as string) || 'СӨХ';
}

const EMPTY_NOTE = 'Холбогдох хүснэгтэд өгөгдөл олдсонгүй — input хоосон утгатай.';

// ============================================================
// 1. Debt reminder input
// ============================================================
// Эх сурвалж: `invoices` (status='pending'|'overdue'|'partial') эсвэл
// fallback `residents.debt > 0`.
// `invoices` хүснэгтэд тухайн сарын pending нь хамгийн бодит — зөвхөн
// тэр сард эргэлзээгүй өртэй айлуудыг тоолно.

export async function getDebtReminderInput(
  ctx: AdapterContext,
): Promise<AdapterResult<DebtReminderInput>> {
  if (isDemoMode()) {
    return { input: DEMO_DEBT_REMINDER_INPUT, source: 'demo' };
  }

  const { year, month, label } = parseMonth(ctx.month);
  const sokhName = await fetchSokhName(ctx.sokhId);

  // 1a) Эхлээд invoices-аас тухайн сарын pending/overdue/partial-ыг авна
  const { data: invoiceRows } = await supabaseAdmin
    .from('invoices')
    .select('id, resident_id, amount, paid_amount, status')
    .eq('sokh_id', ctx.sokhId)
    .eq('year', year)
    .eq('month', month)
    .in('status', ['pending', 'overdue', 'partial'])
    .limit(2000);

  type InvoiceRow = { id: number; resident_id: number; amount: number | string; paid_amount: number | string | null; status: string };
  const invoices = (invoiceRows || []) as InvoiceRow[];

  let unpaidCount = invoices.length;
  let totalUnpaid = invoices.reduce(
    (acc, r) => acc + (Number(r.amount) - Number(r.paid_amount || 0)),
    0,
  );

  // 1b) Хэрэв invoices-д тухайн сард мөр алга бол residents.debt-аас fallback
  if (invoices.length === 0) {
    const { data: residentsRows } = await supabaseAdmin
      .from('residents')
      .select('id, debt')
      .eq('sokh_id', ctx.sokhId)
      .gt('debt', 0);
    type ResidentRow = { id: number; debt: number | string };
    const rows = (residentsRows || []) as ResidentRow[];
    unpaidCount = rows.length;
    totalUnpaid = rows.reduce((acc, r) => acc + Number(r.debt || 0), 0);
  }

  const input: DebtReminderInput = {
    month: label,
    unpaidCount,
    totalUnpaid,
    tone: 'polite',
    sokhName,
  };

  if (unpaidCount === 0 && totalUnpaid === 0) {
    return { input, source: 'empty', notes: [EMPTY_NOTE] };
  }
  return { input, source: 'real' };
}

// ============================================================
// 2. Financial summary input (per-month)
// ============================================================
// Эх сурвалж:
//   - invoices(status='paid') — орлого (sum of paid_amount)
//   - reserve_fund(type='withdrawal') — зарлага
//   - reserve_fund(type='deposit') — нөөц орлого
//   - balance = orlogo - zarlaga
//   - majorExpenses — reserve_fund withdrawal-ыг description-р groupбөөгөөд

export async function getFinancialSummaryInput(
  ctx: AdapterContext,
): Promise<AdapterResult<FinancialReportInput>> {
  if (isDemoMode()) {
    return { input: DEMO_FINANCIAL_REPORT_INPUT, source: 'demo' };
  }

  const { year, month, label } = parseMonth(ctx.month);
  const { start, end } = monthDateRange(year, month);
  const sokhName = await fetchSokhName(ctx.sokhId);

  const [paidInvoicesRes, reserveRowsRes] = await Promise.all([
    supabaseAdmin
      .from('invoices')
      .select('paid_amount, status')
      .eq('sokh_id', ctx.sokhId)
      .eq('year', year)
      .eq('month', month)
      .in('status', ['paid', 'partial'])
      .limit(5000),
    supabaseAdmin
      .from('reserve_fund')
      .select('type, amount, description')
      .eq('sokh_id', ctx.sokhId)
      .gte('occurred_at', start.slice(0, 10))
      .lt('occurred_at', end.slice(0, 10))
      .limit(2000),
  ]);

  type InvoicePaidRow = { paid_amount: number | string | null; status: string };
  type ReserveRow = { type: 'deposit' | 'withdrawal' | string; amount: number | string; description: string | null };
  const paidInvoices = (paidInvoicesRes.data || []) as InvoicePaidRow[];
  const reserveRows = (reserveRowsRes.data || []) as ReserveRow[];

  const incomeFromInvoices = paidInvoices.reduce((s, r) => s + Number(r.paid_amount || 0), 0);
  const incomeFromReserve = reserveRows
    .filter((r) => r.type === 'deposit')
    .reduce((s, r) => s + Number(r.amount || 0), 0);
  const income = incomeFromInvoices + incomeFromReserve;

  const expense = reserveRows
    .filter((r) => r.type === 'withdrawal')
    .reduce((s, r) => s + Number(r.amount || 0), 0);

  // Major expenses — description-р groupбөөгөөд top 5
  const expenseByDesc = new Map<string, number>();
  for (const r of reserveRows) {
    if (r.type !== 'withdrawal') continue;
    const key = r.description?.trim() || 'Бусад зарлага';
    expenseByDesc.set(key, (expenseByDesc.get(key) || 0) + Number(r.amount || 0));
  }
  const majorExpenses = Array.from(expenseByDesc.entries())
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  const input: FinancialReportInput = {
    month: label,
    income,
    expense,
    balance: income - expense,
    majorExpenses,
    sokhName,
  };

  if (income === 0 && expense === 0) {
    return { input, source: 'empty', notes: [EMPTY_NOTE] };
  }
  return { input, source: 'real' };
}

// ============================================================
// 3. Monthly finance insight
// ============================================================
// Эх сурвалж:
//   - invoices(sokh_id, year, month) — нэхэмжлэлийн нийт + paid тоо
//   - residents.debt — fallback unpaid тооцоо

export async function getMonthlyInsightInput(
  ctx: AdapterContext,
): Promise<AdapterResult<MonthlyInsightInput>> {
  if (isDemoMode()) {
    return { input: DEMO_MONTHLY_INSIGHT_INPUT, source: 'demo' };
  }

  const { year, month, label } = parseMonth(ctx.month);

  const { data: invoiceRows } = await supabaseAdmin
    .from('invoices')
    .select('amount, paid_amount, status')
    .eq('sokh_id', ctx.sokhId)
    .eq('year', year)
    .eq('month', month)
    .limit(5000);

  type Row = { amount: number | string; paid_amount: number | string | null; status: string };
  const rows = (invoiceRows || []) as Row[];

  const invoiceCount = rows.length;
  const paidCount = rows.filter((r) => r.status === 'paid').length;
  const totalBilled = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
  const unpaidAmount = rows.reduce(
    (s, r) => s + (Number(r.amount) - Number(r.paid_amount || 0)),
    0,
  );

  const input: MonthlyInsightInput = {
    month: label,
    invoiceCount,
    paidCount,
    unpaidAmount: Math.max(0, unpaidAmount),
    totalBilled,
  };

  if (invoiceCount === 0) {
    return { input, source: 'empty', notes: [EMPTY_NOTE] };
  }
  return { input, source: 'real' };
}

// ============================================================
// 4. Issue insight
// ============================================================
// Эх сурвалж: complaints + maintenance_requests-ыг хослуулна.
// Хоёулаа sokh_id-тэй учир tenant-safe.

export async function getIssueInsightInput(
  ctx: AdapterContext,
): Promise<AdapterResult<IssueInsightInput>> {
  if (isDemoMode()) {
    return { input: DEMO_ISSUE_INSIGHT_INPUT, source: 'demo' };
  }

  const { year, month, label } = parseMonth(ctx.month);
  const { start, end } = monthDateRange(year, month);

  const [complaintsRes, maintenanceRes] = await Promise.all([
    supabaseAdmin
      .from('complaints')
      .select('id, category, title, status, created_at')
      .eq('sokh_id', ctx.sokhId)
      .gte('created_at', start)
      .lt('created_at', end)
      .limit(500),
    supabaseAdmin
      .from('maintenance_requests')
      .select('id, title, status, created_at')
      .eq('sokh_id', ctx.sokhId)
      .gte('created_at', start)
      .lt('created_at', end)
      .limit(500),
  ]);

  type Complaint = { id: number; category: string | null; title: string; status: string; created_at: string };
  type Maintenance = { id: number; title: string; status: string; created_at: string };
  const complaints = (complaintsRes.data || []) as Complaint[];
  const maintenance = (maintenanceRes.data || []) as Maintenance[];

  const now = Date.now();
  const toIssueRow = (
    title: string,
    status: string,
    createdAt: string,
    category?: string | null,
  ): IssueRow => {
    const hoursOpen = Math.round((now - new Date(createdAt).getTime()) / 3600000);
    const normalizedStatus: IssueRow['status'] = (() => {
      const s = (status || '').toLowerCase();
      if (s === 'resolved' || s === 'closed' || s === 'done') return 'resolved';
      if (s === 'in_progress' || s === 'progress' || s === 'replied') return 'in_progress';
      if (s === 'overdue') return 'overdue';
      return 'open';
    })();
    return {
      category: category?.trim() || title || 'Тодорхойгүй',
      status: normalizedStatus,
      hoursOpen,
    };
  };

  const issues: IssueRow[] = [
    ...complaints.map((c) => toIssueRow(c.title, c.status, c.created_at, c.category)),
    ...maintenance.map((m) => toIssueRow(m.title, m.status, m.created_at)),
  ];

  const input: IssueInsightInput = {
    month: label,
    issues,
  };

  if (issues.length === 0) {
    return { input, source: 'empty', notes: [EMPTY_NOTE] };
  }
  return { input, source: 'real' };
}

// ============================================================
// 5. Board report input
// ============================================================
// Эх сурвалж: дээрх 4-ийг хослуулсан.
// Reserve_fund-аас нэмэлт "completed_tasks" авах боломжтой — одоогоор
// reserve_fund.description хосгуулсан 3-ыг ашиглана.

export async function getBoardReportInput(
  ctx: AdapterContext,
): Promise<AdapterResult<BoardReportInput>> {
  if (isDemoMode()) {
    return { input: DEMO_BOARD_REPORT_INPUT, source: 'demo' };
  }

  const { year, month, label } = parseMonth(ctx.month);
  const { start, end } = monthDateRange(year, month);
  const sokhName = await fetchSokhName(ctx.sokhId);

  // Бусад adapter-уудыг дахин ашиглах нь хамгийн тогтвортой — нэг л
  // SQL-ийн форм хэвээр үлдэнэ.
  const [insightRes, issueRes, announceRes, completedRes] = await Promise.all([
    getMonthlyInsightInput(ctx),
    getIssueInsightInput(ctx),
    supabaseAdmin
      .from('announcements')
      .select('id')
      .eq('sokh_id', ctx.sokhId)
      .gte('created_at', start)
      .lt('created_at', end),
    supabaseAdmin
      .from('reserve_fund')
      .select('description, type, occurred_at')
      .eq('sokh_id', ctx.sokhId)
      .eq('type', 'withdrawal')
      .gte('occurred_at', start.slice(0, 10))
      .lt('occurred_at', end.slice(0, 10))
      .order('occurred_at', { ascending: false })
      .limit(3),
  ]);

  const insight = insightRes.input;
  const issues = issueRes.input.issues;
  const announcementsCount = announceRes.data?.length || 0;
  const resolvedIssuesCount = issues.filter((i) => i.status === 'resolved').length;
  const completedTasks = (completedRes.data || [])
    .map((r) => (r as { description?: string }).description)
    .filter((s): s is string => !!s && s.trim().length > 0);

  const totalPaid = Math.max(0, insight.totalBilled - insight.unpaidAmount);

  const input: BoardReportInput = {
    month: label,
    sokhName,
    totalPaid,
    unpaidAmount: insight.unpaidAmount,
    unpaidCount: insight.invoiceCount - insight.paidCount,
    announcementsCount,
    issuesCount: issues.length,
    resolvedIssuesCount,
    completedTasks,
  };

  const hasData =
    insight.invoiceCount > 0 ||
    issues.length > 0 ||
    announcementsCount > 0 ||
    completedTasks.length > 0;

  return {
    input,
    source: hasData ? 'real' : 'empty',
    notes: hasData ? undefined : [EMPTY_NOTE],
  };
}

// ============================================================
// Combined dispatcher (caller-д тус болох)
// ============================================================

export type AdapterKind =
  | 'debt_reminder'
  | 'financial_report'
  | 'monthly_insight'
  | 'issue_insight'
  | 'board_report';

export async function getAdapterInput<K extends AdapterKind>(
  kind: K,
  ctx: AdapterContext,
): Promise<
  K extends 'debt_reminder'
    ? AdapterResult<DebtReminderInput>
    : K extends 'financial_report'
      ? AdapterResult<FinancialReportInput>
      : K extends 'monthly_insight'
        ? AdapterResult<MonthlyInsightInput>
        : K extends 'issue_insight'
          ? AdapterResult<IssueInsightInput>
          : K extends 'board_report'
            ? AdapterResult<BoardReportInput>
            : never
> {
  // TypeScript-ийн conditional return-д хүчээр cast хийх
  switch (kind) {
    case 'debt_reminder':
      return (await getDebtReminderInput(ctx)) as never;
    case 'financial_report':
      return (await getFinancialSummaryInput(ctx)) as never;
    case 'monthly_insight':
      return (await getMonthlyInsightInput(ctx)) as never;
    case 'issue_insight':
      return (await getIssueInsightInput(ctx)) as never;
    case 'board_report':
      return (await getBoardReportInput(ctx)) as never;
    default: {
      const _exhaustive: never = kind;
      void _exhaustive;
      throw new Error(`Unknown adapter kind: ${kind}`);
    }
  }
}
