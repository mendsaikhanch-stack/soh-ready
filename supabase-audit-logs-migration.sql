-- audit_logs — «хэн, хэзээ, юуг өөрчилсөн» бүртгэл.
--
-- ЯАГААД: `app/api/admin/db/route.ts` нь админы select-ээс бусад бүх үйлдлийг
-- энэ хүснэгтэд бичихээр 2026 оноос бичигдсэн боловч **хүснэгт нь хэзээ ч
-- үүсээгүй** байсан. Insert нь `.catch(() => {})`-оор чимээгүй залгигддаг тул
-- алдаа хаана ч харагдалгүй, бүртгэл огт хуримтлагдаагүй.
--
-- Илэрсэн нь: 2026-09-04-нд Өрнөлт СӨХ-ийн «DLife Smart APP» нэгжийн мөр
-- устсаныг хэн устгасныг тогтоох боломжгүй байв — зөвхөн admin_users дахь
-- last_login_at-аар таамаглах л боломжтой байсан.
--
-- Гараар ажиллуулна: Supabase → SQL Editor.

CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT,              -- admin_users.id (нэвтэрсэн хэрэглэгч)
  role        TEXT,                -- admin | superadmin | osnaa | inspector
  sokh_id     BIGINT,              -- аль СӨХ-ийн өгөгдөл дээр ажилласан
  action      TEXT NOT NULL,       -- insert | update | delete | upsert
  table_name  TEXT NOT NULL,
  details     TEXT,                -- хайлтын нөхцөл / бичсэн утга (1000 тэмдэгт)
  ip          TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_created_idx  ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_sokh_idx     ON audit_logs (sokh_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_table_idx    ON audit_logs (table_name, created_at DESC);

COMMENT ON TABLE audit_logs IS
  'Админы бичих үйлдлийн бүртгэл. Зөвхөн service_role бичнэ/уншина.';

-- Клиентээс огт хандуулахгүй — service_role нь RLS-ийг алгасдаг тул
-- сервер тал (api/admin/db) хэвийн бичиж чадна.
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_logs_deny_all" ON audit_logs;
CREATE POLICY "audit_logs_deny_all" ON audit_logs FOR ALL USING (false);

REVOKE ALL ON audit_logs FROM anon;
REVOKE ALL ON audit_logs FROM authenticated;

-- error_logs-д хэрэглэгчийн багана аль хэдийн бий (user_id, sokh_id) —
-- зөвхөн индекс нэмнэ (хайлт хурдасгах).
CREATE INDEX IF NOT EXISTS error_logs_created_idx ON error_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS error_logs_sokh_idx    ON error_logs (sokh_id, created_at DESC);
