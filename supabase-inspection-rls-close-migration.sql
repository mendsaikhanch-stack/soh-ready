-- ============================================================
-- Байцаагчийн хүснэгтүүдийн нийтийн уншилтыг хаах
-- ============================================================
-- supabase-anon-rls-close-migration.sql эдгээрийн бичихийг хааж, уншихыг
-- түр `USING (true)`-ээр үлдээсэн (inspector/* хуудсууд anon key-ээр
-- уншдаг байсан тул).
--
-- inspector/* хуудсууд одоо бүгд /api/admin/db proxy (service_role)-оор
-- уншина. Байцаагч session-ийн нэг СӨХ-ээр хязгаарлагдана; sokh_id-гүй
-- inspection_readings/violations/acts нь inspection_id → inspections.sokh_id
-- замаар шалгагдана. Оршин суугчийн хуудас эдгээрийг уншдаггүй тул
-- tenant policy үүсгэхгүй — зөвхөн service_role хандана.
--
-- ⚠️ Deploy-ийн ДАРАА ажиллуулна, эс бөгөөс inspector/* хоосон харагдана.
-- Давтан ажиллуулахад аюулгүй. Нэг transaction.
-- ============================================================

BEGIN;

DO $$
DECLARE
  t text;
  p record;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'inspections', 'inspection_readings', 'inspection_violations',
    'inspection_acts', 'inspector_assignments'
  ] LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE '% алга — алгаслаа', t;
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    FOR p IN
      SELECT policyname FROM pg_policies
       WHERE schemaname = 'public' AND tablename = t
         AND (qual = 'true' OR with_check = 'true')
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
      RAISE NOTICE '%.% устгав', t, p.policyname;
    END LOOP;
  END LOOP;
END $$;

COMMIT;

-- ── ДАРАА НЬ шалгах (хоосон гарах ёстой) ──
--   SELECT tablename, policyname, cmd FROM pg_policies
--    WHERE schemaname = 'public'
--      AND tablename IN ('inspections','inspection_readings','inspection_violations',
--                        'inspection_acts','inspector_assignments')
--      AND (qual = 'true' OR with_check = 'true');
