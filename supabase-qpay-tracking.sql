-- QPay-аар үүсгэсэн invoice бүрийг бүртгэж callback-ыг forge хийхээс сэргийлэх таблиц.
-- /api/qpay/callback нь зөвхөн манай үүсгэсэн sender_invoice_no-той ирвэл хүлээж авна.

CREATE TABLE IF NOT EXISTS qpay_invoices (
  id BIGSERIAL PRIMARY KEY,
  sender_invoice_no TEXT UNIQUE NOT NULL,           -- бид QPay руу илгээдэг манайхын ID (callback URL-д ашиглана)
  qpay_invoice_id   TEXT,                           -- QPay-ийн буцаасан invoice_id
  sokh_id           BIGINT REFERENCES sokh_organizations(id) ON DELETE SET NULL,
  resident_id       BIGINT REFERENCES residents(id) ON DELETE SET NULL,
  entity_type       TEXT,                           -- 'sokh' | 'osnaa' | 'tsah' | 'platform'
  amount            BIGINT NOT NULL,
  description       TEXT,
  status            TEXT NOT NULL DEFAULT 'pending', -- pending | paid | failed | expired
  paid_amount       BIGINT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  paid_at           TIMESTAMPTZ,
  callback_received_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_qpay_invoices_sokh_id   ON qpay_invoices(sokh_id);
CREATE INDEX IF NOT EXISTS idx_qpay_invoices_status    ON qpay_invoices(status);
CREATE INDEX IF NOT EXISTS idx_qpay_invoices_created   ON qpay_invoices(created_at DESC);

ALTER TABLE qpay_invoices ENABLE ROW LEVEL SECURITY;
-- Зөвхөн service_role хандах. Анонимоор уншиж/бичих шаардлагагүй.
