-- residents хүснэгтэд sokh_id нэмэх
ALTER TABLE residents ADD COLUMN IF NOT EXISTS sokh_id BIGINT REFERENCES sokh_organizations(id) ON DELETE CASCADE;

-- Зарлал
CREATE TABLE IF NOT EXISTS announcements (
  id BIGSERIAL PRIMARY KEY,
  sokh_id BIGINT REFERENCES sokh_organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  type TEXT DEFAULT 'info',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Засвар хүсэлт
CREATE TABLE IF NOT EXISTS maintenance_requests (
  id BIGSERIAL PRIMARY KEY,
  sokh_id BIGINT REFERENCES sokh_organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Санал хураалт
CREATE TABLE IF NOT EXISTS polls (
  id BIGSERIAL PRIMARY KEY,
  sokh_id BIGINT REFERENCES sokh_organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active',
  yes_count INT DEFAULT 0,
  no_count INT DEFAULT 0,
  total_voters INT DEFAULT 0,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Мессеж
CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  sokh_id BIGINT REFERENCES sokh_organizations(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'resident_to_sokh',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read announcements" ON announcements FOR SELECT USING (true);
CREATE POLICY "public read maintenance" ON maintenance_requests FOR SELECT USING (true);
CREATE POLICY "public insert maintenance" ON maintenance_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "public read polls" ON polls FOR SELECT USING (true);
CREATE POLICY "public read messages" ON messages FOR SELECT USING (true);
CREATE POLICY "public insert messages" ON messages FOR INSERT WITH CHECK (true);

-- Жишээ зарлал (sokh_id = 7 = Нарантуул СӨХ)
INSERT INTO announcements (sokh_id, title, content, type) VALUES
(7, 'Цэвэр усны засвар', '2026.03.25-нд 09:00-18:00 цагийн хооронд цэвэр ус хаагдана. Урьдчилж бэлтгэнэ үү.', 'warning'),
(7, 'Хурлын мэдэгдэл', '2026.04.01-нд 19:00 цагт оршин суугчдын хурал болно. Бүгд оролцоно уу.', 'event'),
(7, 'Зогсоолын дүрэм', 'Зогсоолд зөвхөн бүртгэлтэй машин зогсоно. Зөрчвөл торгууль ноогдуулна.', 'info');

-- Жишээ засвар хүсэлт
INSERT INTO maintenance_requests (sokh_id, title, description, status) VALUES
(7, 'Лифт эвдэрсэн', '3-р давхарт зогсоод нээгдэхгүй байна', 'in_progress'),
(7, 'Орцны гэрэл унтарсан', 'A блокийн 2-р давхарын гэрэл асахгүй', 'completed');

-- Жишээ санал хураалт
INSERT INTO polls (sokh_id, title, description, status, yes_count, no_count, total_voters) VALUES
(7, 'Хашаанд камер тавих уу?', 'Аюулгүй байдлын камерын зардлыг хуваах эсэх', 'active', 28, 12, 50);

-- Оршин суугчдыг СӨХ 7-д холбох
UPDATE residents SET sokh_id = 7 WHERE sokh_id IS NULL;
