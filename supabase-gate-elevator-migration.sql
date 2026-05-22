-- Хаалт болон Лифтний хуудаснуудад зориулсан table-ууд

-- Хаалтны үйл явдал (QR нээлт, гар хүсэлт, зочны нэвтрэлт)
CREATE TABLE IF NOT EXISTS gate_events (
  id BIGSERIAL PRIMARY KEY,
  sokh_id BIGINT REFERENCES sokh_organizations(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('opened', 'requested', 'denied')),
  source TEXT NOT NULL CHECK (source IN ('qr', 'manual', 'guest')),
  requester_name TEXT,
  requester_apartment TEXT,
  guest_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gate_events_sokh_time
  ON gate_events(sokh_id, created_at DESC);

-- Лифтний дуудлага
CREATE TABLE IF NOT EXISTS elevator_calls (
  id BIGSERIAL PRIMARY KEY,
  sokh_id BIGINT REFERENCES sokh_organizations(id) ON DELETE CASCADE,
  elevator_name TEXT NOT NULL,
  from_floor INT,
  to_floor INT,
  caller_name TEXT,
  caller_apartment TEXT,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'arrived', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  arrived_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_elevator_calls_sokh_time
  ON elevator_calls(sokh_id, created_at DESC);

ALTER TABLE gate_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE elevator_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gate_events_all" ON gate_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "elevator_calls_all" ON elevator_calls FOR ALL USING (true) WITH CHECK (true);
