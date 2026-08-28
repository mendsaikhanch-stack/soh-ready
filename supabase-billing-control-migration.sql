-- Хотол → СӨХ-ийн төлбөрийн ГАР удирдлага (супер админ)
--
-- Юуг нэмж байна вэ:
--   free_months_override — тухайн СӨХ-д үнэгүй сарыг сунгах (тарифын
--                          ерөнхий дүрмийг дарна). NULL = ерөнхий дүрэм.
--   settled_at/_note/_by — «тооцоо хийсэн» тэмдэглэгээ: хэзээ, хэн, юу гэж.
--   billing_note         — тухайн СӨХ-ийн төлбөрийн тухай чөлөөт тэмдэглэл.
--
-- Идэвхжсэн («нээсэн») огноог засах нь activated_at багана дээр шууд явна —
-- шинэ багана хэрэггүй.
--
-- Ажиллуулах: Supabase → SQL Editor → энэ файлыг буулгаад Run.
-- (Vercel-ийн DATABASE_URL хоосон тул скриптээр ажиллуулах боломжгүй.)

ALTER TABLE sokh_organizations
  ADD COLUMN IF NOT EXISTS free_months_override smallint,
  ADD COLUMN IF NOT EXISTS billing_note        text,
  ADD COLUMN IF NOT EXISTS settled_at          timestamptz,
  ADD COLUMN IF NOT EXISTS settled_note        text,
  ADD COLUMN IF NOT EXISTS settled_by          text;

COMMENT ON COLUMN sokh_organizations.free_months_override IS
  'Үнэгүй сарын тоог тухайн СӨХ-д гараар тогтоосон утга. NULL бол тарифын ерөнхий дүрэм.';
COMMENT ON COLUMN sokh_organizations.settled_at IS
  'Супер админ сүүлд тооцоо хийсэн огноо. NULL бол тооцоо хийгээгүй.';

-- Хэт том утга орохоос сэргийлнэ (0-24 сар)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sokh_organizations_free_months_override_range'
  ) THEN
    ALTER TABLE sokh_organizations
      ADD CONSTRAINT sokh_organizations_free_months_override_range
      CHECK (free_months_override IS NULL OR (free_months_override >= 0 AND free_months_override <= 24));
  END IF;
END $$;
