-- СӨХ-н админ эрх идэвхжүүлэх токенуудын хүснэгт
-- Зорилго: Супер админ гэрээ байгуулсан СӨХ-д 6 оронтой код үүсгэж өгнө,
--          СӨХ-н дарга /activate хуудсанд код+утас оруулаад нууц үгээ өөрөө тавина.

CREATE TABLE IF NOT EXISTS sokh_activation_tokens (
  id BIGSERIAL PRIMARY KEY,
  sokh_id BIGINT NOT NULL REFERENCES sokh_organizations(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,            -- bcrypt hash, plain код DB-д хадгалахгүй
  contact_phone TEXT NOT NULL,        -- Аль утсаар идэвхжүүлэх вэ (verify-д ашиглана)
  expires_at TIMESTAMPTZ NOT NULL,    -- 7 хоног default
  used_at TIMESTAMPTZ,                -- Ашигласны дараа
  used_by_admin_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_superadmin_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL
);

-- Lookup-д зориулсан index-ууд
CREATE INDEX IF NOT EXISTS idx_activation_tokens_sokh
  ON sokh_activation_tokens(sokh_id);
CREATE INDEX IF NOT EXISTS idx_activation_tokens_phone_active
  ON sokh_activation_tokens(contact_phone)
  WHERE used_at IS NULL;

-- RLS — public хэн ч энэ хүснэгтийг шууд унших, өөрчлөх боломжгүй.
-- Зөвхөн service_role-аар (API proxy)-ээр л хандана.
ALTER TABLE sokh_activation_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_all_activation_tokens" ON sokh_activation_tokens
  FOR ALL USING (false) WITH CHECK (false);
