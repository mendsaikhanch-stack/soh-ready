-- Push Notification Subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  sokh_id BIGINT REFERENCES sokh_organizations(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Service role only (API route-р дамжуулна)
CREATE POLICY "push_select" ON push_subscriptions FOR SELECT USING (true);
CREATE POLICY "push_insert" ON push_subscriptions FOR INSERT WITH CHECK (true);
CREATE POLICY "push_update" ON push_subscriptions FOR UPDATE USING (true);
CREATE POLICY "push_delete" ON push_subscriptions FOR DELETE USING (true);
