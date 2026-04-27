-- ============================================
-- СӨХ Directory Phase 2 migration
-- - hoa_provisional        : хэрэглэгчийн гар оролтоор үүсэх түр СӨХ
-- - resident_memberships   : хэрэглэгчийн СӨХ-тэй холбоо
-- - hoa_activation_requests: "Khotol-ийг идэвхжүүлэх" гэсэн албан ёсны дохио
-- - hoa_activation_summaries: тухайн СӨХ-д хэдэн эрэлт байгаа aggregate
-- - hoa_merge_logs         : merge audit trail
--
-- Энэ migration-ыг Phase 1 (supabase-directory-migration.sql)
-- ажиллуулсны ДАРАА Supabase SQL Editor дотор ажиллуулна.
-- ============================================

-- 1. Provisional СӨХ (хэрэглэгчийн гар оролт)
CREATE TABLE IF NOT EXISTS hoa_provisional (
  id BIGSERIAL PRIMARY KEY,
  entered_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  city TEXT,
  district TEXT,
  khoroo TEXT,
  town_name TEXT,
  building TEXT,
  address TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'HAS_DEMAND', 'MATCH_CANDIDATE', 'MERGED', 'REJECTED')),
  matched_directory_id BIGINT REFERENCES hoa_directory(id) ON DELETE SET NULL,
  match_score NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_provisional_normalized ON hoa_provisional(normalized_name);
CREATE INDEX IF NOT EXISTS idx_provisional_district ON hoa_provisional(district);
CREATE INDEX IF NOT EXISTS idx_provisional_khoroo ON hoa_provisional(khoroo);
CREATE INDEX IF NOT EXISTS idx_provisional_status ON hoa_provisional(status);
-- Нэг district + normalized_name дотор дахин үүсгэхгүй байх UNIQUE (status PENDING/HAS_DEMAND зэрэгт ашиглах upsert key)
CREATE UNIQUE INDEX IF NOT EXISTS uq_provisional_dedupe
  ON hoa_provisional(COALESCE(district, ''), COALESCE(khoroo, ''), normalized_name)
  WHERE status IN ('PENDING', 'HAS_DEMAND', 'MATCH_CANDIDATE');

ALTER TABLE hoa_provisional ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hoa_provisional_all" ON hoa_provisional;
CREATE POLICY "hoa_provisional_all" ON hoa_provisional FOR ALL USING (true) WITH CHECK (true);

