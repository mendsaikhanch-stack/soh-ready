-- Оршин суугчийн профайл бүрдүүлэлт: эзэмшил, гэр бүл, нүүсэн огноо
-- Зорилго: импортоор ирсэн "тоот"-ын хагас дутуу бүртгэлийг оршин суугч
-- өөрөө нэвтэрч гүйцээснээр бүрэн болгох.
-- Гараар ажиллуулна: Supabase → SQL Editor.

-- Эзэмшлийн төрөл: owner=эзэмшигч, tenant=түрээслэгч, family=гэр бүлийн гишүүн
ALTER TABLE residents ADD COLUMN IF NOT EXISTS resident_type TEXT
  CHECK (resident_type IN ('owner', 'tenant', 'family'));

-- Гэр бүлийн гишүүдийн тоо (тухайн тоотод амьдардаг хүний тоо)
ALTER TABLE residents ADD COLUMN IF NOT EXISTS household_size INTEGER;

-- Нүүж ирсэн огноо
ALTER TABLE residents ADD COLUMN IF NOT EXISTS move_in_date DATE;

-- Профайл гүйцээсэн огноо (бүрдэлтийн заалтад ашиглана; NULL = гүйцээгээгүй)
ALTER TABLE residents ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMPTZ;

-- Админ UI/импортод хэрэглэгддэг ч миграцид байхгүй байсан баганууд (баримтжуулав)
ALTER TABLE residents ADD COLUMN IF NOT EXISTS building TEXT;
ALTER TABLE residents ADD COLUMN IF NOT EXISTS block TEXT;
ALTER TABLE residents ADD COLUMN IF NOT EXISTS entrance TEXT;
ALTER TABLE residents ADD COLUMN IF NOT EXISTS floor TEXT;
