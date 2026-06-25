// READ-ONLY: "Сэргэлэн" нэртэй СӨХ + идэвхжүүлэх кодын төлвийг шалгана.
// Ажиллуулах: node scripts/check-sergelen.js
// Шаардлага: .env.local дотор NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY байх
//   (хэрэв байхгүй бол эхлээд: vercel env pull .env.local)

const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const ENV_FILE = path.join(path.resolve(__dirname, '..'), '.env.local');
for (const line of fs.readFileSync(ENV_FILE, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) {
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error('❌ SUPABASE env алга. Эхлээд: vercel env pull .env.local');
  process.exit(1);
}
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

(async () => {
  // 1) "Сэргэлэн" нэртэй СӨХ хайх
  const { data: orgs, error: oe } = await sb
    .from('sokh_organizations')
    .select('id, name, phone, address, khoroo_id, claim_status, activated_at, khoroos(name, districts(name, cities(name)))')
    .ilike('name', '%сэргэлэн%')
    .order('id');
  if (oe) { console.error('sokh_organizations алдаа:', oe.message); process.exit(1); }

  if (!orgs || orgs.length === 0) {
    console.log('🔍 "Сэргэлэн" нэртэй СӨХ ОЛДСОНГҮЙ — бүртгэлгүй байна.');
    return;
  }

  console.log(`🔍 ${orgs.length} тохирох СӨХ олдлоо:\n`);
  for (const o of orgs) {
    const k = o.khoroos;
    const loc = k ? [k.districts?.cities?.name, k.districts?.name, k.name].filter(Boolean).join(' · ') : '—';
    console.log(`#${o.id}  ${o.name}`);
    console.log(`   Байршил : ${loc}`);
    console.log(`   Утас    : ${o.phone || '—'}`);
    console.log(`   Төлөв   : ${o.claim_status || '(хоосон)'}${o.activated_at ? '  (идэвхжсэн: ' + o.activated_at + ')' : ''}`);

    // 2) Идэвхжүүлэх кодуудыг шалгах
    const { data: toks } = await sb
      .from('sokh_activation_tokens')
      .select('id, contact_phone, expires_at, used_at, used_by_admin_id, created_at')
      .eq('sokh_id', o.id)
      .order('created_at', { ascending: false });

    if (!toks || toks.length === 0) {
      console.log('   Код     : гаргаагүй');
    } else {
      console.log(`   Код     : ${toks.length}ш бичлэг —`);
      const now = Date.now();
      for (const t of toks) {
        const expired = new Date(t.expires_at).getTime() < now;
        const state = t.used_at ? 'АШИГЛАСАН' : (expired ? 'ХУГАЦАА ДУУССАН' : 'ИДЭВХТЭЙ');
        console.log(`     - утас ${t.contact_phone} | ${state} | дуусах: ${t.expires_at}${t.used_by_admin_id ? ' | admin#' + t.used_by_admin_id : ''}`);
      }
    }

    // 3) Энэ СӨХ-д үүссэн админ байгаа эсэх
    const { data: admins } = await sb
      .from('admin_users')
      .select('id, username, role, display_name, status, created_at')
      .eq('sokh_id', o.id);
    if (admins && admins.length > 0) {
      console.log(`   Админ   : ${admins.map(a => `${a.username} (${a.role}/${a.status})`).join(', ')}`);
    } else {
      console.log('   Админ   : үүсээгүй');
    }
    console.log('');
  }
})();
