-- Байцаагчийн апп DB migration

-- 1. Байцаагчийн бүртгэл
CREATE TABLE IF NOT EXISTS inspectors (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default байцаагч
INSERT INTO inspectors (name, phone, username, password)
VALUES ('Байцаагч 1', '99001122', 'inspector1', 'Inspector@2024!')
ON CONFLICT (username) DO NOTHING;

-- 2. Даалгавар / маршрут
CREATE TABLE IF NOT EXISTS inspector_assignments (
  id SERIAL PRIMARY KEY,
  inspector_id INT NOT NULL REFERENCES inspectors(id),
  sokh_id INT NOT NULL REFERENCES sokh_organizations(id),
  assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Шалгалт (нэг айл = нэг шалгалт)
CREATE TABLE IF NOT EXISTS inspections (
  id SERIAL PRIMARY KEY,
  inspector_id INT NOT NULL REFERENCES inspectors(id),
  assignment_id INT REFERENCES inspector_assignments(id),
  sokh_id INT NOT NULL REFERENCES sokh_organizations(id),
  resident_id INT REFERENCES residents(id),
  apartment TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  inspection_date DATE NOT NULL DEFAULT CURRENT_DATE,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  gps_lat DOUBLE PRECISION,
  gps_lng DOUBLE PRECISION,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Шалгалтын тоолуурын заалт
CREATE TABLE IF NOT EXISTS inspection_readings (
  id SERIAL PRIMARY KEY,
  inspection_id INT NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  resident_id INT REFERENCES residents(id),
  utility_type TEXT NOT NULL,
  previous_reading NUMERIC DEFAULT 0,
  current_reading NUMERIC NOT NULL,
  consumption NUMERIC GENERATED ALWAYS AS (current_reading - COALESCE(previous_reading, 0)) STORED,
  meter_serial TEXT,
  photo_url TEXT,
  discrepancy BOOLEAN DEFAULT FALSE,
  discrepancy_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Зөрчил
CREATE TABLE IF NOT EXISTS inspection_violations (
  id SERIAL PRIMARY KEY,
  inspection_id INT NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  violation_type TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT DEFAULT 'medium',
  photo_url TEXT,
  status TEXT DEFAULT 'open',
  resolved_at TIMESTAMPTZ,
  resolved_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Акт
CREATE TABLE IF NOT EXISTS inspection_acts (
  id SERIAL PRIMARY KEY,
  inspection_id INT NOT NULL REFERENCES inspections(id),
  act_number TEXT,
  act_type TEXT DEFAULT 'inspection',
  content TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE inspectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspector_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_acts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all inspectors" ON inspectors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all inspector_assignments" ON inspector_assignments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all inspections" ON inspections FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all inspection_readings" ON inspection_readings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all inspection_violations" ON inspection_violations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all inspection_acts" ON inspection_acts FOR ALL USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_inspections_inspector ON inspections(inspector_id, inspection_date);
CREATE INDEX IF NOT EXISTS idx_inspector_assignments_date ON inspector_assignments(inspector_id, assigned_date);
