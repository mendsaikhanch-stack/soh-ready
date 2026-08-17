-- Засварын хүсэлтэд ОЛОН зураг хавсаргах (4 хүртэл)
--
-- Өмнө нь `maintenance_requests.image_url` нь ганц зураг л авдаг байсан.
-- Оршин суугч эвдрэлээ 1 өнцгөөс л үзүүлэх боломжтой байв.
--
-- `maintenance_works.photos`-той ижил хэлбэр (TEXT[]) — 2 хүснэгт нэг загвартай.
--
-- image_url-ыг УСТГАХГҮЙ: одоо байгаа хүсэлтүүдийн зураг тэнд байгаа.
-- Апп хоёуланг нь уншина: `photos` хоосон бол `image_url`-ыг харуулна
-- (app/(mobile)/sokh/[id]/maintenance/page.tsx ба app/admin/maintenance/page.tsx).
-- Шинэ хүсэлт зөвхөн `photos`-д бичнэ.

ALTER TABLE maintenance_requests
  ADD COLUMN IF NOT EXISTS photos TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN maintenance_requests.photos IS
  'Хавсаргасан зургийн public URL-ууд (uploads bucket). Хоосон бол image_url-ыг үз.';

COMMENT ON COLUMN maintenance_requests.image_url IS
  'ХУУЧИРСАН — ганц зураг авдаг байсан үеийн багана. Шинэ мөр photos-ыг хэрэглэнэ.';

-- Шалгах:
--   SELECT column_name, data_type FROM information_schema.columns
--    WHERE table_name = 'maintenance_requests' AND column_name IN ('photos','image_url');
