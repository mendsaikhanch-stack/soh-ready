-- Performance indexes for hot foreign-key columns
-- Дансан шинжилгээгээр илрүүлсэн index дутуу хүснэгтүүд (sokh_id / resident_id-ээр шүүгддэг)
-- Үлгэр: CREATE INDEX CONCURRENTLY-ыг production DB-д ажиллуулна (lock-гүй)
-- Supabase SQL Editor-д CONCURRENTLY ажиллахгүй (transaction дотор) тул
-- production-д psql-ээр ажиллуулна, эсвэл "Run query" дотор удаашрахгүй учир CONCURRENTLY-гүйгээр ажиллуулж болно (хүснэгт хоосон/жижиг бол).

-- ===== sokh_id индексүүд =====
CREATE INDEX IF NOT EXISTS idx_residents_sokh_id              ON residents(sokh_id);
CREATE INDEX IF NOT EXISTS idx_announcements_sokh_id          ON announcements(sokh_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_sokh_id   ON maintenance_requests(sokh_id);
CREATE INDEX IF NOT EXISTS idx_polls_sokh_id                  ON polls(sokh_id);
CREATE INDEX IF NOT EXISTS idx_messages_sokh_id               ON messages(sokh_id);
CREATE INDEX IF NOT EXISTS idx_complaints_sokh_id             ON complaints(sokh_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sokh_id          ON chat_messages(sokh_id);
CREATE INDEX IF NOT EXISTS idx_emergency_alerts_sokh_id       ON emergency_alerts(sokh_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_sokh_id   ON marketplace_listings(sokh_id);
CREATE INDEX IF NOT EXISTS idx_staff_sokh_id                  ON staff(sokh_id);
CREATE INDEX IF NOT EXISTS idx_local_shops_sokh_id            ON local_shops(sokh_id);
CREATE INDEX IF NOT EXISTS idx_vending_machines_sokh_id       ON vending_machines(sokh_id);
CREATE INDEX IF NOT EXISTS idx_packages_sokh_id               ON packages(sokh_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_sokh_id ON scheduled_notifications(sokh_id);
CREATE INDEX IF NOT EXISTS idx_budget_items_sokh_id           ON budget_items(sokh_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_sokh_id     ON push_subscriptions(sokh_id);
CREATE INDEX IF NOT EXISTS idx_utility_usage_sokh_id          ON utility_usage(sokh_id);
CREATE INDEX IF NOT EXISTS idx_utility_bills_sokh_id          ON utility_bills(sokh_id);
CREATE INDEX IF NOT EXISTS idx_meter_readings_sokh_id         ON meter_readings(sokh_id);
CREATE INDEX IF NOT EXISTS idx_billing_items_sokh_id          ON billing_items(sokh_id);
CREATE INDEX IF NOT EXISTS idx_resident_bills_sokh_id         ON resident_bills(sokh_id);
CREATE INDEX IF NOT EXISTS idx_parking_vehicles_sokh_id       ON parking_vehicles(sokh_id);

-- ===== resident_id индексүүд =====
CREATE INDEX IF NOT EXISTS idx_payments_resident_id           ON payments(resident_id);
CREATE INDEX IF NOT EXISTS idx_utility_bills_resident_id      ON utility_bills(resident_id);
CREATE INDEX IF NOT EXISTS idx_meter_readings_resident_id     ON meter_readings(resident_id);
CREATE INDEX IF NOT EXISTS idx_resident_bills_resident_id     ON resident_bills(resident_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_resident_id         ON poll_votes(resident_id);

-- ===== Хослуулсан / commonly filtered =====
CREATE INDEX IF NOT EXISTS idx_residents_phone                ON residents(phone);
CREATE INDEX IF NOT EXISTS idx_announcements_sokh_created     ON announcements(sokh_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_sokh_created              ON chat_messages(sokh_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_utility_bills_resident_period  ON utility_bills(resident_id, year, month);
CREATE INDEX IF NOT EXISTS idx_maintenance_sokh_status        ON maintenance_requests(sokh_id, status);
CREATE INDEX IF NOT EXISTS idx_complaints_sokh_status         ON complaints(sokh_id, status);
