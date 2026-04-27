-- ============================================
-- Санхүүгийн системийн migration
-- Supabase SQL Editor дотор ажиллуулна
-- ============================================

-- 1. Нэхэмжлэх (invoice) хүснэгт
CREATE TABLE IF NOT EXISTS invoices (
  id BIGSERIAL PRIMARY KEY,
  sokh_id BIGINT NOT NULL REFERENCES sokh_organizations(id) ON DELETE CASCADE,
  resident_id BIGINT NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  year INT NOT NULL,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  amount NUMERIC NOT NULL,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'partial')),
  paid_amount NUMERIC DEFAULT 0,
  paid_at TIMESTAMPTZ,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (resident_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_invoices_sokh ON invoices(sokh_id, year, month);
CREATE INDEX IF NOT EXISTS idx_invoices_resident ON invoices(resident_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "invoices_select" ON invoices;
DROP POLICY IF EXISTS "invoices_all" ON invoices;
CREATE POLICY "invoices_select" ON invoices FOR SELECT USING (true);
CREATE POLICY "invoices_all" ON invoices FOR ALL USING (true) WITH CHECK (true);

-- 2. Нөөц сан (reserve fund) хүснэгт
CREATE TABLE IF NOT EXISTS reserve_fund (
  id BIGSERIAL PRIMARY KEY,
  sokh_id BIGINT NOT NULL REFERENCES sokh_organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal')),
  amount NUMERIC NOT NULL,
  description TEXT,
  occurred_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reserve_fund_sokh ON reserve_fund(sokh_id, occurred_at DESC);

ALTER TABLE reserve_fund ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reserve_fund_select" ON reserve_fund;
DROP POLICY IF EXISTS "reserve_fund_all" ON reserve_fund;
CREATE POLICY "reserve_fund_select" ON reserve_fund FOR SELECT USING (true);
CREATE POLICY "reserve_fund_all" ON reserve_fund FOR ALL USING (true) WITH CHECK (true);

-- 3. Төсөв план (budget plans)
CREATE TABLE IF NOT EXISTS budget_plans (
  id BIGSERIAL PRIMARY KEY,
  sokh_id BIGINT NOT NULL REFERENCES sokh_organizations(id) ON DELETE CASCADE,
  year INT NOT NULL,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  category TEXT NOT NULL,
  planned_amount NUMERIC NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (sokh_id, year, month, category)
);

CREATE INDEX IF NOT EXISTS idx_budget_plans_sokh ON budget_plans(sokh_id, year, month);

ALTER TABLE budget_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "budget_plans_select" ON budget_plans;
DROP POLICY IF EXISTS "budget_plans_all" ON budget_plans;
CREATE POLICY "budget_plans_select" ON budget_plans FOR SELECT USING (true);
CREATE POLICY "budget_plans_all" ON budget_plans FOR ALL USING (true) WITH CHECK (true);

-- 4. monthly_fee хэдийн нэмэгдсэн ч баталгаажуулна
ALTER TABLE sokh_organizations ADD COLUMN IF NOT EXISTS monthly_fee NUMERIC DEFAULT 50000;

-- ============================================
-- Туршилт: үндсэн өгөгдөл оруулах (заавал биш)
-- ============================================
-- INSERT INTO budget_plans (sokh_id, year, month, category, planned_amount) VALUES
--   (1, 2026, 4, 'cleaning', 500000),
--   (1, 2026, 4, 'elevator', 300000),
--   (1, 2026, 4, 'security', 800000);
