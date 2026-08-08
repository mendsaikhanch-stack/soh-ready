-- ============================================================
-- ХОТОЛ — Төлбөрийн RLS хатууруулалт (PHASE 0.5)
-- Supabase ▸ SQL Editor ▸ Run.  Давтан ажиллуулахад аюулгүй.
--
-- ЗАСАХ АСУУДЛУУД:
--   1. invoices — `USING (true)` бөгөөд `TO` заалтгүй байсан тул
--      НЭВТРЭЭГҮЙ (anon) хүн ч БҮХ СӨХ-ийн нэхэмжлэлийг уншиж байсан.
--   2. payments — тухайн СӨХ-ийн БҮХ айлын төлбөр харагддаг байсан.
--      Оршин суугч А нь оршин суугч Б-ийн төлбөрийг харах ёсгүй.
--   3. invoices UPDATE — СӨХ-ийн аль ч нэвтэрсэн хэрэглэгч ДУРЫН
--      нэхэмжлэлийг "төлсөн" болгож чаддаг байсан. Мөнгө төлөхгүйгээр
--      өрөө арилгах нүх. Төлөв солих ажил зөвхөн сервер талд
--      (QPay callback / Wire webhook, service_role) үлдэнэ.
--   4. billing_items — бүх СӨХ-ийн үнийн жагсаалт нээлттэй байсан.
--
-- Админ/Суперадмин/ОСНАА/Байцаагч нь Supabase Auth хэрэглэгч БИШ,
-- /api/admin/db proxy-гоор service_role-оор ханддаг тул эдгээр policy
-- тэдэнд нөлөөлөхгүй (service_role нь RLS-ийг тойрдог).
-- ============================================================


-- ============================================================
-- 1. current_resident_ids() helper
-- ============================================================
-- Нэвтэрсэн хэрэглэгчийн residents.id-уудыг буцаана.
-- SECURITY DEFINER — RLS-г тойрч residents-ээс уншина.
-- STABLE — нэг query дотор cache хийнэ.
-- current_user_sokh_ids()-тай ижил хэв маяг.

CREATE OR REPLACE FUNCTION public.current_resident_ids()
RETURNS SETOF bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
    FROM residents
   WHERE auth_user_id = auth.uid()
$$;

GRANT EXECUTE ON FUNCTION public.current_resident_ids() TO authenticated;


-- ============================================================
-- 2. invoices — зөвхөн ӨӨРИЙН нэхэмжлэх, зөвхөн УНШИНА
-- ============================================================

DO $$
BEGIN
  IF to_regclass('public.invoices') IS NULL THEN RETURN; END IF;

  -- Хуучин нээлттэй policy-ууд
  DROP POLICY IF EXISTS "invoices_all"            ON invoices;
  DROP POLICY IF EXISTS "Allow all invoices"      ON invoices;
  DROP POLICY IF EXISTS "invoices_select"         ON invoices;
  DROP POLICY IF EXISTS "invoices_select_tenant"  ON invoices;
  DROP POLICY IF EXISTS "invoices_select_own"     ON invoices;
  -- ⚠️ Энэ нь "мөнгө төлөхгүйгээр төлсөн болгох" нүх байсан
  DROP POLICY IF EXISTS "invoices_update_tenant"  ON invoices;

  CREATE POLICY "invoices_select_own" ON invoices
    FOR SELECT TO authenticated
    USING (resident_id IN (SELECT current_resident_ids()));

  -- INSERT / UPDATE / DELETE policy ЗОРИУДААР үүсгэхгүй.
  -- Нэхэмжлэх үүсгэх (админ) ба төлсөн болгох (webhook) нь
  -- зөвхөн service_role-оор явна.
END $$;


-- ============================================================
-- 3. payments — зөвхөн ӨӨРИЙН төлбөрийн түүх
-- ============================================================

