-- ============================================================
-- Cross-tenant БИЧИХ нүхийг хаах (RLS write tighten)
-- ============================================================
-- Асуудал: хэд хэдэн хүснэгт дээр `USING (true)` / `WITH CHECK (true)`
-- бичих policy үлдсэн байсан. Үүнээс болж:
--
--   • resident_bills — нэвтэрсэн ямар ч оршин суугч ӨӨР СӨХ-ийн ямар ч
--     айлын нэхэмжлэхийг засаж чадна (жишээ нь өөрийн өрөө 0 болгох).
--   • invoices / reserve_fund / budget_plans — `FOR ALL` дээр `TO` заалт
--     байхгүй тул PUBLIC (=anon) хамаарна: нэвтрээгүй хүн ч санхүүгийн
--     хүснэгтэд бичиж чадна.
--   • inspections / inspection_* / hoa_directory — мөн адил PUBLIC `FOR ALL`.
--   • polls / packages / marketplace_listings / space_bookings /
--     cctv_requests / content_reports — cross-tenant бичих боломжтой.
--
-- Шийдэл (2 хэсэг):
--   1) `FOR ALL USING(true)` policy-г `FOR SELECT USING(true)` болгож
--      БУУРУУЛНА. Ингэснээр УНШИХ урсгал хэвээр ажиллана (админ/байцаагчийн
--      хуудсууд одоогоор anon key-ээр уншсаар байгаа тул), БИЧИХ нь зөвхөн
--      service_role-д үлдэнэ.
--   2) Оршин суугч жинхэнэ бичдэг цөөн урсгалд tenant-scoped policy өгнө.
--
-- Pattern: sokh_id IN (SELECT current_user_sokh_ids())
-- Эх сурвалж: supabase-tenant-scope-migration.sql
--
-- Админ / Супер / ОСНАА / Байцаагчийн БИЧИХ үйлдэл бүгд
-- /api/admin/db proxy (service_role) — RLS bypass хийдэг тул нөлөөлөхгүй.
--
-- Давтан ажиллуулахад аюулгүй (idempotent). Хүснэгт байхгүй бол
-- тухайн хэсгийг алгасна — скрипт бүхэлдээ унахгүй.
--
-- ⚠️ АНХААР: энэ файл УНШИХ (SELECT) нүхийг ЗАСАХГҮЙ. Тэр нь тусдаа
--    алхам — эхлээд админ/байцаагчийн хуудсуудыг adminFrom proxy руу
--    бүрэн шилжүүлсний ДАРАА л SELECT-ийг чангална.
--
-- ⚠️ Шаардлага: current_user_sokh_ids() функц болон residents.auth_user_id
--    багана байх ёстой → supabase-tenant-scope-migration.sql-ыг ЭХЛЭЭД
--    ажиллуулсан байх ёстой.
-- ============================================================


-- ============================================================
-- 0. Урьдчилсан шалгалт — одоогийн байдлыг харах
-- ============================================================
-- Доорхийг ЭХЛЭЭД тусад нь ажиллуулж, ямар бичих policy амьд байгааг
-- хараарай. Миграцийн ДАРАА дахин ажиллуулж жагсаалт хоосорсныг батална.
--
--   SELECT tablename, policyname, cmd, roles::text, qual, with_check
--     FROM pg_policies
--    WHERE schemaname = 'public'
--      AND cmd <> 'SELECT'
--      AND (qual = 'true' OR with_check = 'true')
--    ORDER BY tablename, policyname;

-- Шаардлагатай функц байгаа эсэхийг шалгаж, байхгүй бол тодорхой
-- алдаа өгч зогсоно (дунд замд эвдэрснээс дээр).
DO $$
BEGIN
  IF to_regprocedure('public.current_user_sokh_ids()') IS NULL THEN
    RAISE EXCEPTION 'current_user_sokh_ids() функц алга. Эхлээд supabase-tenant-scope-migration.sql-ыг ажиллуулна уу.';
  END IF;
END $$;


-- ============================================================
-- 1. resident_bills — UPDATE policy-г БҮРЭН хасах
-- ============================================================
-- Аппын код энэ хүснэгтэд огт хүрдэггүй (git grep = 0 үр дүн).
-- Бүх бичилт service_role-оор явдаг тул policy шаардлагагүй.

