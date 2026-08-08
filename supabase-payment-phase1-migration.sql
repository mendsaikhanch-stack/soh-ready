-- ============================================================
-- ХОТОЛ — Төлбөрийн систем PHASE 1: дата загвар
-- Supabase ▸ SQL Editor ▸ Run.  Давтан ажиллуулахад аюулгүй.
--
-- ЗАРЧИМ: БҮГД АДДИТИВ.
--   • Багана нэг ч устгахгүй, нэр солихгүй, төрөл өөрчлөхгүй
--   • residents.debt-ийг ХЭВЭЭР үлдээнэ (одоогийн код түүнд найддаг)
--   • qpay_invoices / wire_payments-ийг ХЭВЭЭР үлдээнэ
--   • Одоо байгаа бүх INSERT/UPDATE код ямар ч засваргүй ажиллана
--
-- ШИНЭ МОДЕЛ ҮҮСГЭХГҮЙ: Invoice = одоо байгаа `invoices`,
-- Payment / PaymentTransaction = одоо байгаа `payments` (өргөтгөсөн).
-- Зөвхөн `payment_webhook_events` шинээр нэмэгдэнэ.
-- ============================================================


-- ============================================================
-- 1. invoices — өмнөх өр, нийт дүн
-- ============================================================

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS previous_balance NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total_amount     NUMERIC;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ DEFAULT NOW();

-- Хуучин мөрүүдэд нийт дүн = сарын дүн (өмнөх өр 0)
UPDATE invoices SET total_amount = amount + COALESCE(previous_balance, 0)
 WHERE total_amount IS NULL;

-- status-д 'cancelled' нэмэх. CHECK constraint-ийн НЭР нь орчноос
-- хамаарч өөр байж болох тул динамикаар олж устгана.
DO $$
DECLARE
  con_name TEXT;
BEGIN
  IF to_regclass('public.invoices') IS NULL THEN RETURN; END IF;

  SELECT conname INTO con_name
    FROM pg_constraint
   WHERE conrelid = 'public.invoices'::regclass
     AND contype  = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%status%';

  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE invoices DROP CONSTRAINT %I', con_name);
  END IF;

  ALTER TABLE invoices
    ADD CONSTRAINT invoices_status_check
    CHECK (status IN ('pending', 'paid', 'overdue', 'partial', 'cancelled'));
END $$;

CREATE INDEX IF NOT EXISTS idx_invoices_resident_period ON invoices(resident_id, year DESC, month DESC);


-- ============================================================
-- 2. payments — нэхэмжлэхтэй холбох, provider, төлөв
-- ============================================================
-- ⚠️ status-ийн DEFAULT нь ЗОРИУДААР 'paid'.
--    Одоо байгаа БҮХ insert (QPay callback, Wire webhook, админы гар
--    бүртгэл) нь ЗӨВХӨН амжилттай төлбөрийг бичдэг тул энэ нь тэдний
--    хувьд зөв утга — код засах шаардлагагүй, зан төлөв хэвээр.
--
--    PHASE 4-ийн шинэ код (төлбөр эхлүүлэх) нь status-ыг ЗААВАЛ
--    тодорхой дамжуулна: 'pending' → 'paid'/'failed'/... .

ALTER TABLE payments ADD COLUMN IF NOT EXISTS invoice_id      BIGINT REFERENCES invoices(id) ON DELETE SET NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS sokh_id         BIGINT REFERENCES sokh_organizations(id) ON DELETE SET NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider        TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_txn_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS status          TEXT NOT NULL DEFAULT 'paid';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.payments'::regclass AND conname = 'payments_status_check'
  ) THEN
    ALTER TABLE payments
      ADD CONSTRAINT payments_status_check
      CHECK (status IN ('pending', 'paid', 'failed', 'cancelled', 'expired'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.payments'::regclass AND conname = 'payments_provider_check'
  ) THEN
    ALTER TABLE payments
      ADD CONSTRAINT payments_provider_check
      CHECK (provider IN ('manual', 'mock', 'qpay', 'wire'));
  END IF;
END $$;

-- Хуучин мөрүүдэд sokh_id-г айлаас нь бөглөх
UPDATE payments p
   SET sokh_id = r.sokh_id
  FROM residents r
 WHERE p.resident_id = r.id
   AND p.sokh_id IS NULL;

-- ⭐ ДАВХАР ТӨЛӨЛТӨӨС ХАМГААЛАХ ГОЛ ХАМГААЛАЛТ
-- Нэг provider-ийн нэг гүйлгээ ЗӨВХӨН НЭГ УДАА бүртгэгдэнэ.
-- Partial index — хуучин мөрүүдийн provider_txn_id нь NULL.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_payments_provider_txn
    ON payments(provider, provider_txn_id)
 WHERE provider_txn_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_sokh_id    ON payments(sokh_id);
CREATE INDEX IF NOT EXISTS idx_payments_status     ON payments(status);


-- ============================================================
-- 3. payment_webhook_events — идемпотентын бүртгэл (ШИНЭ)
-- ============================================================
-- Provider-ээс ирсэн event бүрийг нэг л удаа боловсруулна.
-- Нэг гүйлгээний webhook дахин ирсэн ч төлбөр 2 удаа бүртгэгдэхгүй.

CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id                BIGSERIAL PRIMARY KEY,
  provider          TEXT NOT NULL,
  external_event_id TEXT NOT NULL,
  event_type        TEXT,
  payload           JSONB,
  processed         BOOLEAN NOT NULL DEFAULT false,
  processed_at      TIMESTAMPTZ,
  error             TEXT,
  payment_id        BIGINT REFERENCES payments(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, external_event_id)
);

CREATE INDEX IF NOT EXISTS idx_pwe_processed ON payment_webhook_events(processed, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pwe_payment   ON payment_webhook_events(payment_id);

-- RLS: policy ҮГҮЙ → зөвхөн service_role хандана.
-- Хэрэглэгч/админ энэ хүснэгтийг харах шаардлагагүй.
ALTER TABLE payment_webhook_events ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- ЗОРИУДААР ХИЙГЭЭГҮЙ
-- ============================================================
-- • `resident_balances` (тусдаа өрийн ledger) — ҮҮСГЭХГҮЙ.
--   `invoices` дээр UNIQUE(resident_id, year, month) байгаа тул сар бүр
--   яг нэг мөр үүснэ. Мөр бүр өөрийн `previous_balance`-ыг агуулснаар
--   сараас сар руу дамжсан өрийн ГИНЖ аль хэдийн бүрдэнэ. Тусдаа ledger
--   нь мөн өгөгдлийг давхардуулна.
--
-- • `payment_transactions` — ҮҮСГЭХГҮЙ. Өргөтгөсөн `payments` нь
--   (provider + provider_txn_id + status) энэ үүргийг гүйцэтгэнэ.
--
-- • `payment_providers` хүснэгт — ҮҮСГЭХГҮЙ. Provider сонголт нь
--   код/env түвшний тохиргоо (PAYMENT_PROVIDER), дата биш.
--
-- • `residents.debt` — ХЭВЭЭР. Одоогийн олон хуудас түүнээс уншдаг.
--   PHASE 4-т invoices-оос тооцсон утгатай зэрэгцүүлж ажиллуулна.
