// Direct DB import of normalized SOKH CSVs.
//
// What it does:
//   1) sokh-clean.csv (with phone) → sokh_organizations + sokh_activation_tokens
//      Output: sokh-codes.csv (codes to SMS to chairmen)
//   2) sokh-directory.csv (no phone) → hoa_directory (status=PENDING)
//
// Modes:
//   - default: DRY RUN. Reads CSVs, resolves district/khoroo, checks for
//     duplicates, prints what would happen. Does NOT write to DB.
//   - --commit: actually writes to DB.
//
// Idempotent: re-running with --commit only inserts new rows. Existing
// SOKHs (same name + same khoroo_id) get a fresh activation code instead
// of a duplicate row. Existing hoa_directory entries (same normalized_name)
// are skipped.

const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { randomInt } = require('crypto');
const { createClient } = require('@supabase/supabase-js');

// --- Config -----------------------------------------------------------------

const ROOT = path.resolve(__dirname, '..');
const ENV_FILE = path.join(ROOT, '.env.local');
const DATA_DIR = path.join(ROOT, 'data');
const CLEAN_CSV = path.join(DATA_DIR, 'sokh-clean.csv');
const DIRECTORY_CSV = path.join(DATA_DIR, 'sokh-directory.csv');
const CODES_OUT = path.join(DATA_DIR, 'sokh-codes.csv');
const SKIP_OUT = path.join(DATA_DIR, 'sokh-import-skipped.csv');

const COMMIT = process.argv.includes('--commit');
const REFRESH_CODES = process.argv.includes('--refresh-codes'); // re-issue codes for existing pending SOKHs
const CODE_TTL_DAYS = 7;
const BCRYPT_COST = 12;

// --- Load .env.local --------------------------------------------------------

function loadEnv() {
  const text = fs.readFileSync(ENV_FILE, 'utf8');
  const env = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[k] = v;
  }
  return env;
}

// --- CSV parser (handles BOM, quoted fields with commas) --------------------

function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const lines = [];
  let cur = '', inQ = false, row = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQ && text[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === ',' && !inQ) {
      row.push(cur); cur = '';
    } else if ((ch === '\n' || ch === '\r') && !inQ) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      if (row.some(c => c !== '')) lines.push(row);
      row = [];
    } else {
      cur += ch;
    }
  }
  if (cur !== '' || row.length) {
    row.push(cur);
    if (row.some(c => c !== '')) lines.push(row);
  }
  if (!lines.length) return [];
  const headers = lines[0].map(h => h.trim());
  return lines.slice(1).map(r => {
    const o = {};
    headers.forEach((h, i) => o[h] = (r[i] ?? '').trim());
    return o;
  });
}

