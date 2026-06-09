// Нэг удаагийн migration runner — supabase-marketing-outreach-migration.sql-ыг
// Postgres холболтоор шууд ажиллуулна. SQL нь idempotent (IF NOT EXISTS /
// DROP POLICY IF EXISTS) тул дахин ажиллуулахад аюулгүй.
//
// Холболтын мөрийг ДАРААХ дарааллаар хайна (нууцыг чатад бичихгүйн тулд):
//   1) process.env.MIGRATE_DATABASE_URL
//   2) process.env.DATABASE_URL
//   3) .env.local доторх MIGRATE_DATABASE_URL= эсвэл DATABASE_URL=
//
// Ажиллуулах:
//   node scripts/run-marketing-migration.mjs
// эсвэл:
//   MIGRATE_DATABASE_URL="postgresql://..." node scripts/run-marketing-migration.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function fromEnvFile(key) {
  try {
    const txt = readFileSync(join(ROOT, '.env.local'), 'utf8');
    const line = txt.split('\n').find((l) => l.startsWith(`${key}=`));
    if (!line) return '';
    return line.slice(key.length + 1).replace(/^["']/, '').replace(/["']$/, '').trim();
  } catch {
    return '';
  }
}

const conn =
  process.env.MIGRATE_DATABASE_URL ||
  process.env.DATABASE_URL ||
  fromEnvFile('MIGRATE_DATABASE_URL') ||
  fromEnvFile('DATABASE_URL');

if (!conn) {
  console.error(
    'Холболтын мөр олдсонгүй. MIGRATE_DATABASE_URL-ийг тохируулна уу ' +
      '(env эсвэл .env.local).',
  );
  process.exit(1);
}

const sql = readFileSync(join(ROOT, 'supabase-marketing-outreach-migration.sql'), 'utf8');

const client = new pg.Client({
  connectionString: conn,
  ssl: { rejectUnauthorized: false }, // Supabase нь SSL шаарддаг
});

const EXPECTED = [
  'marketing_fb_groups',
  'marketing_campaigns',
  'marketing_queue_items',
  'marketing_posting_logs',
  'marketing_leads',
];

try {
  console.log('Холбогдож байна...');
  await client.connect();
  console.log('Migration ажиллуулж байна...');
  await client.query(sql);
  console.log('✓ Migration амжилттай.');

  const { rows } = await client.query(
    `SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name = ANY($1::text[])
       ORDER BY table_name`,
    [EXPECTED],
  );
  const found = rows.map((r) => r.table_name);
  console.log(`Үүссэн хүснэгтүүд (${found.length}/${EXPECTED.length}): ${found.join(', ')}`);
  const missing = EXPECTED.filter((t) => !found.includes(t));
  if (missing.length) {
    console.error('⚠ Дутуу:', missing.join(', '));
    process.exitCode = 2;
  }
} catch (err) {
  console.error('✗ Алдаа:', err.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