DO $$
BEGIN
  IF to_regclass('public.payments') IS NULL THEN RETURN; END IF;

  DROP POLICY IF EXISTS "Allow all access to payments"    ON payments;
  DROP POLICY IF EXISTS "payments_select"                 ON payments;
  DROP POLICY IF EXISTS "payments_insert"                 ON payments;
  DROP POLICY IF EXISTS "payments_select_authenticated"   ON payments;
  DROP POLICY IF EXISTS "payments_select_tenant"          ON payments;
  DROP POLICY IF EXISTS "payments_select_own"             ON payments;

  CREATE POLICY "payments_select_own" ON payments
    FOR SELECT TO authenticated
    USING (resident_id IN (SELECT current_resident_ids()));

  -- INSERT policy ҮГҮЙ — төлбөрийн бичилтийг зөвхөн сервер хийнэ.
END $$;


-- ============================================================
-- 4. billing_items — өөрийн СӨХ-ийн үнийн жагсаалт (хувь хүний биш)
-- ============================================================

DO $$
BEGIN
  IF to_regclass('public.billing_items') IS NULL THEN RETURN; END IF;

  DROP POLICY IF EXISTS "Allow all billing_items"              ON billing_items;
  DROP POLICY IF EXISTS "billing_select"                       ON billing_items;
  DROP POLICY IF EXISTS "billing_items_select_authenticated"   ON billing_items;
  DROP POLICY IF EXISTS "billing_items_select_tenant"          ON billing_items;

  CREATE POLICY "billing_items_select_tenant" ON billing_items
    FOR SELECT TO authenticated
    USING (sokh_id IN (SELECT current_user_sokh_ids()));
END $$;


-- ============================================================
-- 5. utility_bills — БИЧИХ эрхийг хаана, УНШИХыг хэвээр үлдээнэ
-- ============================================================
-- Одоо `FOR ALL USING(true) WITH CHECK(true)` байгаа тул апп дотор
-- ирдэг anon key-тэй хэн ч БҮХ коммуналын нэхэмжлэлийг ЗАСАХ/УСТГАХ
-- боломжтой (жишээ нь өөрийн өрөө "төлсөн" болгох).
--
-- Уншилтыг ЗОРИУДААР нээлттэй үлдээв: /osnaa/* болон
-- /mng-ctrl/{osnaa,tsah}-revenue хуудсууд үүнийг anon client-ээр уншдаг.
-- Тэдгээрийн БИЧИЛТ бүгд adminFrom (service_role) -оор явдаг тул
-- энэ өөрчлөлт ажиллаж байгаа ямар ч урсгалыг эвдэхгүй.

DO $$
BEGIN
  IF to_regclass('public.utility_bills') IS NULL THEN RETURN; END IF;

  DROP POLICY IF EXISTS "Allow all utility_bills"               ON utility_bills;
  DROP POLICY IF EXISTS "utility_bills_select_authenticated"    ON utility_bills;
  DROP POLICY IF EXISTS "utility_bills_select"                  ON utility_bills;

  -- Уншилт нээлттэй хэвээр (өнөөдрийнхтэй ижил зан төлөв)
  CREATE POLICY "utility_bills_select" ON utility_bills
    FOR SELECT USING (true);

  -- INSERT/UPDATE/DELETE policy ҮГҮЙ → зөвхөн service_role бичнэ.
END $$;


-- ============================================================
-- ХИЙГДЭЭГҮЙ — ДАРААГИЙН АЖИЛ
-- ============================================================
-- utility_bills-ийн УНШИХ эрх нээлттэй хэвээр: бүх СӨХ-ийн коммуналын
-- нэхэмжлэл (одоогоор 12 мөр) anon-д харагдана.
--
-- ШАЛТГААН: ОСНААК нь ОЛОН СӨХ-д үйлчилдэг тул одоогийн нэг-СӨХ
-- tenant scope загварт тохирохгүй — тусдаа загварчлал шаардана.
-- Сохроор хаавал ажиллаж байгаа ОСНААК модуль эвдэрнэ
-- (Play шалгалт явж байх үед эрсдэлтэй).
--
-- Хийх ажил: utility_bills-ийг osnaa/superadmin allowlist-д нэмэх →
-- 6 хуудсын уншилтыг adminFrom руу шилжүүлэх → дараа нь энд
-- SELECT policy-г tenant/resident scope болгох.
