-- СӨХ тус бүрийн "төлбөр хүлээн авах данс".
-- Оршин суугч апп дээрээ QR-ыг хараад банкны аппаараа уншуулж, мөнгө нь
-- ШУУД тухайн СӨХ-ийн данс руу очно. Хотол дундаа ороод мөнгө барихгүй.
--
-- Гараар ажиллуулна: Supabase → SQL Editor.
--
-- ⚠️ platform_bank_accounts-той андуурч болохгүй:
--    platform_bank_accounts = Хотолын өөрийн данс (СӨХ-үүд захиалгаа төлдөг)
--    sokh_bank_accounts     = СӨХ-ийн данс (оршин суугчид хураамжаа төлдөг)

CREATE TABLE IF NOT EXISTS sokh_bank_accounts (
  id              BIGSERIAL PRIMARY KEY,
  sokh_id         BIGINT UNIQUE NOT NULL REFERENCES sokh_organizations(id) ON DELETE CASCADE,
  bank_name       TEXT NOT NULL,
  account_number  TEXT NOT NULL,
  account_holder  TEXT NOT NULL,
  qr_image_url    TEXT,          -- Даргын банкны аппаас авсан QR зураг (Supabase Storage)
  note            TEXT,          -- Оршин суугчид харагдах нэмэлт заавар
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sokh_bank_accounts ENABLE ROW LEVEL SECURITY;

-- Оршин суугч ЗӨВХӨН өөрийн СӨХ-ийн дансыг харна
DROP POLICY IF EXISTS "sokh_bank_accounts_select_own" ON sokh_bank_accounts;
CREATE POLICY "sokh_bank_accounts_select_own" ON sokh_bank_accounts
  FOR SELECT TO authenticated
  USING (sokh_id IN (SELECT current_user_sokh_ids()));

-- Бичих эрхийг клиентээс бүрэн татна. Дарга зөвхөн /api/admin/db proxy-гоор
-- (service_role + tenant scope) дансаа өөрчилнө — эс бөгөөс нэвтэрсэн хэн ч
-- өөрийн СӨХ-ийн дансыг сольж, төлбөрийг өөр луугаа чиглүүлэх боломжтой болно.
REVOKE INSERT, UPDATE, DELETE ON sokh_bank_accounts FROM anon;
REVOKE INSERT, UPDATE, DELETE ON sokh_bank_accounts FROM authenticated;

COMMENT ON TABLE sokh_bank_accounts IS
  'СӨХ-ийн хураамж хүлээн авах данс + банкны QR. Оршин суугч шууд энэ данс руу шилжүүлнэ.';
