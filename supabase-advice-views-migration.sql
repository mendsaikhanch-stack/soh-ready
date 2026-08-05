-- ============================================================
-- advice_card_views — "СӨХ-ийн зөвлөгөө" модулийн уншилтын тоолуур
--
-- Яагаад: модулийн "Хамгийн их уншсан" жагсаалтад хэрэгтэй.
-- Контент өөрөө код дотор (app/lib/advice/data.ts) байдаг тул энд зөвхөн
-- карт бүрийн уншилтын тоо хадгалагдана. Хувь хүний мэдээлэл ХАДГАЛАХГҮЙ —
-- хэн уншсаныг бүртгэхгүй, зөвхөн нийт тоог нэмэгдүүлнэ.
--
-- Энэ хүснэгт БАЙХГҮЙ байсан ч модуль хэвийн ажиллана (тоолуур нь чимээгүй
-- унтарна). Иймд миграцыг хойшлуулж болно.
--
-- Ажиллуулах: Supabase → SQL Editor-т ГАРААР copy-paste хийж ажиллуулна.
-- ============================================================

CREATE TABLE IF NOT EXISTS advice_card_views (
  card_id TEXT PRIMARY KEY,
  views BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE advice_card_views ENABLE ROW LEVEL SECURITY;

-- Уншилтын тоо нь нийтийн мэдээлэл — хүн бүр харна.
DROP POLICY IF EXISTS "advice_card_views_select_all" ON advice_card_views;
CREATE POLICY "advice_card_views_select_all" ON advice_card_views
  FOR SELECT TO anon, authenticated
  USING (true);

-- Шууд INSERT/UPDATE эрх ХЭНД Ч байхгүй — зөвхөн доорх функцээр нэмэгдэнэ.
-- Ингэснээр хэн ч дурын тоо бичиж чадахгүй, зөвхөн +1 хийж чадна.

CREATE OR REPLACE FUNCTION increment_advice_view(p_card_id TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Картын id нь код доторх тогтмол утга (жишээ: 'payment-obligation').
  -- Хэмжээ, тэмдэгтийн шалгуураар хог өгөгдлөөс сэргийлнэ.
  IF p_card_id IS NULL OR p_card_id !~ '^[a-z0-9-]{3,64}$' THEN
    RETURN;
  END IF;

  INSERT INTO advice_card_views (card_id, views, updated_at)
  VALUES (p_card_id, 1, NOW())
  ON CONFLICT (card_id)
  DO UPDATE SET views = advice_card_views.views + 1, updated_at = NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION increment_advice_view(TEXT) TO anon, authenticated;
