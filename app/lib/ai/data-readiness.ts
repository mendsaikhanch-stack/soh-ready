// Khotol AI Data Readiness
// ============================================================
// /admin/ai-ийн action cards-ийн дээр харагдах "Data Readiness" panel-д
// зориулсан өгөгдлийн төлөв шалгагч. Энэ нь:
//
//   - Зөвхөн COUNT query хийнэ — өгөгдлийн биеийг татахгүй
//   - sokh_id-р tenant-scoped (admin өөрийн СӨХ-ийн л тоо харна)
//   - AI / провайдер дуудахгүй (бүх ажил DB-аас)
//   - Хүснэгт байхгүй (relation does not exist) бол `missing_table` буцаана
//
// Шалгадаг хүснэгтүүд:
//   1. invoices             — тухайн сарын нэхэмжлэлийн нийт + paid/pending
//   2. residents            — нийт + debt > 0
//   3. complaints           — тухайн сарын гомдлын тоо
//   4. maintenance_requests — тухайн сарын засварын хүсэлтийн тоо
//   5. announcements        — тухайн сарын зарлалын тоо
//   6. reserve_fund         — тухайн сарын санхүүгийн орлого/зарлагын мөр

import { supabaseAdmin } from '@/app/lib/supabase-admin';

export type ReadinessStatus = 'ready' | 'empty' | 'missing_table';

export type RecommendedActionType =
  | 'import'   // CSV/Excel импортоор олон мөр оруулах
  | 'create'   // 1 шинэ бичлэг үүсгэх (UI form)
  | 'migrate'  // DB migration шаардлагатай
  | 'review'   // одоо байгаа бичлэгийг шалгах
  | 'none';    // юу ч хийх шаардлагагүй (жишээ: өр алга бол сайн)

export interface RecommendedAction {
  label: string;
  /** Бодит байгаа admin route. null бол hint-only. */
  href: string | null;
  type: RecommendedActionType;
}

export interface ReadinessItem {
  key: string;
  label: string;
  count: number;
  status: ReadinessStatus;
  hint: string;
  /** Аль AI action-д харьяалагдах */
  relatesTo: Array<
    'debt_reminder' | 'financial_report' | 'monthly_insight' | 'issue_insight' | 'board_report'
  >;
  /** Admin-д дараагийн алхам санал болгох. status='ready' үед `type: 'none'` болж байж болно. */
  recommendedAction: RecommendedAction;
}

export interface ReadinessSnapshot {
  sokhId: number;
  month: string; // "YYYY-MM"
  generatedAt: string;
  items: ReadinessItem[];
}

// ============================================================
// Helpers
// ============================================================

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}
function currentMonth(): { year: number; month: number; label: string; start: string; end: string } {
  const d = new Date();
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  return {
    year,
    month,
    label: `${year}-${pad(month)}`,
    start: new Date(Date.UTC(year, month - 1, 1)).toISOString(),
    end: new Date(Date.UTC(year, month, 1)).toISOString(),
  };
}

// PostgrestError code 42P01 = "relation does not exist".
// Бусад алдаа гарвал missing гэхгүй — empty гэж тэмдэглэнэ, лог үлдээнэ.
function isMissingTable(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code === '42P01') return true;
  return (err.message || '').toLowerCase().includes('does not exist');
}

interface CountResult {
  count: number | null;
  status: ReadinessStatus;
  error?: string;
}

// Supabase JS client-ийн төрөл цаг үргэлж inferred — `any` ашиглах нь
// энд хамгийн цэгцтэй (зөвхөн filter chain-ийг буцаахад).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FilterBuilder = any;

