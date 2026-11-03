-- ============================================================
-- Цахим ТУЗ: ТУЗ болон Хяналтын зөвлөлийн гишүүдийн байнгын жагсаалт
-- Idempotent migration — гараар ажиллуулна (Supabase SQL editor)
-- supabase-board-voting-migration.sql-ийн дараа ажиллуулна.
-- ============================================================

-- ---------- 1. board_members: СӨХ-ны ТУЗ / Хяналтын зөвлөлийн гишүүд ----------
CREATE TABLE IF NOT EXISTS board_members (
  id            BIGSERIAL PRIMARY KEY,
  sokh_id       BIGINT NOT NULL REFERENCES sokh_organizations(id) ON DELETE CASCADE,
  -- 'board' = Төлөөлөн удирдах зөвлөл, 'audit' = Хяналтын зөвлөл
  council       TEXT NOT NULL DEFAULT 'board' CHECK (council IN ('board', 'audit')),
  full_name     TEXT NOT NULL,
  phone_number  TEXT NOT NULL,
  position      TEXT,            -- 'Дарга', 'Гишүүн', 'Нарийн бичиг' г.м
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sokh_id, council, phone_number)
);

CREATE INDEX IF NOT EXISTS idx_board_members_sokh ON board_members(sokh_id);

-- Policy үүсгэхгүй: гишүүдийн утсыг оршин суугчид шууд уншихгүй.
-- Бүх хандалт service_role (/api/admin/*, /api/council)-оор.
ALTER TABLE board_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS board_members_select_tenant ON board_members;

-- ---------- 2. proposal_voters.council: протоколд аль зөвлөлийн гишүүн болохыг харуулна ----------
ALTER TABLE proposal_voters ADD COLUMN IF NOT EXISTS council TEXT
  CHECK (council IS NULL OR council IN ('board', 'audit'));

-- ============================================================
-- 3. Зөвлөлийн тайлан: дарга → ТУЗ / Хяналтын зөвлөлийн гишүүдэд
--    санхүүгийн баримт, зураг бүхий тайлан илгээх.
--    Харах эрхийг 4-р хэсгийн resident_id + утасны тулгалтаар шийднэ.
--    Бүх хандалт service_role (app/api/*board-reports*)-оор — policy үүсгэхгүй.
-- ============================================================
CREATE TABLE IF NOT EXISTS board_reports (
  id          BIGSERIAL PRIMARY KEY,
  sokh_id     BIGINT NOT NULL REFERENCES sokh_organizations(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT,
  created_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_board_reports_sokh ON board_reports(sokh_id, created_at DESC);

CREATE TABLE IF NOT EXISTS board_report_files (
  id          BIGSERIAL PRIMARY KEY,
  report_id   BIGINT NOT NULL REFERENCES board_reports(id) ON DELETE CASCADE,
  sokh_id     BIGINT NOT NULL,
  path        TEXT NOT NULL,       -- storage: board-reports/<sokh_id>/<uuid>.<ext>
  file_name   TEXT NOT NULL,
  mime_type   TEXT,
  size_bytes  BIGINT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_board_report_files_report ON board_report_files(report_id);

CREATE TABLE IF NOT EXISTS board_report_reads (
  report_id    BIGINT NOT NULL REFERENCES board_reports(id) ON DELETE CASCADE,
  resident_id  BIGINT NOT NULL,
  read_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (report_id, resident_id)
);

ALTER TABLE board_reports      ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_report_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_report_reads ENABLE ROW LEVEL SECURITY;

-- Хувийн (public биш) bucket — файлыг зөвхөн сервер signed URL-аар нээнэ
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('board-reports', 'board-reports', false, 20971520)  -- 20MB
ON CONFLICT (id) DO UPDATE SET public = false;

-- ============================================================
-- 4. Зөвлөлийн гишүүнийг оршин суугчийн бүртгэлтэй (resident_id) холбох.
--    Апп дахь «🏛 Зөвлөл» хэсгийн эрх зөвхөн:
--      board_members.resident_id = тухайн оршин суугч
--      ба residents.phone = board_members.phone_number (дарга тэмдэглэх үеийн утас)
--    үед нээгдэнэ. Утсыг OTP-оор баталгаажуулдаггүй тул зөвхөн утсаар
--    таньж болохгүй — даргын тэмдэглэгээ заавал хэрэгтэй.
-- ============================================================
ALTER TABLE board_members ADD COLUMN IF NOT EXISTS resident_id BIGINT
  REFERENCES residents(id) ON DELETE SET NULL;
-- Нэг оршин суугч зөвхөн нэг зөвлөлд
CREATE UNIQUE INDEX IF NOT EXISTS board_members_resident_uniq
  ON board_members(resident_id) WHERE resident_id IS NOT NULL;

-- ---------- 5. Зөвлөлийн дотоод чат (дарга + ТУЗ бичнэ, Хяналт уншина) ----------
CREATE TABLE IF NOT EXISTS board_chat_messages (
  id           BIGSERIAL PRIMARY KEY,
  sokh_id      BIGINT NOT NULL REFERENCES sokh_organizations(id) ON DELETE CASCADE,
  resident_id  BIGINT,             -- NULL бол даргын (админ) мессеж
  author_name  TEXT NOT NULL,
  author_role  TEXT NOT NULL CHECK (author_role IN ('admin', 'board', 'audit')),
  body         TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_board_chat_sokh ON board_chat_messages(sokh_id, created_at DESC);
ALTER TABLE board_chat_messages ENABLE ROW LEVEL SECURITY;  -- зөвхөн service_role
