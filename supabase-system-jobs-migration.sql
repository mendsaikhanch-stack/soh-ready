-- Self-healing / Recovery layer
-- Background job queue + retry tracking + admin visibility
-- Зорилго: Multi-step flow-уудын partial failure-ыг идэмпотент байдлаар засах

-- 1. system_jobs — гол queue
CREATE TABLE IF NOT EXISTS system_jobs (
  id BIGSERIAL PRIMARY KEY,
  job_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'DEAD')),
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  last_error TEXT,
  -- Idempotency key: ижил key-тэй pending/running job үүсгэхгүй
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_system_jobs_idempotency
  ON system_jobs(job_type, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND status IN ('PENDING', 'RUNNING');

CREATE INDEX IF NOT EXISTS idx_system_jobs_status ON system_jobs(status);
CREATE INDEX IF NOT EXISTS idx_system_jobs_type ON system_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_system_jobs_available
  ON system_jobs(available_at)
  WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_system_jobs_dead
  ON system_jobs(created_at DESC)
  WHERE status = 'DEAD';

-- 2. system_job_attempts — оролдлогын тэмдэглэл
CREATE TABLE IF NOT EXISTS system_job_attempts (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT NOT NULL REFERENCES system_jobs(id) ON DELETE CASCADE,
  attempt_no INT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  success BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_system_job_attempts_job ON system_job_attempts(job_id);
CREATE INDEX IF NOT EXISTS idx_system_job_attempts_started ON system_job_attempts(started_at DESC);

-- 3. RLS deny_all — зөвхөн service_role хандана
ALTER TABLE system_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_job_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_all_system_jobs" ON system_jobs FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "deny_all_system_job_attempts" ON system_job_attempts FOR ALL USING (false) WITH CHECK (false);

-- 4. updated_at trigger
CREATE OR REPLACE FUNCTION trg_system_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS system_jobs_updated_at ON system_jobs;
CREATE TRIGGER system_jobs_updated_at
  BEFORE UPDATE ON system_jobs
  FOR EACH ROW EXECUTE FUNCTION trg_system_jobs_updated_at();

-- 5. Stuck job recovery — locked_at-аас 10 минут өнгөрсөн PENDING биш RUNNING-уудыг буцаах
-- (cron-аас дуудна, эсвэл claim хийхэд автомат шалгана)
CREATE OR REPLACE FUNCTION reclaim_stuck_jobs(stale_minutes INT DEFAULT 10)
RETURNS INT AS $$
DECLARE
  reclaimed INT;
BEGIN
  UPDATE system_jobs
  SET status = 'PENDING',
      locked_at = NULL,
      locked_by = NULL,
      available_at = NOW()
  WHERE status = 'RUNNING'
    AND locked_at < NOW() - (stale_minutes || ' minutes')::INTERVAL;
  GET DIAGNOSTICS reclaimed = ROW_COUNT;
  RETURN reclaimed;
END;
$$ LANGUAGE plpgsql;
