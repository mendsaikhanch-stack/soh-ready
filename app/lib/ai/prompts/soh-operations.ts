// SOH ops-д зориулсан AI prompt + deterministic template builder-ууд.
// ============================================================
// Шинж чанар:
//   1. Бүх builder нь typed input авч, typed output буцаана
//   2. Template fallback нь key шаардлагагүй — demo-нд тогтвортой ажиллана
//   3. Real provider (Anthropic) байх үед prompt-ыг ашиглаж generate хийнэ
//      (одоохондоо template-аас гарсан structured output-ыг шууд буцаана —
//       LLM нэмэгдсэн үед энд солигдоно)
//
// АЮУЛГҮЙ БАЙДАЛ:
//   - Бүх мөнгөн дугаар input-аас гарна, AI зохиогоор нэмж зохиохгүй
//   - Output нь үргэлж "draft" — caller-аас илгээх / нийтлэх ёстой

import { formatMnt, formatMonth, SAFETY_DISCLAIMER } from '../core';

// ============================================================
// 1. Debt reminder — өртэй айлуудад сануулга
// ============================================================

export type ReminderTone = 'polite' | 'firm' | 'official';

export interface DebtReminderInput {
  month: string;            // "2026-04"
  unpaidCount: number;
  totalUnpaid: number;
  tone?: ReminderTone;
  sokhName?: string;
}

export interface DebtReminderOutput {
  sms: string;
  appNotification: { title: string; body: string };
  facebookPost: string;
  formalNotice: string;
}

export function buildDebtReminderPrompt(input: DebtReminderInput): string {
  const tone = input.tone || 'polite';
  return [
    'Та СӨХ-ийн ерөнхий нягтлан/админ-ийн туслах. Доорх мэдээллийн дагуу 4 төрлийн сануулгын текст бичнэ үү:',
    '',
    `Сар: ${formatMonth(input.month)}`,
    `Өртэй айлын тоо: ${input.unpaidCount}`,
    `Нийт өрийн дүн: ${formatMnt(input.totalUnpaid)}`,
    `СӨХ: ${input.sokhName || '[СӨХ нэр]'}`,
    `Өнгө аяс: ${tone === 'polite' ? 'эелдэг' : tone === 'firm' ? 'хатуу' : 'албан ёсны'}`,
    '',
    'Шаардлага:',
    '- SMS (≤160 тэмдэгт)',
    '- Апп мэдэгдэл (гарчиг + 1–2 өгүүлбэр)',
    '- Facebook group post (≤300 тэмдэгт, эелдэг)',
    '- Албан ёсны мэдэгдэл (3–5 өгүүлбэр)',
    '',
    'Бодит дугаарыг зохиож нэмж болохгүй — өгөгдсөн дүнгүүдээс л ашиглана.',
    `Бүх хариунд "${SAFETY_DISCLAIMER}" нэмэх шаардлагагүй — caller өөрөө хариуцна.`,
  ].join('\n');
}

export function templateDebtReminder(input: DebtReminderInput): DebtReminderOutput {
  const tone = input.tone || 'polite';
  const monthLabel = formatMonth(input.month);
  const totalLabel = formatMnt(input.totalUnpaid);
  const soh = input.sokhName || 'СӨХ';
  const courteous = tone !== 'firm';

  const sms =
    tone === 'firm'
      ? `Сайн байна уу. ${monthLabel}-ын төлбөр төлөгдөөгүй байна. Энэ долоо хоногт төлнө үү. Үлдэгдэл апп-аас шалгана уу. — ${soh}`
      : tone === 'official'
        ? `${soh}: ${monthLabel}-ын төлбөрийн үлдэгдэл байна. Эргэн төлөх хүсэлт. Дэлгэрэнгүйг апп-аас.`
        : `Сайн байна уу. ${monthLabel}-ын СӨХ-ийн төлбөрийн үлдэгдэл байна. Боломжтой бол энэ долоо хоногт төлнө үү. Баярлалаа.`;

  const appNotification = {
    title: courteous ? `${monthLabel} — Төлбөрийн сануулга` : `${monthLabel} — Төлбөр төлөөгүй байна`,
    body: courteous
      ? `Таны ${monthLabel}-ын төлбөр төлөгдөөгүй харагдаж байна. Үлдэгдлээ шалгаж, боломжтой бол төлнө үү.`
      : `Таны ${monthLabel}-ын төлбөр одоо хүртэл төлөгдөөгүй. Үлдэгдлээ нэн даруй шалгана уу.`,
  };

  const facebookPost = [
    `${soh}-ын эрхэм оршин суугчид аа,`,
    '',
    `${monthLabel}-ын СӨХ-ийн төлбөрийн талаар сануулж байна. Энэ сард ${input.unpaidCount} айл төлбөрөө хийгээгүй байгаа бөгөөд нийт ${totalLabel}-ийн үлдэгдэл хуримтлагдсан байна.`,
    '',
    'Хэрэв та өрөө хаагаагүй бол энэ долоо хоногт хааж өгөхийг хүсье.',
    'Үлдэгдлээ Хотол апп-аас шалгах боломжтой.',
    '',
    'Хамтын ажиллагаанд баярлалаа.',
  ].join('\n');

  const formalNotice = [
    `${soh}-аас албан ёсны мэдэгдэл.`,
    '',
    `${monthLabel}-ын байрны төлбөрийн талаар сануулж байна. Энэ сарын байдлаар ${input.unpaidCount} айлын төлбөр хугацаандаа төлөгдөөгүй, нийт ${totalLabel}-ийн үлдэгдэл хуримтлагдсан.`,
    '',
    'Тус өрийг ажлын 7 хоногийн дотор барагдуулахыг хүсье. Эс барагдсан тохиолдолд нэмэлт хүү тооцох, хууль ёсны арга хэмжээ авах боломжтой гэдгийг урьдчилан анхааруулж байна.',
    '',
    `Хүндэтгэсэн, ${soh}-ийн удирдлага.`,
  ].join('\n');

  return { sms, appNotification, facebookPost, formalNotice };
}

