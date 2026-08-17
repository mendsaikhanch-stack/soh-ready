-- Засвар хүсэлтэд зураг хавсаргах column нэмэх
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Supabase Storage bucket (uploads):
-- ⚠️ Энэ тайлбар нь хийгдээгүй өнгөрч, /admin/maintenance дээр «Bucket not found»
--    алдаа гаргаж байсан. Одоо бүрэн миграц болгосон:
--    → supabase-uploads-bucket-migration.sql (bucket үүссэн, policy-г нь ажиллуулна уу)
