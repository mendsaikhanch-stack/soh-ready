-- ============================================
-- СӨХ Demo хүсэлт / Судалгаа / Lead CRM migration
-- "Хотол" платформын олон нийтэд нээлттэй demo хүсэлтийн форм (/demo)
-- болон superadmin талын lead/судалгаа/харилцсан тэмдэглэлийн CRM.
--
-- Энэ нь ПЛАТФОРМЫН ТҮВШНИЙ хүснэгтүүд (sokh_id-гүй) — Khotol өөрөө
-- шинэ СӨХ-ийг татах судалгаа/маркетингийн өгөгдөл. Олон нийтийн POST
-- /api/demo-requests болон superadmin /api/mng-ctrl/demo-requests/* нь
-- зөвхөн service_role-аар хандана.
--
-- Supabase SQL Editor дотор ГАР аргаар ажиллуулна.
-- ============================================

-- 1. Demo хүсэлт / lead
CREATE TABLE IF NOT EXISTS public.soh_demo_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Олон нийтийн формоос ирэх мэдээлэл
  soh_name TEXT NOT NULL,
  city TEXT NOT NULL,
  district TEXT NOT NULL,
  khoroo TEXT,
  contact_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  role TEXT,
  household_count INTEGER,
  current_channels TEXT[] NOT NULL DEFAULT '{}',
  main_problems TEXT[] NOT NULL DEFAULT '{}',
  has_facebook_group TEXT,
  has_excel TEXT,
  renter_issue_level TEXT,
  notes TEXT,
  improvement_suggestions TEXT,
  consent BOOLEAN NOT NULL DEFAULT FALSE,

  -- Эх сурвалжийн мэдээлэл
  source_page TEXT,
  referrer TEXT,
  user_agent TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,

  -- CRM талбарууд (зөвхөн superadmin засна)
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'demo_scheduled', 'demo_done',
                      'proposal_sent', 'negotiating', 'won', 'lost', 'later')),
  priority TEXT DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_to TEXT,
  last_contacted_at TIMESTAMPTZ,
  next_follow_up_at TIMESTAMPTZ,
  internal_notes TEXT,
  price_note TEXT,
  lost_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_soh_demo_created ON public.soh_demo_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_soh_demo_status ON public.soh_demo_requests(status);
CREATE INDEX IF NOT EXISTS idx_soh_demo_phone ON public.soh_demo_requests(phone);
CREATE INDEX IF NOT EXISTS idx_soh_demo_location ON public.soh_demo_requests(city, district);
CREATE INDEX IF NOT EXISTS idx_soh_demo_household ON public.soh_demo_requests(household_count);
CREATE INDEX IF NOT EXISTS idx_soh_demo_priority ON public.soh_demo_requests(priority);
CREATE INDEX IF NOT EXISTS idx_soh_demo_follow_up ON public.soh_demo_requests(next_follow_up_at);

ALTER TABLE public.soh_demo_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny_all_soh_demo_requests" ON public.soh_demo_requests;
CREATE POLICY "deny_all_soh_demo_requests" ON public.soh_demo_requests
  FOR ALL USING (false) WITH CHECK (false);

-- 2. Харилцсан тэмдэглэл (interaction notes)
CREATE TABLE IF NOT EXISTS public.soh_demo_request_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.soh_demo_requests(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note TEXT NOT NULL,
  contact_method TEXT
    CHECK (contact_method IS NULL OR contact_method IN
      ('phone', 'messenger', 'email', 'meeting', 'demo', 'other')),
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_soh_demo_notes_request ON public.soh_demo_request_notes(request_id, created_at DESC);

ALTER TABLE public.soh_demo_request_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny_all_soh_demo_request_notes" ON public.soh_demo_request_notes;
CREATE POLICY "deny_all_soh_demo_request_notes" ON public.soh_demo_request_notes
  FOR ALL USING (false) WITH CHECK (false);

-- 3. updated_at автоматаар шинэчлэх trigger
CREATE OR REPLACE FUNCTION set_updated_at_demo() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_soh_demo_updated ON public.soh_demo_requests;
CREATE TRIGGER trg_soh_demo_updated BEFORE UPDATE ON public.soh_demo_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_demo();
