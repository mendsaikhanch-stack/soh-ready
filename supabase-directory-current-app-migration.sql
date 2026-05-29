-- ============================================
-- hoa_directory: "одоо ашиглаж байгаа апп" багана нэмэх
--
-- Тухайн СӨХ одоо ямар платформ/арга ашиглаж байгааг тэмдэглэнэ:
--   KHOTOL  = Хотол
--   OTHER   = Бусад апп
--   MANUAL  = Цаасан / гар аргаар
--   UNKNOWN = Мэдэгдэхгүй (анхдагч)
--
-- Supabase SQL Editor дотор ажиллуулна
-- ============================================

ALTER TABLE hoa_directory
  ADD COLUMN IF NOT EXISTS current_app TEXT NOT NULL DEFAULT 'UNKNOWN'
  CHECK (current_app IN ('KHOTOL', 'OTHER', 'MANUAL', 'UNKNOWN'));

-- Шүүлт хийхэд хурдан байх индекс
CREATE INDEX IF NOT EXISTS idx_hoa_directory_current_app ON hoa_directory(current_app);
