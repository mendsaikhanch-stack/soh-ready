-- parking_vehicles-д гаражны төрөл нэмэв
ALTER TABLE parking_vehicles
  ADD COLUMN IF NOT EXISTS parking_type TEXT
  CHECK (parking_type IS NULL OR parking_type IN ('garage', 'outdoor'));

COMMENT ON COLUMN parking_vehicles.parking_type IS
  'garage = доод/хаалттай гараж, outdoor = задгай талбай';
COMMENT ON COLUMN parking_vehicles.parking_spot IS
  'Зогсоолын дугаар (жнь: Г-15 эсвэл задгай-3)';
