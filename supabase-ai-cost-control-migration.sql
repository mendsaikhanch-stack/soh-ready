-- ============================================================
-- Khotol AI Cost Control migration
-- ============================================================
-- Зорилго: AI provider-ийн хэрэглээг хяналт дор байлгах. Системийн
-- үндсэн ажиллагаа (Layer 1 rule engine + Layer 2 template generator)
-- AI ашиглахгүй ажиллана. Layer 3 (AI enhancement) нь зөвхөн админ
-- идэвхжүүлсэн үед, тогтоосон сарын квотын хэмжээнд ажиллана.
--
-- Шинэ хүснэгтүүд:
--   1. ai_settings   — СӨХ бүрийн AI тохиргоо
--   2. ai_usage_log  — AI provider руу хийсэн дуудлага бүрийг лог-д бичнэ
--
-- Idempotent — IF NOT EXISTS / DROP POLICY IF EXISTS
-- ============================================================


-- ============================================================
-- 1. ai_settings (per-sokh)
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_settings (
  sokh_id           BIGINT PRIMARY KEY,

  -- Layer 3-ийг идэвхжүүлэх эсэх. Default false — системийн үндсэн
  -- ажиллагаа AI-гүйгээр явна.
  ai_enabled        BOOLEAN NOT NULL DEFAULT FALSE,

  -- Сонгох провайдер: 'template' (AI бус), 'anthropic', 'openai', 'gemini'.
  -- 'template' нь Layer 2-той тэнцүү — заавал AI ашиглахгүй.
  ai_provider       TEXT NOT NULL DEFAULT 'template'
                    CHECK (ai_provider IN ('template', 'anthropic', 'openai', 'gemini')),

  -- Сарын дуудлагын дээд хязгаар. NULL бол хязгааргүй (зөвхөн админ
  -- хатуу idabsalachee).
  monthly_limit     INTEGER NOT NULL DEFAULT 100
                    CHECK (monthly_limit >= 0),

  -- Тухайн сарын хэрэглэгдсэн тоо. Сар бүр reset_at-аас хойш өсгөнө.
  used_this_month   INTEGER NOT NULL DEFAULT 0
                    CHECK (used_this_month >= 0),

  -- Хамгийн сүүлд reset хийсэн огноо. month rollover-ийг хянана.
  period_started_at TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', NOW()),

  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 2. ai_usage_log
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_usage_log (
  id              BIGSERIAL PRIMARY KEY,
  sokh_id         BIGINT NOT NULL,

  kind            TEXT NOT NULL,
  layer           TEXT NOT NULL
                  CHECK (layer IN ('rule', 'template', 'ai_enhanced')),

  provider        TEXT NOT NULL,
  model           TEXT,

  -- Дуудлагын байдал
  success         BOOLEAN NOT NULL DEFAULT TRUE,
  error_message   TEXT,

  -- Token-ы тоо (хэрвээ provider буцаасан бол)
  prompt_tokens   INTEGER,
  output_tokens   INTEGER,

  -- Тооцоолсон төлбөр (USD * 100000 — entire cents)
  est_cost_micro  BIGINT,

  -- Тухайн дуудлагатай холбоотой нэмэлт мэдээлэл
  metadata        JSONB,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_usage_log_sokh_idx
  ON ai_usage_log(sokh_id);

CREATE INDEX IF NOT EXISTS ai_usage_log_created_idx
  ON ai_usage_log(created_at DESC);

CREATE INDEX IF NOT EXISTS ai_usage_log_layer_idx
  ON ai_usage_log(layer);


-- ============================================================
-- 3. updated_at trigger
-- ============================================================

CREATE OR REPLACE FUNCTION ai_settings_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_settings_updated_at ON ai_settings;
CREATE TRIGGER trg_ai_settings_updated_at
  BEFORE UPDATE ON ai_settings
  FOR EACH ROW
  EXECUTE FUNCTION ai_settings_set_updated_at();


-- ============================================================
-- 4. Monthly period rollover helper
-- ============================================================
-- Сар солигдсон бол used_this_month-ыг автоматаар 0 болгож,
-- period_started_at-ыг шинэчилнэ. Каллер заавал дуудна (mutation үед).

CREATE OR REPLACE FUNCTION ai_settings_rollover_if_new_month(p_sokh_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE ai_settings
     SET used_this_month   = 0,
         period_started_at = date_trunc('month', NOW())
   WHERE sokh_id = p_sokh_id
     AND period_started_at < date_trunc('month', NOW());
END;
$$;


-- ============================================================
-- 5. RLS — tenant scoped READ
-- ============================================================
-- INSERT / UPDATE-ийг зөвхөн service_role хийнэ (admin proxy дамжина).
-- Authenticated resident зөвхөн өөрийн СӨХ-ийн тохиргоог уншиж болно
-- (UI-д "Энэ СӨХ AI ашигладаг уу" гэдгийг харуулах боломжтой).

ALTER TABLE ai_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_settings_select_tenant" ON ai_settings;
CREATE POLICY "ai_settings_select_tenant"
  ON ai_settings
  FOR SELECT
  TO authenticated
  USING (sokh_id IN (SELECT current_user_sokh_ids()));

DROP POLICY IF EXISTS "ai_usage_log_select_tenant" ON ai_usage_log;
CREATE POLICY "ai_usage_log_select_tenant"
  ON ai_usage_log
  FOR SELECT
  TO authenticated
  USING (sokh_id IN (SELECT current_user_sokh_ids()));


-- ============================================================
-- 6. Тайлбар комментүүд
-- ============================================================

COMMENT ON TABLE ai_settings IS
  'Per-СӨХ AI тохиргоо. Системийн үндсэн ажиллагаа AI-гүйгээр явна; '
  'AI зөвхөн ai_enabled=true үед нэмэлт сайжруулалт хийнэ.';

COMMENT ON COLUMN ai_settings.ai_provider IS
  'template (AI бус, default) | anthropic | openai | gemini';

COMMENT ON COLUMN ai_settings.monthly_limit IS
  'Сарын AI дуудлагын дээд хязгаар. 0 бол AI бүрэн хаагдсан.';

COMMENT ON TABLE ai_usage_log IS
  'AI provider руу хийсэн дуудлага бүрийн нэг бичлэг. '
  'layer=rule/template нь AI-гүй дуудлагуудыг тэмдэглэх боломжтой.';
