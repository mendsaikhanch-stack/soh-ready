-- ============================================================
-- Цахим ТУЗ & Санал асуулгын модуль (board voting)
-- Idempotent migration — гараар ажиллуулна (Supabase SQL editor)
-- Конвенц: sokh_id tenant scope, current_user_sokh_ids() RLS,
--          <table>_<action>_<scope> policy нэршил
-- ============================================================

-- ---------- 1. proposals: санал асуулгын үндсэн хүснэгт ----------
CREATE TABLE IF NOT EXISTS proposals (
  id             BIGSERIAL PRIMARY KEY,
  -- Апп худалдаж авсан СӨХ бол sokh_id-тэй; нээлттэй (борлуулалтын) санал бол NULL
  sokh_id        BIGINT REFERENCES sokh_organizations(id) ON DELETE CASCADE,
  kind           TEXT NOT NULL DEFAULT 'internal' CHECK (kind IN ('public', 'internal')),
  title          TEXT NOT NULL,
  description    TEXT,
  budget_amount  NUMERIC(14, 2),
  status         TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'passed', 'rejected', 'expired', 'cancelled')),
  -- ДҮРЭМ 1: Батлагдах босго хувь. Зөвшөөрсөн / нийт эрхтэй гишүүн * 100 >= энэ утга
  --          (жишээ: 50 = олонхи, 67 = 2/3)
  pass_threshold_percentage INT NOT NULL DEFAULT 50
                   CHECK (pass_threshold_percentage BETWEEN 1 AND 100),
  -- ДҮРЭМ 2: Хугацаанд хариу өгөөгүй гишүүнийг автоматаар "Зөвшөөрсөн"-д тооцох эсэх
  auto_approve_on_timeout   BOOLEAN NOT NULL DEFAULT false,
  -- Нээлттэй санал үүсгэсэн даргын чөлөөт мэдээлэл (апп аваагүй үед)
  org_name          TEXT,
  created_by        TEXT,           -- 'admin:12', 'superadmin:1', эсвэл 'public'
  created_by_name   TEXT,
  created_by_phone  TEXT,
  -- Үр дүн/протокол харах нууц линкийн түлхүүр (capability token)
  result_token   TEXT NOT NULL,
  expires_at     TIMESTAMPTZ NOT NULL,
  finalized_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proposals_sokh_id ON proposals(sokh_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status  ON proposals(status);

-- ---------- 2. proposal_voters: санал өгөх эрхтэй ТУЗ-ийн гишүүд ----------
CREATE TABLE IF NOT EXISTS proposal_voters (
  id            BIGSERIAL PRIMARY KEY,
  proposal_id   BIGINT NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  sokh_id       BIGINT,            -- proposals.sokh_id-аас хуулбарлана (admin proxy scope-д хэрэгтэй)
  phone_number  TEXT NOT NULL,
  full_name     TEXT,
  invite_token  TEXT NOT NULL UNIQUE,
  -- Хугацаа хэтэрсний дараа дүрмийн дагуу автоматаар зөвшөөрсөнд тооцогдсон эсэх
  auto_processed BOOLEAN NOT NULL DEFAULT false,
  invited_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proposal_id, phone_number)
);

CREATE INDEX IF NOT EXISTS idx_proposal_voters_proposal ON proposal_voters(proposal_id);

-- ---------- 3. proposal_votes: өгсөн саналууд ----------
CREATE TABLE IF NOT EXISTS proposal_votes (
  id            BIGSERIAL PRIMARY KEY,
  proposal_id   BIGINT NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  sokh_id       BIGINT,
  phone_number  TEXT NOT NULL,
  vote_value    TEXT NOT NULL CHECK (vote_value IN ('approve', 'disapprove', 'abstain')),
  comment       TEXT,
  -- Систем дүрмийн дагуу автоматаар оруулсан санал эсэх (хугацаа хэтэрсэн зөвшөөрөл)
  is_auto       BOOLEAN NOT NULL DEFAULT false,
  voted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proposal_id, phone_number)   -- нэг гишүүн 1 удаа санал өгнө
);

CREATE INDEX IF NOT EXISTS idx_proposal_votes_proposal ON proposal_votes(proposal_id);

-- ---------- 4. proposal_otps: утасны дугаар баталгаажуулах OTP ----------
CREATE TABLE IF NOT EXISTS proposal_otps (
  id            BIGSERIAL PRIMARY KEY,
  proposal_id   BIGINT NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  phone_number  TEXT NOT NULL,
  code_hash     TEXT NOT NULL,      -- bcrypt hash (кодыг задлан хадгалахгүй)
  expires_at    TIMESTAMPTZ NOT NULL,
  attempts      INT NOT NULL DEFAULT 0,
  consumed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proposal_otps_lookup
  ON proposal_otps(proposal_id, phone_number, created_at DESC);

-- ============================================================
-- RLS: анонимоор шууд хандах боломжгүй. Нийтийн урсгал бүхэлдээ
--      service_role (API route)-оор дамжина. Апп доторх гишүүд/
--      оршин суугчид зөвхөн өөрийн СӨХ-ны саналыг УНШИНА.
-- ============================================================
ALTER TABLE proposals       ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_voters ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_votes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_otps   ENABLE ROW LEVEL SECURITY;

-- proposals: өөрийн СӨХ-ны саналыг унших
DROP POLICY IF EXISTS proposals_select_tenant ON proposals;
CREATE POLICY proposals_select_tenant ON proposals
  FOR SELECT TO authenticated
  USING (sokh_id IN (SELECT current_user_sokh_ids()));

-- proposal_voters: өөрийн СӨХ-ны гишүүдийг унших
DROP POLICY IF EXISTS proposal_voters_select_tenant ON proposal_voters;
CREATE POLICY proposal_voters_select_tenant ON proposal_voters
  FOR SELECT TO authenticated
  USING (sokh_id IN (SELECT current_user_sokh_ids()));

-- proposal_votes: өөрийн СӨХ-ны саналуудыг унших
DROP POLICY IF EXISTS proposal_votes_select_tenant ON proposal_votes;
CREATE POLICY proposal_votes_select_tenant ON proposal_votes
  FOR SELECT TO authenticated
  USING (sokh_id IN (SELECT current_user_sokh_ids()));

-- proposal_otps: RLS идэвхтэй боловч policy алга → зөвхөн service_role хандана

-- ============================================================
-- Гүйцэтгэлийн тэмдэглэл:
--  • Бүх бичих/OTP үйлдэл service_role-оор (app/api/vote/*) явна.
--  • Хугацаа дуусах/шийдвэрлэх логик app/lib/board-server.ts дотор.
-- ============================================================
