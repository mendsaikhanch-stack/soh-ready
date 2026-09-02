-- Санхүү, татварын албан ёсны тайлан — шаардлагатай талбарууд
--
-- Юуны тухай вэ: Баланс (санхүүгийн байдлын тайлан) болон татварын тооцоо
-- гаргахад одоогийн схемд 4 зүйл дутуу байна:
--
--   1. tax_id              — СӨХ-ийн регистр / ТТД. Татварын тайлангийн
--                            толгойд заавал ордог.
--   2. opening_balance     — тайлант хугацааны ЭХНИЙ мөнгөн үлдэгдэл.
--                            Үүнгүйгээр баланс дээрх мөнгөн хөрөнгө нь
--                            "Хотолд бүртгэсэн орлого хасах зардал" л болно,
--                            бодит дансны үлдэгдэл биш.
--   3. opening_balance_date — тэр үлдэгдэл ямар өдрийн байдлаарх вэ.
--   4. is_vat_payer        — НӨАТ суутган төлөгч эсэх. Ихэнх СӨХ биш
--                            (50 сая доогуур), гэхдээ томоохон СӨХ байж болно.
--
-- ⚠️ Эдгээрийг СӨХ бүр өөрөө /admin/finance/statements хуудсаас бөглөнө.
--    Бөглөөгүй бол баланс дээр "эхний үлдэгдэл 0" гэж тооцно.
--
-- Гараар ажиллуулна: Supabase → SQL Editor.

ALTER TABLE sokh_organizations
  ADD COLUMN IF NOT EXISTS tax_id               TEXT,
  ADD COLUMN IF NOT EXISTS opening_balance      NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opening_balance_date DATE,
  ADD COLUMN IF NOT EXISTS is_vat_payer         BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN sokh_organizations.tax_id IS
  'СӨХ-ийн регистрийн дугаар / ТТД — татварын тайлангийн толгойд ордог';
COMMENT ON COLUMN sokh_organizations.opening_balance IS
  'Тайлант хугацааны эхний мөнгөн үлдэгдэл (касс + харилцах). Баланс бодоход хэрэглэнэ.';
COMMENT ON COLUMN sokh_organizations.is_vat_payer IS
  'НӨАТ суутган төлөгч эсэх. Ихэнх СӨХ биш — 50 сая төгрөгийн босго.';

-- ── Бусад орлого ──
-- budget_items.type нь аль хэдийн байгаа ('expense'). Одоо 'income' утгыг
-- ашиглаж, хураамжаас БУСАД орлогыг (түрээс, зар сурталчилгаа, алданги)
-- бүртгэнэ. Татварын хувьд энэ хоёр эрс өөр: гишүүдийн хураамж нь
-- гишүүдийн хуримтлал, бусад орлого нь ААНОАТ ногдох орлого гэж үздэг
-- (нягтлан бодогчоор баталгаажуулах шаардлагатай таамаг).
--
-- Хуучин мөрүүд бүгд 'expense' тул зөвхөн default-ыг баталгаажуулна.
UPDATE budget_items SET type = 'expense' WHERE type IS NULL;

-- Оршин суугчийн ил тод тайлан зөвхөн ЗАРДЛЫГ харуулдаг тул хурдасгана
CREATE INDEX IF NOT EXISTS idx_budget_items_sokh_year_type
  ON budget_items(sokh_id, year, type);
