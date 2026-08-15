-- Өр барагдуулах гэрээ (төлбөрийн хуваарь).
-- Их өртэй оршин суугч даргатай тохиролцож, өрөө хэдэн сард хуваан төлөх
-- амлалт өгнө. Тухайн хуваарийг энд бүртгэнэ.
--
-- ⚠️ Энэ гэрээ нь ӨӨРӨӨ өрийг хасахгүй. residents.debt зөвхөн жинхэнэ
--    төлөлт (payments) бүртгэгдэхэд хасагдана. Эс бөгөөс гэрээ байгуулаад л
--    өр арилчихсан мэт харагдана.
--
-- ID төрөл: sokh_organizations.id, residents.id, admin_users.id бүгд BIGINT
-- (BIGSERIAL) — UUID БИШ. Тиймээс FK багануудыг BIGINT-ээр авав.
--
-- Гараар ажиллуулна: Supabase → SQL Editor.

CREATE TABLE IF NOT EXISTS debt_agreements (
  id                  BIGSERIAL PRIMARY KEY,
  sokh_id             BIGINT NOT NULL REFERENCES sokh_organizations(id) ON DELETE CASCADE,
  resident_id         BIGINT NOT NULL REFERENCES residents(id) ON DELETE CASCADE,

  total_amount        NUMERIC NOT NULL CHECK (total_amount > 0),   -- гэрээ байгуулах үеийн нийт өр
  monthly_amount      NUMERIC NOT NULL CHECK (monthly_amount > 0), -- сар бүр төлөх дүн
  months              INTEGER NOT NULL CHECK (months > 0),         -- хуваан төлөх сарын тоо
  paid_amount         NUMERIC NOT NULL DEFAULT 0 CHECK (paid_amount >= 0), -- гэрээний дагуу төлөгдсөн

  start_date          DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date            DATE,                                        -- төлж дуусах товлосон огноо

  status              TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'completed', 'broken', 'cancelled')),
  -- active=хүчинтэй, completed=төлж дууссан, broken=зөрчсөн, cancelled=цуцалсан

  note                TEXT,                                        -- тохиролцооны нэмэлт тайлбар
  created_by_admin_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,

  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  closed_at           TIMESTAMPTZ,                                 -- дуусгасан/цуцалсан үе

  CONSTRAINT debt_agreements_end_after_start
    CHECK (end_date IS NULL OR end_date >= start_date)
);

-- Даргын жагсаалт: өөрийн СӨХ-ийн хүчинтэй гэрээнүүд
CREATE INDEX IF NOT EXISTS idx_debt_agreements_sokh_status
  ON debt_agreements(sokh_id, status);

CREATE INDEX IF NOT EXISTS idx_debt_agreements_resident
  ON debt_agreements(resident_id);

-- Нэг оршин суугчид нэг л ХҮЧИНТЭЙ гэрээ байна (хуучид нь хэдэн ч байж болно)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_debt_agreements_active_resident
  ON debt_agreements(resident_id) WHERE status = 'active';

ALTER TABLE debt_agreements ENABLE ROW LEVEL SECURITY;

-- Оршин суугч ЗӨВХӨН өөрийн гэрээгээ харна
DROP POLICY IF EXISTS "debt_agreements_select_own" ON debt_agreements;
CREATE POLICY "debt_agreements_select_own" ON debt_agreements
  FOR SELECT TO authenticated
  USING (resident_id IN (SELECT id FROM residents WHERE auth_user_id = auth.uid()));

-- Бичих эрхийг клиентээс бүрэн татна. Гэрээг зөвхөн дарга /api/admin/db proxy-гоор
-- (service_role + tenant scope) үүсгэж, төлөв солино — эс бөгөөс нэвтэрсэн хэн ч
-- өөртөө өрийн хөнгөлөлттэй гэрээ бичиж чадна.
REVOKE INSERT, UPDATE, DELETE ON debt_agreements FROM anon;
REVOKE INSERT, UPDATE, DELETE ON debt_agreements FROM authenticated;

COMMENT ON TABLE debt_agreements IS
  'Өр барагдуулах гэрээ — оршин суугч өрөө хуваан төлөх хуваарь. Өрийг хасахгүй, зөвхөн амлалтыг бүртгэнэ.';
