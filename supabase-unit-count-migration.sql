-- СӨХ-н нийт айлын тоо (төлбөр тооцоолох, price tier ашиглана)
ALTER TABLE sokh_organizations
  ADD COLUMN IF NOT EXISTS unit_count INTEGER;
