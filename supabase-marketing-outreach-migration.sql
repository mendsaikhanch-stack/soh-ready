-- ============================================
-- Маркетинг / Outreach migration
-- "Хотол" платформын дотоод Facebook group posting tracker.
--
-- Зорилго: Google Sheets-гүйгээр Facebook группүүдэд гар аргаар
-- (хагас автомат) пост түгээх ажлыг удирдах — группүүд, ротаци,
-- caption, cooldown, лид, дагалт.
--
-- Энэ нь ПЛАТФОРМЫН ТҮВШНИЙ хүснэгтүүд (sokh_id-гүй) — Khotol өөрөө
-- шинэ СӨХ-ийг татах маркетингийн өгөгдөл. Зөвхөн service_role-аар
-- (/api/admin/marketing/* proxy) хандана.
--
-- Supabase SQL Editor дотор ажиллуулна.
-- ============================================

-- 1. Facebook группүүд
CREATE TABLE IF NOT EXISTS marketing_fb_groups (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  -- group_type: hoa_mgmt (СӨХ удирдлага) / resident (оршин суугч) /
  --             apartment (тодорхой байр/хороолол) / general (ерөнхий)
  group_type TEXT NOT NULL DEFAULT 'general'
    CHECK (group_type IN ('hoa_mgmt', 'resident', 'apartment', 'general')),
  priority TEXT NOT NULL DEFAULT 'B' CHECK (priority IN ('A', 'B', 'C')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'banned')),
  member_count INT,
  last_posted_at TIMESTAMPTZ,
  next_allowed_at TIMESTAMPTZ,
  posts_count INT NOT NULL DEFAULT 0,
  leads_count INT NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mkt_groups_status ON marketing_fb_groups(status);
CREATE INDEX IF NOT EXISTS idx_mkt_groups_type ON marketing_fb_groups(group_type);
CREATE INDEX IF NOT EXISTS idx_mkt_groups_priority ON marketing_fb_groups(priority);
CREATE INDEX IF NOT EXISTS idx_mkt_groups_next_allowed ON marketing_fb_groups(next_allowed_at);

ALTER TABLE marketing_fb_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny_all_mkt_groups" ON marketing_fb_groups;
CREATE POLICY "deny_all_mkt_groups" ON marketing_fb_groups
  FOR ALL USING (false) WITH CHECK (false);

-- 2. Кампанит ажил (үндсэн пост текст)
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  main_text TEXT NOT NULL,
  link_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mkt_campaigns_status ON marketing_campaigns(status, created_at DESC);

ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny_all_mkt_campaigns" ON marketing_campaigns;
CREATE POLICY "deny_all_mkt_campaigns" ON marketing_campaigns
  FOR ALL USING (false) WITH CHECK (false);

-- 3. Өдрийн постын дараалал (queue)
CREATE TABLE IF NOT EXISTS marketing_queue_items (
  id BIGSERIAL PRIMARY KEY,
  campaign_id BIGINT NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
  group_id BIGINT NOT NULL REFERENCES marketing_fb_groups(id) ON DELETE CASCADE,
  queue_date DATE NOT NULL,
  caption TEXT NOT NULL,
  -- status: queued / posted / pending_approval / rejected / lead
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'posted', 'pending_approval', 'rejected', 'lead')),
  ai_enhanced BOOLEAN NOT NULL DEFAULT FALSE,
  posted_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (queue_date, campaign_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_mkt_queue_date ON marketing_queue_items(queue_date, status);
CREATE INDEX IF NOT EXISTS idx_mkt_queue_group ON marketing_queue_items(group_id);
CREATE INDEX IF NOT EXISTS idx_mkt_queue_campaign ON marketing_queue_items(campaign_id);

ALTER TABLE marketing_queue_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny_all_mkt_queue" ON marketing_queue_items;
CREATE POLICY "deny_all_mkt_queue" ON marketing_queue_items
  FOR ALL USING (false) WITH CHECK (false);

-- 4. Постын лог (постолсон бүртгэл)
CREATE TABLE IF NOT EXISTS marketing_posting_logs (
  id BIGSERIAL PRIMARY KEY,
  group_id BIGINT REFERENCES marketing_fb_groups(id) ON DELETE SET NULL,
  campaign_id BIGINT REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
  queue_item_id BIGINT REFERENCES marketing_queue_items(id) ON DELETE SET NULL,
  caption TEXT,
  posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mkt_logs_group ON marketing_posting_logs(group_id);
CREATE INDEX IF NOT EXISTS idx_mkt_logs_posted ON marketing_posting_logs(posted_at DESC);

ALTER TABLE marketing_posting_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny_all_mkt_logs" ON marketing_posting_logs;
CREATE POLICY "deny_all_mkt_logs" ON marketing_posting_logs
  FOR ALL USING (false) WITH CHECK (false);

-- 5. Лидүүд (группээс ирсэн сонирхогчид)
CREATE TABLE IF NOT EXISTS marketing_leads (
  id BIGSERIAL PRIMARY KEY,
  group_id BIGINT REFERENCES marketing_fb_groups(id) ON DELETE SET NULL,
  campaign_id BIGINT REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
  queue_item_id BIGINT REFERENCES marketing_queue_items(id) ON DELETE SET NULL,
  name TEXT,
  contact TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'converted', 'lost')),
  follow_up_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mkt_leads_status ON marketing_leads(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mkt_leads_group ON marketing_leads(group_id);

ALTER TABLE marketing_leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny_all_mkt_leads" ON marketing_leads;
CREATE POLICY "deny_all_mkt_leads" ON marketing_leads
  FOR ALL USING (false) WITH CHECK (false);

-- 6. updated_at автоматаар шинэчлэх trigger
CREATE OR REPLACE FUNCTION set_updated_at_marketing() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mkt_groups_updated ON marketing_fb_groups;
CREATE TRIGGER trg_mkt_groups_updated BEFORE UPDATE ON marketing_fb_groups
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_marketing();

DROP TRIGGER IF EXISTS trg_mkt_campaigns_updated ON marketing_campaigns;
CREATE TRIGGER trg_mkt_campaigns_updated BEFORE UPDATE ON marketing_campaigns
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_marketing();

DROP TRIGGER IF EXISTS trg_mkt_queue_updated ON marketing_queue_items;
CREATE TRIGGER trg_mkt_queue_updated BEFORE UPDATE ON marketing_queue_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_marketing();

DROP TRIGGER IF EXISTS trg_mkt_leads_updated ON marketing_leads;
CREATE TRIGGER trg_mkt_leads_updated BEFORE UPDATE ON marketing_leads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_marketing();
