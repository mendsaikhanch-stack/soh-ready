// debt_agreements миграцийг ажиллуулж, дараа нь баталгаажуулна.
//
// Ажиллуулах:
//   node scripts/run-debt-agreements-migration.mjs            # ажиллуулаад шалгана
//   node scripts/run-debt-agreements-migration.mjs --verify   # зөвхөн шалгана
//
// DDL хийхийн тулд дараах 2 замын НЭГ нь хэрэгтэй (.env.local-д нэм):
//   SUPABASE_ACCESS_TOKEN=sbp_...   → Management API (Supabase → Account → Access Tokens)
//   DATABASE_URL=postgresql://...   → шууд Postgres холболт (Project Settings → Database)
// Service role key нь PostgREST-ээр явдаг тул DDL хийж ЧАДАХГҮЙ.

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SQL_FILE = resolve(ROOT, 'supabase-debt-agreements-migration.sql');

const env = { ...process.env };
for (const line of readFileSync(resolve(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (v) env[m[1]] = v;
}

const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SR_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const PROJECT_REF = new URL(SUPA_URL).hostname.split('.')[0];

// --- Баталгаажуулалт: хүснэгт байгаа эсэх + баганы төрөл --------------------
async function verify() {
  const res = await fetch(`${SUPA_URL}/rest/v1/`, {
    headers: { apikey: SR_KEY, Authorization: `Bearer ${SR_KEY}`, Accept: 'application/openapi+json' },
  });
  const spec = await res.json();
  const def = (spec.definitions || {}).debt_agreements;

  if (!def) {
    console.log('✗ debt_agreements хүснэгт ОЛДСОНГҮЙ (schema cache-д алга).');
    return false;
  }

  console.log('✓ debt_agreements хүснэгт БАЙНА. Багана:');
  for (const [col, meta] of Object.entries(def.properties)) {
    const req = (def.required || []).includes(col) ? 'NOT NULL' : '';
    console.log(`    ${col.padEnd(22)} ${String(meta.format || meta.type).padEnd(28)} ${req}`);
  }

  // Мөр уншиж чадаж байна уу (RLS + grant зөв эсэх)
  const probe = await fetch(`${SUPA_URL}/rest/v1/debt_agreements?select=id&limit=1`, {
    headers: { apikey: SR_KEY, Authorization: `Bearer ${SR_KEY}` },
  });
  console.log(`\n  service_role SELECT: ${probe.ok ? 'OK' : 'FAIL ' + (await probe.text()).slice(0, 200)}`);

  // anon бичиж чадах ёсгүй
  const anonWrite = await fetch(`${SUPA_URL}/rest/v1/debt_agreements`, {
    method: 'POST',
    headers: {
      apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sokh_id: 1, resident_id: 1, total_amount: 1, monthly_amount: 1, months: 1 }),
  });
  console.log(`  anon INSERT хаагдсан эсэх: ${anonWrite.ok ? '✗ НЭЭЛТТЭЙ — АЮУЛТАЙ!' : '✓ хаалттай (' + anonWrite.status + ')'}`);
  return true;
}

// --- Ажиллуулах замууд ------------------------------------------------------
async function runViaManagementApi(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Management API ${res.status}: ${body.slice(0, 500)}`);
  console.log('✓ Management API-аар ажиллав.');
}

async function runViaPg(sql) {
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(sql);
    console.log('✓ Postgres холболтоор ажиллав.');
  } finally {
    await client.end();
  }
}

// --- Гол урсгал -------------------------------------------------------------
const verifyOnly = process.argv.includes('--verify');

if (verifyOnly) {
  process.exit((await verify()) ? 0 : 1);
}

const sql = readFileSync(SQL_FILE, 'utf8');

if (env.SUPABASE_ACCESS_TOKEN?.startsWith('sbp_')) {
  await runViaManagementApi(sql);
} else if (env.DATABASE_URL?.startsWith('postgres')) {
  await runViaPg(sql);
} else {
  console.log('DDL ажиллуулах эрх алга (SUPABASE_ACCESS_TOKEN ч, DATABASE_URL ч байхгүй).');
  console.log(`Supabase → SQL Editor-т ГАРААР ажиллуулна уу:\n  ${SQL_FILE}\n`);
  console.log('Дараа нь шалгах:  node scripts/run-debt-agreements-migration.mjs --verify');
  process.exit(2);
}

console.log('\n--- Баталгаажуулалт ---');
await verify();
