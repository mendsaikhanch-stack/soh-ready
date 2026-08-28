// Хотол → СӨХ-өөс авах төлбөрийн тооцоо.
//
// Тариф нь БҮХ СӨХ-д ижил (platform_tariff хүснэгтийн ганц мөр), тиймээс энд
// СӨХ тус бүрийн тусгай нөхцөл гэж байхгүй. Хэрэв ирээдүйд нэг СӨХ-д өөр үнэ
// тавих бол энэ файлыг салгахгүй — тарифын давхарга нэмнэ.
//
// Дүнг ЗӨВХӨН эндээс тооцно. Дэлгэц бүр өөрөө үржүүлж эхэлбэл нэг газар нь
// засахад нөгөө нь хуучин үнээр үлдэж, нэхэмжлэх зөрнө.

export interface PlatformTariff {
  setup_per_unit: number;        // нэг айлд ногдох суурилуулалтын төлбөр
  monthly_per_unit: number;      // нэг айлд ногдох сарын хураамж
  free_months_threshold: number; // энэ тооноос доош айлтай бол "жижиг"
  free_months_below: number;     // жижиг СӨХ-ийн үнэгүй сар
  free_months_above: number;     // түүнээс их айлтай СӨХ-ийн үнэгүй сар
}

export const DEFAULT_TARIFF: PlatformTariff = {
  setup_per_unit: 1500,
  monthly_per_unit: 1000,
  free_months_threshold: 150,
  free_months_below: 1,
  free_months_above: 2,
};

/**
 * Тухайн СӨХ-д үйлчлэх тариф.
 *
 * Үнэгүй сарыг СӨХ тус бүрээр сунгаж болдог (`free_months_override`) —
 * жишээ нь өгөгдлөө удаан оруулсан, эсвэл гэрээ хожуу байгуулсан үед.
 * Дүн бодох бүх функц ерөнхий тарифыг хүлээж авдаг тул шинэ параметр
 * нэмэхийн оронд тарифыг нь энд «хувийн болгож» өгнө.
 */
export function orgTariff(
  tariff: PlatformTariff,
  freeMonthsOverride: number | null | undefined,
): PlatformTariff {
  if (freeMonthsOverride == null) return tariff;
  const n = Math.max(0, Math.round(freeMonthsOverride));
  return { ...tariff, free_months_below: n, free_months_above: n };
}

/** Нэг удаагийн суурилуулалтын төлбөр */
export function setupFee(tariff: PlatformTariff, apartments: number): number {
  return Math.round(apartments * tariff.setup_per_unit);
}

/** Сарын хураамж */
export function monthlyFee(tariff: PlatformTariff, apartments: number): number {
  return Math.round(apartments * tariff.monthly_per_unit);
}

/** Үнэгүй ашиглах сарын тоо. Том СӨХ-д илүү удаан үнэгүй хугацаа өгдөг —
 *  олон айлыг системд оруулах, сургах ажил нь урт байдаг. */
export function freeMonths(tariff: PlatformTariff, apartments: number): number {
  return apartments < tariff.free_months_threshold
    ? tariff.free_months_below
    : tariff.free_months_above;
}

/** Үнэгүй хугацаа дуусах = төлбөр эхлэх өдөр. Идэвхжсэн өдрөөс тоолно.
 *  Идэвхжээгүй СӨХ-д төлбөр эхлэх өдөр гэж байхгүй тул null. */
export function billingStartDate(
  activatedAt: string | null | undefined,
  tariff: PlatformTariff,
  apartments: number,
): Date | null {
  if (!activatedAt) return null;
  const d = new Date(activatedAt);
  if (isNaN(d.getTime())) return null;
  const start = new Date(d);
  start.setMonth(start.getMonth() + freeMonths(tariff, apartments));
  return start;
}

/**
 * Төлбөр тооцох ЭХНИЙ БҮТЭН сар.
 *
 * Үнэгүй хугацаа сарын дунд дуусдаг (ж: 8-р сарын 24). Тэр сарыг бүтнээр нь
 * нэхэмжилбэл айл 7 хоногийн хэрэглээнд бүтэн сарын төлбөр төлнө — шударга
 * бус. Хуваарилж тооцох нь ойлгоход хэцүү. Тиймээс үлдсэн хэдэн өдрийг
 * үнэгүйд тооцоод, ДАРАА сараас нь эхэлнэ.
 */
