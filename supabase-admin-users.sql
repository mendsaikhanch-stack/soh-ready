-- Олон СӨХ дэмжлэг: Админ хэрэглэгчдийн хүснэгт
CREATE TABLE IF NOT EXISTS admin_users (
  id BIGSERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  sokh_id BIGINT REFERENCES sokh_organizations(id) ON DELETE SET NULL,
  role TEXT NOT NULL DEFAULT 'admin',  -- admin, superadmin, osnaa
  display_name TEXT,
  status TEXT DEFAULT 'active',  -- active, disabled
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_users_deny_all" ON admin_users FOR ALL USING (false);
-- Зөвхөн service_role key-ээр хандах боломжтой (API proxy-р)

-- Анхны админ бүртгэх (password-г script-ээр hash-лана)
-- INSERT INTO admin_users (username, password_hash, sokh_id, role, display_name)
-- VALUES ('admin', '<bcrypt hash>', 7, 'admin', 'Админ');