async function safeCount(
  table: string,
  applyFilters: (q: FilterBuilder) => FilterBuilder,
): Promise<CountResult> {
  try {
    const base = supabaseAdmin.from(table).select('*', { count: 'exact', head: true });
    const q = applyFilters(base);
    const { count, error } = await q;
    if (error) {
      if (isMissingTable(error)) {
        return { count: null, status: 'missing_table', error: error.message };
      }
      return { count: 0, status: 'empty', error: error.message };
    }
    const n = (count as number | null) ?? 0;
    return { count: n, status: n > 0 ? 'ready' : 'empty' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    return { count: 0, status: 'empty', error: msg };
  }
}

// ============================================================
// Main
// ============================================================

export async function gatherReadiness(sokhId: number): Promise<ReadinessSnapshot> {
  const { year, month, label, start, end } = currentMonth();

  // Бүх count query parallel
  const [
    invoicesAll,
    invoicesPaid,
    invoicesUnpaid,
    residentsAll,
    residentsDebt,
    complaintsMonth,
    maintenanceMonth,
    announcementsMonth,
    reserveMonth,
  ] = await Promise.all([
    safeCount('invoices', (q) =>
      q.eq('sokh_id', sokhId).eq('year', year).eq('month', month),
    ),
    safeCount('invoices', (q) =>
      q.eq('sokh_id', sokhId).eq('year', year).eq('month', month).eq('status', 'paid'),
    ),
    safeCount('invoices', (q) =>
      q
        .eq('sokh_id', sokhId)
        .eq('year', year)
        .eq('month', month)
        .in('status', ['pending', 'overdue', 'partial']),
    ),
    safeCount('residents', (q) => q.eq('sokh_id', sokhId)),
    safeCount('residents', (q) => q.eq('sokh_id', sokhId).gt('debt', 0)),
    safeCount('complaints', (q) =>
      q.eq('sokh_id', sokhId).gte('created_at', start).lt('created_at', end),
    ),
    safeCount('maintenance_requests', (q) =>
      q.eq('sokh_id', sokhId).gte('created_at', start).lt('created_at', end),
    ),
    safeCount('announcements', (q) =>
      q.eq('sokh_id', sokhId).gte('created_at', start).lt('created_at', end),
    ),
    safeCount('reserve_fund', (q) =>
      q
        .eq('sokh_id', sokhId)
        .gte('occurred_at', start.slice(0, 10))
        .lt('occurred_at', end.slice(0, 10)),
    ),
  ]);

  const items: ReadinessItem[] = [
    {
      key: 'invoices_month',
      label: 'Нэхэмжлэл (энэ сар)',
      count: invoicesAll.count ?? 0,
      status: invoicesAll.status,
      hint: hintFor('invoices_month', invoicesAll),
      relatesTo: ['monthly_insight', 'financial_report', 'board_report'],
      recommendedAction: actionFor('invoices_month', invoicesAll),
    },
    {
      key: 'invoices_paid',
      label: 'Төлөгдсөн нэхэмжлэл',
      count: invoicesPaid.count ?? 0,
      status: invoicesPaid.status,
      hint: hintFor('invoices_paid', invoicesPaid),
      relatesTo: ['monthly_insight', 'financial_report'],
      recommendedAction: actionFor('invoices_paid', invoicesPaid),
    },
    {
      key: 'invoices_unpaid',
      label: 'Төлөөгүй нэхэмжлэл',
      count: invoicesUnpaid.count ?? 0,
      status: invoicesUnpaid.status,
      hint: hintFor('invoices_unpaid', invoicesUnpaid),
      relatesTo: ['debt_reminder'],
      recommendedAction: actionFor('invoices_unpaid', invoicesUnpaid),
    },
    {
      key: 'residents_all',
      label: 'Оршин суугч',
      count: residentsAll.count ?? 0,
      status: residentsAll.status,
      hint: hintFor('residents_all', residentsAll),
      relatesTo: ['debt_reminder', 'monthly_insight', 'board_report'],
      recommendedAction: actionFor('residents_all', residentsAll),
    },
    {
      key: 'residents_with_debt',
      label: 'Өртэй айл',
      count: residentsDebt.count ?? 0,
      status: residentsDebt.status,
      hint: hintFor('residents_with_debt', residentsDebt),
      relatesTo: ['debt_reminder'],
      recommendedAction: actionFor('residents_with_debt', residentsDebt),
    },
    {
      key: 'complaints_month',
      label: 'Гомдол (энэ сар)',
      count: complaintsMonth.count ?? 0,
      status: complaintsMonth.status,
      hint: hintFor('complaints_month', complaintsMonth),
      relatesTo: ['issue_insight', 'board_report'],
      recommendedAction: actionFor('complaints_month', complaintsMonth),
    },
    {
      key: 'maintenance_month',
      label: 'Засварын хүсэлт (энэ сар)',
      count: maintenanceMonth.count ?? 0,
      status: maintenanceMonth.status,
      hint: hintFor('maintenance_month', maintenanceMonth),
      relatesTo: ['issue_insight', 'board_report'],
      recommendedAction: actionFor('maintenance_month', maintenanceMonth),
    },
    {
      key: 'announcements_month',
      label: 'Зарлал (энэ сар)',
      count: announcementsMonth.count ?? 0,
      status: announcementsMonth.status,
      hint: hintFor('announcements_month', announcementsMonth),
      relatesTo: ['board_report'],
      recommendedAction: actionFor('announcements_month', announcementsMonth),
    },
    {
      key: 'reserve_month',
      label: 'Санхүүгийн бичилт',
      count: reserveMonth.count ?? 0,
      status: reserveMonth.status,
      hint: hintFor('reserve_month', reserveMonth),
      relatesTo: ['financial_report', 'board_report'],
      recommendedAction: actionFor('reserve_month', reserveMonth),
    },
  ];

  return {
    sokhId,
    month: label,
    generatedAt: new Date().toISOString(),
    items,
  };
}

// ============================================================
// Hint text
// ============================================================

function hintFor(key: string, result: CountResult): string {
  if (result.status === 'missing_table') {
    return 'Энэ хэсэг бэлэн биш байна. Системийн хариуцагчтай холбогдоно уу.';
  }
  if (result.status === 'empty' || result.count === 0) {
    switch (key) {
      case 'invoices_month':
        return 'Энэ сард нэхэмжлэл үүсгээгүй байна.';
      case 'invoices_paid':
        return 'Төлбөр бүртгэгдээгүй байна.';
      case 'invoices_unpaid':
        return 'Өртэй айл одоогоор алга.';
      case 'residents_all':
        return 'Оршин суугч бүртгэгдээгүй байна.';
      case 'residents_with_debt':
        return 'Өртэй айл одоогоор алга.';
      case 'complaints_month':
        return 'Энэ сард гомдол ирээгүй байна.';
      case 'maintenance_month':
        return 'Энэ сард засварын хүсэлт алга.';
      case 'announcements_month':
        return 'Энэ сард зарлал нийтлээгүй байна.';
      case 'reserve_month':
        return 'Энэ сард санхүүгийн бичлэг алга.';
      default:
        return 'Мэдээлэл алга.';
    }
  }
  // ready
  switch (key) {
    case 'invoices_month':
      return `${result.count} нэхэмжлэл бэлэн.`;
    case 'invoices_paid':
      return `${result.count} нэхэмжлэл төлөгдсөн.`;
    case 'invoices_unpaid':
      return `${result.count} нэхэмжлэл төлөөгүй.`;
    case 'residents_all':
      return `${result.count} оршин суугч бүртгэлтэй.`;
    case 'residents_with_debt':
      return `${result.count} айл өртэй байна.`;
    case 'complaints_month':
      return `${result.count} гомдол ирсэн.`;
    case 'maintenance_month':
      return `${result.count} засварын хүсэлт ирсэн.`;
    case 'announcements_month':
      return `${result.count} зарлал нийтлэгдсэн.`;
    case 'reserve_month':
      return `${result.count} санхүүгийн бичлэг.`;
    default:
      return `${result.count}.`;
  }
}

// ============================================================
// Recommended action — admin-ын дараагийн алхам
// ============================================================
// Зарчим:
//   - status=ready  → action.type='none', href=null
//   - status=empty  → бодит admin route руу хөтлөх
//   - status=missing_table → migrate type, href=null (system-health UI page алга)
//
// Холбоосыг бодит app/admin маршрутаас л сонгоно — буруу холбоос байж болохгүй.

function actionFor(key: string, result: CountResult): RecommendedAction {
  // Хүснэгт байхгүй — системийн ажил
  if (result.status === 'missing_table') {
    return {
      label: 'Энэ хэсэг бэлэн биш — системийн хариуцагчтай холбогдоно уу',
      href: null,
      type: 'migrate',
    };
  }

  // Ready — юу ч хийх шаардлагагүй
  if (result.status === 'ready') {
    return { label: 'Бэлэн', href: null, type: 'none' };
  }

  // Empty — дараагийн алхам санал болгох
  switch (key) {
    case 'invoices_month':
      return {
        label: 'Нэхэмжлэл үүсгэх',
        href: '/admin/finance',
        type: 'create',
      };
    case 'invoices_paid':
      return {
        label: 'Төлбөр бүртгэх',
        href: '/admin/payments',
        type: 'create',
      };
    case 'invoices_unpaid':
      return {
        label: 'Өртэй айл одоогоор алга',
        href: null,
        type: 'none',
      };
    case 'residents_all':
      return {
        label: 'Оршин суугч нэмэх',
        href: '/admin/import',
        type: 'import',
      };
    case 'residents_with_debt':
      return {
        label: 'Өртэй айл алга',
        href: null,
        type: 'none',
      };
    case 'complaints_month':
      return {
        label: 'Гомдол бүртгэх',
        href: '/admin/complaints',
        type: 'create',
      };
    case 'maintenance_month':
      return {
        label: 'Засварын хүсэлт нэмэх',
        href: '/admin/maintenance',
        type: 'create',
      };
    case 'announcements_month':
      return {
        label: 'Эхний зарлал нийтлэх',
        href: '/admin/announcements',
        type: 'create',
      };
    case 'reserve_month':
      return {
        label: 'Санхүүгийн бичлэг нэмэх',
        href: '/admin/finance',
        type: 'create',
      };
    default:
      return { label: 'Өгөгдөл оруулах', href: null, type: 'none' };
  }
}