export function firstBillableMonth(
  activatedAt: string | null | undefined,
  tariff: PlatformTariff,
  apartments: number,
): Date | null {
  const start = billingStartDate(activatedAt, tariff, apartments);
  if (!start) return null;
  // Яг сарын 1-нд дуусвал тэр сар бүтэн тул шууд тооцно
  const month = start.getDate() === 1 ? start.getMonth() : start.getMonth() + 1;
  return new Date(start.getFullYear(), month, 1);
}

export interface BillingPeriod {
  year: number;
  month: number;   // 1-12
  amount: number;
  /** Тухайн сарын төлбөр гарах эхний өдөр */
  startsOn: Date;
}

/** Төлбөр эхэлсэн эсэх (өнөөдрийг үнэгүй хугацаа өнгөрсөн эсэхээр шалгана) */
export function isBillingActive(
  activatedAt: string | null | undefined,
  tariff: PlatformTariff,
  apartments: number,
  now: Date = new Date(),
): boolean {
  const start = billingStartDate(activatedAt, tariff, apartments);
  return start !== null && now >= start;
}

/**
 * Дараагийн төлөх ёстой сарын хугацаа, дүн.
 *
 * `paidPeriods` — аль хэдийн нэхэмжилсэн/төлсөн сарууд ("2026-9" хэлбэрээр).
 * Тэднийг алгасаад дараагийн нэхэмжлэх ёстой сарыг буцаана.
 */
export function nextBillingPeriod(
  activatedAt: string | null | undefined,
  tariff: PlatformTariff,
  apartments: number,
  billedPeriods: Set<string> = new Set(),
  now: Date = new Date(),
): BillingPeriod | null {
  const first = firstBillableMonth(activatedAt, tariff, apartments);
  if (!first) return null;

  // Эхний тооцоот сараас эхлээд нэхэмжлээгүй хамгийн эртний сарыг олно.
  // 120 сар (10 жил) хүрээд олдохгүй бол ямар нэг зүйл буруу — зогсооно.
  const cursor = new Date(first);
  for (let i = 0; i < 120; i++) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth() + 1;
    if (!billedPeriods.has(`${year}-${month}`)) {
      // Ирээдүйн саруудыг урьдчилж санал болгохгүй — хамгийн ойрын
      // нэхэмжлээгүй сар нь өнгөрсөн ч бай, одоогийнх ч бай тэрийг өгнө.
      return {
        year,
        month,
        amount: monthlyFee(tariff, apartments),
        startsOn: new Date(year, month - 1, 1),
      };
    }
    cursor.setMonth(cursor.getMonth() + 1);
    if (cursor > new Date(now.getFullYear(), now.getMonth() + 1, 1)) break;
  }

  // Одоог хүртэлх бүх сар нэхэмжлэгдсэн — дараагийнх нь ирэх сар
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return {
    year: next.getFullYear(),
    month: next.getMonth() + 1,
    amount: monthlyFee(tariff, apartments),
    startsOn: next,
  };
}

/**
 * Төлбөр эхэлснээс хойш өнөөдрийг хүртэлх БҮХ тооцоот сар.
 *
 * «Тооцоо хийсэн эсэх»-ийг харахад хэрэгтэй: сар бүрд нэхэмжлэх үүссэн үү,
 * төлөгдсөн үү гэдгийг энэ жагсаалттай тулгана. Ирээдүйн сар ОРОХГҮЙ —
 * болоогүй сарыг «тооцоо хийгээгүй» гэж харуулбал төөрөгдөнө.
 */
