-- СӨХ-н удирдлагаас ирсэн "холбогдох" хүсэлтүүд
-- Зорилго: Гэрээгүй СӨХ-н дарга/нярав платформтой холбоо барихдаа энэ form-аар орж ирнэ

CREATE TABLE IF NOT EXISTS sokh_leads (
  id BIGSERIAL PRIMARY KEY,
  -- Аль алин нь nullable: одоо байгаа СӨХ-г сонгож болно эсвэл шинэ нэр оруулж болно
  sokh_id BIGINT REFERENCES sokh_organizations(id) ON DELETE SET NULL,
  sokh_name TEXT,                     -- Шинэ нэр оруулсан тохиолдолд
  khoroo_id BIGINT REFERENCES khoroos(id) ON DELETE SET NULL,
  contact_name TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'darga', -- darga / nyarav / member / other
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'contacted', 'contracted', 'declined')),
  handled_by_admin_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,
  handled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sokh_leads_status ON sokh_leads(status);
CREATE INDEX IF NOT EXISTS idx_sokh_leads_phone ON sokh_leads(contact_phone);
CREATE INDEX IF NOT EXISTS idx_sokh_leads_sokh ON sokh_leads(sokh_id);
CREATE INDEX IF NOT EXISTS idx_sokh_leads_created ON sokh_leads(created_at DESC);

-- RLS — public хэн ч энэ хүснэгтийг шууд унших, өөрчлөх боломжгүй.
-- Зөвхөн service_role-аар (API proxy)-ээр л хандана.
ALTER TABLE sokh_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_all_sokh_leads" ON sokh_leads
  FOR ALL USING (false) WITH CHECK (false);
