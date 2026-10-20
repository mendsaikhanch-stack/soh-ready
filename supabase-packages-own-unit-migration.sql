-- ============================================================
-- Илгээмж: оршин суугч зөвхөн өөрийн тоотын илгээмжийг харна
-- ============================================================
-- Асуудал: (mobile)/sokh/[id]/packages хуудас СӨХ-ийн БҮХ илгээмжийг
-- татаад, хэрэглэгчийн өөрөө бичсэн нэр/тоотоор клиент дээр шүүдэг байв.
-- Өөр тоот бичихэд тэр айлын авах код (pickup_code) харагдана.
-- supabase-resident-read-tenant-migration.sql-ийн packages_select_tenant
-- нь нэг СӨХ-ийн бүх илгээмжийг харуулдаг тул хангалтгүй.
--
-- Шийдэл:
--   • current_user_units() — нэвтэрсэн оршин суугчийн (sokh_id, тоот)
--     хосууд (SECURITY DEFINER, current_user_sokh_ids()-тэй ижил загвар)
--   • SELECT — зөвхөн өөрийн тоотын илгээмж
--   • UPDATE — өөрийн илгээмжийг зөвхөн delivered → picked_up («Авсан»
--     товч). Өмнө нь UPDATE policy байхгүй тул товч чимээгүй ажилладаггүй байв.
--
-- Тоотыг хоосон зай, том/жижиг үсгийг үл тоон харьцуулна. packages-д байр
-- (building) багана байхгүй тул олон байртай СӨХ-д ижил дугаартай тоотууд
-- бие биеийнхээ илгээмжийг харна — өмнөхөөс (бүх СӨХ) хамаагүй явцуу.
--
-- Админ /api/admin/db proxy (service_role)-оор хандана — нөлөөлөхгүй.
-- ⚠️ Deploy-ООС ӨМНӨ ажиллуулна: шинэ packages хуудас клиент дээр шүүхгүй
--    (RLS-д найдна). Хуучин хуудас энэ policy-тэй ч зөв ажиллана.
-- Давтан ажиллуулахад аюулгүй. Нэг transaction.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.current_user_units()
RETURNS TABLE (sokh_id bigint, unit text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sokh_id, lower(btrim(apartment))
    FROM residents
   WHERE auth_user_id = auth.uid()
     AND sokh_id IS NOT NULL
     AND apartment IS NOT NULL
$$;

REVOKE ALL ON FUNCTION public.current_user_units() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_units() TO authenticated;

DO $$
DECLARE
  p record;
BEGIN
  -- Өмнөх бүх SELECT/UPDATE policy (true, _select_tenant г.м.) болон
  -- `true` нөхцөлтэй INSERT/DELETE-ийг цэвэрлэнэ (packages эхний
  -- anon-rls-close migration-д ороогүй байсан)
  FOR p IN
    SELECT policyname FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'packages'
       AND (cmd IN ('SELECT', 'UPDATE', 'ALL') OR qual = 'true' OR with_check = 'true')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.packages', p.policyname);
    RAISE NOTICE 'packages.% устгав', p.policyname;
  END LOOP;
END $$;

ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "packages_select_own_unit" ON public.packages
  FOR SELECT TO authenticated
  USING (
    (sokh_id, lower(btrim(unit_number))) IN (SELECT sokh_id, unit FROM current_user_units())
  );

CREATE POLICY "packages_pickup_own_unit" ON public.packages
  FOR UPDATE TO authenticated
  USING (
    status = 'delivered'
    AND (sokh_id, lower(btrim(unit_number))) IN (SELECT sokh_id, unit FROM current_user_units())
  )
  WITH CHECK (
    status = 'picked_up'
    AND (sokh_id, lower(btrim(unit_number))) IN (SELECT sokh_id, unit FROM current_user_units())
  );

COMMIT;

-- ── ДАРАА НЬ шалгах (2 мөр: packages_select_own_unit, packages_pickup_own_unit) ──
--   SELECT policyname, cmd, roles::text FROM pg_policies
--    WHERE schemaname = 'public' AND tablename = 'packages'
--    ORDER BY policyname;
