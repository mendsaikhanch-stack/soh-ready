-- Хотол → СӨХ-ийн нэхэмжлэхийн АВТОМАТ сануулгын бүртгэл
--
-- Юунд хэрэгтэй вэ: супер админы самбарт хэтэрсэн нэхэмжлэх ярайж
-- харагдаад л байдаг, хэн ч гараар сануулдаггүй. Cron өдөр бүр шалгаж,
-- төлөх хугацаа дөхсөн / болсон / хэтэрсэн шатанд даргад SMS + имэйл
-- илгээгээд ЭНД бичнэ. (invoice_id, stage) давхардахгүй тул нэг шатанд
-- нэг л удаа сануулна — cron хэд дуудагдсан ч давтагдахгүй.
--
-- Ажиллуулах: Supabase → SQL Editor → буулгаад Run.
-- (Vercel-ийн DATABASE_URL хоосон тул скриптээр ажиллуулах боломжгүй.)

CREATE TABLE IF NOT EXISTS platform_invoice_reminders (
  id          BIGSERIAL PRIMARY KEY,
  invoice_id  BIGINT NOT NULL REFERENCES platform_invoices(id) ON DELETE CASCADE,
  sokh_id     BIGINT NOT NULL REFERENCES sokh_organizations(id) ON DELETE CASCADE,
  -- soon | today | late_3 | late_10 | late_20 | notice_30 | late_45 | late_60
  stage       TEXT NOT NULL,
  -- Илгээх мөчид төлөх хугацаа хүртэл үлдсэн хоног (сөрөг = хэтэрсэн)
  days_left   INT NOT NULL,
  -- [{"channel":"sms","to":"99..","ok":true,"note":"stub"}, ...]
  channels    JSONB NOT NULL DEFAULT '[]',
  message     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (invoice_id, stage)
);

CREATE INDEX IF NOT EXISTS idx_platform_invoice_reminders_sokh
  ON platform_invoice_reminders(sokh_id, created_at DESC);

-- Зөвхөн service_role (сервер тал) хандана — клиентээс огт харагдахгүй
ALTER TABLE platform_invoice_reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "platform_invoice_reminders_deny_all" ON platform_invoice_reminders;
CREATE POLICY "platform_invoice_reminders_deny_all" ON platform_invoice_reminders
  FOR ALL USING (false);

COMMENT ON TABLE platform_invoice_reminders IS
  'Хотолын нэхэмжлэх бүрд илгээсэн автомат сануулга (шат тус бүрд нэг удаа).';
