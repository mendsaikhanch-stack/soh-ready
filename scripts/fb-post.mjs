// Карусель хавтсыг (slide-*.png + caption.txt) Хотолын Facebook Page руу
// олон зурагтай нэг пост болгон нийтэлнэ / товлоно.
//
//   node scripts/fb-post.mjs --check                          # токен, Page шалгах
//   node scripts/fb-post.mjs docs/fb-posts/carousel-02-hurlyn-irts            # dry-run
//   node scripts/fb-post.mjs docs/fb-posts/carousel-02-hurlyn-irts --yes      # шууд нийтлэх
//   node scripts/fb-post.mjs <dir> --schedule "2026-10-10 09:00" --yes        # УБ цагаар товлох
//
// .env.local:  FB_PAGE_ID=...  FB_PAGE_TOKEN=...  (FB_GRAPH_VERSION=v23.0)
// --yes байхгүй бол юу ч илгээхгүй — зөвхөн юу хийхийг хэвлэнэ.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
try { process.loadEnvFile(path.join(root, '.env.local')); } catch {}

const { FB_PAGE_ID, FB_PAGE_TOKEN, FB_GRAPH_VERSION = 'v23.0' } = process.env;
const API = `https://graph.facebook.com/${FB_GRAPH_VERSION}`;

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };

if (!FB_PAGE_ID || !FB_PAGE_TOKEN) {
  console.error('.env.local-д FB_PAGE_ID, FB_PAGE_TOKEN тохируулаагүй байна');
  process.exit(1);
}

async function graph(method, endpoint, body) {
  const url = new URL(`${API}/${endpoint}`);
  let init = { method };
  if (method === 'GET') {
    for (const [k, v] of Object.entries(body || {})) url.searchParams.set(k, v);
    url.searchParams.set('access_token', FB_PAGE_TOKEN);
  } else {
    if (!(body instanceof FormData)) {
      const fd = new FormData();
      for (const [k, v] of Object.entries(body)) fd.append(k, v);
      body = fd;
    }
    body.append('access_token', FB_PAGE_TOKEN);
    init.body = body;
  }
  const res = await fetch(url, init);
  const json = await res.json();
  if (json.error) throw new Error(`${endpoint}: ${json.error.message} (code ${json.error.code})`);
  return json;
}

if (flag('--check')) {
  const page = await graph('GET', FB_PAGE_ID, { fields: 'id,name,link' });
  console.log('✓ Page:', page.name, page.id, page.link || '');
  process.exit(0);
}

const dir = args.find((a) => !a.startsWith('--') && a !== opt('--schedule'));
if (!dir) {
  console.error('Хэрэглээ: node scripts/fb-post.mjs <карусель хавтас> [--schedule "YYYY-MM-DD HH:mm"] [--yes]');
  process.exit(1);
}
const absDir = path.resolve(dir);
const slides = fs.readdirSync(absDir).filter((f) => /^slide-\d+\.png$/.test(f)).sort();
const caption = fs.readFileSync(path.join(absDir, 'caption.txt'), 'utf8').trim();
if (!slides.length) {
  console.error('slide-*.png олдсонгүй — эхлээд make-carousel.mjs ажиллуул');
  process.exit(1);
}

// Цагийн бүс заагаагүй бол Улаанбаатарын цаг (+08:00)
let scheduleAt;
const scheduleRaw = opt('--schedule');
if (scheduleRaw) {
  const iso = scheduleRaw.replace(' ', 'T');
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}+08:00`);
  const ahead = (d.getTime() - Date.now()) / 60000;
  if (Number.isNaN(ahead) || ahead < 10 || ahead > 30 * 24 * 60) {
    console.error('Товлох цаг одооноос 10 минутаас 30 хоногийн хооронд байх ёстой');
    process.exit(1);
  }
  scheduleAt = Math.floor(d.getTime() / 1000);
}

console.log(`Page: ${FB_PAGE_ID}`);
console.log(`Зураг: ${slides.length} — ${slides.join(', ')}`);
console.log(`Хугацаа: ${scheduleAt ? new Date(scheduleAt * 1000).toLocaleString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' }) + ' (УБ)' : 'шууд'}`);
console.log('--- caption ---\n' + caption + '\n---------------');

if (!flag('--yes')) {
  console.log('\nDry-run. Нийтлэхийн тулд --yes нэм.');
  process.exit(0);
}

if (fs.existsSync(path.join(absDir, 'posted.json')) && !flag('--force')) {
  console.error('Энэ карусель аль хэдийн нийтлэгдсэн (posted.json). Дахин нийтлэх бол --force нэм.');
  process.exit(1);
}

// 1) Зургуудыг нийтлэгдээгүй төлөвтэй байршуулна
const mediaIds = [];
for (const f of slides) {
  const fd = new FormData();
  fd.append('source', new Blob([fs.readFileSync(path.join(absDir, f))], { type: 'image/png' }), f);
  fd.append('published', 'false');
  if (scheduleAt) fd.append('temporary', 'true'); // товлосон постод заавал
  const { id } = await graph('POST', `${FB_PAGE_ID}/photos`, fd);
  mediaIds.push(id);
  console.log('✓ байршуулсан', f, id);
}

// 2) Бүгдийг нэг пост болгоно
const post = { message: caption };
mediaIds.forEach((id, i) => { post[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id }); });
if (scheduleAt) {
  post.published = 'false';
  post.scheduled_publish_time = String(scheduleAt);
}
const { id: postId } = await graph('POST', `${FB_PAGE_ID}/feed`, post);
console.log(`✓ ${scheduleAt ? 'Товлогдлоо' : 'Нийтлэгдлээ'}: https://www.facebook.com/${postId}`);

// Давхар нийтлэхээс сэргийлж бүртгэл үлдээнэ
const logFile = path.join(absDir, 'posted.json');
const log = fs.existsSync(logFile) ? JSON.parse(fs.readFileSync(logFile, 'utf8')) : [];
log.push({ postId, page: FB_PAGE_ID, at: new Date().toISOString(), scheduledFor: scheduleAt ? new Date(scheduleAt * 1000).toISOString() : null });
fs.writeFileSync(logFile, JSON.stringify(log, null, 2) + '\n');
