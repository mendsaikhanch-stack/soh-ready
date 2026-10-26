-- ============================================================
-- ХОТОЛ — Банкны SMS-ээс гүйлгээ автоматаар бүртгэх (ХасБанк → ICTown СӨХ)
-- Supabase ▸ SQL Editor ▸ Run.  Давтан ажиллуулахад аюулгүй.
--
-- Урсгал: банкны SMS → Android дамжуулагч → POST /api/bank-sms →
--   bank_sms_events (эх SMS) → bank_transactions (задалсан гүйлгээ) →
--   payment_reference_mappings (тоот таних) → payments (оршин суугчийн төлбөр)
--
-- ЗАРЧИМ:
--   • АДДИТИВ — одоо байгаа хүснэгтийн багана устгахгүй, нэр солихгүй.
--     Ганц өөрчлөлт нь payments_provider_check-д 'bank_sms' НЭМЭХ (өргөтгөл).
--   • Эх SMS, гүйлгээ, төлбөр гурвыг ТУСАД НЬ хадгална.
--   • Нэг банкны гүйлгээ → хамгийн ихдээ НЭГ payments мөр (unique index).
--   • RLS идэвхтэй, policy ҮГҮЙ → зөвхөн service_role (сервер) хандана.
--     Админ нь Supabase Auth хэрэглэгч биш — /api/admin/bank-sms нь
--     session-ий sokh_id-аар tenant scope тулгана.
-- ============================================================


-- ============================================================
-- 1. bank_sms_devices — SMS дамжуулагч утас (нэг данс = нэг суваг)
-- ============================================================
-- Токены ЭХ утгыг хадгалахгүй — зөвхөн SHA-256. Эх утгыг үүсгэх үед нэг л
-- удаа админд харуулна. Илгээгч, дансны маск нь КОДОД биш энд тохируулагдана.

CREATE TABLE IF NOT EXISTS bank_sms_devices (
  id                          BIGSERIAL PRIMARY KEY,
  sokh_id                     BIGINT NOT NULL REFERENCES sokh_organizations(id) ON DELETE CASCADE,
  display_name                TEXT NOT NULL,
  bank                        TEXT NOT NULL DEFAULT 'xacbank',
  -- SMS илгээгчийн дугаар(ууд), жишээ нь {131888}. Хоосон бол юу ч хүлээж авахгүй.
  allowed_senders             TEXT[] NOT NULL DEFAULT '{}',
  -- SMS дээр харагдах дансны маск, жишээ нь 5006***029. NULL бол шалгахгүй.
  account_mask                TEXT,
  -- Бүх нөхцөл таарвал төлбөрийг автоматаар бүртгэх эсэх. Анхдагч НЬ УНТРААЛТТАЙ:
  -- бодит SMS-ээр шалгаж дууссаны дараа дарга өөрөө асаана.
  auto_apply                  BOOLEAN NOT NULL DEFAULT false,
  token_hash                  TEXT NOT NULL UNIQUE,
  token_prefix                TEXT NOT NULL,
  status                      TEXT NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'revoked')),
  last_seen_at                TIMESTAMPTZ,
  last_sms_received_at        TIMESTAMPTZ,
  last_successful_delivery_at TIMESTAMPTZ,
  last_error                  TEXT,
  last_error_at               TIMESTAMPTZ,
  -- Утасны өөрийнх нь мэдээлсэн төлөв (дараалалд хүлээж буй тоо, хувилбар г.м.)
  last_status                 JSONB,
  created_by_admin_id         BIGINT,
  revoked_at                  TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bank_sms_devices_sokh ON bank_sms_devices(sokh_id);


-- ============================================================
-- 2. bank_sms_events — утаснаас ирсэн эх SMS (нэг хүсэлт = нэг мөр)
-- ============================================================
-- raw_body нь хувийн мэдээлэл агуулж болно (тоот, дүн) → policy-гүй,
-- зөвхөн сервер уншина, bank_sms_purge_raw()-аар хугацаа дуусахад NULL болно.