DO $$
BEGIN
  IF to_regclass('public.resident_bills') IS NULL THEN RETURN; END IF;

  DROP POLICY IF EXISTS "resident_bills_update_authenticated" ON resident_bills;
  DROP POLICY IF EXISTS "rbills_update" ON resident_bills;
  DROP POLICY IF EXISTS "Allow all resident_bills" ON resident_bills;
END $$;


-- ============================================================
-- 2. Санхүүгийн хүснэгтүүд — PUBLIC `FOR ALL` → зөвхөн SELECT
-- ============================================================
-- invoices, reserve_fund, budget_plans дээрх `FOR ALL USING(true)`
-- нь anon-д хүртэл бичих эрх өгч байсан.

-- 2.1 invoices
DO $$
BEGIN
  IF to_regclass('public.invoices') IS NULL THEN RETURN; END IF;

  DROP POLICY IF EXISTS "invoices_all" ON invoices;
  DROP POLICY IF EXISTS "Allow all invoices" ON invoices;
  DROP POLICY IF EXISTS "invoices_select" ON invoices;
  DROP POLICY IF EXISTS "invoices_update_tenant" ON invoices;

  CREATE POLICY "invoices_select" ON invoices
    FOR SELECT USING (true);

  -- Оршин суугч QPay төлбөр амжилттай болсны дараа өөрийн СӨХ-ийн
  -- нэхэмжлэхийг "төлсөн" болгодог (app/(mobile)/sokh/[id]/payments).
  CREATE POLICY "invoices_update_tenant" ON invoices
    FOR UPDATE TO authenticated
    USING (sokh_id IN (SELECT current_user_sokh_ids()))
    WITH CHECK (sokh_id IN (SELECT current_user_sokh_ids()));
END $$;

-- 2.2 reserve_fund — бичих код байхгүй, зөвхөн уншина
DO $$
BEGIN
  IF to_regclass('public.reserve_fund') IS NULL THEN RETURN; END IF;

  DROP POLICY IF EXISTS "reserve_fund_all" ON reserve_fund;
  DROP POLICY IF EXISTS "Allow all reserve_fund" ON reserve_fund;
  DROP POLICY IF EXISTS "reserve_fund_select" ON reserve_fund;

  CREATE POLICY "reserve_fund_select" ON reserve_fund
    FOR SELECT USING (true);
END $$;

-- 2.3 budget_plans — бичих код байхгүй, зөвхөн уншина
DO $$
BEGIN
  IF to_regclass('public.budget_plans') IS NULL THEN RETURN; END IF;

  DROP POLICY IF EXISTS "budget_plans_all" ON budget_plans;
  DROP POLICY IF EXISTS "Allow all budget_plans" ON budget_plans;
  DROP POLICY IF EXISTS "budget_plans_select" ON budget_plans;

  CREATE POLICY "budget_plans_select" ON budget_plans
    FOR SELECT USING (true);
END $$;


