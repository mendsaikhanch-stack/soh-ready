// Demo SOH өгөгдөл — /admin/ai хуудсыг бодит өгөгдөл импортолдоогүй ч
// танилцуулга / demo хийхэд ашиглана.
// ============================================================
// Зарчим:
//   - Бодит СӨХ-уудын дугаартай давхцуулж болохгүй
//   - Тоонууд бодитой даруухан (мегафон бэйт байх ёсгүй)

import type {
  DebtReminderInput,
  FinancialReportInput,
  MonthlyInsightInput,
  IssueInsightInput,
  IssueRow,
  BoardReportInput,
} from './prompts/soh-operations';

export const DEMO_SOKH_NAME = 'Нарлаг хотхон СӨХ';
export const DEMO_MONTH = '2026-04';

// Үндсэн scenario:
//   120 айл · 27 нь төлбөрөө төлөөгүй · нийт өр 8,450,000₮
//   14 гомдол · 5 нь 48 цагаас дээш шийдэгдээгүй
//   2-р орцонд лифт давтан гомдол
//   3 зарлал нийтлэгдсэн

export const DEMO_DEBT_REMINDER_INPUT: DebtReminderInput = {
  month: DEMO_MONTH,
  unpaidCount: 27,
  totalUnpaid: 8_450_000,
  tone: 'polite',
  sokhName: DEMO_SOKH_NAME,
};

export const DEMO_FINANCIAL_REPORT_INPUT: FinancialReportInput = {
  month: DEMO_MONTH,
  income: 18_600_000,
  expense: 14_320_000,
  balance: 4_280_000,
  majorExpenses: [
    { name: 'Цэвэрлэгээ, хог хаягдал', amount: 3_400_000 },
    { name: 'Лифт засвар, үйлчилгээ', amount: 2_850_000 },
    { name: 'Усны нийлүүлэлт', amount: 2_100_000 },
    { name: 'Гэрэлтүүлэг, цахилгаан', amount: 1_750_000 },
    { name: 'Аюулгүй байдал', amount: 1_500_000 },
  ],
  sokhName: DEMO_SOKH_NAME,
};

export const DEMO_MONTHLY_INSIGHT_INPUT: MonthlyInsightInput = {
  month: DEMO_MONTH,
  invoiceCount: 120,
  paidCount: 93,
  unpaidAmount: 8_450_000,
  totalBilled: 27_050_000,
  topIssues: ['2-р орцны лифт давтан гомдол'],
};

const demoIssues: IssueRow[] = [
  // 2-р орцонд лифт давтан гомдол (3)
  { building: 'Нарлаг 1', entrance: '2-р орц', category: 'Лифт', status: 'open', hoursOpen: 72 },
  { building: 'Нарлаг 1', entrance: '2-р орц', category: 'Лифт', status: 'in_progress', hoursOpen: 36 },
  { building: 'Нарлаг 1', entrance: '2-р орц', category: 'Лифт', status: 'overdue', hoursOpen: 96 },
  // overdue (2 нэмэлт)
  { building: 'Нарлаг 2', entrance: '4-р орц', category: 'Ус', status: 'overdue', hoursOpen: 84 },
  { building: 'Нарлаг 3', entrance: '1-р орц', category: 'Орц цэвэрлэгээ', status: 'overdue', hoursOpen: 60 },
  // үлдсэн нь idol
  { building: 'Нарлаг 1', entrance: '1-р орц', category: 'Хог', status: 'resolved', hoursOpen: 12 },
  { building: 'Нарлаг 1', entrance: '3-р орц', category: 'Гэрэлтүүлэг', status: 'in_progress', hoursOpen: 18 },
  { building: 'Нарлаг 2', entrance: '1-р орц', category: 'Орц цэвэрлэгээ', status: 'open', hoursOpen: 6 },
  { building: 'Нарлаг 2', entrance: '2-р орц', category: 'Лифт', status: 'resolved', hoursOpen: 24 },
  { building: 'Нарлаг 2', entrance: '3-р орц', category: 'Ус', status: 'resolved', hoursOpen: 4 },
  { building: 'Нарлаг 3', entrance: '2-р орц', category: 'Дулаан', status: 'open', hoursOpen: 8 },
  { building: 'Нарлаг 3', entrance: '3-р орц', category: 'Хог', status: 'resolved', hoursOpen: 14 },
  { building: 'Нарлаг 3', entrance: '4-р орц', category: 'Орц цэвэрлэгээ', status: 'in_progress', hoursOpen: 30 },
  { building: 'Нарлаг 1', entrance: '4-р орц', category: 'Зогсоол', status: 'open', hoursOpen: 4 },
];

export const DEMO_ISSUE_INSIGHT_INPUT: IssueInsightInput = {
  month: DEMO_MONTH,
  issues: demoIssues,
};

export const DEMO_BOARD_REPORT_INPUT: BoardReportInput = {
  month: DEMO_MONTH,
  sokhName: DEMO_SOKH_NAME,
  totalPaid: 18_600_000,
  unpaidAmount: 8_450_000,
  unpaidCount: 27,
  announcementsCount: 3,
  issuesCount: demoIssues.length,
  resolvedIssuesCount: demoIssues.filter((i) => i.status === 'resolved').length,
  completedTasks: [
    'Хогийн саваа шинэчилсэн (Нарлаг 2)',
    '1-р орцны гэрэлтүүлэг засварлав',
    '2-р улирлын санхүүгийн тайланг нэгтгэв',
  ],
};

export const DEMO_SCENARIO_NUMBERS = {
  apartments: 120,
  unpaidApartments: 27,
  totalUnpaidMnt: 8_450_000,
  issuesThisMonth: demoIssues.length,
  overdueIssues: demoIssues.filter(
    (i) => i.status === 'overdue' || ((i.hoursOpen ?? 0) > 48 && i.status !== 'resolved'),
  ).length,
  announcements: 3,
};