// ============================================================
// 2. Resident-friendly financial report
// ============================================================

export interface FinancialReportInput {
  month: string;
  income: number;
  expense: number;
  balance: number;
  majorExpenses: Array<{ name: string; amount: number }>;
  sokhName?: string;
}

export interface FinancialReportOutput {
  explanation: string;
  bulletSummary: string[];
  transparencyNote: string;
}

export function buildFinancialReportPrompt(input: FinancialReportInput): string {
  return [
    'СӨХ-ийн сарын санхүүгийн тайланг оршин суугчдад ойлгомжтой энгийн монгол хэлээр тайлбарлах:',
    '',
    `Сар: ${formatMonth(input.month)}`,
    `Орлого: ${formatMnt(input.income)}`,
    `Зарлага: ${formatMnt(input.expense)}`,
    `Үлдэгдэл: ${formatMnt(input.balance)}`,
    'Том зарлагууд:',
    ...input.majorExpenses.map((e) => `  - ${e.name}: ${formatMnt(e.amount)}`),
    '',
    'Шаардлага:',
    '- 1 догол мөр: тайлбар (3–5 өгүүлбэр)',
    '- 3 bullet-р дүгнэлт',
    '- Ил тод байдлын тэмдэглэл (1 өгүүлбэр)',
    '',
    'Дугаар нэмж зохиохгүй.',
  ].join('\n');
}

export function templateFinancialReport(input: FinancialReportInput): FinancialReportOutput {
  const monthLabel = formatMonth(input.month);
  const ratio = input.income > 0 ? Math.round((input.expense / input.income) * 100) : 0;
  const soh = input.sokhName || 'СӨХ';

  const topExpenses = [...input.majorExpenses]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);

  const explanation = [
    `${monthLabel}-д ${soh}-д нийт ${formatMnt(input.income)} орлого орж, ${formatMnt(input.expense)} зарлага гарсан байна.`,
    `Үүнээс үлдэгдэл ${formatMnt(input.balance)} болсон.`,
    `Орлогын ${ratio}% нь зарлагад зарцуулагдаж, үлдсэн нь дараагийн сар руу шилжсэн.`,
    topExpenses.length > 0
      ? `Гол зарлагууд: ${topExpenses.map((e) => e.name).join(', ')}.`
      : '',
  ]
    .filter(Boolean)
    .join(' ');

  const bulletSummary = [
    `Орлого ${formatMnt(input.income)}, зарлага ${formatMnt(input.expense)}.`,
    `Үлдэгдэл ${formatMnt(input.balance)} — дараагийн сар руу шилжүүлсэн.`,
    topExpenses[0]
      ? `Хамгийн том зарлага: ${topExpenses[0].name} (${formatMnt(topExpenses[0].amount)}).`
      : 'Том зарлага бичигдээгүй.',
  ];

  const transparencyNote =
    'Энэхүү тайлан нь системийн баталгаажсан бичлэгээс автоматаар үүссэн. Анхдагч бичлэгийг СӨХ-ийн удирдлагаас хүсэх боломжтой.';

  return { explanation, bulletSummary, transparencyNote };
}

// ============================================================
// 3. Monthly finance insight (collection rate, risk, top issues)
// ============================================================

export interface MonthlyInsightInput {
  month: string;
  invoiceCount: number;
  paidCount: number;
  unpaidAmount: number;
  totalBilled: number;
  topIssues?: string[]; // optional manual hint
}

