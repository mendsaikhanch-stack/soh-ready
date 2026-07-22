-- residents багана-түвшний хамгаалалт
-- Асуудал: residents_update_self RLS policy нь мөрийн түвшний тул нэвтэрсэн
-- оршин суугч өөрийн мөрийн БҮХ баганыг (өр, тоот, sokh_id г.м) шууд
-- supabase client-ээр засаж болдог байсан.
-- Шийдэл: authenticated/anon role-оос UPDATE эрхийг татаж, оршин суугчийн
-- өөрөө засах ёстой профайлын талбаруудыг л буцааж олгоно.
-- (Профайлын API нь service_role тул энэ хязгаарлалтад хамаарахгүй, хэвээр ажиллана.)
-- Гараар ажиллуулна: Supabase → SQL Editor.

REVOKE UPDATE ON residents FROM authenticated;
REVOKE UPDATE ON residents FROM anon;

GRANT UPDATE (name, phone, resident_type, household_size, move_in_date, profile_completed_at)
  ON residents TO authenticated;
