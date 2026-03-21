const { Client } = require('pg');
const net = require('net');

// Force IPv6 lookup
const origConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function(options, ...args) {
  if (typeof options === 'object' && options.host === 'db.fthbatuohtiqtulsevel.supabase.co') {
    options.host = '2406:da1c:f42:ae11:88ca:8704:f931:ca12';
    options.family = 6;
  }
  return origConnect.call(this, options, ...args);
};

const client = new Client({
  host: 'db.fthbatuohtiqtulsevel.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: '5JXp6i4MF?2-,S*',
  ssl: { rejectUnauthorized: false }
});

const sql = `
CREATE TABLE IF NOT EXISTS cities (id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS districts (id BIGSERIAL PRIMARY KEY, city_id BIGINT REFERENCES cities(id) ON DELETE CASCADE, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS khoroos (id BIGSERIAL PRIMARY KEY, district_id BIGINT REFERENCES districts(id) ON DELETE CASCADE, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sokh_organizations (id BIGSERIAL PRIMARY KEY, khoroo_id BIGINT REFERENCES khoroos(id) ON DELETE CASCADE, name TEXT NOT NULL, address TEXT, phone TEXT, created_at TIMESTAMPTZ DEFAULT NOW());

ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE khoroos ENABLE ROW LEVEL SECURITY;
ALTER TABLE sokh_organizations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cities' AND policyname='public read cities') THEN CREATE POLICY "public read cities" ON cities FOR SELECT USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='districts' AND policyname='public read districts') THEN CREATE POLICY "public read districts" ON districts FOR SELECT USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='khoroos' AND policyname='public read khoroos') THEN CREATE POLICY "public read khoroos" ON khoroos FOR SELECT USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sokh_organizations' AND policyname='public read sokh') THEN CREATE POLICY "public read sokh" ON sokh_organizations FOR SELECT USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sokh_organizations' AND policyname='public insert sokh') THEN CREATE POLICY "public insert sokh" ON sokh_organizations FOR INSERT WITH CHECK (true); END IF; END $$;

INSERT INTO cities (name) SELECT v.name FROM (VALUES ('Улаанбаатар'),('Дархан'),('Эрдэнэт')) AS v(name) WHERE NOT EXISTS (SELECT 1 FROM cities LIMIT 1);

INSERT INTO districts (city_id, name)
SELECT v.city_id, v.name FROM (VALUES
  (1,'Баянгол'),(1,'Баянзүрх'),(1,'Сүхбаатар'),(1,'Чингэлтэй'),(1,'Хан-Уул'),(1,'Сонгинохайрхан'),(1,'Налайх'),(1,'Багануур'),(1,'Багахангай'),
  (2,'Дархан'),(2,'Шарын гол'),(3,'Эрдэнэт')
) AS v(city_id, name) WHERE NOT EXISTS (SELECT 1 FROM districts LIMIT 1);

INSERT INTO khoroos (district_id, name)
SELECT v.did, v.name FROM (VALUES
  (1,'1-р хороо'),(1,'2-р хороо'),(1,'3-р хороо'),(1,'4-р хороо'),(1,'5-р хороо'),
  (1,'6-р хороо'),(1,'7-р хороо'),(1,'8-р хороо'),(1,'9-р хороо'),(1,'10-р хороо'),
  (2,'1-р хороо'),(2,'2-р хороо'),(2,'3-р хороо'),(2,'4-р хороо'),(2,'5-р хороо'),
  (3,'1-р хороо'),(3,'2-р хороо'),(3,'3-р хороо'),(3,'4-р хороо'),(3,'5-р хороо'),
  (4,'1-р хороо'),(4,'2-р хороо'),(4,'3-р хороо'),(4,'4-р хороо'),(4,'5-р хороо'),
  (5,'1-р хороо'),(5,'2-р хороо'),(5,'3-р хороо'),(5,'4-р хороо'),(5,'5-р хороо')
) AS v(did, name) WHERE NOT EXISTS (SELECT 1 FROM khoroos LIMIT 1);

INSERT INTO sokh_organizations (khoroo_id, name, address, phone)
SELECT v.kid, v.name, v.addr, v.phone FROM (VALUES
  (1,'Нарантуул СӨХ','Баянгол, 1-р хороо, 15-р байр','77001122'),
  (1,'Од СӨХ','Баянгол, 1-р хороо, 25-р байр','77003344'),
  (2,'Алтан гадас СӨХ','Баянгол, 2-р хороо, 3-р байр','77005566'),
  (3,'Номин СӨХ','Баянгол, 3-р хороо, 40-р байр','77007788'),
  (11,'Баянзүрх СӨХ-1','Баянзүрх, 1-р хороо, 5-р байр','88001122'),
  (16,'Сүхбаатар СӨХ-1','Сүхбаатар, 1-р хороо, 10-р байр','99001122')
) AS v(kid, name, addr, phone) WHERE NOT EXISTS (SELECT 1 FROM sokh_organizations LIMIT 1);
`;

async function run() {
  try {
    await client.connect();
    console.log('Supabase-д холбогдлоо!');
    await client.query(sql);
    console.log('Хүснэгтүүд амжилттай үүслээ!');

    const cities = await client.query('SELECT * FROM cities');
    console.log('Хот:', cities.rows);
    const districts = await client.query('SELECT * FROM districts');
    console.log('Дүүрэг:', districts.rows.length, 'ширхэг');
    const khoroos = await client.query('SELECT * FROM khoroos');
    console.log('Хороо:', khoroos.rows.length, 'ширхэг');
    const sokh = await client.query('SELECT * FROM sokh_organizations');
    console.log('СӨХ:', sokh.rows);
  } catch (err) {
    console.error('Алдаа:', err.message);
  } finally {
    await client.end();
  }
}

run();