export interface MonthlyInsightOutput {
  collectionRatePct: number;
  unpaidRisk: 'low' | 'medium' | 'high';
  topThreeIssues: string[];
  suggestedActions: string[];
}

export function buildMonthlyInsightPrompt(input: MonthlyInsightInput): string {
  return [
    'СӨХ-ийн сарын санхүүгийн дүгнэлт гаргах. Доорх өгөгдөл өгөгдсөн:',
    '',
    `Сар: ${formatMonth(input.month)}`,
    `Нэхэмжлэлийн тоо: ${input.invoiceCount}`,
    `Төлөгдсөн: ${input.paidCount}`,
    `Нийт нэхэмжилсэн: ${formatMnt(input.totalBilled)}`,
    `Үлдэгдэл өр: ${formatMnt(input.unpaidAmount)}`,
    '',
    'Дүгнэлт:',
    '- Цуглуулалтын хувь',
    '- Өрийн эрсдэл (low/medium/high)',
    '- Гол 3 асуудал',
    '- 2–3 санал болгож буй үйлдэл',
  ].join('\n');
}

export function templateMonthlyInsight(input: MonthlyInsightInput): MonthlyInsightOutput {
  const collectionRatePct =
    input.invoiceCount > 0 ? Math.round((input.paidCount / input.invoiceCount) * 100) : 0;

  let unpaidRisk: MonthlyInsightOutput['unpaidRisk'] = 'low';
  if (collectionRatePct < 60) unpaidRisk = 'high';
  else if (collectionRatePct < 80) unpaidRisk = 'medium';

  const issues: string[] = [];
  if (input.invoiceCount - input.paidCount > 0) {
    issues.push(`${input.invoiceCount - input.paidCount} нэхэмжлэл төлөгдөөгүй`);
  }
  if (collectionRatePct < 80) {
    issues.push(`Цуглуулалтын хувь ${collectionRatePct}% — дунджаас доогуур`);
  }
  if (input.unpaidAmount > 0) {
    issues.push(`Өр ${formatMnt(input.unpaidAmount)} хуримтлагдсан`);
  }
  if (input.topIssues) issues.push(...input.topIssues);

  const topThreeIssues = issues.slice(0, 3);
  if (topThreeIssues.length === 0) topThreeIssues.push('Тодорхой асуудал илрээгүй');

  const suggestedActions: string[] = [];
  if (unpaidRisk !== 'low') {
    suggestedActions.push('Өртэй айлуудад сануулгын draft үүсгэх');
  }
  if (collectionRatePct < 70) {
    suggestedActions.push('Дараа сарын төлбөрийн хугацаа сунгах судалгаа авах');
  }
  suggestedActions.push('Сарын тайланг оршин суугчдад нийтлэх');

  return {
    collectionRatePct,
    unpaidRisk,
    topThreeIssues,
    suggestedActions: suggestedActions.slice(0, 3),
  };
}

// ============================================================
// 4. Issue / complaint insight
// ============================================================

export interface IssueRow {
  building?: string;
  entrance?: string;
  category: string;
  status: 'open' | 'in_progress' | 'resolved' | 'overdue';
  hoursOpen?: number;
}

export interface IssueInsightInput {
  month: string;
  issues: IssueRow[];
}

export interface IssueInsightOutput {
  topLocation: { label: string; count: number } | null;
  repeatedCategories: Array<{ category: string; count: number }>;
  overdueCount: number;
  recommendedActions: string[];
}

export function buildIssueInsightPrompt(input: IssueInsightInput): string {
  return [
    'СӨХ-ийн гомдол/хүсэлтийн дүгнэлт. Дараах өгөгдөл:',
    '',
    `Сар: ${formatMonth(input.month)}`,
    `Нийт гомдол: ${input.issues.length}`,
    '',
    'Дүгнэлт:',
    '- Хамгийн их гомдолтой байр/орц',
    '- Давтагдаж буй ангиллууд',
    '- Хугацаа хэтэрсэн (overdue) тоо',
    '- 2–3 санал болгох үйлдэл',
  ].join('\n');
}

