// Wire.mn sandbox-ийн бүтэн төлбөрийн урсгалыг magic inputs-аар турших.
// Урьдчилан: .env.local дотор  WIRE_SECRET_KEY=sk_test_...  байх ёстой.
// Ажиллуулах:  node scripts/test-wire-sandbox.mjs
import { readFileSync } from 'fs';

const WIRE_BASE = 'https://api.wire.mn/v1';

// .env.local-аас түлхүүр уншина (Node автоматаар .env уншдаггүй)
function loadKey() {
  if (process.env.WIRE_SECRET_KEY) return process.env.WIRE_SECRET_KEY;
  try {
    const env = readFileSync('.env.local', 'utf8');
    const m = env.match(/^WIRE_SECRET_KEY=(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  } catch {}
  return null;
}

const KEY = loadKey();
if (!KEY) {
  console.error('❌ WIRE_SECRET_KEY олдсонгүй. .env.local-д  WIRE_SECRET_KEY=sk_test_...  нэмнэ үү.');
  process.exit(1);
}
const isTest = KEY.startsWith('sk_test_');
console.log(`Түлхүүр: ${KEY.slice(0, 11)}…  (${isTest ? 'TEST' : 'LIVE ⚠️'})`);

async function wire(path, { method = 'POST', body, idem } = {}) {
  const res = await fetch(WIRE_BASE + path, {
    method,
    headers: {
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      ...(idem ? { 'Idempotency-Key': idem } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

const rid = () => 'test-' + Math.floor(performance.now() * 1000).toString(36);

async function createIntent(amount, label) {
  const r = await wire('/payment_intents', {
    body: { amount, currency: 'MNT', allowed_operators: ['sandbox'], description: label },
    idem: rid(),
  });
  return r;
}

async function confirmIntent(id) {
  return wire(`/payment_intents/${id}/confirm`, { body: {}, idem: rid() });
}

async function getIntent(id) {
  return wire(`/payment_intents/${id}`, { method: 'GET' });
}

async function scenario(name, amount) {
  console.log(`\n── ${name} (amount=${amount}) ──`);
  const c = await createIntent(amount, name);
  console.log('  create:', c.status, JSON.stringify(c.data).slice(0, 200));
  const id = c.data?.id;
  if (!id) return;
  const conf = await confirmIntent(id);
  console.log('  confirm:', conf.status, JSON.stringify(conf.data).slice(0, 200));
  const fin = await getIntent(id);
  console.log('  final status:', fin.data?.status, '| livemode:', fin.data?.livemode);
  return { id, final: fin.data };
}

console.log('\n=== Wire sandbox бүтэн урсгалын тест ===');

// 1) Амжилттай (энгийн дүн)
const ok = await scenario('Амжилттай төлбөр', 5000000); // 50,000₮

// 2) Magic: хэт бага
await scenario('amount_too_small хүлээж байна', 42);

// 3) Magic: timeout
await scenario('timeout хүлээж байна', 42424);

// 4) Hosted checkout session (амжилттай intent дээр)
if (ok?.id) {
  const sess = await wire('/checkout/sessions', {
    body: { payment_intent: ok.id, success_url: 'https://www.khotol.com/pay/done' },
    idem: rid(),
  });
  console.log('\n── Hosted checkout session ──');
  console.log('  status:', sess.status);
  console.log('  url:', sess.data?.url);
  console.log('  (энэ url-ийг хөтчид нээж QR/банк сонголтыг үзэж болно)');
}

console.log('\n=== Дуусав. Дээрх бодит хариунаас webhook payload/талбаруудыг баталгаажуулна ===');
