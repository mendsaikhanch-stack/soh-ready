-- ============================================
-- Play туршилтад оролцох хүсэлтэй оршин суугчдын Gmail хаяг
--
-- Яагаад: Google Play-ийн production эрх авахад 12+ хүн аппыг СУУЛГААД
-- 14 хоног ашигласан байх ёстой. 2026-09-12-ны байдлаар жагсаалтад 26
-- хаяг байсан ч аппыг үнэхээр суулгасан нь ердөө 3–4 байв.
--
-- Хамгийн итгэлтэй эх сурвалж нь Хотолыг ӨМНӨӨС НЬ ашиглаж байгаа оршин
-- суугчид (30 хоногт 55 хүн нэвтэрсэн). Тэднээс Gmail хаягийг нь аппаас
-- шууд асууж цуглуулна.
--
-- Supabase SQL Editor дотор ГАРААР ажиллуулна.
-- ============================================

CREATE TABLE IF NOT EXISTS play_tester_signups (
  id           BIGSERIAL PRIMARY KEY,
  resident_id  BIGINT REFERENCES residents(id) ON DELETE SET NULL,
  sokh_id      BIGINT REFERENCES sokh_organizations(id) ON DELETE SET NULL,

  email        TEXT NOT NULL,          -- Google Play-д нэмэх Gmail хаяг
  platform     TEXT,                   -- 'android' | 'ios' | 'other'

  -- Явцын төлөв. Хотолын дотоод самбараас гараар шинэчилнэ.
  status       TEXT NOT NULL DEFAULT 'new'
               CHECK (status IN ('new', 'added', 'opted_in', 'installed', 'declined')),
  note         TEXT,

  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Нэг хаяг нэг л удаа. Дахин илгээвэл шинэчилнэ (API дээр upsert).
--
-- ⚠️ Индекс нь ЯГ `email` багана дээр байх ёстой, `lower(email)` дээр БИШ.
-- PostgREST-ийн upsert нь `ON CONFLICT (email)` гэж илгээдэг бөгөөд
-- функцэн индекс үүнд тохирдоггүй → 42P10 «no unique or exclusion
-- constraint matching the ON CONFLICT specification».
-- Жижиг/том үсгийн ялгааг API тал нь хадгалахаасаа өмнө lowercase болгож
-- шийднэ (app/api/play-testers/route.ts).
CREATE UNIQUE INDEX IF NOT EXISTS uq_play_tester_email
  ON play_tester_signups (email);

CREATE INDEX IF NOT EXISTS idx_play_tester_status
  ON play_tester_signups (status, created_at DESC);

ALTER TABLE play_tester_signups ENABLE ROW LEVEL SECURITY;

-- Бодлого зориуд НЭГ Ч БАЙХГҮЙ: энэ хүснэгтэд оршин суугчдын хувийн имэйл
-- хадгалагдана. Зөвхөн сервер (service_role) хандана — оршин суугч өөрөө ч
-- бусдын хаягийг харахгүй, СӨХ-ийн дарга ч харахгүй. RLS асаалттай +
-- policy байхгүй = anon ба authenticated хоёул 0 мөр авна.
DROP POLICY IF EXISTS "play_tester_signups_all" ON play_tester_signups;
REVOKE ALL ON play_tester_signups FROM anon;
REVOKE ALL ON play_tester_signups FROM authenticated;

COMMENT ON TABLE play_tester_signups IS
  'Google Play туршилтад оролцохыг зөвшөөрсөн оршин суугчдын Gmail. Зөвхөн Хотолын супер админ харна.';