export function templateIssueInsight(input: IssueInsightInput): IssueInsightOutput {
  const locationCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  let overdueCount = 0;

  for (const i of input.issues) {
    const loc = [i.building, i.entrance].filter(Boolean).join(' / ') || 'Тодорхойгүй';
    locationCounts.set(loc, (locationCounts.get(loc) || 0) + 1);
    categoryCounts.set(i.category, (categoryCounts.get(i.category) || 0) + 1);
    if (i.status === 'overdue' || (i.hoursOpen && i.hoursOpen > 48 && i.status !== 'resolved')) {
      overdueCount++;
    }
  }

  let topLocation: IssueInsightOutput['topLocation'] = null;
  for (const [label, count] of locationCounts) {
    if (!topLocation || count > topLocation.count) topLocation = { label, count };
  }

  const repeatedCategories = Array.from(categoryCounts.entries())
    .filter(([, c]) => c >= 2)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const recommendedActions: string[] = [];
  if (overdueCount > 0) {
    recommendedActions.push(`${overdueCount} хугацаа хэтэрсэн хүсэлтэд хариуцагч томилох`);
  }
  if (topLocation && topLocation.count >= 3) {
    recommendedActions.push(
      `${topLocation.label}-д давтан гомдол ирж байна — газар дээр нь шалгах`,
    );
  }
  if (repeatedCategories[0] && repeatedCategories[0].count >= 3) {
    recommendedActions.push(
      `"${repeatedCategories[0].category}" төрлийн асуудал давтагдаж байна — урьдчилан сэргийлэх арга хэмжээ`,
    );
  }
  if (recommendedActions.length === 0) {
    recommendedActions.push('Энэ сард тусгай арга хэмжээ шаардлагагүй');
  }

  return { topLocation, repeatedCategories, overdueCount, recommendedActions };
}

// ============================================================
// 5. Board one-page report
// ============================================================

export interface BoardReportInput {
  month: string;
  sokhName: string;
  totalPaid: number;
  unpaidAmount: number;
  unpaidCount: number;
  announcementsCount: number;
  issuesCount: number;
  resolvedIssuesCount: number;
  completedTasks: string[];
}

export interface BoardReportOutput {
  title: string;
  sections: Array<{ heading: string; body: string }>;
  footer: string;
}

export function buildBoardReportPrompt(input: BoardReportInput): string {
  return [
    'Удирдах зөвлөлд танилцуулах 1 нүүр сарын тайлан бэлдэх.',
    `СӨХ: ${input.sokhName}`,
    `Сар: ${formatMonth(input.month)}`,
    '',
    'Хэсгүүд:',
    `  - Санхүү: цуглуулсан ${formatMnt(input.totalPaid)}, өр ${formatMnt(input.unpaidAmount)} (${input.unpaidCount} айл)`,
    `  - Зарлал: ${input.announcementsCount} нийтлэгдсэн`,
    `  - Гомдол: ${input.issuesCount} ирсэн, ${input.resolvedIssuesCount} шийдэгдсэн`,
    `  - Хийгдсэн ажлууд: ${input.completedTasks.join(', ')}`,
    '',
    'Албан ёсны энгийн монгол хэлээр, 1 хуудаст багтаах.',
  ].join('\n');
}

export function templateBoardReport(input: BoardReportInput): BoardReportOutput {
  const monthLabel = formatMonth(input.month);
  const resolvedRate =
    input.issuesCount > 0
      ? Math.round((input.resolvedIssuesCount / input.issuesCount) * 100)
      : 0;

  const sections = [
    {
      heading: 'Санхүүгийн товчоо',
      body: [
        `Энэ сард нийт ${formatMnt(input.totalPaid)} цугласан.`,
        `Үлдэгдэл өр ${formatMnt(input.unpaidAmount)} (${input.unpaidCount} айл).`,
        'Дэлгэрэнгүй задаргааг санхүүгийн тайлангаас үзнэ үү.',
      ].join(' '),
    },
    {
      heading: 'Мэдээлэл, зарлал',
      body: `Сарын турш ${input.announcementsCount} албан ёсны зарлал нийтлэгдсэн.`,
    },
    {
      heading: 'Гомдол, хүсэлт',
      body: [
        `Нийт ${input.issuesCount} хүсэлт ирсэн.`,
        `${input.resolvedIssuesCount} нь шийдэгдсэн (${resolvedRate}%).`,
        input.issuesCount - input.resolvedIssuesCount > 0
          ? `${input.issuesCount - input.resolvedIssuesCount} нь шийдэгдэх шатанд.`
          : 'Бүх хүсэлт цаг хугацаандаа шийдэгдсэн.',
      ].join(' '),
    },
    {
      heading: 'Хийгдсэн ажлууд',
      body:
        input.completedTasks.length > 0
          ? input.completedTasks.map((t, i) => `${i + 1}. ${t}`).join('\n')
          : 'Тусгайлан тэмдэглэх ажил бүртгэгдээгүй.',
    },
  ];

  return {
    title: `${input.sokhName} — ${monthLabel}-ын тайлан`,
    sections,
    footer:
      'Энэхүү тайлан нь системийн бичлэгээс автомат гарсан. Удирдах зөвлөлийн хурлаар хэлэлцэх боломжтой.',
  };
}
