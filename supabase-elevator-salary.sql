-- Ажилчдын цалин column нэмэх
ALTER TABLE staff ADD COLUMN IF NOT EXISTS salary NUMERIC DEFAULT 0;

-- Лифт засвар хуваарийн хүснэгт
CREATE TABLE IF NOT EXISTS elevator_tasks (
  id BIGSERIAL PRIMARY KEY,
  sokh_id BIGINT REFERENCES sokh_organizations(id) ON DELETE CASCADE,
  elevator_name TEXT NOT NULL DEFAULT 'Лифт #1',
  task_type TEXT NOT NULL DEFAULT 'inspection',
  description TEXT,
  scheduled_date DATE NOT NULL,
  status TEXT DEFAULT 'scheduled',
  assigned_to TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE elevator_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "elevator_all" ON elevator_tasks FOR ALL USING (true) WITH CHECK (true);

-- Үйлчилгээ тохиргоо: идэвхгүй болгосон feature-ийн жагсаалт
ALTER TABLE sokh_organizations ADD COLUMN IF NOT EXISTS disabled_features TEXT[] DEFAULT '{}';
