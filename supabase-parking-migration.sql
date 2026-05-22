-- Parking удирдлага: зочин машин + автомат хаалгны тохиргоо
-- ⚠️ vehicles, blocking_incidents хүснэгтийг ҮҮСГЭХГҮЙ —
--    parking_vehicles + blocking_reports (v3-migration) хувилбарыг ашиглана.

CREATE TABLE IF NOT EXISTS guest_vehicles (
  id BIGSERIAL PRIMARY KEY,
  sokh_id BIGINT REFERENCES sokh_organizations(id) ON DELETE CASCADE,
  plate_number TEXT NOT NULL,
  host_name TEXT NOT NULL,
  host_apartment TEXT,
  entered_at TIMESTAMPTZ DEFAULT NOW(),
  allowed_minutes INT DEFAULT 60,
  exited_at TIMESTAMPTZ,
  over_charge INT DEFAULT 0,
  charged BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS gate_settings (
  id BIGSERIAL PRIMARY KEY,
  sokh_id BIGINT UNIQUE REFERENCES sokh_organizations(id) ON DELETE CASCADE,
  ip_address TEXT DEFAULT '192.168.1.100',
  port TEXT DEFAULT '8080',
  connected BOOLEAN DEFAULT false,
  auto_open BOOLEAN DEFAULT true,
  overcharge_per_hour INT DEFAULT 5000
);

ALTER TABLE guest_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE gate_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guest_vehicles_all" ON guest_vehicles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "gate_settings_all" ON gate_settings FOR ALL USING (true) WITH CHECK (true);
