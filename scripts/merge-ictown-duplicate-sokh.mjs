// «АйСиТаун» СӨХ — давхар үүссэн 3 СӨХ-ийг (#2697 «Ic town сөх», #2698 «АЙ Си таун»,
// #2703 «АЙ таун сөх»)
// жинхэнэ #2694 «АйСиТаун СӨХ»-д нэгтгээд устгана.
//
// Энэ нь ЗӨВХӨН энэ нэг тохиолдолд зориулсан нэг удаагийн скрипт (2026-10-26).
//
// Юу болсон бэ: 10-20, 10-21-нд бүртгэлийн урсгалаар оршин суугчид СӨХ-ийн нэрийг
// өөрөөр бичээд шинэ СӨХ үүссэн (register-ийн давхардлын шалгалт 10-21-ний орой
// нэмэгдсэн, латин «Ic town»-ыг одоо ч танихгүй). Хайлтад 3 нэр харагдаж, 9 айл
// буруу СӨХ-д бүртгүүлсэн → нэхэмжлэх, өрөө харахгүй, даргад харагдахгүй.
//
//   MERGE — утас таарсан, даргын мөр аккаунтгүй → аккаунт, нэр, утсыг даргын мөрт
//           шилжүүлж (өр, талбай даргынхаар), давхар мөрийг устгана.
//   MOVE  — #2694 руу шилжүүлж байрыг зөв «блок-орц» болгоно. floor-ыг ХӨНДӨХГҮЙ
//           (хоосон) — нэхэмжлэх зөвхөн даргын мөрт очно, давхар нэхэмжлэх гарахгүй.
//           Дарга «өөрөө бүртгүүлсэн» гэж харж баталгаажуулна.
//   KEEP  — байр тодорхойгүй: зөвхөн СӨХ-ийг солино, байрыг дарга тодруулна.
//
// Ажиллуулах:
//   node scripts/merge-ictown-duplicate-sokh.mjs            # dry-run: юу ч бичихгүй
//   node scripts/merge-ictown-duplicate-sokh.mjs --commit   # бодитоор бичнэ

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
const DUPES = [2697, 2698, 2703];
const EXPECTED_NAME = 'АйСиТаун СӨХ';

// [давхар мөр, даргын мөрийн байр, тоот] — утас таарсан (2026-10-26 шалгасан)
const MERGES = [
  [3331, '1-1', '1102'], // «498» 1102 — 1-1-1102-ын утастай ижил
  [3341, '2-1', '903'],  // #2698-д «2-1» 903 — утас, нэр хоёулаа таарсан
];
// [мөр, зөв байр]
const MOVES = [
  [3338, '2-1'], // «2-1» 604
  [3337, '2-1'], // «2-1» 807
  [3340, '2-1'], // «2r bair» 1101
  [3327, '5-2'], // «205» 1609 → 2-р орц (06–10)
  [3335, '2-2'], // «498» 512 → зөвхөн 498-2-ын 2-р орцонд 12 бий
  [3334, '2-2'], // #2703-т «498/2» 1010 → зөвхөн 2-р орцонд 10 бий
  [3336, '1-1'], // «498» 1106 — 1-1-1106-ын нэртэй ижил, даргын мөр өөр аккаунттай → тусдаа гишүүн
];
// Байр тодорхойгүй — СӨХ-ийг л солино
const KEEPS = [
  3330, // байргүй, 1103 — 1-1/2-1/3-1/5-1 аль нь ч байж болно
  3309, // «598» 114 — 598 гэж байр алга (498-2-114 байж магадгүй)
];
const CARRY = ['name', 'phone', 'auth_user_id', 'resident_type', 'household_size', 'move_in_date', 'profile_completed_at'];

const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data; };

const { data: org } = await sb.from('sokh_organizations').select('id, name, claim_status').eq('id', SOKH).single();
if (org?.name !== EXPECTED_NAME || org.claim_status !== 'active') throw new Error(`#${SOKH} хүлээгдээгүй төлөвтэй: ${JSON.stringify(org)}`);

const dupOrgs = must(await sb.from('sokh_organizations').select('*').in('id', DUPES), 'dup orgs');
for (const o of dupOrgs) if (o.claim_status !== 'unclaimed') throw new Error(`#${o.id} эзэнтэй (${o.claim_status}) — гараар шалгана`);

const strays = must(await sb.from('residents').select('*').in('sokh_id', DUPES), 'strays');
const byId = Object.fromEntries(strays.map(r => [r.id, r]));
const planned = new Set([...MERGES.map(m => m[0]), ...MOVES.map(m => m[0]), ...KEEPS]);
const unplanned = strays.filter(r => !planned.has(r.id));
if (unplanned.length) throw new Error(`Төлөвлөгөөнд ороогүй шинэ мөр: ${unplanned.map(r => r.id).join(', ')} — скриптийг шинэчилнэ`);

const push = must(await sb.from('push_subscriptions').select('id, sokh_id').in('sokh_id', DUPES), 'push');
const testers = must(await sb.from('play_tester_signups').select('*').in('sokh_id', DUPES), 'testers');

// Нөөц — PII агуулна, тиймээс репод бус түр фолдерт
const backup = path.join(os.tmpdir(), `ictown-dup-sokh-backup-${Date.now()}.json`);
fs.writeFileSync(backup, JSON.stringify({ dupOrgs, strays, push, testers }, null, 1));

const digits = s => String(s || '').replace(/\D/g, '').slice(-8);

