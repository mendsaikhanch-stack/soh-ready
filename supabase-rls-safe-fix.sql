-- ============================================================
-- RLS АЮУЛГҮЙ ЗАСВАР — 2026-08-29 (РЕГРЕСС ЭРСДЭЛГҮЙ)
-- ============================================================
-- Энэ файл нь шалгалтаар БОДИТООР anon key-д ил байсныг баталгаажуулсан
-- хүснэгтүүдийг Л хаана. Одоо ажиллаж буй tenant-scope policy-уудад
-- (residents/announcements/complaints/polls/chat) ОГТ ХҮРЭХГҮЙ тул
-- эргэж эвдрэх (регресс) эрсдэлгүй.
--
-- ⚠️ supabase-rls-full-fix.sql / supabase-rls-tighten.sql-ийг бүтнээр нь
--    БҮҮ ажиллуул — тэдгээр нь tenant-scope-оос ӨМНӨ бичигдсэн тул
--    residents-д USING(true) өргөн policy дахин үүсгэж, cross-tenant
--    уншилтыг эргүүлж нээнэ.
--
-- Урьдчилсан нөхцөл: current_user_sokh_ids() (tenant-scope миграцаар
-- үүссэн, production-д байгаа нь батлагдсан). Бүгд idempotent.
--
-- АЖИЛЛУУЛАХ: Supabase Dashboard → SQL Editor → бүхэлд нь paste → Run.
-- ДАРАА НЬ: node scratchpad/rls2.mjs → anon SELECT бүгд 0 мөр байх ёстой;
--          мобайл аппаар parking / marketplace / төлбөр хэвийн эсэхийг үз.
-- ============================================================


-- ############################################################
-- А. БҮРЭН ХААХ — зөвхөн server (service_role) уншдаг, эвдрэхгүй
-- ############################################################

-- 1) inspectors — байцаагчийн нэвтрэх нэр + bcrypt нууц үг
--    Нэвтрэлт /api/auth/login дотор service_role-оор → deny-all нөлөөлөхгүй.
DO $$ BEGIN
  IF to_regclass('public.inspectors') IS NULL THEN RETURN; END IF;
  EXECUTE 'ALTER TABLE public.inspectors ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS "Allow all inspectors" ON public.inspectors';
  EXECUTE 'DROP POLICY IF EXISTS "inspectors_deny_all" ON public.inspectors';
  EXECUTE 'CREATE POLICY "inspectors_deny_all" ON public.inspectors FOR ALL USING (false) WITH CHECK (false)';
  EXECUTE 'REVOKE ALL ON public.inspectors FROM anon, authenticated';
END $$;

-- 2) platform_bank_accounts — ХОТОЛ-ын банкны данс
DO $$ BEGIN
  IF to_regclass('public.platform_bank_accounts') IS NULL THEN RETURN; END IF;
  EXECUTE 'ALTER TABLE public.platform_bank_accounts ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS "platform_bank_accounts_all" ON public.platform_bank_accounts';
  EXECUTE 'DROP POLICY IF EXISTS "platform_bank_accounts_deny_all" ON public.platform_bank_accounts';
  EXECUTE 'CREATE POLICY "platform_bank_accounts_deny_all" ON public.platform_bank_accounts FOR ALL USING (false) WITH CHECK (false)';
  EXECUTE 'REVOKE ALL ON public.platform_bank_accounts FROM anon, authenticated';
END $$;

-- 3) platform_invoices — ХОТОЛ-ын орлого/нэхэмжлэх
DO $$ BEGIN
  IF to_regclass('public.platform_invoices') IS NULL THEN RETURN; END IF;
  EXECUTE 'ALTER TABLE public.platform_invoices ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS "platform_invoices_all" ON public.platform_invoices';
  EXECUTE 'DROP POLICY IF EXISTS "platform_invoices_deny_all" ON public.platform_invoices';
  EXECUTE 'CREATE POLICY "platform_invoices_deny_all" ON public.platform_invoices FOR ALL USING (false) WITH CHECK (false)';
  EXECUTE 'REVOKE ALL ON public.platform_invoices FROM anon, authenticated';
