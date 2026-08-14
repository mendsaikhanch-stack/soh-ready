-- И-биллинг: нэхэмжлэх гаргах + банкнаас ирсэн төлөлтийг импортлох.
-- Гараар ажиллуулна: Supabase → SQL Editor.

-- 1. Банкны "хэрэглэгчийн код" — и-биллингд айл бүрийг үүгээр таньдаг.
--    Анхдагчаар тоотыг нь ашиглана; банк өөр код олговол дараа нь солино.
ALTER TABLE residents ADD COLUMN IF NOT EXISTS bank_customer_code TEXT;
UPDATE residents SET bank_customer_code = apartment
  WHERE bank_customer_code IS NULL OR btrim(bank_customer_code) = '';

CREATE INDEX IF NOT EXISTS idx_residents_bank_code
  ON residents(sokh_id, bank_customer_code);

-- 2. Импортын давхардлаас хамгаалах.
--    external_ref = банкны гүйлгээний дугаар (эсвэл огноо+дүн+кодоос үүсгэсэн түлхүүр).
--    UNIQUE тул нэг хуулгыг 2 удаа оруулахад төлбөр давхар бүртгэгдэхгүй.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS external_ref TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS source TEXT;  -- manual | notice | ebilling

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_external_ref
  ON payments(external_ref) WHERE external_ref IS NOT NULL;

COMMENT ON COLUMN residents.bank_customer_code IS
  'Банкны и-биллингийн хэрэглэгчийн код. Анхдагч = тоот.';
COMMENT ON COLUMN payments.external_ref IS
  'Банкны гүйлгээний давтагдашгүй дугаар — хуулга давхар импортлохоос хамгаална.';
