// Идэвхжүүлэх код гаргаж PLAINTEXT-ийг хэвлэнэ (issue-activation route-ийн логик).
// Ажиллуулах: node scripts/issue-activation-code.js <sokh_id> <contact_phone>
// Жишээ:      node scripts/issue-activation-code.js 2679 85037090

const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { randomInt } = require('crypto');
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
if (!URL || !KEY) { console.error('❌ SUPABASE env алга'); process.exit(1); }
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const CODE_TTL_DAYS = 7;
const sokhId = parseInt(process.argv[2], 10);
const phone = (process.argv[3] || '').trim();
if (!Number.isFinite(sokhId) || sokhId <= 0) { console.error('❌ sokh_id буруу'); process.exit(1); }
if (!/^\d{8}$/.test(phone)) { console.error('❌ Утас 8 оронтой байх ёстой'); process.exit(1); }

(async () => {
  const { data: org, error: oe } = await sb
    .from('sokh_organizations').select('id, name, claim_status').eq('id', sokhId).single();
  if (oe || !org) { console.error('❌ СӨХ олдсонгүй'); process.exit(1); }
  if (org.claim_status === 'active') { console.error('⚠️ Энэ СӨХ нэгэнт ИДЭВХТЭЙ — админ үүссэн байна'); process.exit(1); }

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const code_hash = await bcrypt.hash(code, 12);
  const expires_at = new Date(Date.now() + CODE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Хуучин ашиглаагүй кодуудыг хүчингүй болгох (нэг идэвхтэй код)
  await sb.from('sokh_activation_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('sokh_id', sokhId).eq('contact_phone', phone).is('used_at', null);

  const { error: ie } = await sb.from('sokh_activation_tokens').insert([{
    sokh_id: sokhId, code_hash, contact_phone: phone, expires_at, created_by_superadmin_id: null,
  }]);
  if (ie) { console.error('❌ Код үүсгэж чадсангүй:', ie.message); process.exit(1); }

  if (org.claim_status === 'unclaimed') {
    await sb.from('sokh_organizations').update({ claim_status: 'pending' }).eq('id', sokhId);
  }

  console.log('\n✅ ШИНЭ КОД ГАРЛАА\n');
  console.log('   СӨХ   : #' + org.id + '  ' + org.name);
  console.log('   Утас  : ' + phone);
  console.log('   ┌──────────────┐');
  console.log('   │   КОД: ' + code + '  │');
  console.log('   └──────────────┘');
  console.log('   Хүчинтэй: ' + expires_at + ' хүртэл (7 хоног)\n');
  console.log('   Дарга /activate дээр: СӨХ="' + org.name + '" + код=' + code + ' + утас=' + phone + '\n');
})();
