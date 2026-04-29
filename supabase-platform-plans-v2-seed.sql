-- ============================================
-- Platform plans v2 — Эхлэх / Стандарт / Дэвшилтэт
-- Хуучин 6 багцыг устгаж, шинэ 3 багцаар орлуулна.
-- ============================================
-- АНХААР: Хэрэв ямар нэг СӨХ subscription идэвхтэй бол FK
-- алдаа гарна. Доорх safety check түүнийг урьдаар анхааруулна.
-- ============================================

BEGIN;

-- Safety: subscription байгаа эсэхийг шалгана
DO $$
DECLARE
  sub_count INT;
BEGIN
  SELECT COUNT(*) INTO sub_count
  FROM sokh_subscriptions
  WHERE plan_id IN (SELECT id FROM platform_plans);

  IF sub_count > 0 THEN
    RAISE EXCEPTION
      'Plans-ийг устгах боломжгүй: % subscription идэвхтэй байна. Эхлээд тэдгээрийг шинэ plan руу шилжүүл, эсвэл is_active=false ашигла.',
      sub_count;
  END IF;
END $$;

-- Хуучин багцуудыг устгана
DELETE FROM platform_plans;

-- ID-г 1-ээс эхлүүлэх
ALTER SEQUENCE platform_plans_id_seq RESTART WITH 1;

-- Шинэ 3 багц
INSERT INTO platform_plans
  (name, type, base_fee, per_unit_fee, commission_percent, billing_cycle, features, description, sort_order)
VALUES
  (
    'Эхлэх',
    'per_apartment',
    0, 1000, 0,
    'monthly',
    '["basic","qpay"]'::jsonb,
    '50–150 айлтай жижиг СӨХ-д. Эхний 3 сар үнэгүй.',
    1
  ),
  (
    'Стандарт',
    'hybrid',
    50000, 800, 0.7,
    'monthly',
    '["basic","qpay","push","reports"]'::jsonb,
    '150–300 айлтай дундаж СӨХ-д. Хамгийн их сонголт.',
    2
  ),
  (
    'Дэвшилтэт',
    'hybrid',
    150000, 500, 0.5,
    'monthly',
    '["basic","qpay","push","reports","analytics","priority_support"]'::jsonb,
    '300+ айлтай том СӨХ. Аналитик, тусгай дэмжлэг.',
    3
  );

COMMIT;

-- Шалгах:
-- SELECT id, name, type, base_fee, per_unit_fee, commission_percent FROM platform_plans ORDER BY sort_order;
