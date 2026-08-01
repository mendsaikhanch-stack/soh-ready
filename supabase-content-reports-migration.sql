-- ============================================================
-- content_reports — Хөрш чат / Хөрш маркет дээрх зөрчлийг мэдээлэх
--
-- Яагаад: Google Play-ийн User Generated Content бодлого нь оршин суугчид
-- бие биедээ контент нийтэлдэг апп-д "мэдээлэх" (report) механизм байхыг
-- шаарддаг. Мөн IARC асуулгад "report хийх боломжтой юу?" гэсэн асуулт бий.
--
-- Ажиллуулах: Supabase → SQL Editor-т ГАРААР copy-paste хийж ажиллуулна.
-- ============================================================

CREATE TABLE IF NOT EXISTS content_reports (
  id BIGSERIAL PRIMARY KEY,
  sokh_id BIGINT REFERENCES sokh_organizations(id) ON DELETE CASCADE,

  -- Ямар контент дээр мэдээлсэн бэ
  content_type TEXT NOT NULL CHECK (content_type IN ('chat', 'marketplace')),
  content_id BIGINT NOT NULL,

  -- Мэдээлэх үеийн хуулбар — эх контент устсан ч админ юу болсныг харна
  content_snapshot TEXT,
  content_author TEXT,

  reason TEXT NOT NULL,
  note TEXT,
  reporter_name TEXT,

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'removed', 'dismissed')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_content_reports_sokh_status
  ON content_reports(sokh_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_reports_content
  ON content_reports(content_type, content_id);

ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY;

-- Оршин суугч зөвхөн МЭДЭЭЛЖ чадна (insert).
-- Уншиж/засах эрх байхгүй — өөр хүний мэдээлэл харагдахгүй.
-- Админ нь /api/admin/db (service_role) дамжуулан уншиж, шийдвэрлэнэ.
DROP POLICY IF EXISTS "content_reports_insert_authenticated" ON content_reports;
CREATE POLICY "content_reports_insert_authenticated" ON content_reports
  FOR INSERT TO authenticated
  WITH CHECK (true);
