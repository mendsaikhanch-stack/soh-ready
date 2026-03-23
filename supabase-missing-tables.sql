-- ============================================
-- Тоот App: Дутуу table-ууд үүсгэх
-- Бүгдийг IF NOT EXISTS ашиглана
-- ============================================

-- complaints (Гомдол/Санал)
CREATE TABLE IF NOT EXISTS complaints (
  id BIGSERIAL PRIMARY KEY,
  sokh_id BIGINT REFERENCES sokh_organizations(id) ON DELETE CASCADE,
  category TEXT DEFAULT 'complaint',
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',
  admin_reply TEXT,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;

-- chat_messages (Хөрш чат)
CREATE TABLE IF NOT EXISTS chat_messages (
  id BIGSERIAL PRIMARY KEY,
  sokh_id BIGINT REFERENCES sokh_organizations(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- emergency_alerts (Яаралтай мэдэгдэл)
CREATE TABLE IF NOT EXISTS emergency_alerts (
  id BIGSERIAL PRIMARY KEY,
  sokh_id BIGINT REFERENCES sokh_organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE emergency_alerts ENABLE ROW LEVEL SECURITY;

-- marketplace_listings (Хөрш маркет)
CREATE TABLE IF NOT EXISTS marketplace_listings (
  id BIGSERIAL PRIMARY KEY,
  sokh_id BIGINT REFERENCES sokh_organizations(id) ON DELETE CASCADE,
  seller_name TEXT,
  seller_unit TEXT,
  phone TEXT,
  title TEXT NOT NULL,
  description TEXT,
  price NUMERIC DEFAULT 0,
  category TEXT DEFAULT 'other',
  listing_type TEXT DEFAULT 'sell',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE marketplace_listings ENABLE ROW LEVEL SECURITY;

-- common_spaces (Нийтийн зай)
CREATE TABLE IF NOT EXISTS common_spaces (
  id BIGSERIAL PRIMARY KEY,
  sokh_id BIGINT REFERENCES sokh_organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'other',
  capacity INT DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE common_spaces ENABLE ROW LEVEL SECURITY;

-- space_bookings (Зай захиалга)
CREATE TABLE IF NOT EXISTS space_bookings (
  id BIGSERIAL PRIMARY KEY,
  sokh_id BIGINT REFERENCES sokh_organizations(id) ON DELETE CASCADE,
  space_id BIGINT REFERENCES common_spaces(id) ON DELETE CASCADE,
  resident_name TEXT,
  unit_number TEXT,
  date DATE NOT NULL,
  start_time TEXT,
  end_time TEXT,
  status TEXT DEFAULT 'confirmed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE space_bookings ENABLE ROW LEVEL SECURITY;

-- staff (Ажилчид)
CREATE TABLE IF NOT EXISTS staff (
  id BIGSERIAL PRIMARY KEY,
  sokh_id BIGINT REFERENCES sokh_organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'worker',
  phone TEXT,
  schedule TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

-- local_shops (Дэлгүүр)
CREATE TABLE IF NOT EXISTS local_shops (
  id BIGSERIAL PRIMARY KEY,
  sokh_id BIGINT REFERENCES sokh_organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'shop',
  location TEXT,
  phone TEXT,
  hours TEXT,
  description TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE local_shops ENABLE ROW LEVEL SECURITY;

-- vending_machines (Автомат)
CREATE TABLE IF NOT EXISTS vending_machines (
  id BIGSERIAL PRIMARY KEY,
  sokh_id BIGINT REFERENCES sokh_organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'drink',
  location TEXT,
  status TEXT DEFAULT 'active',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE vending_machines ENABLE ROW LEVEL SECURITY;

-- utility_usage (Ашиглалт)
CREATE TABLE IF NOT EXISTS utility_usage (
  id BIGSERIAL PRIMARY KEY,
  sokh_id BIGINT REFERENCES sokh_organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount NUMERIC DEFAULT 0,
  cost NUMERIC DEFAULT 0,
  month INT NOT NULL,
  year INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE utility_usage ENABLE ROW LEVEL SECURITY;

-- packages (Илгээмж)
CREATE TABLE IF NOT EXISTS packages (
  id BIGSERIAL PRIMARY KEY,
  sokh_id BIGINT REFERENCES sokh_organizations(id) ON DELETE CASCADE,
  resident_name TEXT,
  unit_number TEXT,
  carrier TEXT,
  description TEXT,
  pickup_code TEXT,
  status TEXT DEFAULT 'delivered',
  delivered_at TIMESTAMPTZ DEFAULT NOW(),
  picked_up_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;

-- point_activities (Оноо)
CREATE TABLE IF NOT EXISTS point_activities (
  id BIGSERIAL PRIMARY KEY,
  sokh_id BIGINT REFERENCES sokh_organizations(id) ON DELETE CASCADE,
  resident_name TEXT,
  action TEXT NOT NULL,
  points INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE point_activities ENABLE ROW LEVEL SECURITY;

-- scheduled_notifications (Товлосон мэдэгдэл)
CREATE TABLE IF NOT EXISTS scheduled_notifications (
  id BIGSERIAL PRIMARY KEY,
  sokh_id BIGINT REFERENCES sokh_organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  type TEXT DEFAULT 'custom',
  target TEXT DEFAULT 'all',
  status TEXT DEFAULT 'pending',
  scheduled_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE scheduled_notifications ENABLE ROW LEVEL SECURITY;

-- budget_items (Санхүүгийн зүйлс)
CREATE TABLE IF NOT EXISTS budget_items (
  id BIGSERIAL PRIMARY KEY,
  sokh_id BIGINT REFERENCES sokh_organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'expense',
  amount NUMERIC DEFAULT 0,
  month INT,
  year INT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE budget_items ENABLE ROW LEVEL SECURITY;

-- poll_votes (Санал хураалтын дуу хоолой)
CREATE TABLE IF NOT EXISTS poll_votes (
  id BIGSERIAL PRIMARY KEY,
  poll_id BIGINT REFERENCES polls(id) ON DELETE CASCADE,
  resident_id BIGINT,
  vote TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;

-- sokh_organizations-д monthly_fee column нэмэх
ALTER TABLE sokh_organizations ADD COLUMN IF NOT EXISTS monthly_fee NUMERIC DEFAULT 50000;

-- payments table-д created_at column нэмэх (хэрэв paid_at-тай бол)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================
-- ДУУСАВ! Дараа нь RLS migration ажиллуулна.
-- ============================================