function csvEscape(s) {
  const v = String(s ?? '');
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

// --- Name normalizer (mirrors app/lib/directory/normalize.ts) ---------------

const NOISE_PUNCT = /[.,/\\#!$%^&*;:{}=\-_`~()"'?<>|@+\[\]]/g;
const SOH_TOKENS = ['сөх', 'сох', 'cөх', 'cox', 'soh', 'sokh',
  'нийтлэг өмчлөгчдийн холбоо', 'орон сууцны өмчлөгчдийн холбоо'];

function normalizeSohName(input) {
  if (!input) return '';
  let v = String(input).toLowerCase()
    .replace(/[Үү]/g, 'ү').replace(/[Өө]/g, 'ө').replace(/[Ёё]/g, 'ё');
  v = v.replace(NOISE_PUNCT, ' ').replace(/\s+/g, ' ').trim();
  for (const t of SOH_TOKENS) {
    v = v.replace(new RegExp(`(^|\\s)${t}(\\s|$)`, 'gi'), ' ');
  }
  return v.replace(/\s+/g, ' ').trim();
}

// --- Main -------------------------------------------------------------------

(async () => {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Алдаа: .env.local-д NEXT_PUBLIC_SUPABASE_URL эсвэл SUPABASE_SERVICE_ROLE_KEY олдсонгүй');
    process.exit(1);
  }
  const sb = createClient(url, key, { auth: { persistSession: false } });

  console.log(`Mode: ${COMMIT ? 'COMMIT (DB-д бичнэ)' : 'DRY-RUN (бичихгүй, зөвхөн харуулна)'}`);
  if (REFRESH_CODES) console.log('     + --refresh-codes: одоо байгаа СӨХ-д шинэ код үүсгэнэ (өмнөх кодыг хүчингүй болгоно)');
  console.log(`URL:  ${url}`);

  // Load CSVs
  const cleanRows = parseCsv(fs.readFileSync(CLEAN_CSV, 'utf8'));
  const dirRows = parseCsv(fs.readFileSync(DIRECTORY_CSV, 'utf8'));
  console.log(`\nCSV уншсан: clean=${cleanRows.length}, directory=${dirRows.length}`);

  // --- Pre-load metadata ----------------------------------------------------

  console.log('\nDB-аас metadata татаж байна...');
  const [{ data: cities }, { data: districts }, { data: khoroos }] = await Promise.all([
    sb.from('cities').select('id, name').order('id'),
    sb.from('districts').select('id, city_id, name').order('id'),
    sb.from('khoroos').select('id, district_id, name').order('id'),
  ]);
  if (!cities || !districts || !khoroos) {
    console.error('Metadata татаж чадсангүй'); process.exit(1);
  }
  const ub = cities.find(c => c.name === 'Улаанбаатар');
  if (!ub) { console.error('Улаанбаатар хот бүртгэлгүй'); process.exit(1); }

  const districtByName = new Map();
  for (const d of districts) {
    if (d.city_id !== ub.id) continue;
    districtByName.set(d.name.toLowerCase().replace(/\s+/g, ''), d);
  }

  // Track хороонууд that the input references but are missing from DB.
  // We'll auto-create these (1 row each) when --commit is set.
  const missingKhoroos = new Map(); // key: `${district_id}:${num}` → { dist, num, count }

  function resolveKhoroo(districtName, khorooLabel) {
    const dKey = districtName.toLowerCase().replace(/\s+/g, '');
    const dist = districtByName.get(dKey);
    if (!dist) return { error: `дүүрэг олдсонгүй: ${districtName}` };
    const numMatch = String(khorooLabel).match(/(\d+)/);
    if (!numMatch) return { error: `хороо дугаар алга: ${khorooLabel}` };
    const num = numMatch[1];
    // EXACT match — substring олон хороотой match хийнэ ("7-р хороо" vs "17-р хороо")
    const target = `${num}-р хороо`;
    const kh = khoroos.find(k => k.district_id === dist.id && k.name === target);
    if (kh) return { dist, kh };
    // Mark as missing — will be auto-created on commit
    const mk = `${dist.id}:${num}`;
    const entry = missingKhoroos.get(mk) || { dist, num, count: 0 };
    entry.count++;
    missingKhoroos.set(mk, entry);
    return { dist, missing: true, num };
  }

  // Existing SOKHs in target khoroos (so we can detect dupes by name)
  const targetKhorooIds = new Set();
  for (const r of cleanRows) {
    const got = resolveKhoroo(r['Дүүрэг'], r['Хороо']);
    if (got.kh) targetKhorooIds.add(got.kh.id);
  }
  // Paginate to bypass PostgREST default 1000-row limit
  let existingOrgs = [];
  if (targetKhorooIds.size > 0) {
    const idList = [...targetKhorooIds];
    let from = 0;
    while (true) {
      const { data, error } = await sb
        .from('sokh_organizations')
        .select('id, name, khoroo_id, claim_status, phone')
        .in('khoroo_id', idList)
        .order('id')
        .range(from, from + 999);
      if (error) { console.error('existingOrgs error:', error.message); break; }
      if (!data?.length) break;
      existingOrgs.push(...data);
      if (data.length < 1000) break;
      from += 1000;
    }
  }
  console.log(`existingOrgs татсан: ${existingOrgs.length}`);
  const orgByKey = new Map();
  for (const o of existingOrgs) {
    orgByKey.set(`${o.khoroo_id}|${o.name.toLowerCase().trim()}`, o);
  }

  // Existing hoa_directory normalized names
  const { data: existingDir } = await sb.from('hoa_directory').select('id, normalized_name');
  const dirNameSet = new Set((existingDir || []).map(d => d.normalized_name));

  // --- Plan -----------------------------------------------------------------

  const plan = {
    cleanCreate: 0,    // new SOKH + new code
    cleanReuse: 0,     // existing SOKH (not active) → new code only
    cleanActive: 0,    // existing SOKH already active → skip
    cleanFail: 0,      // khoroo unresolved
    dirCreate: 0,
    dirDup: 0,
  };
  const cleanPlan = []; // {row, action, dist, kh|null, existingId, missingNum}
  const dirPlan = [];   // {row, action, normName}
  const skipped = [];

  for (const r of cleanRows) {
    const got = resolveKhoroo(r['Дүүрэг'], r['Хороо']);
    if (got.error) {
      plan.cleanFail++;
      skipped.push({ source: 'clean', sokh: r['СӨХ нэр'], district: r['Дүүрэг'], khoroo: r['Хороо'], reason: got.error });
      continue;
    }
    if (got.missing) {
      // Хороог auto-create хийнэ. Bulkгүй учир existing match хийхгүй (DB-д тэр сөх ч байж чадахгүй).
      plan.cleanCreate++;
      cleanPlan.push({ row: r, action: 'create', dist: got.dist, kh: null, missingNum: got.num });
      continue;
    }
    const key = `${got.kh.id}|${r['СӨХ нэр'].toLowerCase().trim()}`;
    const existing = orgByKey.get(key);
    if (existing && existing.claim_status === 'active') {
      plan.cleanActive++;
      skipped.push({ source: 'clean', sokh: r['СӨХ нэр'], district: r['Дүүрэг'], khoroo: r['Хороо'], reason: 'аль хэдийн идэвхтэй' });
      continue;
    }
    if (existing) {
      // SOKH аль хэдийн бий + код өмнө явуулсан байх магадлалтай.
      // Default бол skip (явуулсан кодыг хүчингүй болгохгүй). --refresh-codes өгсөн үед л шинэ код өгнө.
      if (!REFRESH_CODES) {
        plan.cleanActive++; // тоонд орохын тулд "active"-ийн адил үзэв
        skipped.push({ source: 'clean', sokh: r['СӨХ нэр'], district: r['Дүүрэг'], khoroo: r['Хороо'], reason: 'аль хэдийн бий — код хадгалагдана (--refresh-codes-аар шинэчилнэ)' });
        continue;
      }
      plan.cleanReuse++;
      cleanPlan.push({ row: r, action: 'reuse', dist: got.dist, kh: got.kh, existingId: existing.id });
    } else {
      plan.cleanCreate++;
      cleanPlan.push({ row: r, action: 'create', dist: got.dist, kh: got.kh });
    }
  }

  for (const r of dirRows) {
    const norm = normalizeSohName(r['official_name']);
    if (!norm) {
      skipped.push({ source: 'dir', sokh: r['official_name'], district: r['district'], khoroo: r['khoroo'], reason: 'normalized_name хоосон' });
      continue;
    }
    if (dirNameSet.has(norm)) {
      plan.dirDup++;
      skipped.push({ source: 'dir', sokh: r['official_name'], district: r['district'], khoroo: r['khoroo'], reason: 'directory дотор аль хэдийн бий' });
      continue;
    }
    dirNameSet.add(norm); // protect from dupes within this batch
    plan.dirCreate++;
    dirPlan.push({ row: r, normName: norm });
  }

  console.log('\n=== ТӨЛӨВЛӨГӨӨ ===');
  console.log(`bulk-onboard (sokh_organizations + activation token):`);
  console.log(`  Шинэ СӨХ үүсгэх:                  ${plan.cleanCreate}`);
  console.log(`  Одоо байгаа СӨХ-д шинэ код:       ${plan.cleanReuse}`);
  console.log(`  Идэвхтэй учир алгасах:            ${plan.cleanActive}`);
  console.log(`  Хороо шийдэгдээгүй:               ${plan.cleanFail}`);
  console.log(`directory (hoa_directory):`);
  console.log(`  Шинэ бичлэг:                      ${plan.dirCreate}`);
  console.log(`  Аль хэдийн бий учир алгасах:      ${plan.dirDup}`);
  if (missingKhoroos.size > 0) {
    console.log(`\nDB-д алга байгаа ${missingKhoroos.size} хороо (commit-ийн үед auto-create хийнэ):`);
    for (const m of missingKhoroos.values()) {
      console.log(`  ${m.dist.name} ${m.num}-р хороо  → ${m.count} СӨХ`);
    }
  }

  if (!COMMIT) {
    console.log('\nDRY-RUN — DB-д юу ч бичээгүй.');
    console.log('Commit хийхдээ:  node scripts/import-sokh-direct.js --commit');
    if (skipped.length) {
      console.log(`\nАлгасах ${skipped.length} мөрийн жишээ:`);
      skipped.slice(0, 5).forEach(s => console.log(`  [${s.source}] ${s.sokh} (${s.district} ${s.khoroo}) — ${s.reason}`));
    }
    return;
  }

  // --- Commit ---------------------------------------------------------------

  console.log('\n=== БИЧИЖ ЭХЭЛЛЭЭ ===');
  const codeRecords = [];
  let writeFail = 0;

  // 0) Auto-create missing хороод
  if (missingKhoroos.size > 0) {
    const newKhRows = [...missingKhoroos.values()].map(m => ({
      district_id: m.dist.id,
      name: `${m.num}-р хороо`,
    }));
    const { data: created, error } = await sb.from('khoroos').insert(newKhRows).select('id, district_id, name');
    if (error) {
      console.error('  хороо нэмэх алдаа:', error.message);
      process.exit(1);
    }
    for (const k of created) {
      khoroos.push(k);
    }
    console.log(`  ${created.length} хороо нэмэгдлээ`);
    // Resolve cleanPlan rows that were marked as missing
    for (const p of cleanPlan) {
      if (p.kh) continue;
      const k = created.find(x => x.district_id === p.dist.id && x.name === `${p.missingNum}-р хороо`);
      if (k) p.kh = k;
    }
  }

  // 1) sokh_organizations + tokens
  for (let i = 0; i < cleanPlan.length; i++) {
    const p = cleanPlan[i];
    const r = p.row;
    let sokhId;
    try {
      if (p.action === 'create') {
        const { data, error } = await sb.from('sokh_organizations')
          .insert([{
            khoroo_id: p.kh.id,
            name: r['СӨХ нэр'],
            phone: r['Дарга утас'],
            unit_count: r['Айлын тоо'] ? Number(String(r['Айлын тоо']).replace(/\D/g, '')) || null : null,
            claim_status: 'pending',
          }])
          .select('id').single();
        if (error || !data) throw new Error(error?.message || 'insert failed');
        sokhId = data.id;
      } else {
        sokhId = p.existingId;
        await sb.from('sokh_organizations')
          .update({ claim_status: 'pending' }).eq('id', sokhId).neq('claim_status', 'active');
      }

      // Invalidate any prior unused token for same phone
      await sb.from('sokh_activation_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('sokh_id', sokhId).eq('contact_phone', r['Дарга утас']).is('used_at', null);

      // New 6-digit code
      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      const code_hash = await bcrypt.hash(code, BCRYPT_COST);
      const expires_at = new Date(Date.now() + CODE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const { error: tokErr } = await sb.from('sokh_activation_tokens')
        .insert([{ sokh_id: sokhId, code_hash, contact_phone: r['Дарга утас'], expires_at }]);
      if (tokErr) throw new Error(`token: ${tokErr.message}`);

      codeRecords.push({
        district: r['Дүүрэг'], khoroo: r['Хороо'], sokh: r['СӨХ нэр'],
        darga: r['Дарга нэр'], phone: r['Дарга утас'],
        code, expires_at, action: p.action, sokhId,
      });
    } catch (e) {
      writeFail++;
      skipped.push({ source: 'clean', sokh: r['СӨХ нэр'], district: r['Дүүрэг'], khoroo: r['Хороо'], reason: `WRITE: ${e.message}` });
    }
    if ((i + 1) % 100 === 0) console.log(`  ... clean ${i + 1}/${cleanPlan.length}`);
  }

  // 2) hoa_directory
  let dirInserted = 0;
  for (let i = 0; i < dirPlan.length; i += 100) {
    const chunk = dirPlan.slice(i, i + 100).map(p => ({
      official_name: p.row['official_name'],
      normalized_name: p.normName,
      display_name: p.row['display_name'] || null,
      district: p.row['district'] || null,
      khoroo: p.row['khoroo'] || null,
      address: p.row['address'] || null,
      phone: p.row['phone'] || null,
      unit_count: p.row['unit_count'] ? Number(String(p.row['unit_count']).replace(/\D/g, '')) || null : null,
      status: 'PENDING',
      source: 'manual:normalize-sokh-xlsx',
    }));
    const { error, count } = await sb.from('hoa_directory').insert(chunk, { count: 'exact' });
    if (error) {
      console.error('  hoa_directory chunk алдаа:', error.message);
      writeFail += chunk.length;
    } else {
      dirInserted += chunk.length;
    }
  }

  // Write codes CSV
  const codeLines = ['Дүүрэг,Хороо,СӨХ нэр,Дарга нэр,Утас,Идэвхжүүлэх код,Хүчинтэй хүртэл,Үйлдэл,sokh_id'];
  for (const c of codeRecords) {
    codeLines.push([c.district, c.khoroo, c.sokh, c.darga, c.phone, c.code, c.expires_at, c.action, c.sokhId].map(csvEscape).join(','));
  }
  fs.writeFileSync(CODES_OUT, '﻿' + codeLines.join('\n'), 'utf8');

  // Write skipped CSV
  const skipLines = ['Эх,СӨХ нэр,Дүүрэг,Хороо,Шалтгаан'];
  for (const s of skipped) {
    skipLines.push([s.source, s.sokh, s.district, s.khoroo, s.reason].map(csvEscape).join(','));
  }
  fs.writeFileSync(SKIP_OUT, '﻿' + skipLines.join('\n'), 'utf8');

  console.log('\n=== ҮР ДҮН ===');
  console.log(`  Кодтой бүртгэгдсэн СӨХ:    ${codeRecords.length}`);
  console.log(`  Directory шинэ бичлэг:     ${dirInserted}`);
  console.log(`  Бичих үед алдаа:           ${writeFail}`);
  console.log(`\nГаргасан файлууд:`);
  console.log(`  Кодын жагсаалт: ${CODES_OUT}`);
  console.log(`  Алгассан:       ${SKIP_OUT}`);
})().catch(e => { console.error(e); process.exit(1); });