END $$;

-- 4) platform_plans — тариф + шимтгэлийн хувь
DO $$ BEGIN
  IF to_regclass('public.platform_plans') IS NULL THEN RETURN; END IF;
  EXECUTE 'ALTER TABLE public.platform_plans ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS "platform_plans_all" ON public.platform_plans';
  EXECUTE 'DROP POLICY IF EXISTS "platform_plans_deny_all" ON public.platform_plans';
  EXECUTE 'CREATE POLICY "platform_plans_deny_all" ON public.platform_plans FOR ALL USING (false) WITH CHECK (false)';
  EXECUTE 'REVOKE ALL ON public.platform_plans FROM anon, authenticated';
END $$;

-- 5) sokh_subscriptions — захиалгын төлөв
DO $$ BEGIN
  IF to_regclass('public.sokh_subscriptions') IS NULL THEN RETURN; END IF;
  EXECUTE 'ALTER TABLE public.sokh_subscriptions ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS "sokh_subscriptions_all" ON public.sokh_subscriptions';
  EXECUTE 'DROP POLICY IF EXISTS "sokh_subscriptions_deny_all" ON public.sokh_subscriptions';
  EXECUTE 'CREATE POLICY "sokh_subscriptions_deny_all" ON public.sokh_subscriptions FOR ALL USING (false) WITH CHECK (false)';
  EXECUTE 'REVOKE ALL ON public.sokh_subscriptions FROM anon, authenticated';
END $$;


-- ############################################################
-- Б. TENANT-SCOPE — мобайл апп (authenticated resident) уншдаг тул
--    хаалгүй, зөвхөн ӨӨРИЙН СӨХ-д хязгаарлана (эвдрэхгүй)
-- ############################################################

-- Оршин суугчийн residents.id-уудыг буцаах helper (invoices-д хэрэгтэй)
CREATE OR REPLACE FUNCTION public.current_resident_ids()
RETURNS SETOF bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT id FROM residents WHERE auth_user_id = auth.uid() $$;
GRANT EXECUTE ON FUNCTION public.current_resident_ids() TO authenticated;

-- 6) parking_vehicles — дугаар+нэр+тоот (129 мөр ил байсан)
DO $$ BEGIN
  IF to_regclass('public.parking_vehicles') IS NULL THEN RETURN; END IF;
  EXECUTE 'ALTER TABLE public.parking_vehicles ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS "Allow all parking_vehicles" ON public.parking_vehicles';
  EXECUTE 'DROP POLICY IF EXISTS "parking_select" ON public.parking_vehicles';
  EXECUTE 'DROP POLICY IF EXISTS "parking_insert" ON public.parking_vehicles';
  EXECUTE 'DROP POLICY IF EXISTS "parking_update" ON public.parking_vehicles';
  EXECUTE 'DROP POLICY IF EXISTS "parking_vehicles_select_authenticated" ON public.parking_vehicles';
  EXECUTE 'DROP POLICY IF EXISTS "parking_vehicles_select_tenant" ON public.parking_vehicles';
  EXECUTE 'DROP POLICY IF EXISTS "parking_vehicles_insert_tenant" ON public.parking_vehicles';
  EXECUTE 'DROP POLICY IF EXISTS "parking_vehicles_update_tenant" ON public.parking_vehicles';
  EXECUTE 'CREATE POLICY "parking_vehicles_select_tenant" ON public.parking_vehicles FOR SELECT TO authenticated USING (sokh_id IN (SELECT current_user_sokh_ids()))';
  EXECUTE 'CREATE POLICY "parking_vehicles_insert_tenant" ON public.parking_vehicles FOR INSERT TO authenticated WITH CHECK (sokh_id IN (SELECT current_user_sokh_ids()))';
  EXECUTE 'CREATE POLICY "parking_vehicles_update_tenant" ON public.parking_vehicles FOR UPDATE TO authenticated USING (sokh_id IN (SELECT current_user_sokh_ids())) WITH CHECK (sokh_id IN (SELECT current_user_sokh_ids()))';
