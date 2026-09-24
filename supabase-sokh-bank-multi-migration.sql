-- СӨХ нэгээс олон "хураамж хүлээн авах данс"-тай байж болно.
--
-- ЯАГААД: `supabase-sokh-bank-migration.sql`-д `sokh_id BIGINT UNIQUE` гэж
-- тодорхойлсон тул СӨХ-д ганц данс л багтдаг байв. Админ хуудас нь байгаа
-- мөрийг UPDATE хийдэг учир дарга 2 дахь дансаа оруулахад эхнийх нь дарагдаж
-- "устсан" мэт харагддаг байсан (Бадрах СӨХ, 2026-09-24).
--
-- Олон банктай байх нь бодит хэрэгцээ: оршин суугч өөрийн банкны дотор
-- шилжүүлбэл шимтгэлгүй, хормын дотор ордог.
--
-- ⚠️ Гараар ажиллуулна: Supabase → SQL Editor → бүгдийг сонгоод RUN.
--    (Vercel-ийн DATABASE_URL хоосон тул скриптээр ажиллуулах боломжгүй.)
--
-- Энэ миграц ӨГӨГДӨЛ УСТГАХГҮЙ — зөвхөн хязгаарыг сулруулж, багана нэмнэ.
-- Дахин ажиллуулсан ч аюулгүй (бүгд IF EXISTS / IF NOT EXISTS).

-- 1) sokh_id дээрх UNIQUE хязгаарыг хасна.
--    Нэр нь 2026-09-24-нд DB-ийн алдааны мессежээс баталгаажсан.
ALTER TABLE public.sokh_bank_accounts
  DROP CONSTRAINT IF EXISTS sokh_bank_accounts_sokh_id_key;

-- 2) Дарга дансаа эрэмбэлнэ — хамгийн бага нь "үндсэн данс"
ALTER TABLE public.sokh_bank_accounts
  ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

-- 3) Нэг СӨХ-ийн олон мөрийг эрэмбээр нь хурдан унших
CREATE INDEX IF NOT EXISTS sokh_bank_accounts_sokh_order_idx
  ON public.sokh_bank_accounts (sokh_id, sort_order, id);

-- 4) Нэг СӨХ дотор ижил данс ХОЁР УДАА бүртгэгдэхээс хамгаална
CREATE UNIQUE INDEX IF NOT EXISTS sokh_bank_accounts_unique_number_idx
  ON public.sokh_bank_accounts (sokh_id, account_number);

COMMENT ON COLUMN public.sokh_bank_accounts.sort_order IS
  'Оршин суугчид харагдах дараалал. Хамгийн бага нь эхэнд (үндсэн данс).';

-- 5) PostgREST-ийн schema кэшийг шинэчилнэ. Үүнгүй бол шинэ багана
--    "column does not exist" гэж хэдэн минут харагдахгүй байж болно.
NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- ШАЛГАХ: доорх 2 мөрийг тусад нь RUN хийнэ. Хүлээгдэж буй үр дүн:
--   а) эхнийх нь 0 мөр буцаана (UNIQUE хязгаар хасагдсан)
--   б) хоёр дахь нь sort_order баганыг жагсаана
-- ---------------------------------------------------------------------------
-- SELECT conname FROM pg_constraint
--  WHERE conrelid = 'public.sokh_bank_accounts'::regclass AND contype = 'u';
--
-- SELECT column_name, data_type FROM information_schema.columns
--  WHERE table_name = 'sokh_bank_accounts' ORDER BY ordinal_position;
