/**
 * Нэг удаагийн скрипт — танилцуулгын демо СӨХ (#2678) дэх ХООСОН модулиудыг
 * итгэмээр жишээ өгөгдлөөр дүүргэнэ.
 *
 * Яагаад: khotol.com/admin-demo линкээр орсон СӨХ-ийн дарга зүүн цэсийг
 * дараалан дардаг. Ажилчид, Цалин, Санал хураалт, Илгээмж гэх мэт хоосон
 * дэлгэц гарвал «энэ систем дутуу юм байна» гэсэн сэтгэгдэл төрүүлнэ.
 *
 * Гүйлгэх: node scripts/seed-demo-modules.mjs
 * Дахин гүйлгэхэд аюулгүй — өмнө нь суулгасан мөрөө устгаад шинээр бичнэ
 * (зөвхөн ЭНЭ СӨХ-д, зөвхөн ЭНЭ скриптийн хүснэгтүүдэд).
 *
 * ⚠️ Зөвхөн демо СӨХ #2678-д хандана. Өөр СӨХ-ийн өгөгдлийг хөндөхгүй.
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
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

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const SOKH_ID = 2678;
const NOW = new Date();
const Y = NOW.getFullYear();
const M = NOW.getMonth() + 1;

// Огноог «N хоногийн өмнө» гэж бичихэд хялбар болгох
const daysAgo = (n) => new Date(NOW.getTime() - n * 86400000);
const dateOnly = (d) => d.toISOString().slice(0, 10);

let failed = 0;

async function seed(table, rows, { keep = false } = {}) {
  if (!keep) {
    const { error: delErr } = await sb.from(table).delete().eq('sokh_id', SOKH_ID);
    if (delErr) {
      console.log(`  ⚠ ${table}: цэвэрлэж чадсангүй — ${delErr.message}`);
      failed++;
      return [];
    }
  }
  const { data, error } = await sb.from(table).insert(rows).select('id');
  if (error) {
    console.log(`  ✗ ${table}: ${error.message}`);
    failed++;
    return [];
  }
  console.log(`  ✓ ${table}: ${data.length} мөр`);
  return data;
}

console.log(`Демо СӨХ #${SOKH_ID} — хоосон модулиудыг дүүргэж байна\n`);

// ---------- Хураамж хүлээн авах данс ----------
// Мөнгө СӨХ-ийн өөрийн данс руу шууд ордог загварыг харуулна.
await seed('sokh_bank_accounts', [{
  sokh_id: SOKH_ID,
  bank_name: 'Хаан банк',
  account_number: '5001234567',
  account_holder: 'Туршилтын СӨХ',
  note: 'Гүйлгээний утгад ТООТоо заавал бичнэ үү. Жишээ: «12 тоот, 9 сарын хураамж».',
  is_active: true,
}]);

// ---------- Өглөг (Санхүү ▸ Өглөг) ----------
await seed('payables', [
  {
    sokh_id: SOKH_ID, vendor: 'Лифт сервис ХХК', category: 'elevator',
    amount: 850000, paid_amount: 850000, status: 'paid',
    due_date: dateOnly(daysAgo(20)), paid_at: daysAgo(18).toISOString(),
    description: 'Лифтний сарын үйлчилгээний гэрээ',
  },
  {
    sokh_id: SOKH_ID, vendor: 'Ус сувгийн удирдах газар', category: 'other',
    amount: 1240000, paid_amount: 600000, status: 'partial',
    due_date: dateOnly(daysAgo(3)),
    description: 'Цэвэр, бохир усны төлбөр',
  },
  {
    sokh_id: SOKH_ID, vendor: 'Гэрэлтүүлэг ХХК', category: 'repair',
    amount: 320000, paid_amount: 0, status: 'pending',
    due_date: dateOnly(daysAgo(-9)),
    description: 'Орцны гэрэл солих ажлын үлдэгдэл',
  },
  {
    sokh_id: SOKH_ID, vendor: 'Хог тээвэрлэлт', category: 'cleaning',
    amount: 180000, paid_amount: 0, status: 'pending',
    due_date: dateOnly(daysAgo(-16)),
    description: '9 сарын хог ачилт',
  },
]);

// ---------- Ажилчид + Цалин ----------
const staff = await seed('staff', [
  { sokh_id: SOKH_ID, name: 'Д. Оюунчимэг', role: 'cleaner', phone: '88000101', schedule: 'Даваа–Баасан 08:00–17:00', status: 'active' },
  { sokh_id: SOKH_ID, name: 'Б. Ганзориг', role: 'security', phone: '88000102', schedule: 'Ээлжээр 12 цаг', status: 'active' },
  { sokh_id: SOKH_ID, name: 'Ж. Мөнхбат', role: 'technician', phone: '88000103', schedule: 'Дуудлагаар', status: 'active' },
]);

const SALARIES = [900000, 1100000, 1300000];
const ROLES = ['cleaner', 'security', 'technician'];
const NAMES = ['Д. Оюунчимэг', 'Б. Ганзориг', 'Ж. Мөнхбат'];

if (staff.length === 3) {
  await seed('staff_salaries', staff.map((s, i) => ({
    sokh_id: SOKH_ID, staff_id: s.id, amount: SALARIES[i],
  })));

  // НДШ 11.5% (ажилтан) / 12.5% (ажил олгогч), ХХОАТ 10% — /admin/payroll-тай ижил
  await seed('payroll_entries', staff.map((s, i) => {
    const base = SALARIES[i];
    const si_employee = Math.round(base * 0.115);
    const si_employer = Math.round(base * 0.125);
    const pit = Math.round((base - si_employee) * 0.1);
    return {
      sokh_id: SOKH_ID, staff_id: s.id, staff_name: NAMES[i], role: ROLES[i],
      year: Y, month: M, base_salary: base, bonus: 0, other_deduction: 0,
      si_employee, si_employer, pit,
      net_pay: base - si_employee - pit,
      status: i === 0 ? 'paid' : 'draft',
      paid_at: i === 0 ? daysAgo(5).toISOString() : null,
    };
  }));
}

// ---------- Хийсэн засварын тайлан ----------
await seed('maintenance_works', [
  {
    sokh_id: SOKH_ID, title: 'Орцны хаалганы цахилгаан цоож солив',
    description: '1-р орцны хаалганы цоож эвдэрсэн тул шинээр сольж, бүх айлын карт дахин тохируулав.',
    work_date: dateOnly(daysAgo(6)), photos: [],
  },
  {
    sokh_id: SOKH_ID, title: 'Дээврийн ус алдалт засав',
    description: 'Бороо орсны дараа 5-р давхарт ус дуслах гомдол ирсэн. Дээврийн битүүмжлэлийг сэргээв.',
    work_date: dateOnly(daysAgo(19)), photos: [],
  },
  {
    sokh_id: SOKH_ID, title: 'Хашааны гэрэлтүүлэг шинэчлэв',
    description: 'Хуучин чийдэнг LED-ээр сольж, шөнийн гэрэлтүүлгийг сайжруулав. Цахилгааны зарлага буурна.',
    work_date: dateOnly(daysAgo(34)), photos: [],
  },
]);

// ---------- Санал хураалт ----------
await seed('polls', [
  {
    sokh_id: SOKH_ID, title: 'Хашаанд хүүхдийн тоглоомын талбай барих уу?',
    description: 'Нийт 3.2 сая төгрөгийн зардлыг нөөц сангаас гаргах санал.',
    status: 'active', yes_count: 5, no_count: 1, total_voters: 8,
  },
  {
    sokh_id: SOKH_ID, title: 'Орцны хаалганд код тавих уу?',
    description: 'Түлхүүрийн оронд тоон код ашиглах санал.',
    status: 'closed', yes_count: 7, no_count: 1, total_voters: 8,
  },
]);

// ---------- Цахим ТУЗ ----------
await seed('proposals', [
  {
    sokh_id: SOKH_ID, kind: 'internal',
    title: 'Лифтний засварт 2.5 сая төгрөг зарцуулах',
    description: 'Тэгш тоотын лифт байнга гацаж байгаа тул үндсэн эд ангийг солих шаардлагатай.',
    budget_amount: 2500000, status: 'active',
    pass_threshold_percentage: 60, auto_approve_on_timeout: false,
    created_by: 'admin', created_by_name: 'Демо админ', result_token: randomUUID(),
    expires_at: new Date(NOW.getTime() + 7 * 86400000).toISOString(),
  },
  {
    sokh_id: SOKH_ID, kind: 'internal',
    title: 'Сарын хураамжийг 50,000₮-д хэвээр байлгах',
    description: '2027 онд хураамж нэмэхгүй байх санал.',
    budget_amount: null, status: 'passed',
    pass_threshold_percentage: 50, auto_approve_on_timeout: true,
    created_by: 'admin', created_by_name: 'Демо админ', result_token: randomUUID(),
    expires_at: daysAgo(4).toISOString(),
    finalized_at: daysAgo(4).toISOString(),
  },
]);

// ---------- Ашиглалт (ус, дулаан, цахилгаан — сүүлийн 3 сар) ----------
const utilRows = [];
for (let back = 0; back < 3; back++) {
  const d = new Date(Y, M - 1 - back, 1);
  const y = d.getFullYear(), m = d.getMonth() + 1;
  utilRows.push(
    { sokh_id: SOKH_ID, type: 'water', amount: 210 + back * 12, cost: 315000 + back * 9000, month: m, year: y },
    { sokh_id: SOKH_ID, type: 'heating', amount: 1450 + back * 60, cost: 870000 + back * 21000, month: m, year: y },
    { sokh_id: SOKH_ID, type: 'electricity', amount: 980 + back * 35, cost: 176000 + back * 4200, month: m, year: y },
  );
}
await seed('utility_usage', utilRows);

// ---------- Илгээмж ----------
await seed('packages', [
  { sokh_id: SOKH_ID, resident_name: 'Бат (демо)', unit_number: '24', carrier: 'Шуудан', description: 'Жижиг хайрцаг', pickup_code: '4821', status: 'delivered', delivered_at: daysAgo(1).toISOString() },
  { sokh_id: SOKH_ID, resident_name: 'Сараа (демо)', unit_number: '36', carrier: 'Тээвэр Эксперт', description: 'Дугуй хайрцаг', pickup_code: '9037', status: 'delivered', delivered_at: daysAgo(2).toISOString() },
  { sokh_id: SOKH_ID, resident_name: 'Оюун (демо)', unit_number: '52', carrier: 'Шуудан', description: 'Дугтуй', pickup_code: '1596', status: 'picked_up', delivered_at: daysAgo(6).toISOString(), picked_up_at: daysAgo(5).toISOString() },
]);

// ---------- Зогсоол ----------
await seed('parking_vehicles', [
  { sokh_id: SOKH_ID, plate_number: '1234УБА', car_model: 'Toyota Prius', color: 'Цагаан', resident_name: 'Бат (демо)', apartment: '24', parking_spot: 'A-03', status: 'active' },
  { sokh_id: SOKH_ID, plate_number: '5678УБВ', car_model: 'Lexus RX', color: 'Хар', resident_name: 'Сараа (демо)', apartment: '36', parking_spot: 'A-07', status: 'active' },
  { sokh_id: SOKH_ID, plate_number: '9012УНА', car_model: 'Hyundai Santa Fe', color: 'Саарал', resident_name: 'Дорж (демо)', apartment: '41', parking_spot: 'B-02', status: 'active' },
]);

// ---------- Нэхэмжлэх + төлөлт (сүүлийн 3 сар) ----------
// Яагаад: /admin/finance нь «Энэ сарын орлого»-г ЯГ ОДООГИЙН сарын payments-ээс
// бодно. Демо төлбөр 6-р сард зогссон тул 9 сард орлого 0₮, цуглуулалт 0%
// харагдаж, систем ажиллахгүй мэт сэтгэгдэл төрүүлж байв.
const FEE = 50000;
const { data: residents } = await sb
  .from('residents').select('id, name, apartment, debt').eq('sokh_id', SOKH_ID).order('id');

if (residents?.length) {
  const months = [2, 1, 0].map((back) => {
    const d = new Date(Y, M - 1 - back, 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });

  // Өртэй 4 айлаас 2 нь ЭНЭ САРЫГ төлөөгүй → цуглуулалт 75%, өр нь үлдсэн
  // (residents.debt дахь үлдэгдэлтэй зөрчилдөхгүй тайлбар).
  const debtors = residents.filter((r) => Number(r.debt) > 0).map((r) => r.id);
  const unpaidThisMonth = new Set(debtors.slice(0, 2));

  const invoices = [], payments = [];
  for (const { year, month } of months) {
    const isCurrent = year === Y && month === M;
    for (const r of residents) {
      const paid = !(isCurrent && unpaidThisMonth.has(r.id));
      // Тухайн сарын 17-нд төлсөн гэж үзнэ (ирээдүйн огноо үүсгэхгүй)
      const payDay = new Date(year, month - 1, 17);
      const paidAt = payDay > NOW ? daysAgo(1) : payDay;
      invoices.push({
        sokh_id: SOKH_ID, resident_id: r.id, year, month, amount: FEE,
        due_date: dateOnly(new Date(year, month - 1, 25)),
        status: paid ? 'paid' : 'pending',
        paid_amount: paid ? FEE : 0,
        paid_at: paid ? paidAt.toISOString() : null,
        description: 'СӨХ сарын хураамж',
      });
      if (paid) {
        payments.push({
          resident_id: r.id, amount: FEE,
          description: `СӨХ хураамж (${month}-р сар)`,
          paid_at: paidAt.toISOString(),
        });
      }
    }
  }

  await seed('invoices', invoices);

  // payments-д sokh_id байхгүй тул resident_id-ээр цэвэрлэнэ. Хуучин
  // 4–6 сарын түүхийг ҮЛДЭЭНЭ — зөвхөн энэ скриптийн 3 сарыг дахин бичнэ.
  const ids = residents.map((r) => r.id);
  const cutoff = new Date(Y, M - 3, 1).toISOString();
  const { error: delPay } = await sb
    .from('payments').delete().in('resident_id', ids).gte('paid_at', cutoff);
  if (delPay) { console.log(`  ⚠ payments цэвэрлэх: ${delPay.message}`); failed++; }

  const { data: insPay, error: payErr } = await sb.from('payments').insert(payments).select('id');
  if (payErr) { console.log(`  ✗ payments: ${payErr.message}`); failed++; }
  else console.log(`  ✓ payments: ${insPay.length} мөр (сүүлийн 3 сар)`);
}

console.log(failed
  ? `\n⚠ Дууслаа, гэхдээ ${failed} хүснэгтэд асуудал гарав (дээрхийг үз).`
  : '\n✅ Бүх хүснэгт амжилттай. khotol.com/admin-demo дээр шалгана уу.');
