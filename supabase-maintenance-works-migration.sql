-- Хийсэн засварын тайлан (maintenance_works)
--
-- Юуны тухай вэ: maintenance_requests нь оршин суугчаас СӨХ рүү ИРДЭГ хүсэлт.
-- Энэ хүснэгт нь эсрэг чиглэл — СӨХ өөрөө "бид ийм засвар хийлээ" гэж
-- огноо, зураг, тайлбартайгаар оршин суугчдад мэдээлнэ.
--
-- Яагаад тусдаа хүснэгт: хүсэлт нь төлөвтэй (pending/completed), тайлан нь
-- аль хэдийн хийгдсэн ажил. Хоёрыг нэг хүснэгтэд хольвол оршин суугчийн
-- жагсаалт ойлгомжгүй болно.
--
-- ID төрөл: sokh_organizations.id нь BIGINT (BIGSERIAL) — UUID БИШ.
--
-- Гараар ажиллуулна: Supabase → SQL Editor.

CREATE TABLE IF NOT EXISTS maintenance_works (
  id           BIGSERIAL PRIMARY KEY,
  sokh_id      BIGINT NOT NULL REFERENCES sokh_organizations(id) ON DELETE CASCADE,

  title        TEXT NOT NULL,              -- жнь: "2-р орцны лифт засварлав"
  description  TEXT,                       -- дэлгэрэнгүй тайлбар
  work_date    DATE NOT NULL DEFAULT CURRENT_DATE,  -- засвар хийсэн он-сар-өдөр

  -- Зургийн public URL-ууд (uploads bucket). Хэт олон зураг оруулбал
  -- оршин суугчийн утсанд удаан ачаалдаг тул 10-аар хязгаарлав.
  photos       TEXT[] NOT NULL DEFAULT '{}'
               CHECK (array_length(photos, 1) IS NULL OR array_length(photos, 1) <= 10),

  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Оршин суугчийн жагсаалт: өөрийн СӨХ-ийн ажил, сүүлийнх нь эхэнд
CREATE INDEX IF NOT EXISTS idx_maintenance_works_sokh_date
  ON maintenance_works(sokh_id, work_date DESC);

ALTER TABLE maintenance_works ENABLE ROW LEVEL SECURITY;

-- Оршин суугч ЗӨВХӨН өөрийн СӨХ-ийн тайланг харна
-- (current_user_sokh_ids() — supabase-tenant-scope-migration.sql дотор үүсдэг)
DROP POLICY IF EXISTS "maintenance_works_select_tenant" ON maintenance_works;
CREATE POLICY "maintenance_works_select_tenant" ON maintenance_works
  FOR SELECT TO authenticated
  USING (sokh_id IN (SELECT current_user_sokh_ids()));

-- Бичих эрхийг клиентээс бүрэн татна. Тайланг зөвхөн дарга /api/admin/db
-- proxy-гоор (service_role + tenant scope) үүсгэнэ — эс бөгөөс нэвтэрсэн хэн ч
-- СӨХ-ийн нэрээр "засвар хийлээ" гэж худал тайлан нийтэлж чадна.
REVOKE INSERT, UPDATE, DELETE ON maintenance_works FROM anon;
REVOKE INSERT, UPDATE, DELETE ON maintenance_works FROM authenticated;

COMMENT ON TABLE maintenance_works IS
  'СӨХ-ийн хийсэн засварын тайлан — огноо, зураг, тайлбар. Оршин суугч зөвхөн уншина.';
