-- ============================================
-- WebAuthn / Passkey credentials
-- Superadmin (болон цаашид бусад admin) хурууны хээ / Face ID / passkey-ээр
-- нэвтрэх боломж. Нэг хэрэглэгч олон төхөөрөмж бүртгэж болно.
--
-- Зөвхөн service_role-аар (/api/auth/passkey/* routes) хандана.
-- Supabase SQL Editor дотор ажиллуулна.
-- ============================================

CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id BIGSERIAL PRIMARY KEY,
  admin_user_id BIGINT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,   -- base64url credential ID
  public_key TEXT NOT NULL,             -- base64url COSE public key
  counter BIGINT NOT NULL DEFAULT 0,    -- signature counter (replay хамгаалалт)
  transports TEXT,                      -- JSON: ["internal","hybrid",...]
  device_name TEXT,                     -- хэрэглэгчийн өгсөн нэр (ж: "Утас")
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_webauthn_user ON webauthn_credentials(admin_user_id);

ALTER TABLE webauthn_credentials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny_all_webauthn" ON webauthn_credentials;
CREATE POLICY "deny_all_webauthn" ON webauthn_credentials
  FOR ALL USING (false) WITH CHECK (false);
