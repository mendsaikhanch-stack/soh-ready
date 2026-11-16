/**
 * Санал батлагдахад шаардлагатай «Зөвшөөрөх» саналын тоо (нийт урьсан гишүүнээс).
 * Сонголтууд нь бутархай дүрэм тул хувиар биш тоогоор тооцно:
 * - 50  → энгийн олонхи: ТАЛААС ИЛҮҮ (4 гишүүнээс 3, 5-аас 3). Өмнө нь ">= 50%" байсан тул
 *         4-өөс 2 нь батлагдаж, маягтын «>50%» гэсэн бичиглэлтэй зөрдөг байв.
 * - 67  → гуравны хоёр: ⌈2/3⌉ (3 гишүүнээс 2; 66.7% < 67 гэж унахгүй).
 * - бусад (75, 100, ...) → ⌈pct/100 · нийт⌉.
 */
export function requiredApprovals(total: number, pct: number): number {
  if (total <= 0) return 1;
  const p = Number(pct) || 50;
  if (p === 50) return Math.floor(total / 2) + 1;
  if (p === 67) return Math.ceil((2 * total) / 3);
  return Math.min(total, Math.max(1, Math.ceil((p * total) / 100 - 1e-9)));
}

export function isPassed(approve: number, total: number, pct: number): boolean {
  return total > 0 && approve >= requiredApprovals(total, pct);
}
