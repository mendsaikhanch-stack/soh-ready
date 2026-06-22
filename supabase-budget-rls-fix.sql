-- ХОТОЛ — budget_items SELECT RLS policy дутуу байсныг засна.
-- Шинж: budget_items-д RLS идэвхтэй ч authenticated хэрэглэгчид зориулсан
-- SELECT policy байхгүй тул оршин суугч reports (Зарцуулалтын тайлан) дээр
-- зардлын задаргааг хардаггүй байсан. invoices/utility_bills-тэй ижил
-- (USING true) policy нэмж тэгшитгэнэ. Supabase ▸ SQL Editor ▸ Run.

ALTER TABLE budget_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "budget_items_select_authenticated" ON budget_items;
CREATE POLICY "budget_items_select_authenticated" ON budget_items
  FOR SELECT TO authenticated USING (true);

-- Шалгах: одоо authenticated хэрэглэгч demo СӨХ-ийн budget_items үзэх боломжтой
SELECT count(*) AS rows_visible_after_policy
FROM budget_items b JOIN sokh_organizations o ON b.sokh_id = o.id
WHERE o.name = 'Туршилтын СӨХ — Хотол демо байр';
