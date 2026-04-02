-- Хот
CREATE TABLE cities (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

-- Дүүрэг
CREATE TABLE districts (
  id BIGSERIAL PRIMARY KEY,
  city_id BIGINT REFERENCES cities(id) ON DELETE CASCADE,
  name TEXT NOT NULL
);

-- Хороо
CREATE TABLE khoroos (
  id BIGSERIAL PRIMARY KEY,
  district_id BIGINT REFERENCES districts(id) ON DELETE CASCADE,
  name TEXT NOT NULL
);

-- СӨХ байгууллага
CREATE TABLE sokh_organizations (
  id BIGSERIAL PRIMARY KEY,
  khoroo_id BIGINT REFERENCES khoroos(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE khoroos ENABLE ROW LEVEL SECURITY;
ALTER TABLE sokh_organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read cities" ON cities FOR SELECT USING (true);
CREATE POLICY "public read districts" ON districts FOR SELECT USING (true);
CREATE POLICY "public read khoroos" ON khoroos FOR SELECT USING (true);
CREATE POLICY "public read sokh" ON sokh_organizations FOR SELECT USING (true);
CREATE POLICY "public insert sokh" ON sokh_organizations FOR INSERT WITH CHECK (true);

-- Хот (Улаанбаатар + Дархан + Эрдэнэт + 19 аймгийн төв)
INSERT INTO cities (name) VALUES
  ('Улаанбаатар'),
  ('Дархан'),
  ('Эрдэнэт'),
  ('Цэцэрлэг'),      -- Архангай
  ('Өлгий'),          -- Баян-Өлгий
  ('Баянхонгор'),     -- Баянхонгор
  ('Булган'),          -- Булган
  ('Алтай'),           -- Говь-Алтай
  ('Чойр'),            -- Говьсүмбэр
  ('Сайншанд'),        -- Дорноговь
  ('Чойбалсан'),       -- Дорнод
  ('Мандалговь'),      -- Дундговь
  ('Улиастай'),        -- Завхан
  ('Арвайхээр'),       -- Өвөрхангай
  ('Даланзадгад'),     -- Өмнөговь
  ('Баруун-Урт'),      -- Сүхбаатар
  ('Сүхбаатар хот'),   -- Сэлэнгэ
  ('Зуунмод'),         -- Төв
  ('Улаангом'),        -- Увс
  ('Ховд'),            -- Ховд
  ('Мөрөн'),           -- Хөвсгөл
  ('Өндөрхаан');       -- Хэнтий

-- Дүүрэг (Улаанбаатар = id 1)
INSERT INTO districts (city_id, name) VALUES
  (1, 'Баянгол'),
  (1, 'Баянзүрх'),
  (1, 'Сүхбаатар'),
  (1, 'Чингэлтэй'),
  (1, 'Хан-Уул'),
  (1, 'Сонгинохайрхан'),
  (1, 'Налайх'),
  (1, 'Багануур'),
  (1, 'Багахангай');

-- Дархан (id 2)
INSERT INTO districts (city_id, name) VALUES (2, 'Дархан'), (2, 'Шарын гол');

-- Эрдэнэт (id 3)
INSERT INTO districts (city_id, name) VALUES (3, 'Эрдэнэт');

-- Хороо (Баянгол = id 1)
INSERT INTO khoroos (district_id, name) VALUES
  (1, '1-р хороо'), (1, '2-р хороо'), (1, '3-р хороо'), (1, '4-р хороо'), (1, '5-р хороо'),
  (1, '6-р хороо'), (1, '7-р хороо'), (1, '8-р хороо'), (1, '9-р хороо'), (1, '10-р хороо');

-- Хороо (Баянзүрх = id 2)
INSERT INTO khoroos (district_id, name) VALUES
  (2, '1-р хороо'), (2, '2-р хороо'), (2, '3-р хороо'), (2, '4-р хороо'), (2, '5-р хороо');

-- Хороо (Сүхбаатар = id 3)
INSERT INTO khoroos (district_id, name) VALUES
  (3, '1-р хороо'), (3, '2-р хороо'), (3, '3-р хороо'), (3, '4-р хороо'), (3, '5-р хороо');

-- Хороо (Чингэлтэй = id 4)
INSERT INTO khoroos (district_id, name) VALUES
  (4, '1-р хороо'), (4, '2-р хороо'), (4, '3-р хороо'), (4, '4-р хороо'), (4, '5-р хороо');

-- Хороо (Хан-Уул = id 5)
INSERT INTO khoroos (district_id, name) VALUES
  (5, '1-р хороо'), (5, '2-р хороо'), (5, '3-р хороо'), (5, '4-р хороо'), (5, '5-р хороо');

-- Жишээ СӨХ-үүд (Баянгол, 1-р хороо = khoroo id 1)
INSERT INTO sokh_organizations (khoroo_id, name, address, phone) VALUES
  (1, 'Нарантуул СӨХ', 'Баянгол, 1-р хороо, 15-р байр', '77001122'),
  (1, 'Од СӨХ', 'Баянгол, 1-р хороо, 25-р байр', '77003344'),
  (2, 'Алтан гадас СӨХ', 'Баянгол, 2-р хороо, 3-р байр', '77005566'),
  (3, 'Номин СӨХ', 'Баянгол, 3-р хороо, 40-р байр', '77007788'),
  (11, 'Баянзүрх СӨХ-1', 'Баянзүрх, 1-р хороо, 5-р байр', '88001122'),
  (16, 'Сүхбаатар СӨХ-1', 'Сүхбаатар, 1-р хороо, 10-р байр', '99001122');