END $$;

-- 7) marketplace_listings — зарагчийн нэр+утас+тоот
DO $$ BEGIN
  IF to_regclass('public.marketplace_listings') IS NULL THEN RETURN; END IF;
  EXECUTE 'ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS "Allow all marketplace_listings" ON public.marketplace_listings';
  EXECUTE 'DROP POLICY IF EXISTS "marketplace_select" ON public.marketplace_listings';
  EXECUTE 'DROP POLICY IF EXISTS "marketplace_insert" ON public.marketplace_listings';
  EXECUTE 'DROP POLICY IF EXISTS "marketplace_select_authenticated" ON public.marketplace_listings';
  EXECUTE 'DROP POLICY IF EXISTS "marketplace_insert_authenticated" ON public.marketplace_listings';
  EXECUTE 'DROP POLICY IF EXISTS "marketplace_select_tenant" ON public.marketplace_listings';
  EXECUTE 'DROP POLICY IF EXISTS "marketplace_insert_tenant" ON public.marketplace_listings';
  EXECUTE 'CREATE POLICY "marketplace_select_tenant" ON public.marketplace_listings FOR SELECT TO authenticated USING (sokh_id IN (SELECT current_user_sokh_ids()))';
  EXECUTE 'CREATE POLICY "marketplace_insert_tenant" ON public.marketplace_listings FOR INSERT TO authenticated WITH CHECK (sokh_id IN (SELECT current_user_sokh_ids()))';
END $$;

-- 8) invoices — зөвхөн ӨӨРИЙН нэхэмжлэх УНШИНА. Төлөв солих (webhook) = service_role.
DO $$ BEGIN
  IF to_regclass('public.invoices') IS NULL THEN RETURN; END IF;
  EXECUTE 'ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS "invoices_all" ON public.invoices';
  EXECUTE 'DROP POLICY IF EXISTS "Allow all invoices" ON public.invoices';
  EXECUTE 'DROP POLICY IF EXISTS "invoices_select" ON public.invoices';
  EXECUTE 'DROP POLICY IF EXISTS "invoices_select_own" ON public.invoices';
  EXECUTE 'CREATE POLICY "invoices_select_own" ON public.invoices FOR SELECT TO authenticated USING (resident_id IN (SELECT current_resident_ids()))';
END $$;

-- 9) push_subscriptions — endpoint+түлхүүр. Бичилт бүгд service_role API.
DO $$ BEGIN
  IF to_regclass('public.push_subscriptions') IS NULL THEN RETURN; END IF;
  EXECUTE 'ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS "push_select" ON public.push_subscriptions';
  EXECUTE 'DROP POLICY IF EXISTS "push_insert" ON public.push_subscriptions';
  EXECUTE 'DROP POLICY IF EXISTS "push_update" ON public.push_subscriptions';
  EXECUTE 'DROP POLICY IF EXISTS "push_delete" ON public.push_subscriptions';
  EXECUTE 'DROP POLICY IF EXISTS "push_select_authenticated" ON public.push_subscriptions';
  EXECUTE 'DROP POLICY IF EXISTS "push_select_tenant" ON public.push_subscriptions';
  EXECUTE 'CREATE POLICY "push_select_tenant" ON public.push_subscriptions FOR SELECT TO authenticated USING (sokh_id IN (SELECT current_user_sokh_ids()))';
  -- INSERT/UPDATE/DELETE policy ҮГҮЙ → зөвхөн service_role бичнэ.
END $$;

-- ============================================================
-- ТАЙЛБАР
-- ============================================================
-- • sokh_organizations (1210) public SELECT — ЗОРИУД (бүртгэлийн хайлт).
--   Утас/тарифыг нуух эсэх нь тусдаа шийдвэр — энэ файлд хөндөөгүй.
-- • residents / payments / announcements / complaints / polls / chat нь
--   tenant-scope миграцаар аль хэдийн хамгаалагдсан — энд ХӨНДӨӨГҮЙ.
-- ============================================================