-- ============================================================
-- 3. Байцаагчийн хүснэгтүүд — PUBLIC `FOR ALL` → зөвхөн SELECT
-- ============================================================
-- Байцаагч нь Supabase Auth хэрэглэгч БИШ (cookie session).
-- Тиймээс /app/inspector/* хуудсууд anon key-ээр УНШдаг —
-- SELECT-ийг PUBLIC хэвээр үлдээнэ.
-- Бичилт нь бүгд adminFrom proxy (service_role)-оор явдаг тул
-- бичих policy-г бүрэн хасаж болно.

DO $$
BEGIN
  IF to_regclass('public.inspections') IS NULL THEN RETURN; END IF;

  DROP POLICY IF EXISTS "Allow all inspections" ON inspections;
  DROP POLICY IF EXISTS "inspections_select_authenticated" ON inspections;
  DROP POLICY IF EXISTS "inspections_select" ON inspections;

  CREATE POLICY "inspections_select" ON inspections
    FOR SELECT USING (true);
END $$;

DO $$
BEGIN
  IF to_regclass('public.inspection_readings') IS NULL THEN RETURN; END IF;

  DROP POLICY IF EXISTS "Allow all inspection_readings" ON inspection_readings;
  DROP POLICY IF EXISTS "inspection_readings_select_authenticated" ON inspection_readings;
  DROP POLICY IF EXISTS "inspection_readings_select" ON inspection_readings;

  CREATE POLICY "inspection_readings_select" ON inspection_readings
    FOR SELECT USING (true);
END $$;

DO $$
BEGIN
  IF to_regclass('public.inspection_violations') IS NULL THEN RETURN; END IF;

  DROP POLICY IF EXISTS "Allow all inspection_violations" ON inspection_violations;
  DROP POLICY IF EXISTS "inspection_violations_select" ON inspection_violations;

  CREATE POLICY "inspection_violations_select" ON inspection_violations
    FOR SELECT USING (true);
END $$;

DO $$
BEGIN
  IF to_regclass('public.inspection_acts') IS NULL THEN RETURN; END IF;

  DROP POLICY IF EXISTS "Allow all inspection_acts" ON inspection_acts;
  DROP POLICY IF EXISTS "inspection_acts_select" ON inspection_acts;

  CREATE POLICY "inspection_acts_select" ON inspection_acts
    FOR SELECT USING (true);
END $$;


-- ============================================================
-- 4. СӨХ-ийн лавлах (hoa_directory) — PUBLIC `FOR ALL` → зөвхөн SELECT
-- ============================================================
-- Лавлах нь нийтэд нээлттэй УНШих ёстой (СӨХ хайх урсгал),
-- гэхдээ бичих нь зөвхөн /api/admin/directory/* (service_role).

DO $$
BEGIN
  IF to_regclass('public.hoa_directory') IS NULL THEN RETURN; END IF;

  DROP POLICY IF EXISTS "hoa_directory_all" ON hoa_directory;
  DROP POLICY IF EXISTS "hoa_directory_select" ON hoa_directory;

  CREATE POLICY "hoa_directory_select" ON hoa_directory
    FOR SELECT USING (true);
END $$;

DO $$
BEGIN
  IF to_regclass('public.hoa_directory_aliases') IS NULL THEN RETURN; END IF;

  DROP POLICY IF EXISTS "hoa_aliases_all" ON hoa_directory_aliases;
  DROP POLICY IF EXISTS "hoa_aliases_select" ON hoa_directory_aliases;

  CREATE POLICY "hoa_aliases_select" ON hoa_directory_aliases
    FOR SELECT USING (true);
END $$;


-- ============================================================
-- 5. push_subscriptions — PUBLIC бичих policy хасах
-- ============================================================
-- Бүх бичилт /api/push/subscribe, /api/push/send, cron —
-- бүгд service_role. Client-ээс шууд бичдэг код байхгүй.

DO $$
BEGIN
  IF to_regclass('public.push_subscriptions') IS NULL THEN RETURN; END IF;

  DROP POLICY IF EXISTS "push_update" ON push_subscriptions;
  DROP POLICY IF EXISTS "push_delete" ON push_subscriptions;
  DROP POLICY IF EXISTS "push_insert" ON push_subscriptions;
  DROP POLICY IF EXISTS "push_insert_authenticated" ON push_subscriptions;
END $$;


-- ============================================================
-- 6. Оршин суугчийн жинхэнэ бичих урсгалууд — tenant-scoped
-- ============================================================

-- 6.1 polls — санал өгөхөд yes_count/no_count нэмэгддэг
--     (app/(mobile)/sokh/[id]/voting)
DO $$
BEGIN
  IF to_regclass('public.polls') IS NULL THEN RETURN; END IF;

  DROP POLICY IF EXISTS "polls_update_authenticated" ON polls;
  DROP POLICY IF EXISTS "polls_update_tenant" ON polls;

  CREATE POLICY "polls_update_tenant" ON polls
    FOR UPDATE TO authenticated
    USING (sokh_id IN (SELECT current_user_sokh_ids()))
    WITH CHECK (sokh_id IN (SELECT current_user_sokh_ids()));
END $$;

-- 6.2 packages — оршин суугч илгээмжээ "авсан" гэж тэмдэглэнэ
DO $$
BEGIN
  IF to_regclass('public.packages') IS NULL THEN RETURN; END IF;

  DROP POLICY IF EXISTS "packages_update_authenticated" ON packages;
  DROP POLICY IF EXISTS "packages_update_tenant" ON packages;

  CREATE POLICY "packages_update_tenant" ON packages
    FOR UPDATE TO authenticated
    USING (sokh_id IN (SELECT current_user_sokh_ids()))
    WITH CHECK (sokh_id IN (SELECT current_user_sokh_ids()));
END $$;

-- 6.3 marketplace_listings — зар нэмэх
DO $$
BEGIN
  IF to_regclass('public.marketplace_listings') IS NULL THEN RETURN; END IF;

  DROP POLICY IF EXISTS "marketplace_insert_authenticated" ON marketplace_listings;
  DROP POLICY IF EXISTS "marketplace_insert_tenant" ON marketplace_listings;

  CREATE POLICY "marketplace_insert_tenant" ON marketplace_listings
    FOR INSERT TO authenticated
    WITH CHECK (sokh_id IN (SELECT current_user_sokh_ids()));
END $$;

-- 6.4 space_bookings — нийтийн талбай захиалах
DO $$
BEGIN
  IF to_regclass('public.space_bookings') IS NULL THEN RETURN; END IF;

  DROP POLICY IF EXISTS "space_bookings_insert_authenticated" ON space_bookings;
  DROP POLICY IF EXISTS "space_bookings_insert_tenant" ON space_bookings;

  CREATE POLICY "space_bookings_insert_tenant" ON space_bookings
    FOR INSERT TO authenticated
    WITH CHECK (sokh_id IN (SELECT current_user_sokh_ids()));
END $$;

-- 6.5 cctv_requests — камерын бичлэг хүсэх
DO $$
BEGIN
  IF to_regclass('public.cctv_requests') IS NULL THEN RETURN; END IF;

  DROP POLICY IF EXISTS "cctv_requests_insert_authenticated" ON cctv_requests;
  DROP POLICY IF EXISTS "cctv_requests_insert_tenant" ON cctv_requests;

  CREATE POLICY "cctv_requests_insert_tenant" ON cctv_requests
    FOR INSERT TO authenticated
    WITH CHECK (sokh_id IN (SELECT current_user_sokh_ids()));
END $$;

-- 6.6 content_reports — зохисгүй контент мэдээлэх (ReportButton)
DO $$
BEGIN
  IF to_regclass('public.content_reports') IS NULL THEN RETURN; END IF;

  DROP POLICY IF EXISTS "content_reports_insert_authenticated" ON content_reports;
  DROP POLICY IF EXISTS "content_reports_insert_tenant" ON content_reports;

  CREATE POLICY "content_reports_insert_tenant" ON content_reports
    FOR INSERT TO authenticated
    WITH CHECK (sokh_id IN (SELECT current_user_sokh_ids()));
END $$;


-- ============================================================
-- 7. Дараах шалгалт
-- ============================================================
-- Миграцийн дараа доорхийг ажиллуулж, бичих нүх үлдээгүйг батална.
-- Үр дүнд зөвхөн санаатай үлдээсэн мөрүүд гарах ёстой:
--   error_logs_insert_all, residents_insert_anon,
--   maintenance/complaints/chat/messages insert (tenant-scope-д зассан)
--
--   SELECT tablename, policyname, cmd, roles::text
--     FROM pg_policies
--    WHERE schemaname = 'public'
--      AND cmd <> 'SELECT'
--      AND (qual = 'true' OR with_check = 'true')
--    ORDER BY tablename;


-- ============================================================
-- ДҮГНЭЛТ
-- ============================================================
-- ХААГДСАН:
--   • resident_bills — өөр СӨХ-ийн нэхэмжлэх засах боломж (гол нүх)
--   • invoices / reserve_fund / budget_plans — anon бичих боломж
--   • inspections / inspection_readings / inspection_violations /
--     inspection_acts — anon бичих боломж
--   • hoa_directory / hoa_directory_aliases — anon бичих боломж
--   • push_subscriptions — anon устгах/засах боломж
--   • polls / packages / marketplace_listings / space_bookings /
--     cctv_requests / content_reports — cross-tenant бичих боломж
--
-- ХЭВЭЭР (санаатай):
--   • error_logs INSERT — алдааны лог бүртгэхэд нээлттэй байх ёстой
--     (уншихыг зөвхөн service_role хийнэ)
--   • residents INSERT TO anon — бүртгэлийн урсгалд шаардлагатай
--
-- ХАРААХАН ЗАСААГҮЙ (тусдаа алхам):
--   • SELECT-ийн cross-tenant нүх — utility_bills, meter_readings,
--     billing_items, budget_items гэх мэт. Эхлээд админ/байцаагчийн
--     хуудсуудыг adminFrom proxy руу бүрэн шилжүүлэх шаардлагатай.
--   • polls дээрх санал тоолох логик нь client-ээс шууд counter
--     нэмдэг, давхар саналыг зөвхөн localStorage-оор хардаг —
--     энэ нь RLS-ийн бус, аппын дизайны асуудал.
-- ============================================================
