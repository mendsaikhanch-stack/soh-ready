// «АйСиТаун» СӨХ (#2694) — буруу байраар бүртгүүлсэн айлуудыг зөв орцонд нь оруулна.
//
// Энэ нь ЗӨВХӨН энэ нэг СӨХ-д зориулсан нэг удаагийн скрипт (2026-10-22).
//
// Юу болсон бэ: 10-08 / 10-19-нд, орц бүрийн QR гарахаас өмнө 5 хүн байраа
// гараар «5», «498/5», «498/2», «205» гэж бичээд бүртгүүлсэн → даргын
// импортолсон «блок-орц» (5-1, 2-1 …) мөртэй таарахгүй, шинэ мөр болсон.
// 5-2 нь 106–1610 дугаартай тул «5»-ын 802, «205»-ын 1603 нь зөвхөн 5-1-д бий.
//
//   MERGES — утас эсвэл нэр нь даргын мөртэй таарсан → аккаунт, нэр, утсыг
//            даргын мөрт шилжүүлж (өр, талбай нь даргынхаар үлдэнэ), давхар мөрийг устгана.
//   MOVES  — даргын мөр өөр хүн (гэр бүл / компани) → устгахгүй, зөвхөн байрыг
//            засна. Өөрөө бүртгүүлсэн тэмдэг нь үлдэж, дарга баталгаажуулна.
//
// Ажиллуулах:
//   node scripts/merge-ictown-strays.mjs            # dry-run: юу ч бичихгүй
//   node scripts/merge-ictown-strays.mjs --commit   # бодитоор бичнэ

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

const SOKH = 2694;
// [давхар мөрийн id, даргын мөрийн id]
const MERGES = [
  [3019, 2855], // «498/5» 101 → 5-1-101, утас таарсан
  [3020, 2480], // «498/2» 606 → 2-1-606, утас таарсан
  [3018, 2891], // «5» 802 → 5-1-802, нэр таарсан (Нарантуяа)
];
// [мөрийн id, зөв байр]
const MOVES = [
  [3017, '5-1'], // «5» 802 — 5-1-802-ын гэр бүлийн гишүүн
  [3022, '5-1'], // «205» 1603 — даргын мөр нь «Суврааюнит ХХК», өөр хүн
];
const CARRY = ['name', 'phone', 'auth_user_id', 'resident_type', 'household_size', 'move_in_date', 'profile_completed_at'];

const ids = [...MERGES.flat(), ...MOVES.map(m => m[0])];
const { data: rows, error: e1 } = await sb.from('residents').select('*').in('id', ids);
if (e1) throw e1;
const byId = Object.fromEntries(rows.map(r => [r.id, r]));

// Нөөц — PII агуулна, тиймээс репод бус түр фолдерт
const backup = path.join(os.tmpdir(), `ictown-strays-backup-${Date.now()}.json`);
fs.writeFileSync(backup, JSON.stringify(rows, null, 1));

const plan = [];
for (const [dupId, targetId] of MERGES) {
  const d = byId[dupId], t = byId[targetId];
  if (!d) { console.log(`⏭  #${dupId} алга (аль хэдийн нэгтгэсэн?)`); continue; }
  if (!t || t.sokh_id !== SOKH || d.sokh_id !== SOKH) { console.log(`❌ #${dupId} → #${targetId}: мөр олдсонгүй — алгасав`); continue; }
  if (t.auth_user_id) { console.log(`❌ #${dupId}: #${t.id} аль хэдийн өөр аккаунттай — алгасав`); continue; }
  if (d.apartment !== t.apartment) { console.log(`❌ #${dupId}: тоот зөрж байна (${d.apartment} ≠ ${t.apartment}) — алгасав`); continue; }
  const patch = { pending_claim: false };
  for (const k of CARRY) if (d[k] !== null && d[k] !== '' && d[k] !== undefined) patch[k] = d[k];
  plan.push({ d, t, patch });
  console.log(`✔ нэгтгэх #${d.id} «${d.building}-${d.apartment}» → #${t.id} ${t.building}-${t.apartment} · өр ${t.debt}₮ · ${Object.keys(patch).join(', ')}`);
}

const moves = [];
for (const [id, building] of MOVES) {
  const r = byId[id];
  if (!r || r.sokh_id !== SOKH) { console.log(`⏭  #${id} алга`); continue; }
  if (r.building === building) { console.log(`⏭  #${id} аль хэдийн ${building}`); continue; }
  const [block, entrance] = building.split('-');
  const floor = String(Math.floor(Number(r.apartment) / 100));
  moves.push({ r, patch: { building, block, entrance, floor } });
  console.log(`✔ байр засах #${r.id} «${r.building}-${r.apartment}» → ${building}-${r.apartment} (өөрөө бүртгүүлсэн хэвээр)`);
}

if (!COMMIT) {
  console.log(`\n🔍 DRY-RUN — юу ч бичсэнгүй. Нөөц: ${backup}`);
  console.log('   Бичихдээ: node scripts/merge-ictown-strays.mjs --commit');
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

for (const { r, patch } of moves) {
  const { error } = await sb.from('residents').update(patch).eq('id', r.id);
  console.log(error ? `❌ #${r.id}: ${error.message}` : `✅ #${r.id} → ${patch.building}-${r.apartment}`);
}

const { data: left } = await sb.from('residents').select('building').eq('sokh_id', SOKH);
const c = {};
for (const x of left) c[x.building] = (c[x.building] || 0) + 1;
console.log('\n#2694 байраар:', c, '· нийт', left.length);
console.log(`Нөөц: ${backup}`);
