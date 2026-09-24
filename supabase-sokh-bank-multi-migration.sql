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
-- ⚠️ Гараар ажиллуулна: Supabase → SQL Editor (Vercel-ийн DATABASE_URL хоосон).
--
-- Энэ миграц нь өгөгдөл УСТГАХГҮЙ — зөвхөн хязгаарыг сулруулж, эрэмбийн
-- багана нэмнэ. Байгаа мөрүүд бүгд sort_order = 0 болно.

-- 1) sokh_id дээрх UNIQUE хязгаарыг хасна.
--    Нэрийг нь таамаглахгүй — pg_constraint-аас олж хасна (зөвхөн sokh_id
--    ганц баганаас тогтсон UNIQUE-г).
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    WHERE ns.nspname = 'public'
      AND rel.relname = 'sokh_bank_accounts'
      AND con.contype = 'u'
      AND con.conkey = ARRAY[(
        SELECT attnum FROM pg_attribute
        WHERE attrelid = rel.oid AND attname = 'sokh_id'
      )]::smallint[]
  LOOP
    EXECUTE format('ALTER TABLE public.sokh_bank_accounts DROP CONSTRAINT %I', c.conname);
    RAISE NOTICE 'Хассан UNIQUE хязгаар: %', c.conname;
  END LOOP;
END $$;

-- Хэрэв хязгаар биш, дан ганц UNIQUE INDEX байсан бол түүнийг ч хасна
DROP INDEX IF EXISTS public.sokh_bank_accounts_sokh_id_key;

-- 2) Дарга дансаа эрэмбэлж, эхнийхийг нь үндсэн болгоно
ALTER TABLE public.sokh_bank_accounts
  ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

-- 3) Нэг СӨХ-ийн олон мөрийг эрэмбээр нь хурдан унших
CREATE INDEX IF NOT EXISTS sokh_bank_accounts_sokh_order_idx
  ON public.sokh_bank_accounts (sokh_id, sort_order, id);

-- 4) Нэг СӨХ дотор ижил банкны ижил данс ХОЁР УДАА бүртгэгдэхээс хамгаална
CREATE UNIQUE INDEX IF NOT EXISTS sokh_bank_accounts_unique_number_idx
  ON public.sokh_bank_accounts (sokh_id, account_number);

COMMENT ON COLUMN public.sokh_bank_accounts.sort_order IS
  'Оршин суугчид харагдах дараалал. Хамгийн бага нь эхэнд (үндсэн данс).';

-- Шалгах:
--   SELECT sokh_id, sort_order, bank_name, account_number, is_active
--   FROM sokh_bank_accounts ORDER BY sokh_id, sort_order, id;
