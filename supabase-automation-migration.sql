-- ============================================================
-- Khotol AI Automation migration
-- ============================================================
-- Зорилго: AI / workflow builder-аас үүсгэсэн дүрэм болон тэдгээрийн
-- ажиллалтын түүхийг хадгална. Бүх action нь DRAFT үүсгэдэг —
-- админ заавал шалгаж зөвшөөрсний дараа л үнэн илгээгдэх ёстой.
--
-- Хүснэгтүүд:
--   1. automation_rules   — дүрмийн тодорхойлолт (trigger + condition + action)
--   2. automation_runs    — дүрэм ажилласан тохиолдол бүрийн бичлэг
--
-- Архитектур:
--   - sokh_id-р tenant scoped (RLS via current_user_sokh_ids())
--   - Админ/superadmin нь service_role-аар /api/admin/* proxy-ээр дамждаг
--     тул тэдэнд RLS нөлөөлөхгүй
--
-- Давтан ажиллуулахад аюулгүй (IF NOT EXISTS, DROP POLICY IF EXISTS)
-- ============================================================


-- ============================================================
-- 1. automation_rules
-- ============================================================

CREATE TABLE IF NOT EXISTS automation_rules (
  id              BIGSERIAL PRIMARY KEY,
  sokh_id         BIGINT NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT,

  trigger_type    TEXT NOT NULL
                  CHECK (trigger_type IN (
                    'monthly_date',
                    'unpaid_after_day',
                    'issue_overdue',
                    'manual'
                  )),
  condition_json  JSONB NOT NULL DEFAULT '{}'::jsonb,

  action_type     TEXT NOT NULL
                  CHECK (action_type IN (
                    'create_reminder_draft',
                    'create_notification_draft',
                    'create_report_draft',
                    'alert_admin',
                    'create_invoice_batch_draft'
                  )),
  action_json     JSONB NOT NULL DEFAULT '{}'::jsonb,

  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'active', 'paused')),

  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS automation_rules_sokh_idx
  ON automation_rules(sokh_id);

CREATE INDEX IF NOT EXISTS automation_rules_status_idx
  ON automation_rules(status)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS automation_rules_trigger_idx
  ON automation_rules(trigger_type);


-- ============================================================
-- 2. automation_runs
-- ============================================================

CREATE TABLE IF NOT EXISTS automation_runs (
  id              BIGSERIAL PRIMARY KEY,
  rule_id         BIGINT NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  sokh_id         BIGINT NOT NULL,

  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'success', 'failed', 'skipped')),

  input_json      JSONB,
  output_json     JSONB,
  error_message   TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS automation_runs_rule_idx
  ON automation_runs(rule_id);

CREATE INDEX IF NOT EXISTS automation_runs_sokh_idx
  ON automation_runs(sokh_id);

CREATE INDEX IF NOT EXISTS automation_runs_status_created_idx
  ON automation_runs(status, created_at DESC);


-- ============================================================
-- 3. updated_at trigger
-- ============================================================

CREATE OR REPLACE FUNCTION automation_rules_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_automation_rules_updated_at ON automation_rules;
CREATE TRIGGER trg_automation_rules_updated_at
  BEFORE UPDATE ON automation_rules
  FOR EACH ROW
  EXECUTE FUNCTION automation_rules_set_updated_at();


-- ============================================================
-- 4. RLS — tenant scoped
-- ============================================================
-- Authenticated mobile resident үндсэндээ эдгээр хүснэгтийг харах
-- шаардлагагүй. Гэхдээ ирээдүйд "миний СӨХ-д ямар автомат дүрэм идэвхтэй
-- байна вэ?" гэдгийг харуулахын тулд READ-only policy үлдээж байна.
--
-- INSERT / UPDATE / DELETE-ийг зөвхөн service_role-аар (/api/admin/* proxy)
-- хийнэ.

ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_runs  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "automation_rules_select_tenant" ON automation_rules;
CREATE POLICY "automation_rules_select_tenant"
  ON automation_rules
  FOR SELECT
  TO authenticated
  USING (sokh_id IN (SELECT current_user_sokh_ids()));

DROP POLICY IF EXISTS "automation_runs_select_tenant" ON automation_runs;
CREATE POLICY "automation_runs_select_tenant"
  ON automation_runs
  FOR SELECT
  TO authenticated
  USING (sokh_id IN (SELECT current_user_sokh_ids()));

-- service_role нь RLS-г bypass хийдэг тул INSERT/UPDATE/DELETE policy
-- бичих шаардлагагүй (admin proxy дамжина).


-- ============================================================
-- 5. Тайлбар комментүүд
-- ============================================================

COMMENT ON TABLE automation_rules IS
  'Khotol AI / Workflow builder-ээс үүсгэсэн автомат дүрмүүд. '
  'Бүх action нь DRAFT үүсгэдэг — админ зөвшөөрсний дараа л илгээгдэнэ.';

COMMENT ON COLUMN automation_rules.trigger_type IS
  'monthly_date | unpaid_after_day | issue_overdue | manual';

COMMENT ON COLUMN automation_rules.action_type IS
  'create_reminder_draft | create_notification_draft | create_report_draft | '
  'alert_admin | create_invoice_batch_draft';

COMMENT ON COLUMN automation_rules.status IS
  'draft (анх үүсгэгдсэн) | active (идэвхтэй) | paused (түр зогссон)';

COMMENT ON TABLE automation_runs IS
  'Дүрэм бүрийн ажилласан тохиолдлын түүх. AI үүсгэсэн draft-уудыг '
  'output_json дотор хадгална.';
