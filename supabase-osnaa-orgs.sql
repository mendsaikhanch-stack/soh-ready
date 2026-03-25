-- ОСНААК/ХҮТ-д харъяалагдах байгууллагуудын хүснэгт
CREATE TABLE IF NOT EXISTS osnaa_entities (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,                -- kontrol (орон сууцны контор), khut (ХҮТ), sokh (СӨХ), other
  address TEXT,
  phone TEXT,
  email TEXT,
  director TEXT,                     -- захирал/дарга
  contract_number TEXT,              -- гэрээний дугаар
  contract_date DATE,
  resident_count INT DEFAULT 0,      -- хамрах айлын тоо
  building_count INT DEFAULT 0,      -- барилгын тоо
  status TEXT DEFAULT 'active',      -- active, inactive
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE osnaa_entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all osnaa_entities" ON osnaa_entities FOR ALL USING (true) WITH CHECK (true);

-- СӨХ байгууллагуудыг ОСНААК entity-тэй холбох
ALTER TABLE sokh_organizations ADD COLUMN IF NOT EXISTS osnaa_entity_id BIGINT REFERENCES osnaa_entities(id);
