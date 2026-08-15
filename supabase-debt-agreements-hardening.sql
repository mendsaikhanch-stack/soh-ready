-- debt_agreements — үүссэн хүснэгтийн цоорхойг нөхөх засвар.
--
-- 2026-08-15-нд үүссэн хүснэгтийг шалгахад дараах 4 асуудал илэрсэн:
--
--   1. resident_id / sokh_id-д ГАДААД ТҮЛХҮҮР алга.
--      Байхгүй resident_id=999999999-ээр мөр орж чадсан → өнчин гэрээ үүснэ.
--   2. status-д CHECK алга. 'ZZZ_BURUU' гэсэн утга ч орж байв.
--   3. created_by_admin_id нь UUID, харин admin_users.id нь BIGINT.
--      Өөрөөр хэлбэл ЯМАР Ч даргын ID энэ баганад орж чадахгүй — хэн гэрээ
--      байгуулсныг мөнхөд тэмдэглэж чадахгүй.
--   4. debt_agreements_select_own policy байгаа эсэх нь тодорхойгүй.
--      Байхгүй бол оршин суугч өөрийн гэрээгээ ХАРАХГҮЙ (чимээгүй 0 мөр).
--
-- Хүснэгт хоосон (0 мөр) үед ажиллуулж байгаа тул өгөгдөл алдагдахгүй.
--
-- Гараар ажиллуулна: Supabase → SQL Editor.

-- 1) Гадаад түлхүүр --------------------------------------------------------
ALTER TABLE debt_agreements
  DROP CONSTRAINT IF EXISTS debt_agreements_resident_id_fkey;
ALTER TABLE debt_agreements
  ADD CONSTRAINT debt_agreements_resident_id_fkey
  FOREIGN KEY (resident_id) REFERENCES residents(id) ON DELETE CASCADE;

ALTER TABLE debt_agreements
  DROP CONSTRAINT IF EXISTS debt_agreements_sokh_id_fkey;
ALTER TABLE debt_agreements
  ADD CONSTRAINT debt_agreements_sokh_id_fkey
  FOREIGN KEY (sokh_id) REFERENCES sokh_organizations(id) ON DELETE CASCADE;

-- 2) status-ийн CHECK ------------------------------------------------------
--    pending = дарга санал болгосон, оршин суугч хараахан зөвшөөрөөгүй
--    signed  = оршин суугч зөвшөөрсөн, хүчин төгөлдөр
ALTER TABLE debt_agreements
  DROP CONSTRAINT IF EXISTS debt_agreements_status_check;
ALTER TABLE debt_agreements
  ADD CONSTRAINT debt_agreements_status_check
  CHECK (status IN ('pending', 'signed', 'completed', 'cancelled', 'broken'));

ALTER TABLE debt_agreements ALTER COLUMN status SET DEFAULT 'pending';

-- 3) created_by_admin_id: UUID → BIGINT (admin_users.id-тэй тааруулна) ------
--    Хоосон хүснэгт тул шууд төрлийг нь солино.
ALTER TABLE debt_agreements DROP COLUMN IF EXISTS created_by_admin_id;
ALTER TABLE debt_agreements
  ADD COLUMN created_by_admin_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL;

-- 4) Дүн эерэг байх --------------------------------------------------------
ALTER TABLE debt_agreements
  DROP CONSTRAINT IF EXISTS debt_agreements_total_debt_check;
ALTER TABLE debt_agreements
  ADD CONSTRAINT debt_agreements_total_debt_check CHECK (total_debt > 0);

-- 5) Индекс ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_debt_agreements_sokh_status
  ON debt_agreements(sokh_id, status);
CREATE INDEX IF NOT EXISTS idx_debt_agreements_resident
  ON debt_agreements(resident_id);

-- Нэг оршин суугчид нэг л ХҮЧИНТЭЙ гэрээ (pending/signed) байна
CREATE UNIQUE INDEX IF NOT EXISTS uniq_debt_agreements_open_resident
  ON debt_agreements(resident_id) WHERE status IN ('pending', 'signed');

-- 6) RLS + policy ----------------------------------------------------------
ALTER TABLE debt_agreements ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON debt_agreements TO authenticated;

-- Оршин суугч ЗӨВХӨН өөрийн гэрээгээ харна
DROP POLICY IF EXISTS "debt_agreements_select_own" ON debt_agreements;
CREATE POLICY "debt_agreements_select_own" ON debt_agreements
  FOR SELECT TO authenticated
  USING (resident_id IN (SELECT id FROM residents WHERE auth_user_id = auth.uid()));

-- Бичих эрхийг клиентээс бүрэн татна — зөвхөн дарга /api/admin/db proxy-гоор
REVOKE INSERT, UPDATE, DELETE ON debt_agreements FROM anon;
REVOKE INSERT, UPDATE, DELETE ON debt_agreements FROM authenticated;
REVOKE SELECT ON debt_agreements FROM anon;

COMMENT ON TABLE debt_agreements IS
  'Өр барагдуулах гэрээ — оршин суугч өрөө хуваан төлөх хуваарь. Өрийг хасахгүй, зөвхөн амлалтыг бүртгэнэ.';
COMMENT ON COLUMN debt_agreements.agreed_payment_plan IS
  'JSON: { months, monthly_amount, start_date, installments: [{ no, due_date, amount }] }';
