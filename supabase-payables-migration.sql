-- Өглөг (payables) — СӨХ ХЭНД өртэй вэ
--
-- Юуны тухай вэ: одоо системд "авлага" (residents.debt — айл СӨХ-д өртэй) бий
-- ч "өглөг" (СӨХ нь лифтний компани, харуул, цалин, тог зэрэгт өртэй) байхгүй.
-- docs/SPEC.md #6 модулийн 4 заавал хэсгийн нэг нь ЭНЭ — «Авлага өглөг».
-- Жилийн тайлан, хурлын тайланд «бидэнд хэдэн төгрөгийн өглөг байна» гэдэг
-- мөр заавал ордог тул үүнгүйгээр тайлан бүрэн биш.
--
-- Ажлын урсгал:
--   1. Нэхэмжлэх ирэхэд дарга «Өглөг» табаас нэмнэ (хэнд, хэд, хэзээ хүртэл)
--   2. Төлсний дараа «Төлсөн» дарна → status='paid', paid_at бичигдэнэ
--   3. Тэр мөрөнд тохирсон ЗАРДАЛ budget_items-д автоматаар нэмэгдэнэ
--      (аппын код хийнэ) — иймд өглөгөө бүртгэсэн бол зардлыг гараар
--      давхар бүртгэх ШААРДЛАГАГҮЙ.
--
-- ID төрөл: sokh_organizations.id нь BIGINT (BIGSERIAL) — UUID БИШ.
--
-- Гараар ажиллуулна: Supabase → SQL Editor.

CREATE TABLE IF NOT EXISTS payables (
  id           BIGSERIAL PRIMARY KEY,
  sokh_id      BIGINT NOT NULL REFERENCES sokh_organizations(id) ON DELETE CASCADE,

  vendor       TEXT NOT NULL,              -- хэнд өртэй: "Лифт ХХК", "Харуулын цалин"
  category     TEXT NOT NULL DEFAULT 'other',  -- budget_items-ийн ангилалтай ижил утга
  amount       NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  paid_amount  NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),

  due_date     DATE,                       -- хэзээ хүртэл төлөх ёстой
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'partial', 'paid')),
  paid_at      TIMESTAMPTZ,

  description  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Даргын жагсаалт: төлөгдөөгүй нь эхэндээ, хугацаа нь ойрхон нь дээр
CREATE INDEX IF NOT EXISTS idx_payables_sokh_status
  ON payables(sokh_id, status, due_date);

ALTER TABLE payables ENABLE ROW LEVEL SECURITY;

-- Бодлого зориуд НЭГ Ч БАЙХГҮЙ: өглөг бол СӨХ-ийн дотоод санхүүгийн мэдээлэл.
-- Оршин суугчийн апп үүнийг уншихгүй, зөвхөн дарга /api/admin/db proxy-гоор
-- (service_role + tenant scope) хандана. RLS асаалттай + policy байхгүй =
-- anon ба authenticated аль аль нь 0 мөр авна.
REVOKE ALL ON payables FROM anon;
REVOKE ALL ON payables FROM authenticated;

COMMENT ON TABLE payables IS
  'СӨХ-ийн өглөг — нийлүүлэгч, цалин, үйлчилгээний төлөгдөөгүй өр. Зөвхөн дарга харна.';
