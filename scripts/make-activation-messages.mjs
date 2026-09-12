/**
 * СӨХ тус бүрд илгээх идэвхжүүлэлтийн бичвэрийг бодит тоогоор нь бөглөж
 * `docs/activation-messages.local.md` файлд бичнэ.
 *
 *   node scripts/make-activation-messages.mjs
 *
 * ⚠️ Гаралт нь даргын нэр, утас агуулдаг тул `.local.md` — `.gitignore`-д
 * орсон. Репо НЭЭЛТТЭЙ тул энэ файлыг git-д ХЭЗЭЭ Ч бүү оруул.
 *
 * Бичвэр нь СӨХ бүрийн байдлаас хамаарч 2 хувилбараас сонгогдоно:
 *   «унтсан»  — данс нь үүссэн ч ороогүй айл олонтой  → нэвтрэх заавар
 *   «QR»      — данс үүсээгүй / утасгүй айл олонтой   → QR постер тараах
 */

import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const envText = readFileSync(resolve(ROOT, '.env.local'), 'utf-8');
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
const { data: orgs } = await sb.from('sokh_organizations').select('id, name').in('id', sokhIds);
const orgName = new Map((orgs || []).map(o => [o.id, o.name]));
const { data: admins } = await sb
  .from('admin_users').select('sokh_id, username, display_name').eq('role', 'admin').eq('status', 'active');
const adminBy = new Map((admins || []).map(a => [a.sokh_id, a]));
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
    if (t) { s.ever++; if ((now - new Date(t).getTime()) / DAY <= 30) s.d30++; }
  }
  stat.set(r.sokh_id, s);
}

const DEMO_SOKH = 2678;
const rows = [...stat.entries()]
  .map(([id, s]) => ({
    id, name: orgName.get(id) || `#${id}`, admin: adminBy.get(id), ...s,
    dormant: s.acct - s.ever,
    unreg: s.homes - s.acct,
    phoneNoAcct: (s.homes - s.acct) - s.noPhone, // утастай ч данс үүсээгүй
  }))
  .filter(r => r.homes >= 5 && r.id !== DEMO_SOKH)
  // Нэн тэргүүнд «унтсан» олонтой, дараа нь идэвхжүүлэх нөөц ихтэй
  .sort((a, b) => (b.dormant - a.dormant) || ((b.homes - b.d30) - (a.homes - a.d30)));

const qrDir = (id) => `docs/onboarding/sokh-${id}`;
const hasQr = (id) => existsSync(resolve(ROOT, qrDir(id), 'poster.pdf'));

const dormantMsg = (r) => `Сайн байна уу, ${r.admin?.display_name || '[дарга]'} аа.

Танай СӨХ-ийн **${r.homes} айлын мэдээлэл Хотол системд бүрэн орсон** байгаа.
Гэхдээ одоогоор ердөө **${r.ever} айл** нь л аппаараа нэвтэрч үзсэн байна —
үлдсэн **${r.dormant} айл** нь аппаа байгааг мэдээгүй байх шиг байна.

Тэдэнд шинээр бүртгүүлэх шаардлагагүй, бүртгэл нь аль хэдийн бэлэн.
Группэндээ доорх бичвэрийг тавьж өгөхөд хангалттай:

———
**Хотол апп — өөрийн тоотынхоо мэдээллийг харах**

1. Утаснаасаа нээнэ: **khotol.com**
2. «Нэвтрэх» дарна
3. **Утасны дугаар:** өөрийн дугаараа
   **Нууц үг:** мөн утасны дугаараа (эхний удаа)
4. Орсны дараа «Миний мэдээлэл»-ээс нууц үгээ соль

Эндээс зарлал, сарын хураамж, төлбөрийн үлдэгдлээ шууд харна.
Асуудал гарвал даргадаа хандана уу.
———
${r.noPhone > 0 ? `
Танай ${r.noPhone} айлын утасны дугаар бүртгэлд байхгүй байна — тэднийх
олдвол надад хэлээрэй, нэмж өгье.
` : ''}
Хэдэн айл орсныг би хараад танд хэлж байя.`;

