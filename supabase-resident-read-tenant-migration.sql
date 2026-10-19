-- ============================================================
-- Оршин суугчийн уншдаг хүснэгтүүдийн нийтийн уншилтыг хаах
-- ============================================================
-- supabase-anon-rls-close-migration.sql-ийн дараагийн алхам.
-- Тэр migration эдгээр хүснэгтийн бичихийг хааж, уншихыг түр
-- `USING (true)`-ээр үлдээсэн. Үүнээс болж anon key-тэй хэн ч (нэвтрээгүй)
-- бүх СӨХ-ийн ажилтны утас, лифт/хаалганы бүртгэл, илгээмжийн код г.м.
-- уншиж чадаж байв.
--
-- Эдгээрийг anon key-ээр зөвхөн (mobile)/sokh/[id]/* хуудсууд уншдаг бөгөөд
-- тэр хуудсууд layout-доо Supabase Auth нэвтрэлт шаарддаг (authenticated).
-- Бусад нь /api/admin/db proxy (service_role)-оор уншдаг болсон:
--   admin/utilities, mng-ctrl/*-revenue, osnaa/*, inspector/readings,
--   inspector/inspect/[id] — энэ migration-тэй хамт adminFrom руу шилжсэн.
--   ОСНАА, байцаагч session-ийн нэг СӨХ-ээр хязгаарлагдана.
--
-- Хийх зүйл (хүснэгт бүрд):
--   1) `USING (true)` бүх SELECT policy-г устгана (_read_legacy орно)
--   2) Нэвтэрсэн оршин суугч зөвхөн өөрийн СӨХ-ийн мөрийг уншина:
--      sokh_id IN (SELECT current_user_sokh_ids())
--
-- inspection_* хүснэгтүүд энд ОРООГҮЙ — sokh_id баганагүй, inspector/*
-- хуудсууд anon key-ээр уншсаар байгаа (дараагийн шат).
--
-- ⚠️ Deploy-ийн ДАРАА ажиллуулна: дээрх хуудсуудын шинэ хувилбар
--    production-д гарсан байх ёстой, эс бөгөөс тэд хоосон харагдана.
-- ⚠️ Байцаагч дахин нэвтрэх ёстой — хуучин session-д sokh_id байхгүй.
--
-- Шаардлага: current_user_sokh_ids() (supabase-tenant-scope-migration.sql).
-- Давтан ажиллуулахад аюулгүй. Нэг transaction.
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.current_user_sokh_ids()') IS NULL THEN
    RAISE EXCEPTION 'current_user_sokh_ids() алга — эхлээд supabase-tenant-scope-migration.sql ажиллуулна уу';
  END IF;
END $$;

DO $$
DECLARE
  t text;
  p record;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'elevator_calls', 'gate_events', 'staff',
    'billing_items', 'packages', 'utility_usage',
    'utility_bills', 'meter_readings', 'utility_tariffs'
  ] LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE '% алга — алгаслаа', t;
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    FOR p IN
      SELECT policyname FROM pg_policies
       WHERE schemaname = 'public' AND tablename = t
         AND cmd IN ('SELECT', 'ALL') AND qual = 'true'
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
      RAISE NOTICE '%.% устгав', t, p.policyname;
    END LOOP;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
       WHERE schemaname = 'public' AND tablename = t
         AND policyname = t || '_select_tenant'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
           USING (sokh_id IN (SELECT current_user_sokh_ids()))',
        t || '_select_tenant', t
      );
      RAISE NOTICE '%.%_select_tenant үүсгэв', t, t;
    END IF;
  END LOOP;
END $$;

COMMIT;

-- ── ДАРАА НЬ шалгах (qual = 'true' мөр байх ёсгүй) ──
--   SELECT tablename, policyname, cmd, roles::text, qual FROM pg_policies
--    WHERE schemaname = 'public'
--      AND tablename IN ('elevator_calls','gate_events','staff',
--                        'billing_items','packages','utility_usage',
--                        'utility_bills','meter_readings','utility_tariffs')
--      AND cmd IN ('SELECT','ALL')
--    ORDER BY tablename;
