-- Бүх гишүүдийн хурлын модуль (Meeting Management) — 1-р шат
--
-- Төлөвлөгөө: docs/meeting-management-plan.md
--
-- Энэ файл модулийн БҮХ хүснэгтийг нэг дор үүсгэнэ (дараагийн шатуудад дахин
-- миграц ажиллуулахгүйн тулд). 1-р шатны код зөвхөн meetings,
-- meeting_agenda_items, meeting_eligible_units, meeting_events-ийг ашиглана.
--
-- Аюулгүй байдлын зарчим:
--   • Хүснэгт бүр sokh_id-тэй. Хүүхэд хүснэгт (meeting_id, sokh_id)-аар
--     meetings руу FK-тэй тул өөр СӨХ-ийн хуралд мөр залгах боломжгүй.
--   • RLS = бүгдийг хаана. anon/authenticated ямар ч эрхгүй. Бүх унших/бичих
--     зөвхөн /api/admin/meetings/* (service role + сешний sokh_id)-аар явна.
--     /api/admin/db proxy-ийн ROLE_TABLES-д эдгээрийг НЭМЭХГҮЙ.
--   • Хуулийн нотолгоо болох мөрүүдийг (хүргэлт, ирц, итгэмжлэл, санал, аудит)
--     устгахгүй. Засвар = шинэ мөр + хуучныг superseded_by-аар хүчингүй болгох.
--   • Ирц бүрдээгүй дүнг хүн ч, систем ч «баталсан» гэж тэмдэглэж чадахгүй
--     (meeting_results CHECK).
--
-- Одоогийн хүснэгтэд (residents, payments, proposals, polls, announcements)
-- ALTER ХИЙХГҮЙ — зөвхөн шинэ объект үүсгэнэ.
--
-- ID төрөл: sokh_organizations.id, residents.id нь BIGINT — UUID БИШ.
-- Гараар ажиллуулна: Supabase → SQL Editor. Дахин ажиллуулахад аюулгүй.

-- ============================================================
-- 1. meetings — хурал
-- ============================================================
CREATE TABLE IF NOT EXISTS meetings (
  id                    BIGSERIAL PRIMARY KEY,
  sokh_id               BIGINT NOT NULL REFERENCES sokh_organizations(id) ON DELETE CASCADE,

  kind                  TEXT NOT NULL DEFAULT 'regular'
                        CHECK (kind IN ('regular', 'extraordinary')),
  title                 TEXT NOT NULL CHECK (length(trim(title)) > 0),
  description           TEXT,
  scheduled_at          TIMESTAMPTZ NOT NULL,
  location              TEXT,
  online_url            TEXT,

  convened_by_admin_id  BIGINT,          -- admin_users.id (сешнээс)
  convened_by_name      TEXT,            -- хурал зарлан хуралдуулагчийн нэр
  convened_basis        TEXT,            -- хэний санаачилгаар (ТУЗ, гишүүдийн хүсэлт г.м.)

  status                TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'noticed', 'in_progress', 'closed', 'archived', 'cancelled')),

  -- Хурал зарлах мөчид хөлдөөх дүрэм. Хуулийн тоог кодонд хатуу бичихгүй —
  -- дарга СӨХ-ийн дүрэм, хуулиас шалгаж оруулна. Хөлдөөсний дараа өөрчлөхгүй.
  vote_weight_mode      TEXT CHECK (vote_weight_mode IN ('per_unit', 'per_area')),
  quorum_required_pct   NUMERIC(5,2) CHECK (quorum_required_pct > 0 AND quorum_required_pct <= 100),
  quorum_strict         BOOLEAN NOT NULL DEFAULT FALSE,   -- TRUE = «-аас дээш», FALSE = «-аас багагүй»
  min_notice_days       INT CHECK (min_notice_days >= 0 AND min_notice_days <= 365),
  prevote_counts_as_attendance BOOLEAN,
  ballot_mode           TEXT NOT NULL DEFAULT 'open' CHECK (ballot_mode IN ('open', 'secret')),
  rules_frozen_at       TIMESTAMPTZ,

  cancelled_at          TIMESTAMPTZ,
  cancel_reason         TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (id, sokh_id),

  -- Ноорогоос бусад төлөвт дүрэм заавал бүрэн, хөлдөөгдсөн байна
  CONSTRAINT meetings_rules_frozen_chk CHECK (
    status IN ('draft', 'cancelled')
    OR (rules_frozen_at IS NOT NULL
        AND vote_weight_mode IS NOT NULL
        AND quorum_required_pct IS NOT NULL
        AND min_notice_days IS NOT NULL
        AND prevote_counts_as_attendance IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_meetings_sokh_sched ON meetings(sokh_id, scheduled_at DESC);

-- ============================================================
-- 2. meeting_agenda_items — хэлэлцэх асуудал
-- ============================================================
CREATE TABLE IF NOT EXISTS meeting_agenda_items (
  id                    BIGSERIAL PRIMARY KEY,
  meeting_id            BIGINT NOT NULL,
  sokh_id               BIGINT NOT NULL,
  position              INT NOT NULL,
  title                 TEXT NOT NULL CHECK (length(trim(title)) > 0),
  description           TEXT,
  decision_draft        TEXT,            -- шийдвэрийн төсөл
  pass_threshold_pct    NUMERIC(5,2) CHECK (pass_threshold_pct > 0 AND pass_threshold_pct <= 100),
  pass_threshold_strict BOOLEAN NOT NULL DEFAULT TRUE,   -- TRUE = «-аас дээш» (энгийн олонх)
  prevote_enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (meeting_id, sokh_id) REFERENCES meetings(id, sokh_id) ON DELETE CASCADE,
  UNIQUE (id, sokh_id),
  UNIQUE (meeting_id, position)
);

-- ============================================================
-- 3. meeting_eligible_units — санал өгөх эрхтэй сууцны хөлдөөсөн жагсаалт
-- ============================================================
CREATE TABLE IF NOT EXISTS meeting_eligible_units (
  id                    BIGSERIAL PRIMARY KEY,
  meeting_id            BIGINT NOT NULL,
  sokh_id               BIGINT NOT NULL,
  resident_id           BIGINT REFERENCES residents(id) ON DELETE SET NULL,
  unit_key              TEXT NOT NULL,   -- нормчилсон «байр|тоот»
  building              TEXT,
  apartment             TEXT NOT NULL,
  owner_name            TEXT,
  phone_snapshot        TEXT,
  area_sqm_snapshot     NUMERIC,
  weight                NUMERIC NOT NULL CHECK (weight > 0),
  owner_confirmed       BOOLEAN NOT NULL,  -- resident_type='owner' мөр олдсон эсэх
  owner_count           INT NOT NULL DEFAULT 0, -- >1 бол хэн санал өгөхийг тодруулах
  snapshot_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (meeting_id, sokh_id) REFERENCES meetings(id, sokh_id) ON DELETE CASCADE,
  UNIQUE (id, sokh_id),
  UNIQUE (meeting_id, unit_key)
);

CREATE INDEX IF NOT EXISTS idx_meeting_units_resident ON meeting_eligible_units(resident_id);

-- ============================================================
-- 4. meeting_notices — зар хүргэлт (сууц × суваг) — 2-р шат
-- ============================================================
CREATE TABLE IF NOT EXISTS meeting_notices (
  id                    BIGSERIAL PRIMARY KEY,
  meeting_id            BIGINT NOT NULL,
  sokh_id               BIGINT NOT NULL,
  eligible_unit_id      BIGINT NOT NULL,
  channel               TEXT NOT NULL CHECK (channel IN ('app', 'push', 'sms', 'paper', 'board_posting')),
  status                TEXT NOT NULL CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'opened', 'hand_delivered')),
  sent_at               TIMESTAMPTZ,
  delivered_at          TIMESTAMPTZ,
  opened_at             TIMESTAMPTZ,
  provider_ref          TEXT,
  error                 TEXT,
  proof_file_path       TEXT,            -- meeting-docs bucket дахь гарын үсгийн скан
  recorded_by_admin_id  BIGINT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (meeting_id, sokh_id) REFERENCES meetings(id, sokh_id) ON DELETE RESTRICT,
  FOREIGN KEY (eligible_unit_id, sokh_id) REFERENCES meeting_eligible_units(id, sokh_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_meeting_notices_meeting ON meeting_notices(meeting_id, eligible_unit_id);

-- ============================================================
-- 5. meeting_proxies — итгэмжлэл — 3-р шат
-- ============================================================
CREATE TABLE IF NOT EXISTS meeting_proxies (
  id                    BIGSERIAL PRIMARY KEY,
  meeting_id            BIGINT NOT NULL,
  sokh_id               BIGINT NOT NULL,
  grantor_unit_id       BIGINT NOT NULL,
  grantee_name          TEXT NOT NULL,
  grantee_phone         TEXT,
  grantee_resident_id   BIGINT REFERENCES residents(id) ON DELETE SET NULL,
  scope                 TEXT NOT NULL DEFAULT 'all' CHECK (scope IN ('all', 'agenda_items')),
  agenda_item_ids       BIGINT[],
  document_path         TEXT,
  valid_from            TIMESTAMPTZ,
  valid_until           TIMESTAMPTZ,
  status                TEXT NOT NULL DEFAULT 'submitted'
                        CHECK (status IN ('submitted', 'verified', 'rejected', 'revoked')),
  verified_by_admin_id  BIGINT,
  verified_at           TIMESTAMPTZ,
  rejection_reason      TEXT,
  revoked_at            TIMESTAMPTZ,
  submitted_by_auth_user_id UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (meeting_id, sokh_id) REFERENCES meetings(id, sokh_id) ON DELETE RESTRICT,
  FOREIGN KEY (grantor_unit_id, sokh_id) REFERENCES meeting_eligible_units(id, sokh_id) ON DELETE RESTRICT,
  UNIQUE (id, sokh_id)
);

-- Нэг сууцанд нэг л идэвхтэй итгэмжлэл
CREATE UNIQUE INDEX IF NOT EXISTS uq_meeting_proxies_active
  ON meeting_proxies(meeting_id, grantor_unit_id)
  WHERE status IN ('submitted', 'verified');

-- ============================================================
-- 6. meeting_attendance — ирц — 3-р шат
-- ============================================================
CREATE TABLE IF NOT EXISTS meeting_attendance (
  id                    BIGSERIAL PRIMARY KEY,
  meeting_id            BIGINT NOT NULL,
  sokh_id               BIGINT NOT NULL,
  eligible_unit_id      BIGINT NOT NULL,
  mode                  TEXT NOT NULL CHECK (mode IN ('in_person', 'online', 'proxy', 'prevote_only')),
  proxy_id              BIGINT,
  checked_in_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  method                TEXT NOT NULL CHECK (method IN ('admin_manual', 'qr_checkin', 'self_online', 'system_prevote')),
  recorded_by_admin_id  BIGINT,
  superseded_by         BIGINT REFERENCES meeting_attendance(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (meeting_id, sokh_id) REFERENCES meetings(id, sokh_id) ON DELETE RESTRICT,
  FOREIGN KEY (eligible_unit_id, sokh_id) REFERENCES meeting_eligible_units(id, sokh_id) ON DELETE RESTRICT,
  FOREIGN KEY (proxy_id, sokh_id) REFERENCES meeting_proxies(id, sokh_id) ON DELETE RESTRICT,
  CHECK (mode <> 'proxy' OR proxy_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_meeting_attendance_active
  ON meeting_attendance(meeting_id, eligible_unit_id)
  WHERE superseded_by IS NULL;

-- ============================================================
-- 7. meeting_ballots — урьдчилсан ба хурлын санал (тусдаа phase) — 4-р шат
-- ============================================================
CREATE TABLE IF NOT EXISTS meeting_ballots (
  id                    BIGSERIAL PRIMARY KEY,
  meeting_id            BIGINT NOT NULL,
  sokh_id               BIGINT NOT NULL,
  agenda_item_id        BIGINT NOT NULL,
  eligible_unit_id      BIGINT NOT NULL,
  phase                 TEXT NOT NULL CHECK (phase IN ('prevote', 'in_meeting')),
  choice                TEXT NOT NULL CHECK (choice IN ('for', 'against', 'abstain')),
  weight_snapshot       NUMERIC NOT NULL CHECK (weight_snapshot > 0),
  cast_by               TEXT NOT NULL CHECK (cast_by IN ('owner', 'proxy', 'admin_paper_entry')),
  proxy_id              BIGINT,
  auth_user_id          UUID,
  recorded_by_admin_id  BIGINT,
  cast_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip                    TEXT,
  user_agent            TEXT,
  superseded_by         BIGINT REFERENCES meeting_ballots(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (meeting_id, sokh_id) REFERENCES meetings(id, sokh_id) ON DELETE RESTRICT,
  FOREIGN KEY (agenda_item_id, sokh_id) REFERENCES meeting_agenda_items(id, sokh_id) ON DELETE RESTRICT,
  FOREIGN KEY (eligible_unit_id, sokh_id) REFERENCES meeting_eligible_units(id, sokh_id) ON DELETE RESTRICT,
  FOREIGN KEY (proxy_id, sokh_id) REFERENCES meeting_proxies(id, sokh_id) ON DELETE RESTRICT,
  CHECK (cast_by <> 'proxy' OR proxy_id IS NOT NULL)
);

-- Нэг асуудалд нэг сууц нэг л идэвхтэй санал
CREATE UNIQUE INDEX IF NOT EXISTS uq_meeting_ballots_active
  ON meeting_ballots(agenda_item_id, eligible_unit_id)
  WHERE superseded_by IS NULL;

-- ============================================================
-- 8. meeting_results — тооцоолсон дүн + хүний баталгаажуулалт — 4-р шат
-- ============================================================
CREATE TABLE IF NOT EXISTS meeting_results (
  id                    BIGSERIAL PRIMARY KEY,
  meeting_id            BIGINT NOT NULL,
  sokh_id               BIGINT NOT NULL,
  agenda_item_id        BIGINT,          -- NULL = хурлын ирцийн дүн
  eligible_count        INT NOT NULL,
  eligible_weight       NUMERIC NOT NULL,
  present_count         INT NOT NULL,
  present_weight        NUMERIC NOT NULL,
  for_weight            NUMERIC NOT NULL DEFAULT 0,
  against_weight        NUMERIC NOT NULL DEFAULT 0,
  abstain_weight        NUMERIC NOT NULL DEFAULT 0,
  prevote_weight        NUMERIC NOT NULL DEFAULT 0,
  in_meeting_weight     NUMERIC NOT NULL DEFAULT 0,
  quorum_status         TEXT NOT NULL CHECK (quorum_status IN ('not_met', 'met')),
  outcome               TEXT CHECK (outcome IN ('passed', 'rejected', 'no_quorum')),
  computed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_by_admin_id BIGINT,
  confirmed_at          TIMESTAMPTZ,
  superseded_by         BIGINT REFERENCES meeting_results(id),
  FOREIGN KEY (meeting_id, sokh_id) REFERENCES meetings(id, sokh_id) ON DELETE RESTRICT,
  FOREIGN KEY (agenda_item_id, sokh_id) REFERENCES meeting_agenda_items(id, sokh_id) ON DELETE RESTRICT,
  -- Ирц бүрдээгүй бол хэн ч батлах боломжгүй, шийдвэр «ирцгүй» л байна
  CONSTRAINT meeting_results_quorum_chk CHECK (
    quorum_status = 'met' OR (confirmed_at IS NULL AND (outcome IS NULL OR outcome = 'no_quorum'))
  )
);

-- ============================================================
-- 9. meeting_minutes — хурлын тэмдэглэл — 5-р шат
-- ============================================================
CREATE TABLE IF NOT EXISTS meeting_minutes (
  id                    BIGSERIAL PRIMARY KEY,
  meeting_id            BIGINT NOT NULL,
  sokh_id               BIGINT NOT NULL,
  version               INT NOT NULL,
  body_md               TEXT,
  pdf_path              TEXT,
  signed_scan_path      TEXT,
  chair_name            TEXT,
  secretary_name        TEXT,
  approved_at           TIMESTAMPTZ,
  created_by_admin_id   BIGINT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (meeting_id, sokh_id) REFERENCES meetings(id, sokh_id) ON DELETE RESTRICT,
  UNIQUE (meeting_id, version)
);

-- ============================================================
-- 10. meeting_decisions — шийдвэрийн архив — 5-р шат
-- ============================================================
CREATE TABLE IF NOT EXISTS meeting_decisions (
  id                    BIGSERIAL PRIMARY KEY,
  meeting_id            BIGINT NOT NULL,
  sokh_id               BIGINT NOT NULL,
  agenda_item_id        BIGINT,
  decision_no           TEXT,
  text                  TEXT NOT NULL,
  outcome               TEXT NOT NULL CHECK (outcome IN ('passed', 'rejected', 'no_quorum')),
  effective_from        DATE,
  published_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (meeting_id, sokh_id) REFERENCES meetings(id, sokh_id) ON DELETE RESTRICT,
  FOREIGN KEY (agenda_item_id, sokh_id) REFERENCES meeting_agenda_items(id, sokh_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_meeting_decisions_sokh ON meeting_decisions(sokh_id, published_at DESC);

-- ============================================================
-- 11. meeting_events — зөвхөн нэмэх аудит лог
-- ============================================================
CREATE TABLE IF NOT EXISTS meeting_events (
  id                    BIGSERIAL PRIMARY KEY,
  meeting_id            BIGINT,          -- хурал устсан ч лог үлдэнэ (FK-гүй)
  sokh_id               BIGINT NOT NULL,
  actor_type            TEXT NOT NULL CHECK (actor_type IN ('admin', 'resident', 'system', 'superadmin')),
  actor_id              TEXT,
  action                TEXT NOT NULL,
  payload               JSONB,
  ip                    TEXT,
  user_agent            TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meeting_events_meeting ON meeting_events(meeting_id, created_at DESC);

-- ============================================================
-- Trigger-үүд
-- ============================================================

-- Аудит лог, хөлдөөсөн жагсаалтыг засах/устгахыг хориглоно
CREATE OR REPLACE FUNCTION meeting_forbid_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% хүснэгтийн мөрийг өөрчлөх/устгах боломжгүй', TG_TABLE_NAME
    USING ERRCODE = 'check_violation';
END $$;

DROP TRIGGER IF EXISTS trg_meeting_events_immutable ON meeting_events;
CREATE TRIGGER trg_meeting_events_immutable
  BEFORE UPDATE OR DELETE ON meeting_events
  FOR EACH ROW EXECUTE FUNCTION meeting_forbid_change();

-- Хөлдөөсөн жагсаалтыг хурал ноорог хэвээр байхад (CASCADE) л устгаж болно
CREATE OR REPLACE FUNCTION meeting_units_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  st TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Хөлдөөсөн сууцны жагсаалтыг засах боломжгүй' USING ERRCODE = 'check_violation';
  END IF;
  SELECT status INTO st FROM meetings WHERE id = OLD.meeting_id;
  IF st IS NOT NULL AND st <> 'draft' THEN
    RAISE EXCEPTION 'Хөлдөөсөн сууцны жагсаалтыг устгах боломжгүй' USING ERRCODE = 'check_violation';
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_meeting_units_guard ON meeting_eligible_units;
CREATE TRIGGER trg_meeting_units_guard
  BEFORE UPDATE OR DELETE ON meeting_eligible_units
  FOR EACH ROW EXECUTE FUNCTION meeting_units_guard();

-- Нотолгооны мөрүүдийг устгахгүй. Засахдаа зөвхөн superseded_by (ба
-- итгэмжлэл/хүргэлтийн төлөвийн багана)-г өөрчилнө.
DROP TRIGGER IF EXISTS trg_meeting_notices_nodelete ON meeting_notices;
CREATE TRIGGER trg_meeting_notices_nodelete
  BEFORE DELETE ON meeting_notices FOR EACH ROW EXECUTE FUNCTION meeting_forbid_change();
DROP TRIGGER IF EXISTS trg_meeting_proxies_nodelete ON meeting_proxies;
CREATE TRIGGER trg_meeting_proxies_nodelete
  BEFORE DELETE ON meeting_proxies FOR EACH ROW EXECUTE FUNCTION meeting_forbid_change();
DROP TRIGGER IF EXISTS trg_meeting_attendance_nodelete ON meeting_attendance;
CREATE TRIGGER trg_meeting_attendance_nodelete
  BEFORE DELETE ON meeting_attendance FOR EACH ROW EXECUTE FUNCTION meeting_forbid_change();
DROP TRIGGER IF EXISTS trg_meeting_ballots_nodelete ON meeting_ballots;
CREATE TRIGGER trg_meeting_ballots_nodelete
  BEFORE DELETE ON meeting_ballots FOR EACH ROW EXECUTE FUNCTION meeting_forbid_change();
DROP TRIGGER IF EXISTS trg_meeting_results_nodelete ON meeting_results;
CREATE TRIGGER trg_meeting_results_nodelete
  BEFORE DELETE ON meeting_results FOR EACH ROW EXECUTE FUNCTION meeting_forbid_change();

CREATE OR REPLACE FUNCTION meeting_ballots_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.choice, NEW.weight_snapshot, NEW.phase, NEW.eligible_unit_id, NEW.agenda_item_id, NEW.cast_at)
     IS DISTINCT FROM
     (OLD.choice, OLD.weight_snapshot, OLD.phase, OLD.eligible_unit_id, OLD.agenda_item_id, OLD.cast_at) THEN
    RAISE EXCEPTION 'Өгсөн саналыг засах боломжгүй — шинэ мөр нэмнэ үү' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_meeting_ballots_guard ON meeting_ballots;
CREATE TRIGGER trg_meeting_ballots_guard
  BEFORE UPDATE ON meeting_ballots FOR EACH ROW EXECUTE FUNCTION meeting_ballots_guard();

-- Хурал: ноорогоос гарсны дараа устгахгүй, хөлдөөсөн дүрмийг өөрчлөхгүй
CREATE OR REPLACE FUNCTION meetings_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN
      RAISE EXCEPTION 'Зарласан хурлыг устгах боломжгүй — цуцлана уу' USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.rules_frozen_at IS NOT NULL AND (
       NEW.vote_weight_mode, NEW.quorum_required_pct, NEW.quorum_strict,
       NEW.min_notice_days, NEW.prevote_counts_as_attendance, NEW.ballot_mode,
       NEW.rules_frozen_at, NEW.scheduled_at, NEW.sokh_id
     ) IS DISTINCT FROM (
       OLD.vote_weight_mode, OLD.quorum_required_pct, OLD.quorum_strict,
       OLD.min_notice_days, OLD.prevote_counts_as_attendance, OLD.ballot_mode,
       OLD.rules_frozen_at, OLD.scheduled_at, OLD.sokh_id
     ) THEN
    RAISE EXCEPTION 'Хурал зарласны дараа дүрэм, огноог өөрчлөх боломжгүй' USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.status IN ('cancelled', 'archived') AND NEW.status <> OLD.status THEN
    RAISE EXCEPTION 'Цуцалсан/архивласан хурлын төлөвийг өөрчлөх боломжгүй' USING ERRCODE = 'check_violation';
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_meetings_guard ON meetings;
CREATE TRIGGER trg_meetings_guard
  BEFORE UPDATE OR DELETE ON meetings FOR EACH ROW EXECUTE FUNCTION meetings_guard();

-- Хурал зарласны дараа хэлэлцэх асуудлыг өөрчлөхгүй
CREATE OR REPLACE FUNCTION meeting_agenda_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  st TEXT;
BEGIN
  SELECT status INTO st FROM meetings WHERE id = COALESCE(NEW.meeting_id, OLD.meeting_id);
  -- CASCADE устгалт (хурал өөрөө устаж байгаа) үед мөр олдохгүй
  IF st IS NOT NULL AND st <> 'draft' THEN
    RAISE EXCEPTION 'Хурал зарласны дараа хэлэлцэх асуудлыг өөрчлөх боломжгүй' USING ERRCODE = 'check_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_meeting_agenda_guard ON meeting_agenda_items;
CREATE TRIGGER trg_meeting_agenda_guard
  BEFORE INSERT OR UPDATE OR DELETE ON meeting_agenda_items
  FOR EACH ROW EXECUTE FUNCTION meeting_agenda_guard();

-- ============================================================
-- Хурал зарлах (хөлдөөх) — нэг транзакцид
-- ============================================================
-- residents-ээс сууц бүрийг (байр+тоот) нэг мөр болгон хөлдөөнө:
--   • pending_claim (баталгаажаагүй өөрөө бүртгүүлсэн) мөрийг тооцохгүй
--   • resident_type='owner' мөр байвал түүнийг (апп-д нэвтэрсэнийг нь түрүүлж),
--     эс бөгөөс тухайн тоотын эхний мөрийг авч owner_confirmed=FALSE гэж тэмдэглэнэ
--   • per_area горимд талбайгүй сууц байвал хөлдөөхгүй, алдаа буцаана
-- Латин/кирилл ижил төстэй үсгийг (23A / 23А) нэг гэж үзнэ.
CREATE OR REPLACE FUNCTION meeting_unit_norm(t TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
  SELECT translate(upper(regexp_replace(trim(coalesce(t, '')), '\s+', '', 'g')),
                   'ABEKMHOPCTYX', 'АВЕКМНОРСТУХ')
$$;

CREATE OR REPLACE FUNCTION meeting_freeze(p_meeting_id BIGINT, p_sokh_id BIGINT, p_admin_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql AS $$
DECLARE
  m meetings%ROWTYPE;
  agenda_cnt INT;
  missing_area INT;
  unit_cnt INT;
  unconfirmed INT;
  multi INT;
BEGIN
  SELECT * INTO m FROM meetings WHERE id = p_meeting_id AND sokh_id = p_sokh_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Хурал олдсонгүй' USING ERRCODE = 'no_data_found';
  END IF;
  IF m.status <> 'draft' THEN
    RAISE EXCEPTION 'Хурал аль хэдийн зарлагдсан байна' USING ERRCODE = 'check_violation';
  END IF;
  IF m.vote_weight_mode IS NULL OR m.quorum_required_pct IS NULL
     OR m.min_notice_days IS NULL OR m.prevote_counts_as_attendance IS NULL THEN
    RAISE EXCEPTION 'Хурлын дүрэм бүрэн бөглөгдөөгүй байна' USING ERRCODE = 'check_violation';
  END IF;
  IF m.scheduled_at < NOW() + make_interval(days => m.min_notice_days) THEN
    RAISE EXCEPTION 'Хурлын огноо хүртэл зар хүргэх хугацаа (% хоног) хүрэхгүй байна', m.min_notice_days
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT count(*) INTO agenda_cnt FROM meeting_agenda_items WHERE meeting_id = m.id;
  IF agenda_cnt = 0 THEN
    RAISE EXCEPTION 'Хэлэлцэх асуудал алга' USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM meeting_agenda_items WHERE meeting_id = m.id AND pass_threshold_pct IS NULL) THEN
    RAISE EXCEPTION 'Хэлэлцэх асуудал бүрийн батлагдах босгыг оруулна уу' USING ERRCODE = 'check_violation';
  END IF;

  CREATE TEMP TABLE _units ON COMMIT DROP AS
  WITH r AS (
    SELECT res.*,
           meeting_unit_norm(res.building) || '|' || meeting_unit_norm(res.apartment) AS unit_key
    FROM residents res
    WHERE res.sokh_id = p_sokh_id
      AND COALESCE(res.pending_claim, FALSE) = FALSE
      AND length(trim(coalesce(res.apartment, ''))) > 0
  ),
  ranked AS (
    SELECT r.*,
           count(*) FILTER (WHERE r.resident_type = 'owner') OVER (PARTITION BY r.unit_key) AS owners,
           row_number() OVER (
             PARTITION BY r.unit_key
             ORDER BY (r.resident_type = 'owner') DESC NULLS LAST,
                      (r.auth_user_id IS NOT NULL) DESC,
                      r.id
           ) AS rn
    FROM r
  )
  SELECT * FROM ranked WHERE rn = 1;

  IF m.vote_weight_mode = 'per_area' THEN
    SELECT count(*) INTO missing_area FROM _units WHERE area_sqm IS NULL OR area_sqm <= 0;
    IF missing_area > 0 THEN
      RAISE EXCEPTION 'Талбайгаар жинлэхэд % сууцны талбай бүртгэлгүй байна', missing_area
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  INSERT INTO meeting_eligible_units
    (meeting_id, sokh_id, resident_id, unit_key, building, apartment, owner_name,
     phone_snapshot, area_sqm_snapshot, weight, owner_confirmed, owner_count)
  SELECT m.id, p_sokh_id, u.id, u.unit_key, u.building, u.apartment, u.name,
         u.phone, u.area_sqm,
         CASE WHEN m.vote_weight_mode = 'per_area' THEN u.area_sqm ELSE 1 END,
         u.owners > 0, u.owners
  FROM _units u;

  GET DIAGNOSTICS unit_cnt = ROW_COUNT;
  IF unit_cnt = 0 THEN
    RAISE EXCEPTION 'Оршин суугчийн бүртгэлд сууц алга' USING ERRCODE = 'check_violation';
  END IF;

  SELECT count(*) FILTER (WHERE NOT owner_confirmed), count(*) FILTER (WHERE owner_count > 1)
    INTO unconfirmed, multi
  FROM meeting_eligible_units WHERE meeting_id = m.id;

  UPDATE meetings SET status = 'noticed', rules_frozen_at = NOW() WHERE id = m.id;

  INSERT INTO meeting_events (meeting_id, sokh_id, actor_type, actor_id, action, payload)
  VALUES (m.id, p_sokh_id, 'admin', p_admin_id::TEXT, 'meeting.frozen',
          jsonb_build_object('units', unit_cnt, 'owner_unconfirmed', unconfirmed,
                             'multi_owner', multi,
                             'total_weight', (SELECT sum(weight) FROM meeting_eligible_units WHERE meeting_id = m.id)));

  RETURN jsonb_build_object('units', unit_cnt, 'owner_unconfirmed', unconfirmed, 'multi_owner', multi);
END $$;

REVOKE ALL ON FUNCTION meeting_freeze(BIGINT, BIGINT, BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION meeting_freeze(BIGINT, BIGINT, BIGINT) TO service_role;

-- ============================================================
-- RLS — бүгдийг хаана (зөвхөн service role)
-- ============================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'meetings', 'meeting_agenda_items', 'meeting_eligible_units', 'meeting_notices',
    'meeting_proxies', 'meeting_attendance', 'meeting_ballots', 'meeting_results',
    'meeting_minutes', 'meeting_decisions', 'meeting_events'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON %I FROM anon, authenticated', t);
  END LOOP;
END $$;

-- ============================================================
-- Хаалттай файл сан — итгэмжлэл, тэмдэглэл, гарын үсгийн скан (2-5-р шат)
-- ============================================================
-- uploads bucket нийтэд нээлттэй, зөвхөн зураг авдаг тул тусдаа хаалттай сан.
-- Policy үүсгэхгүй = зөвхөн service role хандана, уншихдаа signed URL.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('meeting-docs', 'meeting-docs', FALSE, 10485760,
        ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE meetings IS 'Бүх гишүүдийн хурал. Дүрэм зарлах үед хөлдөнө. docs/meeting-management-plan.md';
COMMENT ON TABLE meeting_eligible_units IS 'Хурал зарлах мөчийн санал өгөх эрхтэй сууцны хөлдөөсөн жагсаалт';
COMMENT ON TABLE meeting_events IS 'Хурлын модулийн зөвхөн нэмэх аудит лог';
