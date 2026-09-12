/**
 * СӨХ тус бүрийн идэвхжилтийн зураглал — өдөр бүр ажиллуулж явцаа хар.
 *
 *   node scripts/sokh-activation-report.mjs
 *
 * Багануудын утга:
 *   айл     — системд орсон айлын тоо (гараж, дэлгүүрийг оруулаагүй)
 *   данс    — нэвтрэх бүртгэл үүссэн
 *   орсон   — нэг ч удаа нэвтэрч үзсэн
 *   30хон   — сүүлийн 30 хоногт нэвтэрсэн  ← ЭНЭ ТООГ ӨСГӨХ НЬ ЗОРИЛГО
 *   унтсан  — данстай ч хэзээ ч ороогүй    ← хамгийн хурдан идэвхжих бүлэг
 *   дансгүй — данс огт үүсээгүй
 *   утасгүй — холбогдох дугаар байхгүй     ← зөвхөн QR-аар хүрнэ
 *
 * Зөвхөн УНШИНА, юу ч өөрчлөхгүй.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envText = readFileSync(resolve(__dirname, '../.env.local'), 'utf-8');
const env = {};
for (const line of envText.split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/\r$/, '').replace(/^["']|["']$/g, '');
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: res } = await sb.from('residents').select('id, sokh_id, auth_user_id, phone, unit_kind');
const sokhIds = [...new Set((res || []).map(r => r.sokh_id).filter(Boolean))];

// sokh_organizations нь 1000-аас олон мөртэй тул PostgREST-ийн анхдагч
// хязгаарт найдахгүй — хэрэгтэй id-гаараа шүүж авна.
const { data: orgs } = await sb.from('sokh_organizations').select('id, name').in('id', sokhIds);
const orgName = new Map((orgs || []).map(o => [o.id, o.name]));

const { data: admins } = await sb
  .from('admin_users').select('sokh_id, display_name').eq('role', 'admin').eq('status', 'active');
const adminName = new Map((admins || []).map(a => [a.sokh_id, a.display_name]));

const { data: authList } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
const signIn = new Map((authList.users || []).map(u => [u.id, u.last_sign_in_at]));

const now = Date.now(), DAY = 86400000;
const stat = new Map();
for (const r of res || []) {
  if (!r.sokh_id || r.unit_kind === 'business') continue;
  const s = stat.get(r.sokh_id) || { homes: 0, acct: 0, ever: 0, d30: 0, noPhone: 0 };
  s.homes++;
  if (!/^\d{8}$/.test(String(r.phone || ''))) s.noPhone++;
  if (r.auth_user_id) {
    s.acct++;
    const t = signIn.get(r.auth_user_id);
    if (t) {
      s.ever++;
      if ((now - new Date(t).getTime()) / DAY <= 30) s.d30++;
    }
  }
  stat.set(r.sokh_id, s);
}

const rows = [...stat.entries()]
  .map(([id, s]) => ({ id, name: orgName.get(id) || `#${id}`, admin: adminName.get(id), ...s }))
  .filter(r => r.homes >= 5)
  .sort((a, b) => (b.homes - b.d30) - (a.homes - a.d30));

const pad = (v, n) => String(v).padStart(n);
console.log(`\nХотол — СӨХ-ийн идэвхжилт  (${new Date().toISOString().slice(0, 10)})\n`);
console.log('СӨХ'.padEnd(26), 'айл  данс орсон 30хон унтсан дансгүй утасгүй  дарга');
console.log('─'.repeat(100));

const T = { homes: 0, acct: 0, ever: 0, d30: 0, dormant: 0, unreg: 0, noPhone: 0 };
for (const r of rows) {
  const dormant = r.acct - r.ever;
  const unreg = r.homes - r.acct;
  console.log(
    r.name.slice(0, 25).padEnd(26),
    pad(r.homes, 4), pad(r.acct, 5), pad(r.ever, 5), pad(r.d30, 5),
    pad(dormant, 6), pad(unreg, 7), pad(r.noPhone, 8), ' ',
    (r.admin || '⚠ дарга алга').slice(0, 22),
  );
  T.homes += r.homes; T.acct += r.acct; T.ever += r.ever; T.d30 += r.d30;
  T.dormant += dormant; T.unreg += unreg; T.noPhone += r.noPhone;
}
console.log('─'.repeat(100));
console.log('НИЙТ'.padEnd(26), pad(T.homes, 4), pad(T.acct, 5), pad(T.ever, 5), pad(T.d30, 5),
  pad(T.dormant, 6), pad(T.unreg, 7), pad(T.noPhone, 8));

console.log(`\n⚡ Хамгийн хурдан боломж — «унтсан» ${T.dormant} айл: данс, утас хоёул бэлэн,`);
console.log('   зөвхөн мэдэгдээгүй. Даргад нь нэвтрэх зааврыг илгээхэд л болно.');
console.log(`\n📌 QR шаардлагатай — «утасгүй» ${T.noPhone} айл: холбогдох дугаар байхгүй тул`);
console.log('   зөвхөн орцны самбар / группээр хүрнэ (node scripts/make-sokh-qr.mjs <id>).\n');
