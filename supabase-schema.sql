-- СӨХ СИСТЕМ - Database Schema
-- Supabase SQL Editor дээр ажиллуулна

-- Оршин суугчдын хүснэгт
CREATE TABLE residents (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  apartment TEXT NOT NULL,
  phone TEXT,
  debt NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Төлбөрийн хүснэгт (ирээдүйд хэрэглэнэ)
CREATE TABLE payments (
  id BIGSERIAL PRIMARY KEY,
  resident_id BIGINT REFERENCES residents(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  description TEXT,
  paid_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security идэвхжүүлэх
ALTER TABLE residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Бүгдэд уншиж, бичих эрх (одоохондоо auth-гүй тул)
CREATE POLICY "Allow all access to residents" ON residents
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access to payments" ON payments
  FOR ALL USING (true) WITH CHECK (true);

-- Жишээ өгөгдөл
INSERT INTO residents (name, apartment, phone, debt) VALUES
  ('Бат', 'A-101', '99001122', 120000),
  ('Сараа', 'B-203', '88112233', 0),
  ('Болд', 'A-305', '95443322', 85000);
