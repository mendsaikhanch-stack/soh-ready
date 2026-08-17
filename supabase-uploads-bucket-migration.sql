-- "uploads" storage bucket — засварын ажлын зураг
--
-- Алдаа: /admin/maintenance дээр зураг хавсаргахад «Bucket not found».
-- Шалтгаан: `uploads` bucket-ийг гараар үүсгэх ёстой байсныг (supabase-maintenance-image.sql
-- дотор зөвхөн ТАЙЛБАР болгон бичсэн) хийгээгүй өнгөрсөн.
--
-- Энэ bucket-ийг 2 газар ашигладаг:
--   app/admin/maintenance/page.tsx          → maintenance-works/<sokh_id>/...  (дарга нийтэлдэг)
--   app/(mobile)/sokh/[id]/maintenance/...  → maintenance/<sokh_id>/...        (оршин суугчийн хүсэлт)
--
-- ⚠️ Bucket-ийг өөрийг нь 2026-08-17-нд Storage API-гаар үүсгэсэн (public,
--    10MB, зөвхөн зургийн MIME). Энэ файл нь ЗӨВХӨН policy-г үүсгэнэ —
--    policy бол DDL тул Supabase SQL Editor-т ГАРААР ажиллуулна.
--
-- Bucket дахин үүсгэх шаардлагатай бол дараах мөрийг тайлбараас гарга:
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES ('uploads', 'uploads', true, 10485760,
--         ARRAY['image/jpeg','image/png','image/webp','image/heic'])
-- ON CONFLICT (id) DO NOTHING;

-- 1) Нийтэд харагдана (зураг нь public URL-ээр ачаалагддаг)
DROP POLICY IF EXISTS "Public uploads read" ON storage.objects;
CREATE POLICY "Public uploads read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'uploads');

-- 2) Хуулах эрх.
--    ЖИЧ: `TO authenticated` гэж БОЛОХГҮЙ. СӨХ-ийн дарга нь admin_users
--    хүснэгтээр (bcrypt) нэвтэрдэг болохоос Supabase Auth хэрэглэгч БИШ тул
--    даргын хуудсан дээрх client нь anon хэвээр байдаг. `logos` bucket ч
--    яг ийм тохиргоотой (supabase-branding-migration.sql).
--    Хамгаалалт нь bucket-ийн өөрийн хязгаар: зөвхөн зураг, дээд тал нь 10MB.
DROP POLICY IF EXISTS "Anyone can upload to uploads" ON storage.objects;
CREATE POLICY "Anyone can upload to uploads"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'uploads');

-- UPDATE / DELETE policy ЗОРИУДААР үүсгээгүй: апп хэзээ ч файл устгадаггүй,
-- бичих эрхийг anon-д нээсэн тул устгах эрхийг нээвэл хэн ч бүх СӨХ-ийн
-- зургийг устгаж чадна. Хэрэгцээ гарвал тухайн үед нь нэмнэ.

-- Шалгах:
--   SELECT id, public, file_size_limit FROM storage.buckets WHERE id = 'uploads';
--   SELECT policyname, cmd FROM pg_policies
--    WHERE schemaname='storage' AND tablename='objects' AND policyname ILIKE '%upload%';
