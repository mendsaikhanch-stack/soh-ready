-- СӨХ-ийн ажилчдын цалингийн тооцоо
--
-- Юуны тухай вэ: СӨХ-д цэвэрлэгч, харуул, сантехникч, менежер ажилладаг.
-- Тэдний цалингаас НДШ, ХХОАТ суутгаж, ажил олгогчийн НДШ нэмж төлдөг.
-- Одоогийн /admin/staff дээрх «Цалингийн тооцоо» таб нь зөвхөн ЭКРАН ДЭЭРХ
-- урьдчилсан тооцоо — сар бүрийн бодит бүртгэл, олголтын түүх, санхүүтэй
-- холбоо байхгүй байв. Энэ миграц түүнийг гүйцээнэ.
--
-- ⚠️ ЯАГААД ЦАЛИНГ staff ХҮСНЭГТЭД БИЧИХГҮЙ ВЭ:
--    Оршин суугчийн «Ажилчид» хуудас (app/(mobile)/sokh/[id]/staff) нь
--    staff-ыг anon түлхүүрээр `select('*')`-ээр уншдаг. Тэнд salary багана
--    нэмбэл ажилчдын цалин нийтэд ил болно. Тиймээс цалинг ТУСДАА,
--    RLS-ээр бүрэн хаалттай хүснэгтэд хадгална.
--
-- Гараар ажиллуулна: Supabase → SQL Editor.

-- ── 1. Ажилтны сарын үндсэн цалин (хаалттай) ──
CREATE TABLE IF NOT EXISTS staff_salaries (
  id          BIGSERIAL PRIMARY KEY,
  sokh_id     BIGINT NOT NULL REFERENCES sokh_organizations(id) ON DELETE CASCADE,
  staff_id    BIGINT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  amount      NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_staff_salary ON staff_salaries(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_salaries_sokh ON staff_salaries(sokh_id);

ALTER TABLE staff_salaries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON staff_salaries FROM anon;
REVOKE ALL ON staff_salaries FROM authenticated;

COMMENT ON TABLE staff_salaries IS
  'Ажилтны сарын үндсэн цалин. Хувийн мэдээлэл — зөвхөн дарга /api/admin/db proxy-гоор хандана.';

-- ── 2. Татвар, шимтгэлийн хувь — СӨХ бүр өөрөө тохируулна ──
-- Анхдагч утгууд нь 2025 оны байдлаарх нийтлэг хувь. Хууль өөрчлөгдөх,
-- ажил олгогчийн эрсдэлийн ангиллаас хамаарч ялгаатай байдаг тул тогтмол
-- (hardcode) бичихгүй — дарга/нягтлан өөрсдөө засах боломжтой байна.
ALTER TABLE sokh_organizations
  ADD COLUMN IF NOT EXISTS si_employee_rate NUMERIC(5,2)  NOT NULL DEFAULT 11.5,
  ADD COLUMN IF NOT EXISTS si_employer_rate NUMERIC(5,2)  NOT NULL DEFAULT 12.5,
  ADD COLUMN IF NOT EXISTS pit_rate         NUMERIC(5,2)  NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS pit_credit       NUMERIC(14,2) NOT NULL DEFAULT 20000;

COMMENT ON COLUMN sokh_organizations.si_employee_rate IS 'НДШ — ажилтнаас суутгах хувь (%)';
COMMENT ON COLUMN sokh_organizations.si_employer_rate IS 'НДШ — ажил олгогч нэмж төлөх хувь (%)';
COMMENT ON COLUMN sokh_organizations.pit_rate IS 'ХХОАТ-ын хувь (%)';
COMMENT ON COLUMN sokh_organizations.pit_credit IS 'ХХОАТ-ын сарын хөнгөлөлт (₮)';

-- ── 3. Сар бүрийн цалингийн мөр ──
CREATE TABLE IF NOT EXISTS payroll_entries (
  id            BIGSERIAL PRIMARY KEY,
  sokh_id       BIGINT NOT NULL REFERENCES sokh_organizations(id) ON DELETE CASCADE,
  staff_id      BIGINT REFERENCES staff(id) ON DELETE SET NULL,

  -- Ажилтныг устгасан ч өнгөрсөн тайлан бүтэн үлдэх ёстой тул нэр, албан
  -- тушаалыг мөр дотор нь хуулж хадгална.
  staff_name    TEXT NOT NULL,
  role          TEXT,

  year          INT NOT NULL,
  month         INT NOT NULL CHECK (month BETWEEN 1 AND 12),

  base_salary     NUMERIC(14,2) NOT NULL DEFAULT 0,
  bonus           NUMERIC(14,2) NOT NULL DEFAULT 0,   -- урамшуулал, нэмэгдэл
  other_deduction NUMERIC(14,2) NOT NULL DEFAULT 0,   -- урьдчилгаа, торгууль

  si_employee   NUMERIC(14,2) NOT NULL DEFAULT 0,     -- ажилтнаас суутгасан НДШ
  si_employer   NUMERIC(14,2) NOT NULL DEFAULT 0,     -- СӨХ нэмж төлөх НДШ
  pit           NUMERIC(14,2) NOT NULL DEFAULT 0,     -- ХХОАТ
  net_pay       NUMERIC(14,2) NOT NULL DEFAULT 0,     -- гарт олгох

  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'paid')),
  paid_at       TIMESTAMPTZ,
  note          TEXT,

  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Нэг ажилтанд нэг сард нэг мөр. «Цалин бодох» товчийг 2 удаа дарахад
-- давхар мөр үүсэхээс сэргийлнэ.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_payroll_staff_month
  ON payroll_entries(sokh_id, staff_id, year, month);

CREATE INDEX IF NOT EXISTS idx_payroll_sokh_period
  ON payroll_entries(sokh_id, year, month);

ALTER TABLE payroll_entries ENABLE ROW LEVEL SECURITY;

-- Бодлого зориуд НЭГ Ч БАЙХГҮЙ — цалин бол хувь хүний мэдээлэл.
REVOKE ALL ON payroll_entries FROM anon;
REVOKE ALL ON payroll_entries FROM authenticated;

COMMENT ON TABLE payroll_entries IS
  'СӨХ-ийн ажилчдын сар бүрийн цалингийн тооцоо. Хувийн мэдээлэл — зөвхөн дарга харна.';
