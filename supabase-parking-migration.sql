-- Parking удирдлага: localStorage → Supabase шилжүүлэг

CREATE TABLE IF NOT EXISTS vehicles (
  id BIGSERIAL PRIMARY KEY,
  sokh_id BIGINT REFERENCES sokh_organizations(id) ON DELETE CASCADE,
  plate_number TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  car_model TEXT,
  color TEXT DEFAULT 'Цагаан',
  parking_spot TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS blocking_incidents (
  id BIGSERIAL PRIMARY KEY,
  sokh_id BIGINT REFERENCES sokh_organizations(id) ON DELETE CASCADE,
  blocking_plate TEXT NOT NULL,
  blocked_plate TEXT NOT NULL,
  resolved BOOLEAN DEFAULT false,
  notification_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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

-- RLS
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocking_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE gate_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vehicles_read" ON vehicles FOR SELECT USING (true);
CREATE POLICY "blocking_incidents_read" ON blocking_incidents FOR SELECT USING (true);
CREATE POLICY "guest_vehicles_read" ON guest_vehicles FOR SELECT USING (true);
CREATE POLICY "gate_settings_read" ON gate_settings FOR SELECT USING (true);
