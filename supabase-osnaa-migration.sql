-- ОСНААК (Ус, Дулаан, Цахилгаан) админ хэсгийн DB migration
-- Supabase SQL Editor дээр ажиллуулна

-- 1. Тариф/Үнэ — ОСНААК-аас тогтоосон тариф
CREATE TABLE IF NOT EXISTS utility_tariffs (
  id BIGSERIAL PRIMARY KEY,
  sokh_id BIGINT REFERENCES sokh_organizations(id),
  utility_type TEXT NOT NULL,        -- water, heating, electricity
  rate_per_unit NUMERIC NOT NULL,    -- нэгж үнэ (₮/м³, ₮/Гкал, ₮/кВт)
  unit TEXT NOT NULL,                -- м³, Гкал, кВт/ц
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE utility_tariffs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all utility_tariffs" ON utility_tariffs FOR ALL USING (true) WITH CHECK (true);

-- 2. Тоолуурын заалт — айл тус бүрийн сарын заалт
CREATE TABLE IF NOT EXISTS meter_readings (
  id BIGSERIAL PRIMARY KEY,
  sokh_id BIGINT REFERENCES sokh_organizations(id),
  resident_id BIGINT REFERENCES residents(id),
  apartment TEXT NOT NULL,
  utility_type TEXT NOT NULL,        -- water, heating, electricity
  previous_reading NUMERIC DEFAULT 0,
  current_reading NUMERIC NOT NULL,
  consumption NUMERIC GENERATED ALWAYS AS (current_reading - COALESCE(previous_reading, 0)) STORED,
  year INT NOT NULL,
  month INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(resident_id, utility_type, year, month)
);
ALTER TABLE meter_readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all meter_readings" ON meter_readings FOR ALL USING (true) WITH CHECK (true);

-- 3. Коммуналын нэхэмжлэх — ОСНААК-аас үүсгэсэн сарын нэхэмжлэх
CREATE TABLE IF NOT EXISTS utility_bills (
  id BIGSERIAL PRIMARY KEY,
  sokh_id BIGINT REFERENCES sokh_organizations(id),
  resident_id BIGINT REFERENCES residents(id),
  apartment TEXT NOT NULL,
  utility_type TEXT NOT NULL,
  year INT NOT NULL,
  month INT NOT NULL,
  consumption NUMERIC,               -- хэрэглээ
  rate NUMERIC,                       -- тухайн үеийн тариф
  amount NUMERIC NOT NULL,            -- нийт дүн
  status TEXT DEFAULT 'unpaid',       -- unpaid, paid, overdue
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(resident_id, utility_type, year, month)
);
ALTER TABLE utility_bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all utility_bills" ON utility_bills FOR ALL USING (true) WITH CHECK (true);
