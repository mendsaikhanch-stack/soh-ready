-- Админ audit log хүснэгт
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER,
  role TEXT NOT NULL,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index: хурдан хайлт
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON audit_logs (table_name);

-- 90 хоногоос хуучин log автоматаар устгах (cron-оор ажиллуулна)
-- DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '90 days';