CREATE TABLE IF NOT EXISTS bank_sms_events (
  id                  BIGSERIAL PRIMARY KEY,
  sokh_id             BIGINT NOT NULL REFERENCES sokh_organizations(id) ON DELETE CASCADE,
  device_id           BIGINT NOT NULL REFERENCES bank_sms_devices(id) ON DELETE CASCADE,
  -- Утасны үүсгэсэн тогтвортой ID — retry үед ижил байна
  source_message_id   TEXT NOT NULL,
  -- Утасны мэдээлсэн илгээгч, хүлээн авсан цаг — ИТГЭХГҮЙ, зөвхөн лог
  sender              TEXT,
  received_at         TIMESTAMPTZ,
  server_received_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  body_sha256         TEXT NOT NULL,
  raw_body            TEXT,
  raw_purged_at       TIMESTAMPTZ,
  processing_status   TEXT NOT NULL DEFAULT 'received'
                      CHECK (processing_status IN ('received', 'processed', 'duplicate', 'needs_review', 'failed')),
  processing_error    TEXT,
  parser_version      TEXT,
  transaction_id      BIGINT,
  retry_count         INT NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Утас ижил SMS-ийг дахин илгээвэл шинэ мөр үүсэхгүй
  UNIQUE (device_id, source_message_id)
);

CREATE INDEX IF NOT EXISTS idx_bank_sms_events_sokh   ON bank_sms_events(sokh_id, server_received_at DESC);
CREATE INDEX IF NOT EXISTS idx_bank_sms_events_status ON bank_sms_events(sokh_id, processing_status);


-- ============================================================
-- 3. payment_reference_mappings — гүйлгээний утга → байр-орц-тоот
-- ============================================================
-- Зөвхөн ЯГ ТААРАЛ (normalized_pattern) — «403» гэх мэт дан тоотыг
-- бусад SMS дээр сохроор тааруулахгүй.
-- normalized_pattern-ийг апп (normalizeReference) тооцож хадгална.

