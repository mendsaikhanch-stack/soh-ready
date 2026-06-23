-- ХОТОЛ — Wire.mn төлбөрийн mapping/tracking хүснэгт.
-- PaymentIntent ↔ тухайн нэхэмжлэх/айлыг холбож, webhook ирэхэд тулгана.
-- Supabase ▸ SQL Editor ▸ Run.

CREATE TABLE IF NOT EXISTS wire_payments (
  id                  BIGSERIAL PRIMARY KEY,
  payment_intent_id   TEXT UNIQUE NOT NULL,       -- pi_...
  checkout_session_id TEXT,                        -- cs_...
  sokh_id             BIGINT REFERENCES sokh_organizations(id) ON DELETE SET NULL,
  resident_id         BIGINT REFERENCES residents(id) ON DELETE SET NULL,
  invoice_id          BIGINT,                      -- холбогдсон invoices.id (хэрэв байвал)
  utility_bill_id     BIGINT,                      -- холбогдсон utility_bills.id (хэрэв байвал)
  kind                TEXT NOT NULL DEFAULT 'invoice',  -- invoice | utility | custom
  amount              NUMERIC NOT NULL,            -- ₮ (төгрөг)
  description         TEXT,
  status              TEXT NOT NULL DEFAULT 'pending',  -- pending | succeeded | failed
  livemode            BOOLEAN DEFAULT false,       -- Wire-ийн livemode (test=false)
  last_event_id       TEXT,                        -- webhook давхардлаас сэргийлэх
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  paid_at             TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_wire_payments_pi      ON wire_payments(payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_wire_payments_sokh    ON wire_payments(sokh_id);
CREATE INDEX IF NOT EXISTS idx_wire_payments_status  ON wire_payments(status);

-- RLS: зөвхөн service-role (server) бичнэ/уншина. Оршин суугч өөрийн бүртгэлээ үзэх боломж.
ALTER TABLE wire_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wire_payments_select_authenticated" ON wire_payments;
CREATE POLICY "wire_payments_select_authenticated" ON wire_payments
  FOR SELECT TO authenticated USING (true);