-- 2. Resident memberships (хэрэглэгч <-> СӨХ identity)
CREATE TABLE IF NOT EXISTS resident_memberships (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT,
  directory_id BIGINT REFERENCES hoa_directory(id) ON DELETE SET NULL,
  provisional_hoa_id BIGINT REFERENCES hoa_provisional(id) ON DELETE SET NULL,
  city TEXT,
  district TEXT,
  khoroo TEXT,
  building TEXT,
  unit_number TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING_HOA' CHECK (status IN ('PENDING_HOA', 'LINKED_TO_DIRECTORY', 'ACTIVE_TENANT')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Дор хаяж нэг holder заавал байх (provisional эсвэл directory)
  CHECK (directory_id IS NOT NULL OR provisional_hoa_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_memberships_user ON resident_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_directory ON resident_memberships(directory_id);
CREATE INDEX IF NOT EXISTS idx_memberships_provisional ON resident_memberships(provisional_hoa_id);
CREATE INDEX IF NOT EXISTS idx_memberships_status ON resident_memberships(status);

ALTER TABLE resident_memberships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "resident_memberships_all" ON resident_memberships;
CREATE POLICY "resident_memberships_all" ON resident_memberships FOR ALL USING (true) WITH CHECK (true);

-- 3. СӨХ дээр Khotol идэвхжүүлэх хүсэлт (албан ёсны interest signal)
CREATE TABLE IF NOT EXISTS hoa_activation_requests (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT,
  directory_id BIGINT REFERENCES hoa_directory(id) ON DELETE SET NULL,
  provisional_hoa_id BIGINT REFERENCES hoa_provisional(id) ON DELETE SET NULL,
  city TEXT,
  district TEXT,
  khoroo TEXT,
  building TEXT,
  unit_number TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'COUNTED', 'CONTACT_PENDING', 'CONTACTED', 'ONBOARDING', 'CONVERTED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (directory_id IS NOT NULL OR provisional_hoa_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_activation_directory ON hoa_activation_requests(directory_id);
CREATE INDEX IF NOT EXISTS idx_activation_provisional ON hoa_activation_requests(provisional_hoa_id);
CREATE INDEX IF NOT EXISTS idx_activation_status ON hoa_activation_requests(status, created_at DESC);

ALTER TABLE hoa_activation_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hoa_activation_requests_all" ON hoa_activation_requests;
CREATE POLICY "hoa_activation_requests_all" ON hoa_activation_requests FOR ALL USING (true) WITH CHECK (true);

-- 4. Activation summary (СӨХ бүрийн нийт эрэлтийн агрегат)
CREATE TABLE IF NOT EXISTS hoa_activation_summaries (
  id BIGSERIAL PRIMARY KEY,
  directory_id BIGINT UNIQUE REFERENCES hoa_directory(id) ON DELETE CASCADE,
  provisional_hoa_id BIGINT UNIQUE REFERENCES hoa_provisional(id) ON DELETE CASCADE,
  interest_count INT NOT NULL DEFAULT 0,
  building_count INT NOT NULL DEFAULT 0,
  latest_request_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'INTEREST' CHECK (status IN ('INTEREST', 'WARM_LEAD', 'ACTIVATION_READY', 'ACTIVE')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (directory_id IS NOT NULL OR provisional_hoa_id IS NOT NULL),
  CHECK (NOT (directory_id IS NOT NULL AND provisional_hoa_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_summaries_status ON hoa_activation_summaries(status);
CREATE INDEX IF NOT EXISTS idx_summaries_interest ON hoa_activation_summaries(interest_count DESC);

ALTER TABLE hoa_activation_summaries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hoa_activation_summaries_all" ON hoa_activation_summaries;
CREATE POLICY "hoa_activation_summaries_all" ON hoa_activation_summaries FOR ALL USING (true) WITH CHECK (true);

-- 5. Merge audit log
CREATE TABLE IF NOT EXISTS hoa_merge_logs (
  id BIGSERIAL PRIMARY KEY,
  provisional_hoa_id BIGINT NOT NULL REFERENCES hoa_provisional(id) ON DELETE CASCADE,
  directory_id BIGINT NOT NULL REFERENCES hoa_directory(id) ON DELETE CASCADE,
  score NUMERIC,
  reason TEXT,
  merged_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_merge_logs_provisional ON hoa_merge_logs(provisional_hoa_id);
CREATE INDEX IF NOT EXISTS idx_merge_logs_directory ON hoa_merge_logs(directory_id);

ALTER TABLE hoa_merge_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hoa_merge_logs_all" ON hoa_merge_logs;
CREATE POLICY "hoa_merge_logs_all" ON hoa_merge_logs FOR ALL USING (true) WITH CHECK (true);

-- 6. updated_at trigger (Phase 1-ээс set_updated_at_directory() аль хэдийн үүссэн)
DROP TRIGGER IF EXISTS trg_hoa_provisional_updated ON hoa_provisional;
CREATE TRIGGER trg_hoa_provisional_updated BEFORE UPDATE ON hoa_provisional
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_directory();

DROP TRIGGER IF EXISTS trg_resident_memberships_updated ON resident_memberships;
CREATE TRIGGER trg_resident_memberships_updated BEFORE UPDATE ON resident_memberships
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_directory();

DROP TRIGGER IF EXISTS trg_activation_requests_updated ON hoa_activation_requests;
CREATE TRIGGER trg_activation_requests_updated BEFORE UPDATE ON hoa_activation_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_directory();

DROP TRIGGER IF EXISTS trg_activation_summaries_updated ON hoa_activation_summaries;
CREATE TRIGGER trg_activation_summaries_updated BEFORE UPDATE ON hoa_activation_summaries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_directory();
