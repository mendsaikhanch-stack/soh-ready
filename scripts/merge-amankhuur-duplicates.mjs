// «Аман хуур дижитал» СӨХ (#2696) — буруу бүртгэгдсэн айлуудыг зөв мөрт нь нэгтгэнэ.
//
// Энэ нь ЗӨВХӨН энэ нэг СӨХ-д зориулсан нэг удаагийн скрипт (2026-10-21).
//
// Юу болсон бэ:
//   • 3 айл байраа «33» гэж бичээд орцоо тусад нь бичсэн → даргын мөртэй
//     (building = «33В» г.м.) таарахгүй, шинэ мөр болсон.
//   • 4 айл СӨХ-ийг жагсаалтаас сонгохын оронд нэрээ гараар бичиж давхар СӨХ
//     үүсгэсэн: #2700 «Аманхуур Дижитал», #2699 «хотол сөх».
//
// Айл бүрд: давхар мөрийн аккаунт, нэр, утас, профайлыг даргын импортолсон
// мөрт шилжүүлж (өр, талбай нь даргынхаар үлдэнэ), давхар мөрийг устгана.
// Дараа нь хоосорсон давхар СӨХ-үүдийг устгана (residents-ээс өөр өгөгдөлгүйг
// 2026-10-21-нд шалгасан).
//
// Ажиллуулах:
//   node scripts/merge-amankhuur-duplicates.mjs            # dry-run: юу ч бичихгүй
//   node scripts/merge-amankhuur-duplicates.mjs --commit   # бодитоор бичнэ

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COMMIT = process.argv.includes('--commit');

for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) {
    let v = m[2].trim();
    if (/^["'].*["']$/.test(v)) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const SOKH = 2696;
const DUP_SOKHS = [2699, 2700];
// [давхар мөрийн id, зөв байр, зөв тоот] — байрыг дарга/оршин суугчаас баталгаажуулсан
const MOVES = [
  [3315, '33В', '58'], // утас нь даргын бүртгэлтэй таарсан, 10-21-нд баталгаажуулав
  [3312, '33Г', '62'], // 10-21-нд баталгаажуулав
  [3313, '33Б', '16'], // #2699-д «33б / 16тоот»
  [3314, '33В', '72'], // #2699
  [3319, '33В', '63'], // #2700
  [3316, '33Б', '68'], // #2700
  [3317, '33В', '11'], // «33-11», 10-21-нд баталгаажуулав
];
const CARRY = ['name', 'phone', 'auth_user_id', 'resident_type', 'household_size', 'move_in_date', 'profile_completed_at'];

const ids = MOVES.map(m => m[0]);
const { data: dups, error: e1 } = await sb.from('residents').select('*').in('id', ids);
if (e1) throw e1;
const { data: targets, error: e2 } = await sb.from('residents').select('*').eq('sokh_id', SOKH)
  .in('building', [...new Set(MOVES.map(m => m[1]))]).in('apartment', MOVES.map(m => m[2]));
if (e2) throw e2;

// Нөөц — PII агуулна, тиймээс репод бус түр фолдерт
const backup = path.join(os.tmpdir(), `amankhuur-merge-backup-${Date.now()}.json`);
fs.writeFileSync(backup, JSON.stringify({ dups, targets }, null, 1));

const plan = [];
for (const [dupId, building, unit] of MOVES) {
  const d = dups.find(r => r.id === dupId);
  const t = targets.find(r => r.building === building && r.apartment === unit);
  if (!d) { console.log(`⏭  #${dupId} алга (аль хэдийн нэгтгэсэн?)`); continue; }
  if (!t) { console.log(`❌ #${dupId}: ${building}-${unit} мөр олдсонгүй — алгасав`); continue; }
  if (t.auth_user_id) { console.log(`❌ #${dupId}: ${building}-${unit} аль хэдийн өөр аккаунттай — алгасав`); continue; }
  const patch = { pending_claim: false };
  for (const k of CARRY) if (d[k] !== null && d[k] !== '' && d[k] !== undefined) patch[k] = d[k];
  plan.push({ d, t, patch });
  console.log(`✔ #${d.id} (СӨХ #${d.sokh_id}, «${d.building}-${d.apartment}») → #${t.id} ${building}-${unit} · өр ${t.debt}₮ · ${Object.keys(patch).join(', ')}`);
}

if (!COMMIT) {
  console.log(`\n🔍 DRY-RUN — юу ч бичсэнгүй. Нөөц: ${backup}`);
  console.log('   Бичихдээ: node scripts/merge-amankhuur-duplicates.mjs --commit');
  process.exit(0);
}

for (const { d, t, patch } of plan) {
  // 1) давхар мөрийн аккаунтыг суллана (нэг аккаунт хоёр мөрт байхаас сэргийлнэ)
  let r = await sb.from('residents').update({ auth_user_id: null }).eq('id', d.id).select('id');
  if (r.error) throw r.error;
  // 2) даргын мөрт шилжүүлнэ — зэрэг хэн нэгэн холбогдсон бол буцаана
  r = await sb.from('residents').update(patch).eq('id', t.id).is('auth_user_id', null).select('id');
  if (r.error || !r.data.length) {
    await sb.from('residents').update({ auth_user_id: d.auth_user_id }).eq('id', d.id);
    console.log(`❌ #${d.id} → #${t.id} бүтсэнгүй, буцаав`, r.error?.message || '');
    continue;
  }
  // 3) давхар мөрийг устгана
  r = await sb.from('residents').delete().eq('id', d.id);
  if (r.error) throw r.error;
  console.log(`✅ ${t.building}-${t.apartment} нэгтгэв`);
}

for (const id of DUP_SOKHS) {
  const { count } = await sb.from('residents').select('id', { count: 'exact', head: true }).eq('sokh_id', id);
  if (count) { console.log(`⚠️  СӨХ #${id}-д ${count} айл үлдсэн — устгасангүй`); continue; }
  const { error } = await sb.from('sokh_organizations').delete().eq('id', id);
  console.log(error ? `❌ СӨХ #${id}: ${error.message}` : `🗑  давхар СӨХ #${id} устгав`);
}

const { data: left } = await sb.from('residents').select('building').eq('sokh_id', SOKH);
const c = {};
for (const x of left) c[x.building] = (c[x.building] || 0) + 1;
console.log('\n#2696 байраар:', c, '· нийт', left.length);
console.log(`Нөөц: ${backup}`);
