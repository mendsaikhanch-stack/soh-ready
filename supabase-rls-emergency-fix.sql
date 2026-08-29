-- ============================================================
-- ЯАРАЛТАЙ RLS ЗАСВАР — anon key-ээр ил гарсан хүснэгтүүдийг хаах
-- ============================================================
-- Огноо: 2026-08-29
-- Шалтгаан: Аюулгүй байдлын шалгалтаар public anon key-ээр (хөтөч бүрд
--   очдог) дараах хүснэгтүүд ШУУД уншигдаж байсныг амьдаар баталгаажуулав:
--     • inspectors            — байцаагчийн нэвтрэх нэр + bcrypt нууц үг (1)
--     • platform_bank_accounts— ХОТОЛ-ын банкны данс, дансны эзэн (1)
--     • platform_invoices     — ХОТОЛ-ын орлого/нэхэмжлэх, тооцооны задаргаа (7)
--     • platform_plans        — тариф + шимтгэлийн хувь (3)
--     • sokh_subscriptions    — СӨХ-үүдийн захиалгын төлөв
--
-- Эдгээрийг апп нь ЗӨВХӨН server талаас (service_role) уншдаг болохыг
-- код шалгаж тогтоов — тул anon-г хаахад аппын функц ЭВДРЭХГҮЙ.
--
-- Хэрхэн ажиллуулах:
--   Supabase Dashboard → SQL Editor → энэ файлыг бүхэлд нь paste → Run.
--   Давтан ажиллуулахад аюулгүй (idempotent).
--
-- Ажиллуулсны дараа баталгаажуулах:
--   node scratchpad/rls2.mjs  (эсвэл REST-ээр anon key-ээр SELECT → 0 мөр байх ёстой)
-- ============================================================

-- ---------- 1. inspectors — НУУЦ ҮГ агуулсан → бүрэн хаах ----------
-- Нэвтрэлт /api/auth/login дотор service_role-оор хийгддэг тул deny-all
-- нь нэвтрэлтэд НӨЛӨӨЛӨХГҮЙ.
DO $$ BEGIN
  IF to_regclass('public.inspectors') IS NULL THEN RETURN; END IF;
  EXECUTE 'ALTER TABLE public.inspectors ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS "Allow all inspectors" ON public.inspectors';
  EXECUTE 'DROP POLICY IF EXISTS "inspectors_deny_all" ON public.inspectors';
  EXECUTE 'CREATE POLICY "inspectors_deny_all" ON public.inspectors FOR ALL USING (false) WITH CHECK (false)';
  EXECUTE 'REVOKE ALL ON public.inspectors FROM anon, authenticated';
END $$;

-- ---------- 2. platform_bank_accounts — ХОТОЛ-ын банкны данс ----------
DO $$ BEGIN
  IF to_regclass('public.platform_bank_accounts') IS NULL THEN RETURN; END IF;
  EXECUTE 'ALTER TABLE public.platform_bank_accounts ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS "platform_bank_accounts_all" ON public.platform_bank_accounts';
  EXECUTE 'DROP POLICY IF EXISTS "platform_bank_accounts_deny_all" ON public.platform_bank_accounts';
  EXECUTE 'CREATE POLICY "platform_bank_accounts_deny_all" ON public.platform_bank_accounts FOR ALL USING (false) WITH CHECK (false)';
  EXECUTE 'REVOKE ALL ON public.platform_bank_accounts FROM anon, authenticated';
END $$;

-- ---------- 3. platform_invoices — ХОТОЛ-ын орлого/нэхэмжлэх ----------
DO $$ BEGIN
  IF to_regclass('public.platform_invoices') IS NULL THEN RETURN; END IF;
  EXECUTE 'ALTER TABLE public.platform_invoices ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS "platform_invoices_all" ON public.platform_invoices';
  EXECUTE 'DROP POLICY IF EXISTS "platform_invoices_deny_all" ON public.platform_invoices';
  EXECUTE 'CREATE POLICY "platform_invoices_deny_all" ON public.platform_invoices FOR ALL USING (false) WITH CHECK (false)';
  EXECUTE 'REVOKE ALL ON public.platform_invoices FROM anon, authenticated';
END $$;

-- ---------- 4. platform_plans — тариф + шимтгэлийн хувь ----------
-- Тарифыг маркетингийн хуудсанд харуулдаг бол ирээдүйд тусдаа "public view"
-- гаргаж болно. Одоогоор client anon уншилт байхгүй тул хаана.
DO $$ BEGIN
  IF to_regclass('public.platform_plans') IS NULL THEN RETURN; END IF;
  EXECUTE 'ALTER TABLE public.platform_plans ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS "platform_plans_all" ON public.platform_plans';
  EXECUTE 'DROP POLICY IF EXISTS "platform_plans_deny_all" ON public.platform_plans';
  EXECUTE 'CREATE POLICY "platform_plans_deny_all" ON public.platform_plans FOR ALL USING (false) WITH CHECK (false)';
  EXECUTE 'REVOKE ALL ON public.platform_plans FROM anon, authenticated';
END $$;

-- ---------- 5. sokh_subscriptions — захиалгын төлөв ----------
DO $$ BEGIN
  IF to_regclass('public.sokh_subscriptions') IS NULL THEN RETURN; END IF;
  EXECUTE 'ALTER TABLE public.sokh_subscriptions ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS "sokh_subscriptions_all" ON public.sokh_subscriptions';
  EXECUTE 'DROP POLICY IF EXISTS "sokh_subscriptions_deny_all" ON public.sokh_subscriptions';
  EXECUTE 'CREATE POLICY "sokh_subscriptions_deny_all" ON public.sokh_subscriptions FOR ALL USING (false) WITH CHECK (false)';
  EXECUTE 'REVOKE ALL ON public.sokh_subscriptions FROM anon, authenticated';
END $$;

-- ============================================================
-- ТАЙЛБАР: Дараах хүснэгтүүд БАС anon-д ил байсан ч энэ файлд ОРООГҮЙ,
-- учир нь тэдгээрийг мобайл апп client (authenticated resident) уншдаг —
-- зүгээр хаавал апп эвдэрнэ. Эдгээрт tenant-scope (residents-тэй ижил
-- current_user_sokh_ids() хэв маяг) хэрэгтэй бөгөөд репод бэлэн байгаа:
--     • parking_vehicles, marketplace_listings, invoices, push_subscriptions
--       → supabase-rls-tighten.sql + supabase-payment-rls-hardening.sql-ийг
--         Supabase SQL Editor-т ажиллуулна (эдгээр нь app-compat бодож бичсэн).
--     • sokh_organizations → лавлахын public SELECT нь ЗОРИУД (бүртгэлийн
--       хайлтад хэрэгтэй). Утас/тарифыг нуух бол тусдаа шийдвэр.
-- ============================================================
