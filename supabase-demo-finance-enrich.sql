-- ============================================================
--  ХОТОЛ — Demo санхүүгийн дата баяжуулалт (Play Store screenshot)
--  Зорилго: payments болон reports дэлгэц хоосон биш, баялаг харагдах.
--  PII-гүй, зохиомол. Idempotent — дахин ажиллуулж болно.
--
--  УРЬДЧИЛСАН НӨХЦӨЛ: supabase-demo-seed.sql аль хэдийн ажилласан байх
--  (Demo СӨХ + apartment '12' resident үүссэн байх ёстой).
--
--  Supabase ▸ SQL Editor ▸ Run.
-- ============================================================

-- budget_items-д `category` багана дутуу байсныг нэмнэ (reports/admin finance
-- код энэ баганыг уншдаг/бичдэг тул дутуу байсан нь далд алдаа). Аюулгүй,
-- одоо байгаа дата устгахгүй.
ALTER TABLE budget_items ADD COLUMN IF NOT EXISTS category TEXT;

DO $$
DECLARE
  v_sokh bigint;
  v_res  bigint;
  v_y    int := EXTRACT(YEAR  FROM NOW())::int;   -- одоогийн жил
  v_m    int := EXTRACT(MONTH FROM NOW())::int;   -- одоогийн сар
  v_due  date := make_date(v_y, v_m, 25);
BEGIN
  -- Demo СӨХ ба demo resident (apartment 12)-ийг олох
  SELECT id INTO v_sokh FROM sokh_organizations
    WHERE name = 'Туршилтын СӨХ — Хотол демо байр' LIMIT 1;
  IF v_sokh IS NULL THEN
    RAISE EXCEPTION 'Demo СӨХ олдсонгүй. Эхлээд supabase-demo-seed.sql ажиллуулна уу.';
  END IF;

  SELECT id INTO v_res FROM residents
    WHERE sokh_id = v_sokh AND apartment = '12' LIMIT 1;
  IF v_res IS NULL THEN
    RAISE EXCEPTION 'Demo resident (apartment 12) олдсонгүй.';
  END IF;

  -- monthly_fee баталгаажуулах (reports-ийн "орлого" тооцоонд хэрэгтэй)
  UPDATE sokh_organizations SET monthly_fee = 50000 WHERE id = v_sokh;

  -- ========== 1) REPORTS: budget_items (одоогийн сар) ==========
  -- Дахин ажиллуулахад давхцахгүйн тулд эхлээд устгана.
  DELETE FROM budget_items WHERE sokh_id = v_sokh AND year = v_y AND month = v_m;

  -- name (NOT NULL) ба category (reports код уншина) хоёуланг бөглөнө.
  INSERT INTO budget_items (sokh_id, name, category, amount, month, year, description) VALUES
    (v_sokh, 'Ажилчдын цалин',     'salary',         150000, v_m, v_y, 'Үйлчлэгч, сахиулын цалин'),
    (v_sokh, 'Нийтийн цэвэрлэгээ',  'cleaning',        60000, v_m, v_y, 'Орц, гадна талбай'),
    (v_sokh, 'Тог цахилгаан',       'electricity',     45000, v_m, v_y, 'Нийтийн гэрэлтүүлэг'),
    (v_sokh, 'Хог ачуулалт',        'garbage',         30000, v_m, v_y, 'Хог тээвэрлэлт'),
    (v_sokh, 'Засварын зардал',     'repair',          40000, v_m, v_y, 'Урсгал засвар'),
    (v_sokh, 'Лифт засвар',         'elevator',        25000, v_m, v_y, 'Лифтний үйлчилгээ'),
    (v_sokh, 'Зогсоолын орлого',    'parking_income',  50000, v_m, v_y, 'Зогсоолын хураамж');
  -- Нийт зардал 350,000₮ · Орлого 400,000 (8×50,000) + 50,000 = 450,000 · Үлдэгдэл +100,000

  -- ========== 2) PAYMENTS: тухайн айлын нэхэмжлэх (одоогийн сар) ==========
  -- СӨХ хураамж — invoices (төлсөн)
  INSERT INTO invoices (sokh_id, resident_id, year, month, amount, due_date, status, paid_amount, paid_at, description)
  VALUES (v_sokh, v_res, v_y, v_m, 50000, v_due, 'paid', 50000, NOW() - INTERVAL '5 days', 'СӨХ сарын хураамж')
  ON CONFLICT (resident_id, year, month)
  DO UPDATE SET amount = EXCLUDED.amount, status = 'paid',
                paid_amount = EXCLUDED.paid_amount, paid_at = EXCLUDED.paid_at;

  -- Коммунал — utility_bills (бүгд төлсөн → dashboard "Миний өр 0₮"-тэй нийцнэ)
  INSERT INTO utility_bills (sokh_id, resident_id, apartment, utility_type, year, month, amount, status, paid_at) VALUES
    (v_sokh, v_res, '12', 'water',       v_y, v_m, 12000, 'paid', NOW() - INTERVAL '5 days'),
    (v_sokh, v_res, '12', 'heating',     v_y, v_m, 38000, 'paid', NOW() - INTERVAL '5 days'),
    (v_sokh, v_res, '12', 'electricity', v_y, v_m, 22000, 'paid', NOW() - INTERVAL '5 days')
  ON CONFLICT (resident_id, utility_type, year, month)
  DO UPDATE SET amount = EXCLUDED.amount, status = 'paid', paid_at = EXCLUDED.paid_at;

  -- ========== 3) PAYMENTS: түүхэнд нэмэлт бичилт (Түүх таб баялаг) ==========
  INSERT INTO payments (resident_id, amount, description, paid_at)
  VALUES (v_res, 50000, 'СӨХ хураамж — энэ сар', NOW() - INTERVAL '5 days');

  RAISE NOTICE 'Demo finance enriched. sokh_id=%, resident_id=%, % сар/% жил', v_sokh, v_res, v_m, v_y;
END $$;
