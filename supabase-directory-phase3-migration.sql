-- ============================================
-- СӨХ Directory Phase 3 migration — pre-auth claim columns
-- ============================================
--
-- Зорилго: /find-hoa дээр гар оролтоор үүсгэсэн provisional СӨХ-ийн
-- бичлэгүүдийг хэрэглэгчийн бүртгэл үүсэхэд зөв user account-той холбох.
--
-- Энэ migration нь Phase 1 + Phase 2 migration-уудыг ажиллуулсны ДАРАА
-- Supabase SQL Editor дотор ажиллуулна.
-- ============================================

-- 1. resident_memberships — холбогдох утас/имэйл/claim token
ALTER TABLE resident_memberships ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE resident_memberships ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE resident_memberships ADD COLUMN IF NOT EXISTS claim_token TEXT;

CREATE INDEX IF NOT EXISTS idx_memberships_claim_phone
  ON resident_memberships(contact_phone) WHERE user_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_memberships_claim_email
  ON resident_memberships(contact_email) WHERE user_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_memberships_claim_token
  ON resident_memberships(claim_token) WHERE user_id IS NULL;

-- 2. hoa_activation_requests — мөн адил
ALTER TABLE hoa_activation_requests ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE hoa_activation_requests ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE hoa_activation_requests ADD COLUMN IF NOT EXISTS claim_token TEXT;

CREATE INDEX IF NOT EXISTS idx_activation_claim_phone
  ON hoa_activation_requests(contact_phone) WHERE user_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_activation_claim_email
  ON hoa_activation_requests(contact_email) WHERE user_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_activation_claim_token
  ON hoa_activation_requests(claim_token) WHERE user_id IS NULL;

-- 3. user_signup_requests — claimed_user_id + claim_token
-- Phase 1 дотор phone/email бичлэг аль хэдийн байгаа учраас зөвхөн claim metadata нэмнэ.
ALTER TABLE user_signup_requests ADD COLUMN IF NOT EXISTS claimed_user_id BIGINT;
ALTER TABLE user_signup_requests ADD COLUMN IF NOT EXISTS claim_token TEXT;

CREATE INDEX IF NOT EXISTS idx_signup_requests_claim_phone
  ON user_signup_requests(phone) WHERE claimed_user_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_signup_requests_claim_token
  ON user_signup_requests(claim_token) WHERE claimed_user_id IS NULL;
