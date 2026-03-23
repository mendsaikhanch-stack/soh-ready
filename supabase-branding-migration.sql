-- СӨХ Branding: logo + theme support
-- Run this in Supabase SQL Editor

-- 1. Add branding columns to sokh_organizations
ALTER TABLE sokh_organizations
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'classic';

-- 2. Create storage bucket for logos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'logos',
  'logos',
  true,
  2097152, -- 2MB
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage policies - anyone can view, authenticated can upload
CREATE POLICY "Public logo access"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'logos');

CREATE POLICY "Auth users upload logos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'logos');

CREATE POLICY "Auth users update logos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'logos');

CREATE POLICY "Auth users delete logos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'logos');
