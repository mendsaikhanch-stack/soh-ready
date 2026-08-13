-- Тоот бүр "айл өрх" мөн үү, эсвэл "аж ахуйн нэгж" (дэлгүүр, оффис) мөн үү.
-- Гараар ажиллуулна: Supabase → SQL Editor.
--
-- Яагаад: Хөгжил хаус СӨХ-ийн дарга үүнийг бичих багана байхгүй тул
-- "Байр / Блок / Орц" талбар руу "айл", "айл өрх", "ААН" гэж бичиж байсан.
-- Тэр талбарууд нь жагсаалтын эрэмбэнд ордог байсан учир засвар хийсэн айл
-- жагсаалтын хамгийн ард үсэрдэг байв.

ALTER TABLE residents ADD COLUMN IF NOT EXISTS unit_kind TEXT
  DEFAULT 'household'
  CHECK (unit_kind IN ('household', 'business'));

-- Одоо байгаа бүх мөрийг анхдагчаар "айл өрх" болгоно
UPDATE residents SET unit_kind = 'household' WHERE unit_kind IS NULL;

-- Байршлын талбарт "ААН / аж ахуйн нэгж" гэж бичсэн мөрүүдийг зөв багана руу шилжүүлнэ
UPDATE residents SET unit_kind = 'business'
WHERE upper(btrim(coalesce(building, ''))) IN ('ААН', 'АЖ АХУЙН НЭГЖ')
   OR upper(btrim(coalesce(block,    ''))) IN ('ААН', 'АЖ АХУЙН НЭГЖ')
   OR upper(btrim(coalesce(entrance, ''))) IN ('ААН', 'АЖ АХУЙН НЭГЖ')
   OR upper(btrim(coalesce(floor,    ''))) IN ('ААН', 'АЖ АХУЙН НЭГЖ');

-- Байршлын талбарт үлдсэн "айл / айл өрх / ААН" гэсэн бичвэрийг цэвэрлэнэ
-- (жинхэнэ байрны нэр — жнь "67б" — хэвээр үлдэнэ)
UPDATE residents SET building = NULL
  WHERE upper(btrim(coalesce(building, ''))) IN ('АЙЛ', 'АЙЛ ӨРХ', 'ӨРХ', 'ААН', 'АЖ АХУЙН НЭГЖ');
UPDATE residents SET block = NULL
  WHERE upper(btrim(coalesce(block, ''))) IN ('АЙЛ', 'АЙЛ ӨРХ', 'ӨРХ', 'ААН', 'АЖ АХУЙН НЭГЖ');
UPDATE residents SET entrance = NULL
  WHERE upper(btrim(coalesce(entrance, ''))) IN ('АЙЛ', 'АЙЛ ӨРХ', 'ӨРХ', 'ААН', 'АЖ АХУЙН НЭГЖ');
UPDATE residents SET floor = NULL
  WHERE upper(btrim(coalesce(floor, ''))) IN ('АЙЛ', 'АЙЛ ӨРХ', 'ӨРХ', 'ААН', 'АЖ АХУЙН НЭГЖ');

COMMENT ON COLUMN residents.unit_kind IS
  'household = айл өрх, business = аж ахуйн нэгж (дэлгүүр, оффис, түрээсийн талбай)';
