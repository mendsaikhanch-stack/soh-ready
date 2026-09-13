// «ӨРГӨӨ-142» СӨХ — 96 айлыг өрийн үлдэгдэлтэй нь бүртгэнэ.
//
// Энэ файл ЗӨВХӨН энэ нэг СӨХ-д зориулсан нэг удаагийн скрипт (аппын кодыг өөрчлөхгүй).
//
// Эх сурвалж (2026-09-13-нд хүлээн авав):
//   «ӨРГӨӨ-142 СӨХ-ны 2026 оны 01 сарын байдлаар төлбөр төлсөн төлөөгүй айл өрх»
//   — Word файл (Downloads/Өргөө142…docx), 2 баганатай нэг хүснэгт, 48+48 = 96 мөр.
//   Багана: № | Айл өрхийн тоот | СӨХ-ийн төлбөр төлөөгүй сарууд (дүн эсвэл «төлсөн»)
//
// Онцлог:
//   • Тоот нь 301…1211 — эхний 1-2 орон нь давхар (3-12 давхар). 1, 2 давхар байхгүй.
//   • Нэр, утас өгөгдөөгүй → аккаунт үүсгэхгүй. Нэвтрэлтийг QR-аар өөрсдөөр нь
//     бүртгүүлнэ. Нэрийг «<тоот> тоот» гэж бичнэ.
//   • Сарын хураамж = 55,000₮ (айлын суурь) + гараажны зогсоол бүрт 35,000₮
//     → 1 зогсоолтой 90,000₮, 2 зогсоолтой 125,000₮. Айл тус бүрд нь
//     `residents.monthly_fee`-д бичнэ.
//   • 501 тоотын нүдэнд гараар бичсэн дансны дугаар орсон байсныг хаяж, 165,000 гэж авав.
//     (Тэр тоот нь гараажны жагсаалт дээр ч шаргалаар тэмдэглэгдсэн байв.)
//   • 1111 тоотын нүд ХООСОН — «төлсөн» гэж үзэж 0 болгов.
//   • 907 ба 1206 тоот гэж БАЙХГҮЙ (дарга 2026-09-13-нд баталгаажуулав).
//   • 1108 тоот нь СӨХ-ийнх бөгөөд төлбөрөө төлсөн (дарга) → өр 0.
//
// Гараажны эх сурвалж: «Дулаан зогсоол эзэмшигчдийн бүртгэл» цаасан жагсаалт
// (28 мөр, 2026-09-13-нд зургаар авав) + даргын дараагийн засвар. Нэг тоот
// ХОЁР мөрөнд бичигдсэн нь 2 зогсоолтой гэсэн үг (909, 809, 405, 906).
// Даргын засвар: 1210 ба 803 гараажгүй БОЛСОН; 602 ба 802 хоёр гараажтай БОЛСОН.
// ЖИЧ: өрийг 2026.01-нд бодсон тул «болсон» өөрчлөлтөөс ӨМНӨХ хураамжаар
// тооцоологдсон байна (802: 180,000 = 2 × 90,000). Энэ нь зөрчил биш.
// Зогсоолын утас/машины дугаар → `docs/sokh-2693-garage.local.md` (git-д ОРОХГҮЙ).
//
// Хяналт: эх баримтад нийт дүнгийн мөр БАЙХГҮЙ тул тулгах дүн алга. Оронд нь
// скрипт давхар бүрийн тоо, нийт 96 айл, давхардал, өр бүр өөрийн сарын
// хураамжийн бүхэл үржвэр эсэхийг шалгаж хэвлэнэ.
//
// Ажиллуулах:
//   node scripts/import-orgoo-142.js               # dry-run: юу ч бичихгүй
//   node scripts/import-orgoo-142.js --commit      # бодитоор бичнэ
//
// Дахин ажиллуулахад: байгаа мөрийг давхарлахгүй, харин өр/хураамж нь энэ
// файлаас зөрж байвал ЗАСНА (дарга мэдээллээ тодруулахад дахин ажиллуулна).
//
// Сонголт (орчны хувьсагч):
//   SOKH_ID=1234       — байгаа СӨХ рүү нэмнэ (өгөхгүй бол нэрээр хайж, олдохгүй бол шинээр үүсгэнэ)
//   KHOROO_ID=5        — шинээр үүсгэхэд хороо холбоно
//   ORG_ADDRESS=…      — хаяг
//   ORG_PHONE=99112233 — даргын утас

