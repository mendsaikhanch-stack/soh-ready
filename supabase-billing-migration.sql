-- ============================================
-- Тоот платформ төлбөрийн систем
-- Багцууд, захиалга, нэхэмжлэл, данс, комисс
-- ============================================

-- 1. Төлбөрийн багцууд
CREATE TABLE IF NOT EXISTS platform_plans (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'fixed_monthly',
  -- types: fixed_monthly, per_apartment, per_transaction, one_time, hybrid
  base_fee NUMERIC DEFAULT 0,
  per_unit_fee NUMERIC DEFAULT 0,
  commission_percent NUMERIC DEFAULT 0,
  billing_cycle TEXT DEFAULT 'monthly', -- monthly, yearly
  features JSONB DEFAULT '[]',
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE platform_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform_plans_all" ON platform_plans FOR ALL USING (true) WITH CHECK (true);

-- 2. СӨХ захиалгууд (аль багц дээр байгаа)
CREATE TABLE IF NOT EXISTS sokh_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  sokh_id BIGINT NOT NULL REFERENCES sokh_organizations(id) ON DELETE CASCADE,
  plan_id BIGINT NOT NULL REFERENCES platform_plans(id),
  status TEXT DEFAULT 'active', -- active, trial, suspended, cancelled
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  custom_pricing JSONB DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sokh_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sokh_subscriptions_all" ON sokh_subscriptions FOR ALL USING (true) WITH CHECK (true);

-- 3. Платформ нэхэмжлэлүүд (сар бүрийн тооцоо)
CREATE TABLE IF NOT EXISTS platform_invoices (
  id BIGSERIAL PRIMARY KEY,
  sokh_id BIGINT NOT NULL REFERENCES sokh_organizations(id) ON DELETE CASCADE,
  subscription_id BIGINT REFERENCES sokh_subscriptions(id),
  period_year INT NOT NULL,
  period_month INT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  calculation_details JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending', -- pending, paid, overdue, cancelled
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  paid_amount NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sokh_id, period_year, period_month)
);

ALTER TABLE platform_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform_invoices_all" ON platform_invoices FOR ALL USING (true) WITH CHECK (true);

-- 4. Платформ дансны мэдээлэл
CREATE TABLE IF NOT EXISTS platform_bank_accounts (
  id BIGSERIAL PRIMARY KEY,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_holder TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE platform_bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform_bank_accounts_all" ON platform_bank_accounts FOR ALL USING (true) WITH CHECK (true);

-- 5. Комисс гүйлгээний бүртгэл
CREATE TABLE IF NOT EXISTS platform_transactions (
  id BIGSERIAL PRIMARY KEY,
  payment_id BIGINT,
  sokh_id BIGINT REFERENCES sokh_organizations(id) ON DELETE SET NULL,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  commission_rate NUMERIC NOT NULL DEFAULT 0,
  commission_amount NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  qpay_order_id TEXT,
  status TEXT DEFAULT 'pending', -- pending, confirmed, settled
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE platform_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform_transactions_all" ON platform_transactions FOR ALL USING (true) WITH CHECK (true);

-- 6. СӨХ зэрэглэл (байршил, байрны чанараас хамаарсан үнийн зэрэглэл)
CREATE TABLE IF NOT EXISTS sokh_tiers (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  per_unit_fee NUMERIC DEFAULT 0,
  description TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sokh_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sokh_tiers_all" ON sokh_tiers FOR ALL USING (true) WITH CHECK (true);

-- sokh_organizations дээр зэрэглэл холбох
ALTER TABLE sokh_organizations ADD COLUMN IF NOT EXISTS tier_id BIGINT REFERENCES sokh_tiers(id);

-- 7. eBarimt тохиргоо (СӨХ, ОСНАА, ЦАХ тус бүрд)
CREATE TABLE IF NOT EXISTS ebarimt_configs (
  id BIGSERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL, -- sokh, osnaa, tsah, platform
  entity_id BIGINT,          -- sokh_organizations.id эсвэл null (platform)
  merchant_tin TEXT NOT NULL,
  pos_no TEXT NOT NULL,
  branch_id TEXT,
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL,
  auth_url TEXT DEFAULT 'https://auth.itc.gov.mn/auth/realms/Production/protocol/openid-connect/token',
  api_url TEXT DEFAULT 'https://api.ebarimt.mn',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entity_type, entity_id)
);

ALTER TABLE ebarimt_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ebarimt_configs_all" ON ebarimt_configs FOR ALL USING (true) WITH CHECK (true);

-- Анхны багцууд оруулах
INSERT INTO platform_plans (name, type, base_fee, per_unit_fee, commission_percent, billing_cycle, features, description, sort_order) VALUES
  ('Үнэгүй', 'fixed_monthly', 0, 0, 0, 'monthly', '["basic"]', '50 хүртэл айлтай СӨХ-д 3 сар үнэгүй', 1),
  ('Стандарт', 'fixed_monthly', 50000, 0, 0, 'monthly', '["basic","qpay","push","reports"]', 'Тогтмол сарын төлбөр', 2),
  ('Айл тутам', 'per_apartment', 0, 500, 0, 'monthly', '["basic","qpay","push","reports"]', 'Айлын тоогоор тооцно', 3),
  ('Комисс', 'per_transaction', 0, 0, 2, 'monthly', '["basic","qpay","push","reports"]', 'QPay гүйлгээний 2% комисс', 4),
  ('Премиум', 'hybrid', 30000, 300, 1.5, 'monthly', '["basic","qpay","push","reports","analytics","priority_support"]', 'Суурь + айл тутам + комисс', 5),
  ('Жилийн', 'one_time', 500000, 0, 0, 'yearly', '["basic","qpay","push","reports","analytics"]', 'Жилийн нэг удаагийн төлбөр', 6)
ON CONFLICT DO NOTHING;
