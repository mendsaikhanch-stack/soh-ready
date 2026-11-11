// Оршин суугчийн сарын нэхэмжлэхийн төлөх хугацаа — автомат (cron) болон
// гараар үүсгэх (/admin/finance) хоёр зам ЯГ ИЖИЛ дүрэм хэрэглэнэ.
// Клиент хуудас импортлодог тул энд серверийн модуль (supabaseAdmin) бүү оруул.

/** Төлөх өдөр — дараа сарын энэ өдөр (анхдагч) */
export const RESIDENT_DUE_DAY = 5;

/**
 * СӨХ тус бүрийн нэхэмжлэлийн хуваарь. issueDay — M сарын нэхэмжлэх M сарын хэдэнд үүсэх,
 * dueDay — M+1 сарын хэдэн хүртэл төлөх. Анхдагч: 1-нд үүсч, дараа сарын 5 хүртэл.
 * ICTown (#2694, хэрэглэгч 2026-11-11): M сарынх M сарын 10-нд үүсч, M+1 сарын 10 хүртэл төлнө.
 * Тайлант сар нь хуанлийн сар (1–31) хэвээр — энэ нь зөвхөн нэхэмжлэх/төлөх хугацаа.
 */
export const BILLING_SCHEDULE: Record<number, { issueDay: number; dueDay: number }> = {
  2694: { issueDay: 10, dueDay: 10 },
};
export const billingSchedule = (sokhId?: number) =>
  (sokhId && BILLING_SCHEDULE[sokhId]) || { issueDay: 1, dueDay: RESIDENT_DUE_DAY };

/** M сарын нэхэмжлэхийн төлөх хугацаа = M+1 сарын dueDay (анхдагч 5; 9-р сарынх → 10-р сарын 5).
 *  Тэмдэгтээр угсарна: Date→toISOString серверийн цагийн бүсээс хамаарч өдөр гулсдаг. */
export function residentDueDate(year: number, month: number, sokhId?: number): string {
  const y = month === 12 ? year + 1 : year;
  const m = month === 12 ? 1 : month + 1;
  return `${y}-${String(m).padStart(2, '0')}-${String(billingSchedule(sokhId).dueDay).padStart(2, '0')}`;
}