const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const COMMIT = process.argv.includes('--commit');

// ------- СӨХ-ийн тохиргоо -------
const ORG_NAME = process.env.ORG_NAME || 'Өргөө-142 СӨХ';
// Баянгол дүүрэг, 1-р хороо, 142-р байр (дарга, 2026-09-13). khoroo #1 = БГД 1-р хороо.
const ORG_ADDRESS = process.env.ORG_ADDRESS || 'Баянгол дүүрэг, 1-р хороо, 142-р байр';
const ORG_PHONE = process.env.ORG_PHONE || '';
const KHOROO_ID = process.env.KHOROO_ID ? Number(process.env.KHOROO_ID) : 1;
const SOKH_ID = process.env.SOKH_ID ? Number(process.env.SOKH_ID) : null;
const MONTHLY_FEE = 55000;   // айлын суурь хураамж
const GARAGE_FEE = 35000;    // гараажны нэг зогсоол

// Гараажтай тоотууд — [тоот: зогсоолын тоо]
// «Дулаан зогсоол эзэмшигчдийн бүртгэл» + даргын засвар (2026-09-13). Нийт 24 зогсоол.
const GARAGE = {
  '405': 2, '501': 1, '602': 2, '607': 1, '708': 1, '709': 1,
  '802': 2, '809': 2, '906': 2, '908': 1, '909': 2,
  '1006': 1, '1007': 1, '1108': 1, '1110': 1, '1205': 1, '1207': 1, '1209': 1,
};
// Цаасан жагсаалтад БАЙГАА боловч дарга «гараажгүй болсон» гэсэн: 1210, 803.
// 806 — дарга эхэндээ «гараажтай» гэсэн ч дараа нь «гараажгүй» гэж
// залруулав (2026-09-13), цаасан жагсаалттай ч нийцэж байна.

// Өр нь ямар ч тарифын бүхэл үржвэр биш боловч ЗӨВ нь баталгаажсан тоот.
// (Хэдэн жилээр хуримтлагдсан өр — хуучин тариф, хэсэгчилсэн төлөлт холилдсон.)
const CONFIRMED_ODD = {
  '806': 'дарга: гараажгүй, СӨХ-өө төлдөггүй айл — олон жилийн хуримтлагдсан өр',
};
const feeOf = (apt) => MONTHLY_FEE + GARAGE_FEE * (GARAGE[apt] || 0);

// ------- Өгөгдөл: [тоот, 2026.01-ний өр] — «төлсөн» = 0 -------
const ROWS = [
  // Word хүснэгтийн ЗҮҮН багана (1-48)
  ['301',       0], ['302',   55000], ['303',       0], ['304',   55000],
  ['305',   55000], ['306',       0], ['307',  220000], ['308',   55000],
  ['309',       0], ['310',  385000],
  ['401',       0], ['402',   55000], ['403',  385000], ['404',  550000],
  ['405',  125000], ['406',       0], ['407',       0], ['408',   55000],
  ['409',   55000], ['410',   55000],
  ['501',  165000], ['502',  220000], ['503',       0], ['504',       0],
  ['505',   55000], ['506',  110000], ['507',       0], ['508',   55000],
  ['509',  550000], ['510',   55000],
  ['601',       0], ['602',       0], ['603',       0], ['604',   55000],
  ['605',       0], ['606',       0], ['607',       0], ['608',       0],
  ['609',       0],
  ['701',  440000], ['702',       0], ['703',  330000], ['704',       0],
  ['705',  440000], ['706',       0], ['707',  220000], ['708',       0],
  ['709',  360000],
  // Word хүснэгтийн БАРУУН багана (1-48)
  ['801',       0], ['802',  180000], ['803',       0], ['804',       0],
  ['805',       0], ['806', 1095000], ['807',   55000], ['808',   55000],
  ['809',       0],
  ['901',   55000], ['902',       0], ['903',       0], ['904',  220000],
  ['905',  110000], ['906',       0], ['908',       0], ['909',       0],
  ['1001', 275000], ['1002',      0], ['1003',      0], ['1004',      0],
  // 1006 — саяхан 2026 он дуустал төлсөн (дарга, 2026-09-13):
  // 1 сарын тайлангаас хойших 2-12 сар = 11 × 90,000₮ урьдчилгаа → сөрөг үлдэгдэл
  ['1005', 605000], ['1006', -990000], ['1007',      0], ['1008',      0],
  ['1009',  55000], ['1010',      0],
  ['1101',  55000], ['1102',  55000], ['1103',  55000], ['1104',      0],
  ['1105', 440000], ['1106',      0], ['1107',  55000], ['1108',      0],  // 1108 — СӨХ-ийнх, төлсөн
  ['1109', 330000], ['1110',  90000], ['1111',      0],  // 1111 — нүд хоосон байв
  ['1201',      0], ['1202',      0], ['1203', 220000], ['1204',      0],
  ['1205', 360000], ['1207',      0], ['1208',      0], ['1209',      0],
  ['1210',      0], ['1211',      0],
];

