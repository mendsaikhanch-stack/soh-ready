/**
 * Нэг удаагийн скрипт — Play review-ийн demo СӨХ (#2678) дэх
 * «Хөрш чат» ба «Хөрш маркет»-д жишээ контент суулгана.
 *
 * Яагаад: контент байхгүй бол «Мэдээлэх» товч харагдахгүй тул Google-ийн
 * шалгагч UGC модерацийн механизмыг олж харахгүй (IARC-д "мэдээлэх
 * боломжтой" гэж хариулсан). Чат дээрх товч зөвхөн БУСДЫН мессеж дээр
 * гардаг тул мессежүүдийг өөр өөр оршин суугчийн нэрээр оруулна.
 *
 * Дахин ажиллуулж болно — өмнөх demo мөрүүдийг устгаад шинээр суулгана.
 *
 * Ажиллуулах:  node scripts/seed-demo-social.js
 */

const fs = require('fs');
const path = require('path');

const SOKH_ID = 2678;

// .env.local уншина
const envPath = path.join(__dirname, '..', '.env.local');
const env = {};
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_]+)\s*=\s*"?([^"]*)"?\s*$/);
  if (m) env[m[1]] = m[2];
}
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) throw new Error('.env.local дотор Supabase түлхүүр олдсонгүй');

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

// Огноог сүүлийн 3 хоногт тараана
const hoursAgo = (h) => new Date(Date.now() - h * 3600 * 1000).toISOString();

// ЖИЧ: багана нь `content` (supabase-missing-tables.sql), `message` БИШ
const messages = [
  { sender_name: 'Б.Оюунчимэг', content: 'Сайн байцгаана уу! 3 давхарт лифт өнөөдөр 14:00 цагт засвартай гэсэн. Мэдээлэл өгье.', created_at: hoursAgo(52) },
  { sender_name: 'Д.Батбаяр', content: 'Баярлалаа. Дулааны асуудлаар СӨХ-д хүсэлт өгсөн, хариу ирвэл энд бичнэ.', created_at: hoursAgo(47) },
  { sender_name: 'С.Наранцэцэг', content: 'Хогийн цэгийн ард машин тавьчихсан байна, эзэн нь хараарай 🙏', created_at: hoursAgo(20) },
  { sender_name: 'Д.Батбаяр', content: 'Маргааш 10:00-д орцны цэвэрлэгээ хийнэ. Хаалганы дэргэдэх эд зүйлсээ түр авч өгөөрэй.', created_at: hoursAgo(5) },
];

const listings = [
  {
    seller_name: 'Б.Оюунчимэг', seller_unit: '34', phone: '99112233',
    title: 'Хүүхдийн тэрэг', description: 'Бага ашигласан, эвхэгддэг. Цэвэрлэсэн.',
    price: 120000, category: 'kids', listing_type: 'sell', status: 'active', created_at: hoursAgo(60),
  },
  {
    seller_name: 'С.Наранцэцэг', seller_unit: '12', phone: '99445566',
    title: 'Ном — сурах бичиг багц', description: '5-6 дугаар ангийн. Үнэгүй өгнө.',
    price: 0, category: 'books', listing_type: 'free', status: 'active', created_at: hoursAgo(30),
  },
  {
    seller_name: 'Д.Батбаяр', seller_unit: '48', phone: '99778899',
    title: 'Цахилгаан өрөм', description: 'Түр хэрэглэхэд зээлүүлж болно. Орцондоо ирж авна.',
    price: 0, category: 'other', listing_type: 'lend', status: 'active', created_at: hoursAgo(8),
  },
];

async function api(method, pathname, body) {
  const res = await fetch(`${URL}/rest/v1/${pathname}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${pathname} → ${res.status} ${text}`);
  return text ? JSON.parse(text) : [];
}

(async () => {
  console.log(`Demo СӨХ #${SOKH_ID} — хөрш чат / маркетын жишээ контент суулгаж байна...`);

  // Өмнөх demo мөрүүдийг цэвэрлэнэ (зөвхөн энэ СӨХ)
  await api('DELETE', `chat_messages?sokh_id=eq.${SOKH_ID}`);
  await api('DELETE', `marketplace_listings?sokh_id=eq.${SOKH_ID}`);

  const chat = await api('POST', 'chat_messages', messages.map(m => ({ sokh_id: SOKH_ID, ...m })));
  console.log(`  чат мессеж: ${chat.length}`);

  const market = await api('POST', 'marketplace_listings', listings.map(l => ({ sokh_id: SOKH_ID, ...l })));
  console.log(`  маркетын зар: ${market.length}`);

  console.log('\nДууслаа. Одоо demo бүртгэлээр орж:');
  console.log('  Хөрш чат   → бусдын мессеж бүрийн доор «Мэдээлэх»');
  console.log('  Хөрш маркет → зар бүрийн доор «Мэдээлэх»');
})().catch(err => {
  console.error('АЛДАА:', err.message);
  process.exit(1);
});
