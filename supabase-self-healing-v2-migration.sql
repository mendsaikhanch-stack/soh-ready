-- Self-healing v2: timeout, alerts, notification outbox
-- Дараалал: system-jobs migration-ы дараа ажиллуулна.

-- 1. system_jobs: timeout_sec нэмэх
ALTER TABLE system_jobs
  ADD COLUMN IF NOT EXISTS timeout_sec INT NOT NULL DEFAULT 60;

-- 2. system_alerts: DEAD job, drift threshold г.м-ийн алертууд
CREATE TABLE IF NOT EXISTS system_alerts (
  id BIGSERIAL PRIMARY KEY,
  severity TEXT NOT NULL DEFAULT 'warning'
    CHECK (severity IN ('info', 'warning', 'critical')),
  source TEXT NOT NULL,                -- e.g. 'job:dead', 'reconcile:drift', 'notif:dead'
  message TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Идэмпотент түлхүүр — нэг асуудлаас олон алерт хуурайруулахгүй
  dedup_key TEXT,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_system_alerts_dedup
  ON system_alerts(dedup_key)
  WHERE dedup_key IS NOT NULL AND acknowledged_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_system_alerts_active
  ON system_alerts(created_at DESC)
  WHERE acknowledged_at IS NULL;

ALTER TABLE system_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny_all_system_alerts" ON system_alerts;
CREATE POLICY "deny_all_system_alerts" ON system_alerts FOR ALL USING (false) WITH CHECK (false);

-- 3. scheduled_notifications: outbox талбарууд
ALTER TABLE scheduled_notifications
  ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS max_attempts INT NOT NULL DEFAULT 3;

CREATE INDEX IF NOT EXISTS idx_scheduled_notif_failed
  ON scheduled_notifications(failed_at)
  WHERE status = 'failed';
