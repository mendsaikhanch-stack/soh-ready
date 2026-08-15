-- Хотолын тариф + хэрэглэгч СӨХ-ийн төлбөрийн бүртгэл.
--
-- Тариф нь БҮХ СӨХ-д ижил тул багц (platform_plans) шиг олон мөртэй биш,
-- ГАНЦ мөртэй хүснэгт болгов. Багц/зэрэглэлийн хуучин механизмыг хөндөөгүй —
-- тэр нь өөр зорилготой (хосолсон үнэ, комисс) тул хэвээр үлдэнэ.
--
-- Тарифын дүрэм (2026-08-15):
--   Суурилуулалт (нэг удаа) = айлын тоо × 1,500₮   (1,000 × 1.5)
--   Сар бүр                 = айлын тоо × 1,000₮
--   Үнэгүй хугацаа          = 150-аас доош айл → 1 сар, түүнээс их → 2 сар
--
-- Гараар ажиллуулна: Supabase → SQL Editor.

-- 1) Тариф ------------------------------------------------------------------
-- id = 1 гэж хатуу шалгасан нь санамсаргүйгээр 2 дахь тариф үүсэхээс сэргийлнэ.
-- Хоёр тариф зэрэг байвал аль нь хүчинтэйг код мэдэхгүй болно.
CREATE TABLE IF NOT EXISTS platform_tariff (
  id                    BIGINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),

  setup_per_unit        NUMERIC NOT NULL DEFAULT 1500 CHECK (setup_per_unit >= 0),
  monthly_per_unit      NUMERIC NOT NULL DEFAULT 1000 CHECK (monthly_per_unit >= 0),

  free_months_threshold INTEGER NOT NULL DEFAULT 150 CHECK (free_months_threshold > 0),
  free_months_below     INTEGER NOT NULL DEFAULT 1   CHECK (free_months_below >= 0),
  free_months_above     INTEGER NOT NULL DEFAULT 2   CHECK (free_months_above >= 0),

  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO platform_tariff (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE platform_tariff ENABLE ROW LEVEL SECURITY;

-- Тариф бол платформын дотоод мэдээлэл — СӨХ-ийн дарга ч, оршин суугч ч
-- харах ёсгүй. Зөвхөн service_role (superadmin API) хандана.
DROP POLICY IF EXISTS "platform_tariff_deny_all" ON platform_tariff;
CREATE POLICY "platform_tariff_deny_all" ON platform_tariff FOR ALL USING (false);
REVOKE ALL ON platform_tariff FROM anon, authenticated;

-- 2) Нэхэмжлэхийн төрөл -----------------------------------------------------
-- Суурилуулалт нь идэвхжсэн сард нэг удаа гарна, сарын хураамж нь сар бүр.
-- Хоёулаа НЭГ сард таарч болох тул хуучин UNIQUE(sokh_id, year, month)-д
-- kind-ийг нэмэхгүй бол хоёр дахь нь орж чадахгүй.
ALTER TABLE platform_invoices
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'monthly';

ALTER TABLE platform_invoices
  DROP CONSTRAINT IF EXISTS platform_invoices_kind_check;
ALTER TABLE platform_invoices
  ADD CONSTRAINT platform_invoices_kind_check CHECK (kind IN ('setup', 'monthly'));

ALTER TABLE platform_invoices
  DROP CONSTRAINT IF EXISTS platform_invoices_sokh_id_period_year_period_month_key;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_platform_invoices_period_kind
  ON platform_invoices(sokh_id, period_year, period_month, kind);

CREATE INDEX IF NOT EXISTS idx_platform_invoices_sokh
  ON platform_invoices(sokh_id, status);

COMMENT ON TABLE platform_tariff IS
  'Хотолын нэгдсэн тариф. Бүх СӨХ-д ижил үйлчилнэ — /mng-ctrl/plans → Тариф табаас засна.';
COMMENT ON COLUMN platform_invoices.kind IS
  'setup = нэг удаагийн суурилуулалт, monthly = сарын хураамж';
