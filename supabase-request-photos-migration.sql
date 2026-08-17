-- Засварын хүсэлтэд ОЛОН зураг хавсаргах (4 хүртэл)
--
-- Өмнө нь `maintenance_requests.image_url` нь ганц зураг л авдаг байсан.
-- Оршин суугч эвдрэлээ 1 өнцгөөс л үзүүлэх боломжтой байв.
--
-- `maintenance_works.photos`-той ижил хэлбэр (TEXT[]) — 2 хүснэгт нэг загвартай.
--
-- ЖИЧ: `image_url` багана DB-д ХЭЗЭЭ Ч үүсээгүй байсан (supabase-maintenance-image.sql
-- ажиллаагүй) тул хадгалах хуучин зураг байхгүй. Апп зөвхөн `photos`-ыг уншина.

ALTER TABLE maintenance_requests
  ADD COLUMN IF NOT EXISTS photos TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN maintenance_requests.photos IS
  'Хавсаргасан зургийн public URL-ууд (uploads bucket). Хоосон бол image_url-ыг үз.';

COMMENT ON COLUMN maintenance_requests.image_url IS
  'ХУУЧИРСАН — ганц зураг авдаг байсан үеийн багана. Шинэ мөр photos-ыг хэрэглэнэ.';

-- Шалгах:
--   SELECT column_name, data_type FROM information_schema.columns
--    WHERE table_name = 'maintenance_requests' AND column_name IN ('photos','image_url');
