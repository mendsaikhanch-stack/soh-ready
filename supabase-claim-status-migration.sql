-- СӨХ-н claim_status төлөв нэмэх migration
-- Зорилго: Self-service-ээр үүссэн СӨХ ба бид гэрээлсэн идэвхтэй СӨХ-г ялгах

-- 1. claim_status багана нэмэх (unclaimed = default, оршин суугчид бүртгэгдэж болно гэхдээ дарга байхгүй)
ALTER TABLE sokh_organizations
  ADD COLUMN IF NOT EXISTS claim_status TEXT NOT NULL DEFAULT 'unclaimed'
    CHECK (claim_status IN ('unclaimed', 'pending', 'active'));

-- 2. activated_at — СӨХ-н админ анх login хийсэн цаг
ALTER TABLE sokh_organizations
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;

-- 3. Гэрээ/холбоо барих мэдээлэл (batch onboarding-д ашиглана)
ALTER TABLE sokh_organizations
  ADD COLUMN IF NOT EXISTS contract_number TEXT;
ALTER TABLE sokh_organizations
  ADD COLUMN IF NOT EXISTS contact_email TEXT;

-- 4. Index — dashboard filter-д ашиглагдана
CREATE INDEX IF NOT EXISTS idx_sokh_organizations_claim_status
  ON sokh_organizations(claim_status);
