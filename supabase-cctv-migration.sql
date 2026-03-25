-- CCTV камерын удирдлага: localStorage → Supabase шилжүүлэг

CREATE TABLE IF NOT EXISTS cameras (
  id BIGSERIAL PRIMARY KEY,
  sokh_id BIGINT REFERENCES sokh_organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location TEXT,
  rtsp_url TEXT,
  ip_address TEXT,
  status TEXT DEFAULT 'offline',
  ai_enabled BOOLEAN DEFAULT false,
  brand TEXT DEFAULT 'Hikvision',
  onvif_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cctv_ai_alerts (
  id BIGSERIAL PRIMARY KEY,
  sokh_id BIGINT REFERENCES sokh_organizations(id) ON DELETE CASCADE,
  camera_id BIGINT REFERENCES cameras(id) ON DELETE CASCADE,
  camera_name TEXT,
  type TEXT NOT NULL,
  severity TEXT DEFAULT 'info',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS footage_requests (
  id BIGSERIAL PRIMARY KEY,
  sokh_id BIGINT REFERENCES sokh_organizations(id) ON DELETE CASCADE,
  resident_name TEXT NOT NULL,
  apartment TEXT,
  phone TEXT,
  category TEXT,
  description TEXT,
  date_from DATE,
  date_to DATE,
  location TEXT,
  status TEXT DEFAULT 'pending',
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE cameras ENABLE ROW LEVEL SECURITY;
ALTER TABLE cctv_ai_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE footage_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cameras_read" ON cameras FOR SELECT USING (true);
CREATE POLICY "cctv_ai_alerts_read" ON cctv_ai_alerts FOR SELECT USING (true);
CREATE POLICY "footage_requests_read" ON footage_requests FOR SELECT USING (true);
