-- "Би шилжүүлсэн" мэдэгдэл.
-- Оршин суугч банкны аппаараа шилжүүлсний дараа апп дээрээ товч дарж даргад
-- мэдэгдэнэ. Дарга банкны хуулгатайгаа тулгаад баталгаажуулна.
--
-- ⚠️ Энэ мэдэгдэл нь ӨӨРӨӨ өрийг хасахгүй. Зөвхөн дарга баталгаажуулахад
--    payments-д бичигдэж, residents.debt хасагдана. Эс бөгөөс хэн ч мөнгө
--    төлөлгүйгээр өрөө арилгах боломжтой болно.
--
-- Гараар ажиллуулна: Supabase → SQL Editor.

CREATE TABLE IF NOT EXISTS payment_notices (
  id           BIGSERIAL PRIMARY KEY,
  sokh_id      BIGINT NOT NULL REFERENCES sokh_organizations(id) ON DELETE CASCADE,
  resident_id  BIGINT NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  amount       NUMERIC NOT NULL CHECK (amount > 0),
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'confirmed', 'rejected')),
  admin_note   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  resolved_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payment_notices_sokh_status
  ON payment_notices(sokh_id, status);

ALTER TABLE payment_notices ENABLE ROW LEVEL SECURITY;

-- Оршин суугч ЗӨВХӨН өөрийн мэдэгдлээ харна
DROP POLICY IF EXISTS "payment_notices_select_own" ON payment_notices;
CREATE POLICY "payment_notices_select_own" ON payment_notices
  FOR SELECT TO authenticated
  USING (resident_id IN (SELECT id FROM residents WHERE auth_user_id = auth.uid()));

-- Оршин суугч ЗӨВХӨН өөрийнхөө нэрээр, ЗӨВХӨН "pending" төлөвтэй мэдэгдэнэ
DROP POLICY IF EXISTS "payment_notices_insert_own" ON payment_notices;
CREATE POLICY "payment_notices_insert_own" ON payment_notices
  FOR INSERT TO authenticated
  WITH CHECK (
    status = 'pending'
    AND resident_id IN (SELECT id FROM residents WHERE auth_user_id = auth.uid())
  );

-- Төлөв солих эрхийг клиентээс бүрэн татна — зөвхөн дарга (admin proxy, service_role)
REVOKE UPDATE, DELETE ON payment_notices FROM anon;
REVOKE UPDATE, DELETE ON payment_notices FROM authenticated;
REVOKE INSERT ON payment_notices FROM anon;

COMMENT ON TABLE payment_notices IS
  'Оршин суугчийн "Би шилжүүлсэн" мэдэгдэл. Дарга баталгаажуулж байж төлбөр болно.';