CREATE TABLE IF NOT EXISTS payment_reference_mappings (
  id                  BIGSERIAL PRIMARY KEY,
  sokh_id             BIGINT NOT NULL REFERENCES sokh_organizations(id) ON DELETE CASCADE,
  source_pattern      TEXT NOT NULL,
  normalized_pattern  TEXT NOT NULL,
  building_number     TEXT NOT NULL,
  entrance_number     TEXT,
  apartment_number    TEXT NOT NULL,
  mapping_type        TEXT NOT NULL DEFAULT 'exact'
                      CHECK (mapping_type IN ('exact')),
  note                TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_by_admin_id BIGINT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Нэг СӨХ-д нэг утга зөвхөн НЭГ идэвхтэй дүрэмтэй байна
CREATE UNIQUE INDEX IF NOT EXISTS uniq_payment_ref_mapping_active
  ON payment_reference_mappings(sokh_id, normalized_pattern)
  WHERE is_active;


-- ============================================================
-- 4. bank_transactions — SMS-ээс задалсан банкны гүйлгээ
-- ============================================================

CREATE TABLE IF NOT EXISTS bank_transactions (
  id                      BIGSERIAL PRIMARY KEY,
  sokh_id                 BIGINT NOT NULL REFERENCES sokh_organizations(id) ON DELETE CASCADE,
  device_id               BIGINT REFERENCES bank_sms_devices(id) ON DELETE SET NULL,
  bank                    TEXT NOT NULL,
  account_reference       TEXT NOT NULL,
  -- Банк/QPay-ийн гүйлгээний дугаар (байвал)
  transaction_reference   TEXT,
  payment_channel         TEXT,
  -- Давхардлын түлхүүр: reference байвал түүгээр, үгүй бол тогтвортой hash
  idempotency_key         TEXT NOT NULL,
  transaction_type        TEXT NOT NULL CHECK (transaction_type IN ('credit')),
  amount_mnt              NUMERIC(14, 2) NOT NULL CHECK (amount_mnt > 0),
  balance_after_mnt       NUMERIC(14, 2),
  currency                TEXT NOT NULL DEFAULT 'MNT',
  transaction_date        DATE NOT NULL,
  transaction_description TEXT,
  payer_reference         TEXT,
  normalized_reference    TEXT,
  mapping_id              BIGINT REFERENCES payment_reference_mappings(id) ON DELETE SET NULL,
  building_number         TEXT,
  entrance_number         TEXT,
  apartment_number        TEXT,
  resident_id             BIGINT REFERENCES residents(id) ON DELETE SET NULL,
  suggested_invoice_id    BIGINT REFERENCES invoices(id) ON DELETE SET NULL,
  matching_status         TEXT NOT NULL DEFAULT 'unmatched'
                          CHECK (matching_status IN ('matched', 'unmatched', 'mapped_no_resident', 'ambiguous')),
  reconciliation_status   TEXT NOT NULL DEFAULT 'needs_review'
                          CHECK (reconciliation_status IN ('needs_review', 'auto_applied', 'confirmed', 'ignored')),
  review_reason           TEXT,
  payment_id              BIGINT REFERENCES payments(id) ON DELETE SET NULL,
  reviewed_by_admin_id    BIGINT,
  reviewed_at             TIMESTAMPTZ,
  review_note             TEXT,
  source_sms_event_id     BIGINT REFERENCES bank_sms_events(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ⭐ ДАВХАР ГҮЙЛГЭЭНЭЭС ХАМГААЛАХ ГОЛ ХАМГААЛАЛТ
CREATE UNIQUE INDEX IF NOT EXISTS uniq_bank_tx_idempotency
  ON bank_transactions(sokh_id, idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_bank_tx_reference
  ON bank_transactions(sokh_id, account_reference, transaction_reference)
  WHERE transaction_reference IS NOT NULL;
-- Нэг гүйлгээ → нэг л төлбөр
CREATE UNIQUE INDEX IF NOT EXISTS uniq_bank_tx_payment
  ON bank_transactions(payment_id)
  WHERE payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bank_tx_sokh_date ON bank_transactions(sokh_id, transaction_date DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_bank_tx_review    ON bank_transactions(sokh_id, reconciliation_status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.bank_sms_events'::regclass AND conname = 'bank_sms_events_transaction_fk'
  ) THEN
    ALTER TABLE bank_sms_events
      ADD CONSTRAINT bank_sms_events_transaction_fk
      FOREIGN KEY (transaction_id) REFERENCES bank_transactions(id) ON DELETE SET NULL;
  END IF;
END $$;


-- ============================================================
-- 5. RLS — policy ҮГҮЙ → anon/authenticated юу ч харахгүй
-- ============================================================
-- Ингэснээр ICTown-ий гүйлгээ бусад СӨХ-ийн оршин суугчид (anon key-тэй
-- апп) огт харагдахгүй. Tenant тусгаарлалтыг /api/admin/bank-sms хийнэ.

ALTER TABLE bank_sms_devices           ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_sms_events            ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_reference_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions          ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON bank_sms_devices, bank_sms_events, payment_reference_mappings, bank_transactions
  FROM anon, authenticated;


-- ============================================================
-- 6. payments.provider-д 'bank_sms' нэмэх (зөвхөн өргөтгөл)
-- ============================================================

DO $$
BEGIN
  IF to_regclass('public.payments') IS NULL THEN RETURN; END IF;
  ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_provider_check;
  ALTER TABLE payments
    ADD CONSTRAINT payments_provider_check
    CHECK (provider IN ('manual', 'mock', 'qpay', 'wire', 'bank_sms'));
END $$;


-- ============================================================
-- 7. bank_sms_apply_payment — гүйлгээг төлбөр болгох (НЭГ transaction дотор)
-- ============================================================
-- Мөрийг FOR UPDATE-оор түгжиж, payment_id хоосон, needs_review төлөвтэй
-- үед л ажиллана → зэрэг дуудсан ч, дахин боловсруулсан ч НЭГ л төлбөр.
-- Нэхэмжлэх, residents.debt-ийг applySuccessfulPayment-тэй ижил дүрмээр шинэчилнэ.

CREATE OR REPLACE FUNCTION public.bank_sms_apply_payment(
  p_transaction_id BIGINT,
  p_resident_id    BIGINT,
  p_invoice_id     BIGINT,
  p_admin_id       BIGINT,
  p_mode           TEXT,
  p_note           TEXT DEFAULT NULL
) RETURNS BIGINT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  tx      bank_transactions%ROWTYPE;
  res_sokh BIGINT;
  inv     RECORD;
  total   NUMERIC;
  new_paid NUMERIC;
  pay_id  BIGINT;
BEGIN
  IF p_mode NOT IN ('auto', 'manual') THEN
    RAISE EXCEPTION 'bad_mode';
  END IF;

  SELECT * INTO tx FROM bank_transactions WHERE id = p_transaction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'transaction_not_found'; END IF;
  IF tx.payment_id IS NOT NULL OR tx.reconciliation_status <> 'needs_review' THEN
    RAISE EXCEPTION 'already_resolved';
  END IF;

  SELECT sokh_id INTO res_sokh FROM residents WHERE id = p_resident_id FOR UPDATE;
  IF NOT FOUND OR res_sokh IS DISTINCT FROM tx.sokh_id THEN
    RAISE EXCEPTION 'resident_not_in_sokh';
  END IF;

  IF p_invoice_id IS NOT NULL THEN
    SELECT id, resident_id, sokh_id, amount, previous_balance, total_amount, paid_amount, status
      INTO inv FROM invoices WHERE id = p_invoice_id FOR UPDATE;
    IF NOT FOUND OR inv.resident_id <> p_resident_id OR inv.sokh_id <> tx.sokh_id THEN
      RAISE EXCEPTION 'invoice_not_for_resident';
    END IF;
    IF inv.status IN ('paid', 'cancelled') THEN
      RAISE EXCEPTION 'invoice_closed';
    END IF;
  END IF;

  INSERT INTO payments (resident_id, sokh_id, invoice_id, amount, description,
                        provider, provider_txn_id, status, paid_at, updated_at)
  VALUES (p_resident_id, tx.sokh_id, p_invoice_id, tx.amount_mnt,
          left('Банкны шилжүүлэг — ' || COALESCE(tx.transaction_description, ''), 300),
          'bank_sms', 'banktx:' || tx.id, 'paid', NOW(), NOW())
  RETURNING id INTO pay_id;

  IF p_invoice_id IS NOT NULL THEN
    total    := COALESCE(inv.total_amount, inv.amount + COALESCE(inv.previous_balance, 0));
    new_paid := COALESCE(inv.paid_amount, 0) + tx.amount_mnt;
    UPDATE invoices
       SET paid_amount = new_paid,
           status      = CASE WHEN new_paid >= total THEN 'paid' ELSE 'partial' END,
           paid_at     = CASE WHEN new_paid >= total THEN NOW() ELSE NULL END,
           updated_at  = NOW()
     WHERE id = p_invoice_id;
  END IF;

  UPDATE residents
     SET debt = GREATEST(0, COALESCE(debt, 0) - tx.amount_mnt)
   WHERE id = p_resident_id;

  UPDATE bank_transactions
     SET payment_id            = pay_id,
         resident_id           = p_resident_id,
         reconciliation_status = CASE WHEN p_mode = 'auto' THEN 'auto_applied' ELSE 'confirmed' END,
         review_reason         = NULL,
         reviewed_by_admin_id  = p_admin_id,
         reviewed_at           = CASE WHEN p_mode = 'manual' THEN NOW() ELSE NULL END,
         review_note           = p_note,
         updated_at            = NOW()
   WHERE id = p_transaction_id;

  RETURN pay_id;
END $$;

REVOKE ALL ON FUNCTION public.bank_sms_apply_payment(BIGINT, BIGINT, BIGINT, BIGINT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bank_sms_apply_payment(BIGINT, BIGINT, BIGINT, BIGINT, TEXT, TEXT) TO service_role;


-- ============================================================
-- 8. bank_sms_purge_raw — эх SMS-ийн текстийг хугацаа дуусахад арилгах
-- ============================================================
-- Задалсан гүйлгээ (bank_transactions) үлдэнэ. Хянах шаардлагатай
-- (needs_review / failed) SMS-ийн эх текстийг шийдэгдэх хүртэл хадгална.

CREATE OR REPLACE FUNCTION public.bank_sms_purge_raw(p_retention_days INT DEFAULT 90)
RETURNS INT
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  WITH purged AS (
    UPDATE bank_sms_events
       SET raw_body = NULL, raw_purged_at = NOW(), updated_at = NOW()
     WHERE raw_body IS NOT NULL
       AND server_received_at < NOW() - make_interval(days => GREATEST(p_retention_days, 7))
       AND processing_status IN ('processed', 'duplicate')
    RETURNING 1
  )
  SELECT COUNT(*)::INT FROM purged;
$$;

REVOKE ALL ON FUNCTION public.bank_sms_purge_raw(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bank_sms_purge_raw(INT) TO service_role;

NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- ШАЛГАХ (тусад нь RUN):
--   SELECT relname, relrowsecurity FROM pg_class
--    WHERE relname IN ('bank_sms_devices','bank_sms_events','payment_reference_mappings','bank_transactions');
--   -- бүгд relrowsecurity = true байх ёстой
--   SELECT polname FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
--    WHERE c.relname IN ('bank_sms_devices','bank_sms_events','payment_reference_mappings','bank_transactions');
--   -- 0 мөр (policy байхгүй = зөвхөн service_role)
-- ---------------------------------------------------------------------------
