-- Суурилуулалтын төлбөрийн СӨХ тус бүрийн хөнгөлөлт.
--
-- Яагаад: platform_tariff нь БҮХ СӨХ-д ижил (1500₮/айл). Тохиролцоогоор
-- зарим СӨХ-д хөнгөлөлт өгдөг тул гэрээ болон нэхэмжлэх хоёр зөрдөг байв
-- (Өрнөлт #2111 — гэрээ 183,000₮ бичих байсан, нэхэмжлэх 91,500₮).
-- Гэрээ бол төлбөрийн заалтад хүчин чадал өгдөг баримт тул хоёулаа
-- ижил дүн харуулах ёстой.
--
-- Гараар ажиллуулна: Supabase → SQL Editor.

ALTER TABLE sokh_organizations
  ADD COLUMN IF NOT EXISTS setup_discount_percent SMALLINT;

COMMENT ON COLUMN sokh_organizations.setup_discount_percent IS
  'Суурилуулалтын төлбөрийн хөнгөлөлт (0-100%). NULL = хөнгөлөлтгүй, стандарт тариф.';

ALTER TABLE sokh_organizations
  DROP CONSTRAINT IF EXISTS sokh_organizations_setup_discount_percent_check;
ALTER TABLE sokh_organizations
  ADD CONSTRAINT sokh_organizations_setup_discount_percent_check
  CHECK (setup_discount_percent IS NULL
         OR (setup_discount_percent >= 0 AND setup_discount_percent <= 100));

-- Өрнөлт СӨХ — 50% хөнгөлөлт (122 нэгж × 750₮ = 91,500₮)
UPDATE sokh_organizations SET setup_discount_percent = 50 WHERE id = 2111;
