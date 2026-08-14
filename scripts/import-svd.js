// СВД СӨХ (sokh_id=1787) — 43 айлын бүртгэл + өрийн үлдэгдэл.
//
// Энэ бол ЗӨВХӨН энэ нэг СӨХ-д зориулсан нэг удаагийн скрипт (аппын кодыг өөрчлөхгүй).
//
// Эх сурвалж: даргаас ирсэн 2 хуудас өрийн тайлан (ажилтан ГАНБАТ гаргасан).
//   - Байр 3.1, хаалга 0002–0043, 39 мөр өртэй
//   - Нийт өр 22,686,123₮ — скрипт энэ дүнг өөрөө шалгана, зөрвөл зогсоно
//   - 0001, 0008, 0021, 0024 хаалга жагсаалтад алга = өргүй тул 0₮-өөр үүснэ
//
// Онцлог: тайланд НЭР ч, УТАС ч байхгүй.
//   → нэрийг "<тоот> тоот" болгоно, утас хоосон үлдэнэ.
//   → утасгүй тул нэвтрэх аккаунт ҮҮСГЭХГҮЙ. Утас ирэхэд /admin/residents-ээс
//     нэмээд "Нууц үг сэргээх" дарж эрхийг нь нээнэ.
//
// Сарын хураамж: тайлангаас баттай мэдэгдэхгүй тул 0₮-өөр үүсгэнэ.
//   (СӨХ-ийн ерөнхий 50,000₮ нь лавлахын анхдагч утга — бодит тариф биш.
//    null орхивол тэр буруу дүн даргад харагдана. Дарга жинхэнэ тарифаа
//    оруулах хүртэл зөвхөн өр харагдана.)
//
// Ажиллуулах:
//   node scripts/import-svd.js            # dry-run: юу болохыг харуулна
//   node scripts/import-svd.js --commit   # бодитоор бичнэ

const path = require('path');
const fs = require('fs');

const SOKH_ID = 1787;
const EXPECTED_TOTAL = 22_686_123;
const TOTAL_UNITS = 43;

// Тайлангаас уншсан: [хаалга, өр]
const DEBTS = [
  ['0002', 704900], ['0003', 1677558], ['0004', 138575], ['0005', 302100],
  ['0006', 85430], ['0007', 352450], ['0009', 176750], ['0010', 436700],
  ['0011', 743970], ['0012', 35350], ['0013', 247450], ['0014', 124800],
  ['0015', 151050], ['0016', 35350], ['0017', 1212810], ['0018', 503500],
  ['0019', 459550], ['0020', 251750], ['0022', 458350], ['0023', 822110],
  ['0025', 453150], ['0026', 471650], ['0027', 2056952], ['0028', 604200],
  ['0029', 654550], ['0030', 476800], ['0031', 1369090], ['0032', 1653542],
  ['0033', 518000], ['0034', 939320], ['0035', 623790], ['0036', 136050],
  ['0037', 1825946], ['0038', 553850], ['0039', 50350], ['0040', 176750],
  ['0041', 50350], ['0042', 92500], ['0043', 1058780],
];

const COMMIT = process.argv.includes('--commit');

function getClient() {
  const ENV_FILE = path.join(path.resolve(__dirname, '..'), '.env.local');
  if (fs.existsSync(ENV_FILE)) {
    for (const line of fs.readFileSync(ENV_FILE, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) {
        let v = m[2].trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        if (!process.env[m[1]]) process.env[m[1]] = v;
      }
    }
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL эсвэл SUPABASE_SERVICE_ROLE_KEY алга.');
    process.exit(1);
  }
  const { createClient } = require(path.resolve(__dirname, '../node_modules/@supabase/supabase-js'));
  return createClient(url, key, { auth: { persistSession: false } });
}

// Тайлангийн нийт дүнтэй тулгах — уншилт буруу бол энд зогсоно
function buildRows() {
  const sum = DEBTS.reduce((s, [, d]) => s + d, 0);
  if (sum !== EXPECTED_TOTAL) {
    console.error(`❌ Өрийн нийлбэр зөрж байна: ${sum.toLocaleString()} ≠ ${EXPECTED_TOTAL.toLocaleString()}`);
    process.exit(1);
  }
  const debtByDoor = new Map(DEBTS);
  const rows = [];
  for (let i = 1; i <= TOTAL_UNITS; i++) {
    const door = String(i).padStart(4, '0');
    const apartment = String(i);           // "0002" → "2" (оршин суугчид ойлгомжтой)
    rows.push({
      sokh_id: SOKH_ID,
      apartment,
      name: `${apartment} тоот`,
      phone: null,
      debt: debtByDoor.get(door) || 0,
      monthly_fee: 0,                      // жинхэнэ тарифыг дарга оруулна
      area_sqm: 0,
      unit_kind: 'household',
      bank_customer_code: apartment,
      pending_claim: false,
    });
  }
  return rows;
}

(async () => {
  const rows = buildRows();
  const withDebt = rows.filter(r => r.debt > 0);
  const total = rows.reduce((s, r) => s + r.debt, 0);

  console.log(`\n📋 СВД СӨХ (id=${SOKH_ID})`);
  console.log(`   Үүсгэх айл       : ${rows.length}`);
  console.log(`   Өртэй            : ${withDebt.length}`);
  console.log(`   Өргүй (0₮)       : ${rows.length - withDebt.length} → ${rows.filter(r => !r.debt).map(r => r.apartment).join(', ')}`);
  console.log(`   Нийт өр          : ${total.toLocaleString()}₮  ✅ тайлангийн дүнтэй таарсан`);
  console.log(`   Утас             : байхгүй → нэвтрэх аккаунт үүсэхгүй`);

  const sb = getClient();

  const { data: org } = await sb.from('sokh_organizations').select('id, name, claim_status').eq('id', SOKH_ID).single();
  if (!org) { console.error('❌ СӨХ олдсонгүй'); process.exit(1); }
  console.log(`\n🏢 ${org.name} (${org.claim_status})`);

  const { data: existing } = await sb.from('residents').select('id, apartment').eq('sokh_id', SOKH_ID);
  if (existing && existing.length) {
    console.error(`\n❌ Энэ СӨХ дээр аль хэдийн ${existing.length} айл бүртгэлтэй байна. Давхардуулахгүйн тулд зогслоо.`);
    console.error(`   Байгаа тоотууд: ${existing.map(r => r.apartment).join(', ')}`);
    process.exit(1);
  }

  if (!COMMIT) {
    console.log('\n🔍 DRY-RUN — юу ч бичээгүй. Эхний 5 мөр:');
    rows.slice(0, 5).forEach(r => console.log('  ', JSON.stringify(r)));
    console.log('\n   Бодитоор оруулах бол: node scripts/import-svd.js --commit');
    return;
  }

  const { error } = await sb.from('residents').insert(rows);
  if (error) { console.error('❌ Оруулах алдаа:', error.message); process.exit(1); }

  await sb.from('sokh_organizations').update({ unit_count: TOTAL_UNITS }).eq('id', SOKH_ID);

  const { count } = await sb.from('residents').select('id', { count: 'exact', head: true }).eq('sokh_id', SOKH_ID);
  console.log(`\n✅ Дууслаа. DB дээр ${count} айл бүртгэгдлээ.`);
  console.log('   Дараагийн алхам: даргад идэвхжүүлэх код өгөх → утасны жагсаалт авах → тариф оруулах');
})();
