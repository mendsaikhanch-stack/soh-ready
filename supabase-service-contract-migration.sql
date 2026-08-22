-- Хотол ↔ СӨХ хоорондын үйлчилгээний гэрээ
--
-- Гэрээний ТЕКСТ энд хадгалагдахгүй — код дотор (app/lib/contract/) байна.
-- DB нь зөвхөн «хэн татаж болох вэ» гэдгийг тэмдэглэнэ:
--   contract_unlocked_at   — супер админ эрхийг нээсэн мөч. NULL = дарга харахгүй.
--   contract_number        — гэрээний дугаар (ХОТ-2026-2679). Нэг л удаа үүснэ.
--   contract_downloaded_at — дарга сүүлд татсан мөч (эргэн хянахад).
--
-- Supabase SQL Editor-т ГАРААР ажиллуулна (Vercel-ийн DATABASE_URL хоосон).

ALTER TABLE sokh_organizations
  ADD COLUMN IF NOT EXISTS contract_number TEXT;

ALTER TABLE sokh_organizations
  ADD COLUMN IF NOT EXISTS contract_unlocked_at TIMESTAMPTZ;

ALTER TABLE sokh_organizations
  ADD COLUMN IF NOT EXISTS contract_downloaded_at TIMESTAMPTZ;

COMMENT ON COLUMN sokh_organizations.contract_unlocked_at IS
  'Хотолын үйлчилгээний гэрээг татах эрх нээгдсэн мөч. NULL бол СӨХ-ийн дарга гэрээгээ харахгүй.';
COMMENT ON COLUMN sokh_organizations.contract_number IS
  'Үйлчилгээний гэрээний дугаар — ХОТ-<он>-<СӨХ id>.';
COMMENT ON COLUMN sokh_organizations.contract_downloaded_at IS
  'СӨХ-ийн дарга гэрээгээ сүүлд татсан мөч.';

-- Хэдэн СӨХ-д гэрээ нээгдсэнийг хурдан харах индекс (жагсаалт жижиг тул
-- partial индекс хангалттай).
CREATE INDEX IF NOT EXISTS idx_sokh_organizations_contract_unlocked
  ON sokh_organizations(contract_unlocked_at)
  WHERE contract_unlocked_at IS NOT NULL;
