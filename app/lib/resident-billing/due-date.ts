// Оршин суугчийн сарын нэхэмжлэхийн төлөх хугацаа — автомат (cron) болон
// гараар үүсгэх (/admin/finance) хоёр зам ЯГ ИЖИЛ дүрэм хэрэглэнэ.
// Клиент хуудас импортлодог тул энд серверийн модуль (supabaseAdmin) бүү оруул.

/** Төлөх өдөр — дараа сарын энэ өдөр */
export const RESIDENT_DUE_DAY = 5;

/** M сарын нэхэмжлэхийн төлөх хугацаа = M+1 сарын 5 (9-р сарынх → 10-р сарын 5).
 *  Тэмдэгтээр угсарна: Date→toISOString серверийн цагийн бүсээс хамаарч өдөр гулсдаг. */
export function residentDueDate(year: number, month: number): string {
  const y = month === 12 ? year + 1 : year;
  const m = month === 12 ? 1 : month + 1;
  return `${y}-${String(m).padStart(2, '0')}-${String(RESIDENT_DUE_DAY).padStart(2, '0')}`;
}
