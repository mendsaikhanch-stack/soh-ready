-- error_logs хүснэгт — краш, алдааг бүртгэх
CREATE TABLE IF NOT EXISTS error_logs (
  id BIGSERIAL PRIMARY KEY,
  level TEXT NOT NULL DEFAULT 'error' CHECK (level IN ('error', 'warning', 'fatal')),
  message TEXT NOT NULL,
  stack TEXT,
  digest TEXT,
  source TEXT NOT NULL DEFAULT 'client' CHECK (source IN ('client', 'server', 'api', 'instrumentation')),
  route TEXT,
  method TEXT,
  user_agent TEXT,
  user_id TEXT,
  sokh_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index: сүүлийн алдаануудыг хурдан татах
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_level ON error_logs (level);
CREATE INDEX IF NOT EXISTS idx_error_logs_source ON error_logs (source);

-- 30 хоногоос хуучин бичлэг автоматаар устгах (cron шаардлагатай)
-- SELECT cron.schedule('cleanup-error-logs', '0 3 * * *', $$DELETE FROM error_logs WHERE created_at < NOW() - INTERVAL '30 days'$$);

-- RLS идэвхжүүлэх
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- Зөвхөн insert зөвшөөрөх (клиентээс бичих)
CREATE POLICY "Allow anonymous insert" ON error_logs FOR INSERT WITH CHECK (true);

-- Select зөвхөн service_role-д (admin proxy-р дамжина)
CREATE POLICY "Service role select" ON error_logs FOR SELECT USING (auth.role() = 'service_role');