const qrMsg = (r) => `Сайн байна уу, ${r.admin?.display_name || '[дарга]'} аа.

Танай СӨХ-ийн **${r.homes} айлын жагсаалт Хотолд орсон** байгаа. Одоогоор
**${r.d30} айл** аппаа ашиглаж байна. Үлдсэнд нь хүрэхийн тулд оршин суугчид
өөрсдөө бүртгүүлэх **QR постер** бэлдлээ — хавсаргав.

• A4 хуудсыг **орцны самбарт наана**
• Дөрвөлжин зургийг **группэндээ тавина**

Оршин суугч QR-аа уншуулаад тоотоо бичихэд таны оруулсан яг тэр мөр рүү
холбогдоно — өр, төлбөрийн түүх нь хэвээр үлдэнэ, давхар бүртгэл үүсэхгүй.

Хэдэн айл бүртгүүлснийг би хараад танд хэлж байя.`;

let out = `# Даргууд руу илгээх бичвэр — бодит тоогоор бөглөсөн

> ⚠️ **ЛОКАЛ ФАЙЛ.** Даргын нэр, утас агуулна. Репо нээлттэй тул git-д
> ХЭЗЭЭ Ч бүү оруул (\`.gitignore\` хамгаалж байгаа).
>
> Үүсгэсэн: ${new Date().toISOString().slice(0, 16).replace('T', ' ')}
> Дахин үүсгэх: \`node scripts/make-activation-messages.mjs\`

`;

let n = 0;
for (const r of rows) {
  n++;
  const useDormant = r.dormant >= 20;
  const qr = hasQr(r.id);
  out += `\n---\n\n## ${n}. ${r.name}  ·  #${r.id}\n\n`;
  out += `| айл | данс | орсон | 30хон | унтсан | дансгүй | утасгүй |\n|---|---|---|---|---|---|---|\n`;
  out += `| ${r.homes} | ${r.acct} | ${r.ever} | ${r.d30} | **${r.dormant}** | ${r.unreg} | ${r.noPhone} |\n\n`;
  out += `**Дарга:** ${r.admin?.display_name || '⚠ бүртгэлгүй'}`;
  if (r.admin?.username) out += `  ·  холбоо барих: \`${r.admin.username}\``;
  out += `\n\n**Арга:** ${useDormant ? '🔥 Унтсан данс сэрээх (хамгийн хурдан)' : '🔹 QR тараах'}`;
  if (!useDormant) {
    out += qr ? `  ·  постер: \`${qrDir(r.id)}/poster.pdf\`` : `  ·  ⚠️ QR БЭЛДЭЭГҮЙ → \`node scripts/make-sokh-qr.mjs ${r.id}\``;
  }
  if (r.phoneNoAcct > 0 && !useDormant) {
    out += `\n\n> 💡 ${r.phoneNoAcct} айл **утастай ч данс үүсээгүй** — QR хүлээхгүйгээр даргаар нь шууд дуудуулж болно.`;
  }
  out += `\n\n\`\`\`\n${(useDormant ? dormantMsg(r) : qrMsg(r)).trim()}\n\`\`\`\n`;
}

const outPath = resolve(ROOT, 'docs', 'activation-messages.local.md');
writeFileSync(outPath, out, 'utf8');
console.log(`\n✅ ${n} СӨХ-ийн бичвэр бэлэн`);
console.log(`   docs/activation-messages.local.md  (git-д ОРОХГҮЙ)\n`);
for (const r of rows) {
  const tag = r.dormant >= 20 ? '🔥 унтсан' : '🔹 QR';
  console.log(`   ${tag}  ${r.name.slice(0, 24).padEnd(25)} ${String(r.homes).padStart(4)} айл · сэрээх боломж ${String(r.homes - r.d30).padStart(3)}`);
}
console.log('');
