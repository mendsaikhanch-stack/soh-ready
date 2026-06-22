-- ХОТОЛ — budget_items дата дахин оруулах (plain INSERT, DO block-гүй).
-- `category` багана аль хэдийн нэмэгдсэн. Идемпотент. Supabase ▸ SQL Editor ▸ Run.

-- 1) Хуучин (давхцахгүй болгох)
DELETE FROM budget_items b USING sokh_organizations o
  WHERE b.sokh_id = o.id
    AND o.name = 'Туршилтын СӨХ — Хотол демо байр'
    AND b.month = EXTRACT(MONTH FROM NOW())::int
    AND b.year  = EXTRACT(YEAR  FROM NOW())::int;

-- 2) Одоогийн сарын зардал + орлого
INSERT INTO budget_items (sokh_id, name, category, amount, month, year, description)
SELECT o.id, v.name, v.category, v.amount,
       EXTRACT(MONTH FROM NOW())::int, EXTRACT(YEAR FROM NOW())::int, v.descr
FROM sokh_organizations o
CROSS JOIN (VALUES
  ('Ажилчдын цалин',    'salary',         150000, 'Үйлчлэгч, сахиулын цалин'),
  ('Нийтийн цэвэрлэгээ', 'cleaning',        60000, 'Орц, гадна талбай'),
  ('Тог цахилгаан',      'electricity',     45000, 'Нийтийн гэрэлтүүлэг'),
  ('Хог ачуулалт',       'garbage',         30000, 'Хог тээвэрлэлт'),
  ('Засварын зардал',    'repair',          40000, 'Урсгал засвар'),
  ('Лифт засвар',        'elevator',        25000, 'Лифтний үйлчилгээ'),
  ('Зогсоолын орлого',   'parking_income',  50000, 'Зогсоолын хураамж')
) AS v(name, category, amount, descr)
WHERE o.name = 'Туршилтын СӨХ — Хотол демо байр';

-- 3) Шалгах — 7 гарвал амжилттай
SELECT count(*) AS budget_rows
FROM budget_items b JOIN sokh_organizations o ON b.sokh_id = o.id
WHERE o.name = 'Туршилтын СӨХ — Хотол демо байр';
