const { Client } = require('pg');

const client = new Client({
  host: 'aws-0-ap-southeast-1.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres.fthbatuohtiqtulsevel',
  password: '5JXp6i4MF?2-,S*',
  ssl: { rejectUnauthorized: false }
});

const sql = `
CREATE TABLE IF NOT EXISTS residents (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  apartment TEXT NOT NULL,
  phone TEXT,
  debt NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id BIGSERIAL PRIMARY KEY,
  resident_id BIGINT REFERENCES residents(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  description TEXT,
  paid_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'residents' AND policyname = 'Allow all access to residents') THEN
    CREATE POLICY "Allow all access to residents" ON residents FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payments' AND policyname = 'Allow all access to payments') THEN
    CREATE POLICY "Allow all access to payments" ON payments FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

INSERT INTO residents (name, apartment, phone, debt)
SELECT * FROM (VALUES
  ('Бат', 'A-101', '99001122', 120000::numeric),
  ('Сараа', 'B-203', '88112233', 0::numeric),
  ('Болд', 'A-305', '95443322', 85000::numeric)
) AS v(name, apartment, phone, debt)
WHERE NOT EXISTS (SELECT 1 FROM residents LIMIT 1);
`;

async function run() {
  try {
    await client.connect();
    console.log('Supabase-д холбогдлоо!');
    await client.query(sql);
    console.log('Хүснэгтүүд амжилттай үүслээ!');

    const res = await client.query('SELECT * FROM residents');
    console.log('Оршин суугчид:', res.rows);
  } catch (err) {
    console.error('Алдаа:', err.message);
  } finally {
    await client.end();
  }
}

run();
