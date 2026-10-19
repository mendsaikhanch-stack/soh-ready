-- ============================================================
-- Anon key-ээр нээлттэй үлдсэн RLS нүхийг хаах
-- ============================================================
-- 2026-10-19 production-д anon key-ээр (нэвтрээгүй) шалгахад дараах
-- хүснэгтүүдийн БҮХ мөр уншигдаж байв:
--   admin_config (админы нэвтрэх нэр!), user_signup_requests (утас, нэр),
--   staff, utility_bills, utility_usage, meter_readings, elevator_calls,
--   gate_events, gate_settings, packages, billing_items, hoa_directory ...
-- Migration файлуудад `USING (true)` / `WITH CHECK (true)` policy олон
-- үлдсэн бөгөөд өмнөх tighten migration-ууд production-д бүрэн
-- хэрэгжээгүй (жишээ нь elevator_calls, gate_events одоо ч нээлттэй).
--
-- Иймд policy-г НЭРЭЭР нь биш, pg_policies-ээс `true` нөхцөлтэйг нь олж
-- устгана — production-д ямар нэртэй үлдсэнээс үл хамаарна.
--
-- 3 хэсэг:
--   A) БҮРЭН ХААХ — client (anon key) огт уншдаггүй, зөвхөн сервер
--      (supabaseAdmin) эсвэл /api/admin/db proxy (adminFrom) ашигладаг
--      хүснэгтүүд. service_role RLS-ийг тойрдог тул юу ч эвдрэхгүй.
--   B) БИЧИХИЙГ ХААХ — хөтөчөөс anon key-ээр УНШДАГ хуудас байгаа
--      хүснэгтүүд (ОСНАА, байцаагч, оршин суугч). Унших нь түр хэвээр,
--      бичих нь зөвхөн service_role + tenant policy.
--   C) Оршин суугчийн бичих урсгал — B-д бичих нь хаагдсан ч оршин суугч
--      (authenticated) өөрийн СӨХ-д insert хийх tenant policy-г
--      байхгүй бол үүсгэнэ.
--
-- ⚠️ B хэсгийн УНШИХ нүх үлдэнэ. Дараагийн алхам: osnaa/*, inspector/*,
--    mng-ctrl/*-revenue хуудсуудыг adminFrom proxy руу шилжүүлээд эдгээрийн
--    SELECT-ийг мөн хаах.
--
-- Шаардлага: supabase-tenant-scope-migration.sql (current_user_sokh_ids(),
-- residents.auth_user_id) ажилласан байх.
--
-- Давтан ажиллуулахад аюулгүй. Хүснэгт байхгүй бол алгасна.
-- Нэг transaction — алдаа гарвал юу ч өөрчлөгдөхгүй.
--
-- ── ӨМНӨ НЬ (зөвхөн уншина) — одоогийн нээлттэй policy-ууд: ──
--   SELECT tablename, policyname, cmd, roles::text, qual, with_check
--     FROM pg_policies
--    WHERE schemaname = 'public' AND (qual = 'true' OR with_check = 'true')
--    ORDER BY tablename, policyname;
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.current_user_sokh_ids()') IS NULL THEN
    RAISE EXCEPTION 'current_user_sokh_ids() алга — эхлээд supabase-tenant-scope-migration.sql ажиллуулна уу';
  END IF;
END $$;

-- ============================================================
-- A) Бүрэн хаах
-- ============================================================
DO $$
DECLARE
  t text;
  p record;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'admin_config', 'user_signup_requests', 'push_subscriptions',
    'hoa_directory', 'hoa_directory_aliases',
    'directory_import_jobs', 'directory_import_rows',
    'platform_invoices', 'platform_transactions', 'platform_plans',
    'platform_bank_accounts', 'sokh_subscriptions', 'sokh_tiers',
    'ebarimt_configs', 'inspectors',
    'budget_plans', 'reserve_fund', 'resident_bills',
    'gate_settings', 'guest_vehicles'
  ] LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE 'A: % алга — алгаслаа', t;
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    FOR p IN
      SELECT policyname FROM pg_policies
       WHERE schemaname = 'public' AND tablename = t
         AND (qual = 'true' OR with_check = 'true')
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
      RAISE NOTICE 'A: %.% устгав', t, p.policyname;
    END LOOP;
  END LOOP;
END $$;

-- ============================================================
-- B) Бичихийг хаах, уншихыг түр үлдээх
-- ============================================================
DO $$
DECLARE
  t text;
  p record;
  had_read boolean;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'utility_bills', 'utility_tariffs', 'meter_readings', 'osnaa_entities',
    'inspections', 'inspection_acts', 'inspection_readings',
    'inspection_violations', 'inspector_assignments',
    'invoices', 'billing_items', 'staff',
    'elevator_calls', 'elevator_tasks', 'gate_events',
    'parking_vehicles', 'blocking_reports', 'cctv_requests',
    'maintenance_requests', 'messages'
  ] LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE 'B: % алга — алгаслаа', t;
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    -- FOR ALL USING(true) устгагдахад унших нь алга болохгүйн тулд
    -- өмнө нь бүх мөр уншигддаг байсан эсэхийг тэмдэглэнэ
    SELECT EXISTS (
      SELECT 1 FROM pg_policies
       WHERE schemaname = 'public' AND tablename = t
         AND cmd IN ('ALL', 'SELECT') AND qual = 'true'
    ) INTO had_read;

    FOR p IN
      SELECT policyname FROM pg_policies
       WHERE schemaname = 'public' AND tablename = t
         AND cmd <> 'SELECT'
         AND (qual = 'true' OR with_check = 'true')
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
      RAISE NOTICE 'B: %.% устгав', t, p.policyname;
    END LOOP;

    IF had_read AND NOT EXISTS (
      SELECT 1 FROM pg_policies
       WHERE schemaname = 'public' AND tablename = t
         AND cmd = 'SELECT' AND qual = 'true'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT USING (true)',
        t || '_read_legacy', t
      );
      RAISE NOTICE 'B: %.%_read_legacy (түр унших) үүсгэв', t, t;
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- C) Оршин суугч өөрийн СӨХ-д бичих
-- ============================================================
-- (mobile)/sokh/[id]/* хуудсууд эдгээрт authenticated эрхээр insert хийдэг.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'maintenance_requests', 'messages', 'meter_readings', 'elevator_calls',
    'gate_events', 'parking_vehicles', 'blocking_reports', 'cctv_requests'
  ] LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
       WHERE schemaname = 'public' AND tablename = t
         AND policyname = t || '_insert_tenant'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated
           WITH CHECK (sokh_id IN (SELECT current_user_sokh_ids()))',
        t || '_insert_tenant', t
      );
      RAISE NOTICE 'C: %.%_insert_tenant үүсгэв', t, t;
    END IF;
  END LOOP;

  -- Зогсоолын машинаа «хассан» болгох (update) — supabase-parking-rls-tighten.sql-тэй ижил
  IF to_regclass('public.parking_vehicles') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'parking_vehicles'
       AND policyname = 'parking_vehicles_update_owner'
  ) THEN
    CREATE POLICY "parking_vehicles_update_owner" ON parking_vehicles
      FOR UPDATE TO authenticated
      USING (
        sokh_id IN (SELECT current_user_sokh_ids())
        AND resident_name IN (SELECT name FROM residents WHERE auth_user_id = auth.uid())
      )
      WITH CHECK (
        sokh_id IN (SELECT current_user_sokh_ids())
        AND resident_name IN (SELECT name FROM residents WHERE auth_user_id = auth.uid())
      );
    RAISE NOTICE 'C: parking_vehicles.parking_vehicles_update_owner үүсгэв';
  END IF;
END $$;

COMMIT;

-- ── ДАРАА НЬ шалгах ──
-- 1) Бичих `true` policy үлдэх ёсгүй (хоосон гарах ёстой):
--   SELECT tablename, policyname, cmd FROM pg_policies
--    WHERE schemaname = 'public' AND cmd <> 'SELECT'
--      AND (qual = 'true' OR with_check = 'true');
-- 2) Түр унших policy-ууд (дараагийн алхмаар хаана):
--   SELECT tablename, policyname FROM pg_policies
--    WHERE schemaname = 'public' AND cmd = 'SELECT' AND qual = 'true'
--    ORDER BY tablename;
