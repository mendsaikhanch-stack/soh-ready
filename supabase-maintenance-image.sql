-- Засвар хүсэлтэд зураг хавсаргах column нэмэх
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Supabase Storage bucket (uploads) үүсгэх — Dashboard-аас хийх:
-- 1. Storage > New bucket > "uploads" > Public bucket
-- Эсвэл SQL-ээр:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('uploads', 'uploads', true) ON CONFLICT DO NOTHING;