// Эх баримтын давхар тус бүрийн мөрийн тоо (нүдээр тоолов)
const EXPECT_PER_FLOOR = { 3: 10, 4: 10, 5: 10, 6: 9, 7: 9, 8: 9, 9: 8, 10: 10, 11: 11, 12: 10 };
const EXPECT_UNITS = 96;
// Эх баримтад БАЙХГҮЙ тоотууд — дарга «тийм тоот байхгүй» гэж баталгаажуулав
const ABSENT = ['907', '1206'];

const money = (n) => `${Number(n).toLocaleString('en-US')}₮`;
const floorOf = (apt) => Number(apt.length === 4 ? apt.slice(0, 2) : apt.slice(0, 1));

// ------- Хяналт -------
function verify() {
  const apts = ROWS.map((r) => r[0]);
  const dup = apts.filter((a, i) => apts.indexOf(a) !== i);
  const perFloor = {};
  for (const a of apts) perFloor[floorOf(a)] = (perFloor[floorOf(a)] || 0) + 1;

  console.log('🔎 Эх баримттай тулгах:');
  console.log(`   Нийт айл:    ${String(ROWS.length).padStart(4)}  (баримтад ${EXPECT_UNITS}) ${ROWS.length === EXPECT_UNITS ? '✓' : '❌'}`);
  console.log(`   Давхардал:   ${dup.length ? `❌ ${dup.join(', ')}` : 'байхгүй ✓'}`);

  let floorsOk = true;
  const floorLine = Object.keys(EXPECT_PER_FLOOR).map((f) => {
    const ok = perFloor[f] === EXPECT_PER_FLOOR[f];
    if (!ok) floorsOk = false;
    return `${f}:${perFloor[f] || 0}${ok ? '' : `≠${EXPECT_PER_FLOOR[f]}`}`;
  }).join('  ');
  console.log(`   Давхар бүр:  ${floorLine} ${floorsOk ? '✓' : '❌'}`);
  console.log(`   Байхгүй тоот: ${ABSENT.join(', ')} (дарга баталгаажуулсан)`);

  const strayGarage = Object.keys(GARAGE).filter((a) => !apts.includes(a));
  if (strayGarage.length) console.log(`   ❌ Гараажны жагсаалтад байхгүй тоот: ${strayGarage.join(', ')}`);

  return ROWS.length === EXPECT_UNITS && !dup.length && floorsOk && !strayGarage.length;
}

