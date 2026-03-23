-- ============================================
-- Тоот App: v3 Migration
-- Шинэ table-ууд + admin config
-- ============================================

-- 1. Зогсоолын машинууд (parking_vehicles)
CREATE TABLE IF NOT EXISTS parking_vehicles (
  id BIGSERIAL PRIMARY KEY,
  sokh_id BIGINT REFERENCES sokh_organizations(id),
  plate_number TEXT NOT NULL,
  car_model TEXT,
  color TEXT,
  resident_name TEXT,
  apartment TEXT,
  parking_spot TEXT,
  status TEXT DEFAULT 'active', -- active, removed
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE parking_vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all parking_vehicles" ON parking_vehicles FOR ALL USING (true) WITH CHECK (true);

-- 2. Зогсоол хаагдсан мэдэгдэл (blocking_reports)
CREATE TABLE IF NOT EXISTS blocking_reports (
  id BIGSERIAL PRIMARY KEY,
  sokh_id BIGINT REFERENCES sokh_organizations(id),
  blocked_plate TEXT NOT NULL,
  blocking_plate TEXT,
  reporter_name TEXT,
  reporter_apartment TEXT,
  status TEXT DEFAULT 'pending', -- pending, notified, resolved
  resolved_at TIMESTAMPTZ,
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE blocking_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all blocking_reports" ON blocking_reports FOR ALL USING (true) WITH CHECK (true);

-- 3. Камер бичлэг хүсэлт (cctv_requests)
CREATE TABLE IF NOT EXISTS cctv_requests (
  id BIGSERIAL PRIMARY KEY,
  sokh_id BIGINT REFERENCES sokh_organizations(id),
  resident_name TEXT NOT NULL,
  apartment TEXT NOT NULL,
  phone TEXT,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT,
  date_from DATE,
  date_to DATE,
  status TEXT DEFAULT 'pending', -- pending, reviewing, approved, rejected
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE cctv_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all cctv_requests" ON cctv_requests FOR ALL USING (true) WITH CHECK (true);

-- 4. Төлбөрийн нэр төрөл (billing_items) - СӨХ тус бүрийн сарын төлбөрүүд
CREATE TABLE IF NOT EXISTS billing_items (
  id BIGSERIAL PRIMARY KEY,
  sokh_id BIGINT REFERENCES sokh_organizations(id),
  name TEXT NOT NULL,
  icon TEXT DEFAULT '💰',
  amount NUMERIC DEFAULT 0,
  category TEXT DEFAULT 'utility', -- utility, service, other
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE billing_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all billing_items" ON billing_items FOR ALL USING (true) WITH CHECK (true);

-- 5. Оршин суугчийн төлбөр тус бүрийн төлөв (resident_bills) - сар бүрийн төлбөр төлсөн эсэх
CREATE TABLE IF NOT EXISTS resident_bills (
  id BIGSERIAL PRIMARY KEY,
  sokh_id BIGINT REFERENCES sokh_organizations(id),
  resident_id BIGINT REFERENCES residents(id),
  billing_item_id BIGINT REFERENCES billing_items(id),
  year INT NOT NULL,
  month INT NOT NULL,
  amount NUMERIC DEFAULT 0,
  paid BOOLEAN DEFAULT false,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(resident_id, billing_item_id, year, month)
);
ALTER TABLE resident_bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all resident_bills" ON resident_bills FOR ALL USING (true) WITH CHECK (true);

-- 6. Admin тохиргоо (admin_config) - admin ямар СӨХ-г удирддаг
CREATE TABLE IF NOT EXISTS admin_config (
  id BIGSERIAL PRIMARY KEY,
  admin_username TEXT NOT NULL UNIQUE,
  sokh_id BIGINT REFERENCES sokh_organizations(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE admin_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all admin_config" ON admin_config FOR ALL USING (true) WITH CHECK (true);

-- Анхны admin тохиргоо (sokh_id = 7 байсныг хадгалъя)
INSERT INTO admin_config (admin_username, sokh_id) VALUES ('admin', 7) ON CONFLICT (admin_username) DO NOTHING;

-- Жишээ billing items (sokh_id = 7)
INSERT INTO billing_items (sokh_id, name, icon, amount, category, sort_order) VALUES
  (7, 'СӨХ хураамж', '🏢', 15000, 'service', 1),
  (7, 'Ус', '💧', 8500, 'utility', 2),
  (7, 'Дулаан', '🔥', 35000, 'utility', 3),
  (7, 'Цахилгаан', '⚡', 12000, 'utility', 4),
  (7, 'Ашиглалт', '🔧', 5000, 'service', 5),
  (7, 'Кабелийн ТВ', '📺', 8000, 'service', 6),
  (7, 'Интернет', '🌐', 25000, 'service', 7)
ON CONFLICT DO NOTHING;

-- ============================================
-- ДУУСАВ! Supabase SQL Editor дээр ажиллуулна уу.
-- ============================================
