// Санхүүгийн тайлант сар (орлого/зардал аль сард орох).
//
// Анхдагч: Улаанбаатарын цагаар хуанлийн сар. Зарим СӨХ-д тасалбар өөр —
// ICTown (#2694): 10-р сарын төлбөрийг 11/10 хүртэл хүлээн авсан тул 11/10 хүртэлх
// БҮХ орлого, зардал 10-р сард орно (хэрэглэгч 2026-11-11).
//
// PERIOD_ENDS[sokhId]['YYYY-MM'] = тухайн тайлант сарын сүүлийн өдөр (UB цагаар, оролцоно).
// Дараагийн сарын эхэн (1..тэр өдөр) нь өмнөх сард шилжинэ; бусад нь хуанлийн сараараа.
export const PERIOD_ENDS: Record<number, Record<string, string>> = {
  2694: { '2026-10': '2026-11-10' },
};

const UB_OFFSET_MS = 8 * 60 * 60 * 1000;

/** ISO огноо/цаг → Улаанбаатарын 'YYYY-MM-DD'. Цаггүй 'YYYY-MM-DD'-г шууд буцаана. */
export function ubDate(iso: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return '';
  return new Date(t + UB_OFFSET_MS).toISOString().slice(0, 10);
}

/** Тайлант сар { year, month } (сар 1–12). Огноо буруу бол null. */
export function periodOf(sokhId: number, iso: string | null | undefined): { year: number; month: number } | null {
  if (!iso) return null;
  const d = ubDate(iso);
  if (!d) return null;
  for (const [ym, end] of Object.entries(PERIOD_ENDS[sokhId] || {})) {
    const [y, m] = ym.split('-').map(Number);
    const ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1;
    const nextStart = `${ny}-${String(nm).padStart(2, '0')}-01`;
    if (d >= nextStart && d <= end) return { year: y, month: m };
  }
  return { year: Number(d.slice(0, 4)), month: Number(d.slice(5, 7)) };
}

/** year*100+month — харьцуулахад */
export function periodKey(sokhId: number, iso: string | null | undefined): number {
  const p = periodOf(sokhId, iso);
  return p ? p.year * 100 + p.month : 0;
}

/** Төлбөрүүдэд тайлант сарыг (period_year, period_month) нэмнэ */
export function withPeriod<T extends { paid_at: string | null }>(sokhId: number, rows: T[]) {
  return rows.map((r) => {
    const p = periodOf(sokhId, r.paid_at);
    return { ...r, period_year: p?.year ?? 0, period_month: p?.month ?? 0 };
  });
}