const merges = [];
for (const [id, building, apartment] of MERGES) {
  const d = byId[id];
  if (!d) { console.log(`⏭  #${id} алга`); continue; }
  const t = must(await sb.from('residents').select('*').eq('sokh_id', SOKH).eq('building', building)
    .eq('apartment', apartment).not('floor', 'is', null), 'target');
  if (t.length !== 1) { console.log(`❌ #${id}: ${building}-${apartment} даргын мөр ${t.length} — алгасав`); continue; }
  if (t[0].auth_user_id) { console.log(`❌ #${id}: #${t[0].id} аль хэдийн аккаунттай — алгасав`); continue; }
  if (digits(t[0].phone) !== digits(d.phone)) { console.log(`❌ #${id}: утас таарахгүй — алгасав`); continue; }
  const patch = { pending_claim: false };
  for (const k of CARRY) if (d[k] !== null && d[k] !== '' && d[k] !== undefined) patch[k] = d[k];
  merges.push({ d, t: t[0], patch });
  console.log(`✔ нэгтгэх #${d.id} «${d.building ?? ''} ${d.apartment}» → #${t[0].id} ${building}-${apartment} · өр ${t[0].debt}₮`);
}

const moves = [];
for (const [id, building] of MOVES) {
  const r = byId[id];
  if (!r) { console.log(`⏭  #${id} алга`); continue; }
  const [block, entrance] = building.split('-');
  moves.push({ r, patch: { sokh_id: SOKH, building, block, entrance } });
  console.log(`✔ шилжүүлэх #${r.id} «${r.building ?? ''} ${r.apartment}» → #${SOKH} ${building}-${r.apartment} (өөрөө бүртгүүлсэн)`);
}
for (const id of KEEPS) {
  const r = byId[id];
  if (!r) { console.log(`⏭  #${id} алга`); continue; }
  moves.push({ r, patch: { sokh_id: SOKH } });
  console.log(`✔ шилжүүлэх #${r.id} «${r.building ?? ''} ${r.apartment}» → #${SOKH}, байрыг дарга тодруулна`);
}
console.log(`✔ push_subscriptions ${push.length} → #${SOKH}`);
console.log(`✔ play_tester_signups ${testers.length} → #${SOKH}`);
console.log(`✔ устгах: ${dupOrgs.map(o => `#${o.id} «${o.name}»`).join(', ')}`);

if (!COMMIT) {
  console.log(`\n🔍 DRY-RUN — юу ч бичсэнгүй. Нөөц: ${backup}`);
  console.log('   Бичихдээ: node scripts/merge-ictown-duplicate-sokh.mjs --commit');
  process.exit(0);
}

for (const { d, t, patch } of merges) {
  // 1) давхар мөрийн аккаунтыг суллана (нэг аккаунт хоёр мөрт байхаас сэргийлнэ)
  must(await sb.from('residents').update({ auth_user_id: null }).eq('id', d.id).select('id'), 'release');
  // 2) даргын мөрт шилжүүлнэ — зэрэг хэн нэгэн холбогдсон бол буцаана
  const r = await sb.from('residents').update(patch).eq('id', t.id).is('auth_user_id', null).select('id');
  if (r.error || !r.data.length) {
    await sb.from('residents').update({ auth_user_id: d.auth_user_id }).eq('id', d.id);
    throw new Error(`#${d.id} → #${t.id} бүтсэнгүй, буцаав ${r.error?.message || ''}`);
  }
  must(await sb.from('play_tester_signups').update({ resident_id: t.id }).eq('resident_id', d.id).select('id'), 'tester repoint');
  must(await sb.from('residents').delete().eq('id', d.id).select('id'), 'delete dup');
  console.log(`✅ ${t.building}-${t.apartment} нэгтгэв`);
}

for (const { r, patch } of moves) {
  must(await sb.from('residents').update(patch).eq('id', r.id).select('id'), `move #${r.id}`);
  console.log(`✅ #${r.id} → #${SOKH} ${patch.building ?? r.building ?? ''}-${r.apartment}`);
}

must(await sb.from('push_subscriptions').update({ sokh_id: SOKH }).in('sokh_id', DUPES).select('id'), 'push');
must(await sb.from('play_tester_signups').update({ sokh_id: SOKH }).in('sokh_id', DUPES).select('id'), 'testers');

// Устгахаас өмнө: үлдсэн холбоос байвал зогсоно (CASCADE-аар юу ч алдахгүй)
const left = must(await sb.from('residents').select('id').in('sokh_id', DUPES), 'left residents');
const leftPush = must(await sb.from('push_subscriptions').select('id').in('sokh_id', DUPES), 'left push');
const leftTest = must(await sb.from('play_tester_signups').select('id').in('sokh_id', DUPES), 'left testers');
if (left.length || leftPush.length || leftTest.length) {
  throw new Error(`Холбоос үлдсэн — устгасангүй: residents ${left.length}, push ${leftPush.length}, testers ${leftTest.length}`);
}
const del = must(await sb.from('sokh_organizations').delete().in('id', DUPES).select('id, name'), 'delete orgs');
console.log(`✅ устгав: ${del.map(o => `#${o.id} «${o.name}»`).join(', ')}`);

const { count } = await sb.from('residents').select('id', { count: 'exact', head: true }).eq('sokh_id', SOKH);
console.log(`\n#${SOKH} «${EXPECTED_NAME}» нийт айл: ${count}`);
console.log(`Нөөц: ${backup}`);