// ------- Supabase -------
function getClient() {
  const ENV_FILE = path.join(ROOT, '.env.local');
  if (fs.existsSync(ENV_FILE)) {
    for (const line of fs.readFileSync(ENV_FILE, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) {
        let v = m[2].trim();
        if (/^["'].*["']$/.test(v)) v = v.slice(1, -1);
        if (!process.env[m[1]]) process.env[m[1]] = v;
      }
    }
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('\n❌ NEXT_PUBLIC_SUPABASE_URL эсвэл SUPABASE_SERVICE_ROLE_KEY алга байна (.env.local).');
    process.exitCode = 1;
    return null;
  }
  const { createClient } = require('@supabase/supabase-js');
  return createClient(url, key, { auth: { persistSession: false } });
}

const ORG_COLS = 'id, name, khoroo_id, address, phone, claim_status, unit_count, monthly_fee';

async function findOrg(sb) {
  if (SOKH_ID) {
    const { data } = await sb.from('sokh_organizations').select(ORG_COLS).eq('id', SOKH_ID).maybeSingle();
    return data || null;
  }
  // «Өргөө» нэртэй СӨХ олон бий тул 142-тойг нь л хайна
  const { data } = await sb.from('sokh_organizations').select(ORG_COLS).ilike('name', '%142%');
  return (data || []).find((o) => /ргөө/i.test(o.name)) || null;
}

async function run() {
  if (!verify()) {
    console.error('\n❌ Өгөгдөл эх баримттай таарахгүй байна — засах хүртэл бичихгүй.');
    process.exitCode = 1;
    return;
  }

  // Хураангуй
  const withDebt = ROWS.filter((r) => r[1] > 0);
  const debtTotal = ROWS.reduce((s, r) => s + r[1], 0);
  const maxDebt = Math.max(...ROWS.map((r) => r[1]));
  // Өр нь 2026.01-нд бодогдсон бөгөөд зарим айлын гарааж хожим өөрчлөгдсөн тул
  // боломжит 3 тарифын АЛЬ НЭГЭД нь бүхлээр хуваагдаж байвал зөв гэж үзнэ.
  const PLAUSIBLE = [MONTHLY_FEE, MONTHLY_FEE + GARAGE_FEE, MONTHLY_FEE + 2 * GARAGE_FEE];
  const fits = (debt) => PLAUSIBLE.filter((f) => debt % f === 0);
  const noFit = withDebt.filter((r) => fits(r[1]).length === 0);
  const odd = noFit.filter(([a]) => !CONFIRMED_ODD[a]);
  const okOdd = noFit.filter(([a]) => CONFIRMED_ODD[a]);

  const prepaid = ROWS.filter((r) => r[1] < 0);
  console.log('\n📊 Өр (2026 оны 01 сарын байдлаар):');
  console.log(`   Өртэй:         ${String(withDebt.length).padStart(3)} айл · ${money(debtTotal)} (цэвэр)`);
  console.log(`   Төлсөн:        ${String(ROWS.length - withDebt.length - prepaid.length).padStart(3)} айл`);
  if (prepaid.length) {
    console.log(`   Урьдчилж төлсөн: ${prepaid.length} айл — ${prepaid.map(([a, d]) => `${a}: ${money(d)}`).join(', ')}`);
  }
  console.log(`   Хамгийн их өр: ${money(maxDebt)} (${withDebt.find((r) => r[1] === maxDebt)[0]} тоот)`);

  const spots = Object.values(GARAGE).reduce((a, b) => a + b, 0);
  const one = Object.keys(GARAGE).filter((a) => GARAGE[a] === 1);
  const two = Object.keys(GARAGE).filter((a) => GARAGE[a] === 2);
  console.log('\n🚗 Сарын хураамж:');
  console.log(`   ${money(MONTHLY_FEE).padStart(9)} × ${ROWS.length - Object.keys(GARAGE).length} айл (гараажгүй)`);
  console.log(`   ${money(MONTHLY_FEE + GARAGE_FEE).padStart(9)} × ${one.length} айл (1 зогсоол): ${one.join(', ')}`);
  console.log(`   ${money(MONTHLY_FEE + 2 * GARAGE_FEE).padStart(9)} × ${two.length} айл (2 зогсоол): ${two.join(', ')}`);
  console.log(`   Нийт ${spots} зогсоол / ${Object.keys(GARAGE).length} айл`);

  if (odd.length) {
    console.log(`\n   ⚠️  Өр нь 55,000 / 90,000 / 125,000-ын АЛЬ Ч НЭГЭНД бүхлээр хуваагдахгүй ${odd.length} тоот (даргаар шалгуулах):`);
    odd.forEach(([a, d]) => console.log(`      ${a} тоот: ${money(d).padStart(12)} — ${PLAUSIBLE.map((f) => `${(d / f).toFixed(2)}×${money(f)}`).join(' · ')}`));
  } else {
    console.log('\n   ✓ Өр бүр боломжит тарифын бүхэл үржвэр (баталгаажсанаас бусад).');
  }
  okOdd.forEach(([a, d]) => console.log(`   ✓ ${a} тоот ${money(d)} — тарифт хуваагдахгүй ч ЗӨВ: ${CONFIRMED_ODD[a]}`));

  const sb = getClient();
  if (!sb) return;

  // 1) СӨХ
  let org = await findOrg(sb);
  if (org) {
    console.log(`\n🏢 Байгаа СӨХ: #${org.id} — ${org.name} (${org.claim_status}, хороо ${org.khoroo_id ?? '—'})`);
    const orgPatch = {};
    if (KHOROO_ID && org.khoroo_id !== KHOROO_ID) orgPatch.khoroo_id = KHOROO_ID;
    if (ORG_ADDRESS && org.address !== ORG_ADDRESS) orgPatch.address = ORG_ADDRESS;
    if (ORG_PHONE && org.phone !== ORG_PHONE) orgPatch.phone = ORG_PHONE;
    if (Object.keys(orgPatch).length) {
      console.log(`   Засах: ${JSON.stringify(orgPatch)} (одоо: хороо ${org.khoroo_id ?? '—'}, хаяг ${org.address || '—'})`);
      if (COMMIT) {
        const { error } = await sb.from('sokh_organizations').update(orgPatch).eq('id', org.id);
        if (error) { console.error(`   ❌ ${error.message}`); process.exitCode = 1; return; }
        Object.assign(org, orgPatch);
        console.log('   ✓ Засав');
      }
    }
  } else {
    console.log(`\n🏢 СӨХ олдсонгүй → шинээр үүсгэнэ: "${ORG_NAME}"`);
    console.log(`   хороо: ${KHOROO_ID ?? '— (дараа холбоно)'}   утас: ${ORG_PHONE || '—'}   хаяг: ${ORG_ADDRESS || '—'}`);
    if (COMMIT) {
      const { data, error } = await sb
        .from('sokh_organizations')
        .insert([{
          name: ORG_NAME,
          address: ORG_ADDRESS || null,
          phone: ORG_PHONE || null,
          khoroo_id: KHOROO_ID,
          monthly_fee: MONTHLY_FEE,
          unit_count: ROWS.length,
          claim_status: 'pending',
        }])
        .select(ORG_COLS)
        .single();
      if (error) {
        console.error(`❌ СӨХ үүсгэж чадсангүй: ${error.message}`);
        process.exitCode = 1;
        return;
      }
      org = data;
      console.log(`   ✓ Үүсгэв: #${org.id}`);
    }
  }

  // 2) Айлууд
  const byApt = new Map();
  if (org) {
    const { data: existing, error } = await sb
      .from('residents')
      .select('id, apartment, name, phone, debt, monthly_fee, auth_user_id')
      .eq('sokh_id', org.id);
    if (error) {
      console.error(`❌ DB унших алдаа: ${error.message}`);
      process.exitCode = 1;
      return;
    }
    (existing || []).forEach((r) => byApt.set(String(r.apartment), r));
    console.log(`   Одоо DB-д: ${byApt.size} айл`);
  }

  const toCreate = ROWS.filter(([apt]) => !byApt.has(apt));
  // Байгаа мөрийн өр/хураамж энэ файлаас зөрж байвал засна
  const toFix = [];
  for (const [apt, debt] of ROWS) {
    const cur = byApt.get(apt);
    if (!cur) continue;
    const patch = {};
    if (Number(cur.debt || 0) !== debt) patch.debt = debt;
    if (Number(cur.monthly_fee || 0) !== feeOf(apt)) patch.monthly_fee = feeOf(apt);
    if (Object.keys(patch).length) toFix.push({ id: cur.id, apt, cur, patch });
  }
  // Энэ файлд байхгүй мөр (оршин суугч өөрөө бүртгүүлсэн байж болно) — гар аргаар шалгана
  const extra = [...byApt.keys()].filter((a) => !ROWS.some(([apt]) => apt === a));

  console.log(`\n🧭 Төлөвлөгөө (${COMMIT ? 'COMMIT' : 'DRY-RUN'}):`);
  console.log(`   Шинээр үүсгэх айл:   ${toCreate.length}`);
  console.log(`   Засах айл:           ${toFix.length}`);
  toFix.forEach(({ apt, cur, patch }) => {
    const parts = [];
    if ('debt' in patch) parts.push(`өр ${money(cur.debt || 0)} → ${money(patch.debt)}`);
    if ('monthly_fee' in patch) parts.push(`хураамж ${money(cur.monthly_fee || 0)} → ${money(patch.monthly_fee)}`);
    console.log(`      ${apt} тоот: ${parts.join(' · ')}`);
  });
  console.log(`   Хэвээр:              ${ROWS.length - toCreate.length - toFix.length}`);
  console.log(`   Аккаунт:             үүсгэхгүй (утас өгөгдөөгүй — QR-аар бүртгүүлнэ)`);
  if (extra.length) console.log(`   ⚠️  Энэ файлд байхгүй ${extra.length} мөр DB-д бий: ${extra.join(', ')} (гар аргаар шалга)`);

  if (!COMMIT) {
    console.log('\n🔍 DRY-RUN — юу ч бичсэнгүй. Бичихдээ: node scripts/import-orgoo-142.js --commit');
    return;
  }
  if (!toCreate.length && !toFix.length) {
    console.log('\n✅ Бичих зүйл алга.');
    return;
  }

  const payload = toCreate.map(([apartment, debt]) => ({
    name: `${apartment} тоот`,
    apartment,
    floor: String(floorOf(apartment)),
    monthly_fee: feeOf(apartment),
    debt,
    unit_kind: 'household',
    sokh_id: org.id,
  }));

  let ok = 0;
  if (payload.length) {
    console.log(`\n✍️  ${payload.length} айл бичиж байна...`);
    for (let i = 0; i < payload.length; i += 50) {
      const chunk = payload.slice(i, i + 50);
      const { error } = await sb.from('residents').insert(chunk);
      if (error) console.error(`   ❌ ${chunk[0].apartment}…${chunk[chunk.length - 1].apartment}: ${error.message}`);
      else ok += chunk.length;
    }
  }

  let fixed = 0;
  if (toFix.length) {
    console.log(`\n✍️  ${toFix.length} айл засаж байна...`);
    for (const { id, apt, patch } of toFix) {
      const { error } = await sb.from('residents').update(patch).eq('id', id);
      if (error) console.error(`   ❌ ${apt} тоот: ${error.message}`);
      else fixed++;
    }
    console.log(`   ✓ ${fixed}/${toFix.length} засагдлаа`);
  }

  const patch = {};
  if (org.unit_count !== ROWS.length) patch.unit_count = ROWS.length;
  if (Number(org.monthly_fee) !== MONTHLY_FEE) patch.monthly_fee = MONTHLY_FEE;
  if (Object.keys(patch).length) {
    const { error } = await sb.from('sokh_organizations').update(patch).eq('id', org.id);
    console.log(error ? `   ❌ СӨХ шинэчлэх алдаа: ${error.message}` : `   ✓ СӨХ шинэчлэв: ${JSON.stringify(patch)}`);
  }

  console.log(`\n✅ Шинэ ${ok}/${payload.length} · засварласан ${fixed}/${toFix.length}. СӨХ #${org.id}`);
  console.log('\n   Дараагийн алхам:');
  console.log(`     1. Даргын эрх нээх → node scripts/activate-sokh.js --id=${org.id} --commit`);
  console.log(`     2. QR хэвлүүлэх   → node scripts/make-sokh-qr.mjs ${org.id}`);
}

run().catch((e) => { console.error(e); process.exitCode = 1; });