export function billableMonths(
  activatedAt: string | null | undefined,
  tariff: PlatformTariff,
  apartments: number,
  now: Date = new Date(),
): { year: number; month: number }[] {
  const first = firstBillableMonth(activatedAt, tariff, apartments);
  if (!first) return [];

  const months: { year: number; month: number }[] = [];
  const cursor = new Date(first);
  const limit = new Date(now.getFullYear(), now.getMonth(), 1);
  // 120 сар = 10 жил. Огноо буруу бичигдсэн үед мөчлөг тасрахгүй байхаас сэргийлнэ.
  for (let i = 0; i < 120 && cursor <= limit; i++) {
    months.push({ year: cursor.getFullYear(), month: cursor.getMonth() + 1 });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

export function periodKey(year: number, month: number): string {
  return `${year}-${month}`;
}

export function formatPeriod(year: number, month: number): string {
  return `${year} оны ${month} сар`;
}

// ---------------------------------------------------------------------------
// Үнэгүй хугацаа дуусах сануулга
// ---------------------------------------------------------------------------

/** Хэдэн хоногийн өмнөөс сануулж эхлэх */
export const TRIAL_ALERT_LEAD_DAYS = 7;

/** Asia/Ulaanbaatar бүсийн огноо (YYYY-MM-DD).
 *
 *  Сервер UTC дээр ажилладаг тул Date-ийн өдрийг шууд авбал Монголд 08:00-аас
 *  өмнө «өчигдөр», оройн 16:00-аас хойш «маргааш» гэж тоолж, «яг тэр өдөр»
 *  гэсэн сануулга нэг хоногоор зөрнө. */
export function ubDay(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ulaanbaatar',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** Хоёр өдрийн хоорондох хоногийн зөрүү (UB огноогоор, цаг тооцохгүй).
 *  0 = яг өнөөдөр, эерэг = ирээдүйд, сөрөг = аль хэдийн өнгөрсөн. */
export function daysBetweenUb(target: Date, now: Date = new Date()): number {
  const day = (d: Date) => Date.parse(`${ubDay(d)}T00:00:00Z`);
  return Math.round((day(target) - day(now)) / 86_400_000);
}

export type TrialAlertLevel = 'today' | 'soon' | 'overdue';

/**
 * Үнэгүй хугацааны сануулгын зэрэг.
 *
 *   today   — яг өнөөдөр дуусч, маргаашаас төлбөр эхэлнэ
 *   soon    — 7 хоногийн дотор дуусна (урьдчилж бэлдэх)
 *   overdue — дууссан ч сарын нэхэмжлэх үүсээгүй (мартагдсан мөнгө)
 *
 * null = сануулах шаардлагагүй (хол байгаа, эсвэл дуусаад нэхэмжилчихсэн).
 */
export function trialAlertLevel(
  daysLeft: number,
  invoiced: boolean,
): TrialAlertLevel | null {
  if (daysLeft === 0) return 'today';
  if (daysLeft > 0) return daysLeft <= TRIAL_ALERT_LEAD_DAYS ? 'soon' : null;
  return invoiced ? null : 'overdue';
}

/** Төлбөр хэтэрсэн нэхэмжлэхийг хэдэн хоногийн өмнөөс самбарт гаргах. */
export const OVERDUE_ALERT_LEAD_DAYS = 7;

/** Гэрээгээр бичгээр мэдэгдэх босго. Үйлчилгээний гэрээний «Талуудын эрх,
 *  үүрэг» хэсэгт: төлбөр 30 хоногоос дээш хэтэрвэл Гүйцэтгэгч бичгээр
 *  мэдэгдэн үйлчилгээг түр зогсоох эрхтэй. */
export const OVERDUE_NOTICE_DAYS = 30;

export type OverdueAlertLevel = 'soon' | 'overdue' | 'critical';

/**
 * Төлөгдөөгүй нэхэмжлэхийн сануулгын зэрэг.
 *
 *   soon     — төлөх хугацаа 7 хоногийн дотор болно (өнөөдөр багтана)
 *   overdue  — хугацаа хэтэрсэн, гэхдээ 30 хоногт хүрээгүй
 *   critical — 30-аас дээш хоног хэтэрсэн → гэрээгээр бичгээр мэдэгдэх босго
 *
 * null = сануулах шаардлагагүй (төлөх хугацаа хол байна).
 *
 * `daysLeft` нь ЗААВАЛ `due_date`-ээс тоологдоно, нэхэмжлэх үүсгэсэн өдрөөс
 * БИШ. Хоёр огноо сар зөрж болдог тул үүсгэсэн өдрөөр тоолвол хугацаа
 * хэтрээгүй нэхэмжлэхийг хэтэрсэн мэт харуулна.
 */
export function overdueAlertLevel(daysLeft: number): OverdueAlertLevel | null {
  if (daysLeft > OVERDUE_ALERT_LEAD_DAYS) return null;
  if (daysLeft >= 0) return 'soon';
  return -daysLeft >= OVERDUE_NOTICE_DAYS ? 'critical' : 'overdue';
}
