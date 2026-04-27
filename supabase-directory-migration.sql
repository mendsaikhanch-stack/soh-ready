-- ============================================
-- СӨХ Master Directory migration
-- "Хотол" платформын дээд түвшний СӨХ-ийн жагсаалтын суурь
--
-- Загвар:
--   sokh_organizations  = идэвхтэй Khotol-н tenant (tenant Store)
--   hoa_directory       = master directory (бүх СӨХ — идэвхжээгүй ч багтана)
--   linked_tenant_id    = тухайн directory-г аль tenant-тай холбосон холбоос
--
-- Supabase SQL Editor дотор ажиллуулна
-- ============================================

-- 1. Master СӨХ Directory
CREATE TABLE IF NOT EXISTS hoa_directory (
  id BIGSERIAL PRIMARY KEY,
  official_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL UNIQUE,
  display_name TEXT,
  district TEXT,
  khoroo TEXT,
  address TEXT,
  phone TEXT,
  soh_code TEXT UNIQUE,
  building_count INT,
  unit_count INT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PENDING', 'HIDDEN')),
  linked_tenant_id BIGINT UNIQUE REFERENCES sokh_organizations(id) ON DELETE SET NULL,
  search_text TEXT,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hoa_directory_normalized ON hoa_directory(normalized_name);
CREATE INDEX IF NOT EXISTS idx_hoa_directory_district ON hoa_directory(district);
CREATE INDEX IF NOT EXISTS idx_hoa_directory_khoroo ON hoa_directory(khoroo);
CREATE INDEX IF NOT EXISTS idx_hoa_directory_status ON hoa_directory(status);
CREATE INDEX IF NOT EXISTS idx_hoa_directory_search ON hoa_directory USING GIN (to_tsvector('simple', COALESCE(search_text, '')));

ALTER TABLE hoa_directory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hoa_directory_select" ON hoa_directory;
DROP POLICY IF EXISTS "hoa_directory_all" ON hoa_directory;
CREATE POLICY "hoa_directory_select" ON hoa_directory FOR SELECT USING (true);
CREATE POLICY "hoa_directory_all" ON hoa_directory FOR ALL USING (true) WITH CHECK (true);

-- 2. Directory Aliases (нэг СӨХ-ийн өөр нэрс)
CREATE TABLE IF NOT EXISTS hoa_directory_aliases (
  id BIGSERIAL PRIMARY KEY,
  directory_id BIGINT NOT NULL REFERENCES hoa_directory(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hoa_aliases_directory ON hoa_directory_aliases(directory_id);
CREATE INDEX IF NOT EXISTS idx_hoa_aliases_normalized ON hoa_directory_aliases(normalized_alias);
CREATE UNIQUE INDEX IF NOT EXISTS uq_hoa_aliases_per_directory ON hoa_directory_aliases(directory_id, normalized_alias);

ALTER TABLE hoa_directory_aliases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hoa_aliases_select" ON hoa_directory_aliases;
DROP POLICY IF EXISTS "hoa_aliases_all" ON hoa_directory_aliases;
CREATE POLICY "hoa_aliases_select" ON hoa_directory_aliases FOR SELECT USING (true);
CREATE POLICY "hoa_aliases_all" ON hoa_directory_aliases FOR ALL USING (true) WITH CHECK (true);

-- 3. Хэрэглэгчийн "СӨХ олдсонгүй" хүсэлт
CREATE TABLE IF NOT EXISTS user_signup_requests (
  id BIGSERIAL PRIMARY KEY,
  full_name TEXT,
  phone TEXT,
  email TEXT,
  requested_name TEXT NOT NULL,
  district TEXT,
  khoroo TEXT,
  address TEXT,
  matched_directory_id BIGINT REFERENCES hoa_directory(id) ON DELETE SET NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'MATCHED', 'APPROVED', 'REJECTED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signup_requests_status ON user_signup_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signup_requests_directory ON user_signup_requests(matched_directory_id);

ALTER TABLE user_signup_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "signup_requests_insert" ON user_signup_requests;
DROP POLICY IF EXISTS "signup_requests_all" ON user_signup_requests;
-- Олон нийтэд insert зөвшөөрөхгүй (зөвхөн API route service_role-аар)
CREATE POLICY "signup_requests_all" ON user_signup_requests FOR ALL USING (true) WITH CHECK (true);

-- 4. Импортын ажил (preview job)
CREATE TABLE IF NOT EXISTS directory_import_jobs (
  id BIGSERIAL PRIMARY KEY,
  file_name TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PARSED', 'REVIEW', 'COMPLETED', 'FAILED')),
  total_rows INT,
  imported_rows INT,
  skipped_rows INT,
  duplicate_rows INT,
  error_rows INT,
  summary_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON directory_import_jobs(status, created_at DESC);

ALTER TABLE directory_import_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "import_jobs_all" ON directory_import_jobs;
CREATE POLICY "import_jobs_all" ON directory_import_jobs FOR ALL USING (true) WITH CHECK (true);

-- 5. Импортын мөр бүр (preview row)
CREATE TABLE IF NOT EXISTS directory_import_rows (
  id BIGSERIAL PRIMARY KEY,
  import_job_id BIGINT NOT NULL REFERENCES directory_import_jobs(id) ON DELETE CASCADE,
  row_number INT NOT NULL,
  raw_json JSONB NOT NULL,
  mapped_json JSONB,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'MATCHED', 'NEW_RECORD', 'DUPLICATE', 'ERROR', 'SKIPPED')),
  match_score DOUBLE PRECISION,
  suggested_directory_id BIGINT REFERENCES hoa_directory(id) ON DELETE SET NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_rows_job ON directory_import_rows(import_job_id, row_number);
CREATE INDEX IF NOT EXISTS idx_import_rows_status ON directory_import_rows(import_job_id, status);

ALTER TABLE directory_import_rows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "import_rows_all" ON directory_import_rows;
CREATE POLICY "import_rows_all" ON directory_import_rows FOR ALL USING (true) WITH CHECK (true);

-- 6. updated_at автоматаар шинэчлэх trigger
CREATE OR REPLACE FUNCTION set_updated_at_directory() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_hoa_directory_updated ON hoa_directory;
CREATE TRIGGER trg_hoa_directory_updated BEFORE UPDATE ON hoa_directory
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_directory();

DROP TRIGGER IF EXISTS trg_signup_requests_updated ON user_signup_requests;
CREATE TRIGGER trg_signup_requests_updated BEFORE UPDATE ON user_signup_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_directory();

DROP TRIGGER IF EXISTS trg_import_jobs_updated ON directory_import_jobs;
CREATE TRIGGER trg_import_jobs_updated BEFORE UPDATE ON directory_import_jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_directory();

DROP TRIGGER IF EXISTS trg_import_rows_updated ON directory_import_rows;
CREATE TRIGGER trg_import_rows_updated BEFORE UPDATE ON directory_import_rows
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_directory();
