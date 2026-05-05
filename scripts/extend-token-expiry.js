// Extend the expiry of all unused activation tokens to 2099-12-31, so the
// pre-generated codes stay valid until the SOKH is actually contacted and
// onboarded. When admin clicks "🔁 Шинэ код" on a specific SOKH, that SOKH's
// old token will be invalidated and a fresh one issued — the existing
// per-SOKH flow handles that automatically.

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const ROOT = path.resolve(__dirname, '..');
const env = {};
fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/).forEach(l => {
  const m = l.match(/^([^#=]+)=(.*)$/); if (m) env[m[1].trim()] = m[2].trim();
});
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const COMMIT = process.argv.includes('--commit');
const FAR_FUTURE = '2099-12-31T23:59:59Z';

(async () => {
  console.log(`Mode: ${COMMIT ? 'COMMIT' : 'DRY-RUN'}`);

  // Зөвхөн ашиглагдаагүй token-уудыг шинэчлэнэ (used_at IS NULL)
  const { count: total } = await sb.from('sokh_activation_tokens')
    .select('*', { count: 'exact', head: true })
    .is('used_at', null);
  console.log('Хүчинтэй (ашиглагдаагүй) token:', total);

  if (!COMMIT) {
    console.log(`\nDRY-RUN. Шинэчлэхдээ: node scripts/extend-token-expiry.js --commit`);
    console.log(`Шинэчлэх expires_at → ${FAR_FUTURE}`);
    return;
  }

  const { error, count } = await sb.from('sokh_activation_tokens')
    .update({ expires_at: FAR_FUTURE }, { count: 'exact' })
    .is('used_at', null);
  if (error) { console.error(error); process.exit(1); }
  console.log(`Шинэчилсэн token:`, count);
})();
