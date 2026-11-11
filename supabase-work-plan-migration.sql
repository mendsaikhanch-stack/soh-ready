-- СӨХ-ийн ажлын төлөвлөгөө (жил + улирал) — туршилт: ICTown (#2694)
--
-- Урсгал: дарга ноорог гаргана → ТУЗ-д илгээнэ → ТУЗ гишүүд апп-аас
-- «Батлах / Засвар хэрэгтэй» гэж санал, сэтгэгдэл өгнө (олонх баталбал батлагдана,
-- эсвэл дарга «ТУЗ-ийн хурлаар баталсан» гэж гараар тэмдэглэнэ) → батлагдсан
-- төлөвлөгөө оршин суугчдад нээгдэнэ → дарга ажил бүрийн гүйцэтгэлийг (хувь,
-- тайлбар, бодит зардал, зураг/баримт) тайлагнана → ТУЗ гишүүд ажил бүрийг
-- «Хийгдсэн / Дутуу / Хийгдээгүй» гэж дүгнэнэ.
--
-- Аюулгүй байдал:
--   • RLS = бүгдийг хаана. anon/authenticated эрхгүй. Бүх унших/бичих зөвхөн
--     /api/admin/work-plan (дарга) ба /api/work-plan (оршин суугч, ТУЗ)-аар.
--     /api/admin/db proxy-ийн ROLE_TABLES-д эдгээрийг НЭМЭХГҮЙ.
--   • Хүүхэд хүснэгт (plan_id, sokh_id)-аар work_plans руу FK-тэй тул өөр
--     СӨХ-ийн төлөвлөгөөнд мөр залгах боломжгүй.
--
-- Одоогийн хүснэгтэд ALTER ХИЙХГҮЙ — зөвхөн шинэ объект үүсгэнэ.
-- Гараар ажиллуулна: Supabase → SQL Editor. Дахин ажиллуулахад аюулгүй.

-- ============================================================
-- 1. work_plans — жилийн төлөвлөгөө (СӨХ-д жилд нэг)
-- ============================================================
CREATE TABLE IF NOT EXISTS work_plans (
  id            BIGSERIAL PRIMARY KEY,
  sokh_id       BIGINT NOT NULL REFERENCES sokh_organizations(id) ON DELETE CASCADE,
  year          INT NOT NULL CHECK (year BETWEEN 2020 AND 2100),
  title         TEXT NOT NULL CHECK (length(trim(title)) > 0),
  intro         TEXT,
  status        TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'review', 'approved', 'archived')),
  -- ТУЗ-д илгээх бүрд +1. ТУЗ-ийн санал тухайн хувилбартаа хамаарна.
  revision      INT NOT NULL DEFAULT 0,
  submitted_at  TIMESTAMPTZ,
  approved_at   TIMESTAMPTZ,
  approved_via  TEXT CHECK (approved_via IN ('app', 'meeting')),
  approved_note TEXT,
  summary       TEXT,           -- жилийн эцсийн дүгнэлт (дарга)
  created_by    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sokh_id, year),
  UNIQUE (id, sokh_id)
);

-- ============================================================
-- 2. work_plan_items — төлөвлөгөөний ажил
-- ============================================================
CREATE TABLE IF NOT EXISTS work_plan_items (
  id           BIGSERIAL PRIMARY KEY,
  plan_id      BIGINT NOT NULL,
  sokh_id      BIGINT NOT NULL,
  quarter      SMALLINT NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  category     TEXT NOT NULL DEFAULT 'other'
               CHECK (category IN ('repair', 'landscaping', 'finance', 'safety', 'cleaning', 'community', 'admin', 'other')),
  title        TEXT NOT NULL CHECK (length(trim(title)) > 0),
  description  TEXT,
  owner        TEXT,            -- хариуцагч (чөлөөт текст: «Дарга», «Инженер Бат», «ТУЗ — Дорж»)
  budget       NUMERIC(14, 2) CHECK (budget IS NULL OR budget >= 0),
  sort         INT NOT NULL DEFAULT 0,
  -- Гүйцэтгэл (дарга тайлагнана)
  status       TEXT NOT NULL DEFAULT 'planned'
               CHECK (status IN ('planned', 'in_progress', 'done', 'partial', 'not_done', 'cancelled')),
  progress     SMALLINT NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  report       TEXT,
  actual_cost  NUMERIC(14, 2) CHECK (actual_cost IS NULL OR actual_cost >= 0),
  reported_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (plan_id, sokh_id) REFERENCES work_plans(id, sokh_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_work_plan_items_plan ON work_plan_items(plan_id, quarter, sort);

-- ============================================================
-- 3. work_plan_files — гүйцэтгэлийн зураг / баримт
-- ============================================================
CREATE TABLE IF NOT EXISTS work_plan_files (
  id          BIGSERIAL PRIMARY KEY,
  item_id     BIGINT NOT NULL REFERENCES work_plan_items(id) ON DELETE CASCADE,
  sokh_id     BIGINT NOT NULL,
  path        TEXT NOT NULL,     -- storage: work-plan-files/<sokh_id>/<uuid>.<ext>
  file_name   TEXT NOT NULL,
  mime_type   TEXT,
  size_bytes  BIGINT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_work_plan_files_item ON work_plan_files(item_id);

-- ============================================================
-- 4. work_plan_reviews — ТУЗ гишүүний санал (хувилбар бүрд нэг)
-- ============================================================
CREATE TABLE IF NOT EXISTS work_plan_reviews (
  plan_id      BIGINT NOT NULL REFERENCES work_plans(id) ON DELETE CASCADE,
  revision     INT NOT NULL,
  resident_id  BIGINT NOT NULL,
  member_name  TEXT,
  decision     TEXT NOT NULL CHECK (decision IN ('approve', 'changes')),
  comment      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (plan_id, revision, resident_id)
);

-- ============================================================
-- 5. work_plan_ratings — ТУЗ гишүүний ажил тус бүрийн дүгнэлт
-- ============================================================
CREATE TABLE IF NOT EXISTS work_plan_ratings (
  item_id      BIGINT NOT NULL REFERENCES work_plan_items(id) ON DELETE CASCADE,
  resident_id  BIGINT NOT NULL,
  member_name  TEXT,
  rating       TEXT NOT NULL CHECK (rating IN ('done', 'partial', 'not_done')),
  comment      TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (item_id, resident_id)
);

-- ============================================================
-- RLS — бүгдийг хаана (зөвхөн service role)
-- ============================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['work_plans', 'work_plan_items', 'work_plan_files', 'work_plan_reviews', 'work_plan_ratings']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON %I FROM anon, authenticated', t);
  END LOOP;
END $$;

-- Хувийн bucket — файлыг зөвхөн сервер signed URL-аар нээнэ (20MB)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('work-plan-files', 'work-plan-files', FALSE, 20971520)
ON CONFLICT (id) DO UPDATE SET public = FALSE;
