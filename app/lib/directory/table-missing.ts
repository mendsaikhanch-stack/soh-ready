// «Directory Phase 2» (эрэлт, гар оролтын СӨХ) хэсгийн хүснэгтүүд нь тусдаа
// миграцаар үүсдэг — `supabase-directory-phase2-migration.sql`. Тэр миграц
// ажиллаагүй байхад PostgREST «schema cache»-д хүснэгт олдохгүй гэж хэлнэ.
//
// Энэ тохиолдол нь БҮТЭЛГҮЙТЭЛ биш, «энэ боломж хараахан асаагүй» гэсэн үг.
// Тиймээс 500 биш, хоосон жагсаалт + тайлбар буцаана — эс тэгвэл дарга
// хуудас нээхэд шалтгаангүй улаан алдаа хардаг.

export const PHASE2_UNAVAILABLE_MESSAGE =
  'Энэ хэсэг хараахан асаагүй байна. Идэвхжүүлэхийн тулд '
  + '`supabase-directory-phase2-migration.sql`-ийг Supabase SQL Editor-т ажиллуулна уу.';

export function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: string }).code;
  // PGRST205 = "Could not find the table ... in the schema cache"
  // 42P01    = PostgreSQL "undefined_table"
  return code === 'PGRST205' || code === '42P01';
}
