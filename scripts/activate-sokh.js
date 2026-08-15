// СӨХ-ийг бүрэн идэвхжүүлнэ (даргын бүртгэл үүсгээд, төлөвийг active болгоно).
//
// /api/auth/activate маршрутын хийдэг ЯГ ТЭР 2 зүйлийг хийнэ:
//   1. admin_users-д дарга үүсгэх (bcrypt cost 12)
//   2. sokh_organizations-г claim_status='active', activated_at=now болгох
//
// Ялгаа нь: тэр маршрут дарга өөрөө код оруулж, нууц үгээ СОНГОХ замаар
// ажилладаг. Энэ скрипт нь дарга руу код хүргэх боломжгүй үед (утсаар нь
// тохирсон гэх мэт) супер админ гараар нээж өгөх зориулалттай.
//
// Нэвтрэх нэр = утасны дугаар, түр нууц үг = утасны дугаар.
// ⚠️ Түр нууц үг СУЛ. Дарга нэвтэрсэн даруйдаа солих ёстой. Боломжтой бол
//    /mng-ctrl/organizations → «Идэвхжүүлэх» кодоор явуулах нь илүү аюулгүй.
//
// Ажиллуулах:
//   node scripts/activate-sokh.js --id=2686            # зөвхөн шалгана
//   node scripts/activate-sokh.js --id=2686 --commit   # бодитоор идэвхжүүлнэ

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const env = { ...process.env };
for (const line of readFileSync(resolve(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (v) env[m[1]] = v;
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const idArg = process.argv.find(a => a.startsWith('--id='));
const SOKH_ID = idArg ? Number(idArg.split('=')[1]) : null;
const commit = process.argv.includes('--commit');

if (!SOKH_ID) {
  console.error('Хэрэглээ: node scripts/activate-sokh.js --id=<sokh_id> [--commit]');
  process.exit(1);
}

async function main() {
  const { data: org, error: orgErr } = await sb
    .from('sokh_organizations')
    .select('id, name, phone, claim_status, activated_at, unit_count')
    .eq('id', SOKH_ID)
    .single();

  if (orgErr || !org) {
    console.error('❌ СӨХ олдсонгүй:', orgErr?.message);
    process.exit(1);
  }

  const { count: residentCount } = await sb
    .from('residents')
    .select('id', { count: 'exact', head: true })
    .eq('sokh_id', SOKH_ID);

  const { data: admins } = await sb
    .from('admin_users')
    .select('id, username, role, status')
    .eq('sokh_id', SOKH_ID);

  console.log(`\n🏢 ${org.name} (#${org.id})`);
  console.log(`   Төлөв:          ${org.claim_status}`);
  console.log(`   Идэвхжсэн:      ${org.activated_at || '—'}`);
  console.log(`   Утас:           ${org.phone || '—'}`);
  console.log(`   Оршин суугч:    ${residentCount} мөр`);
  console.log(`   Даргын бүртгэл: ${admins?.length ? admins.map(a => a.username).join(', ') : 'БАЙХГҮЙ'}`);

  if (!org.phone) {
    console.error('\n❌ Утасны дугааргүй тул нэвтрэх нэр үүсгэх боломжгүй.');
    process.exit(1);
  }

  const username = String(org.phone).trim();

  // Нэвтрэх нэр давхардвал өөр СӨХ-ийн дарга дарагдах эрсдэлтэй тул зогсооно
  const { data: taken } = await sb
    .from('admin_users')
    .select('id, sokh_id')
    .eq('username', username)
    .maybeSingle();

  if (taken && taken.sokh_id !== SOKH_ID) {
    console.error(`\n❌ "${username}" нэвтрэх нэр өөр СӨХ-д (sokh_id=${taken.sokh_id}) бүртгэлтэй байна.`);
    process.exit(1);
  }

  const needsAdmin = !admins?.length;
  const needsActivation = org.claim_status !== 'active';

  console.log('\n📋 Хийх ажил:');
  console.log(`   ${needsAdmin ? '➕' : '✓ '} Даргын бүртгэл: ${needsAdmin ? `${username} үүсгэнэ (нууц үг = утас)` : 'аль хэдийн байна'}`);
  console.log(`   ${needsActivation ? '➕' : '✓ '} Төлөв: ${needsActivation ? 'active болгоно' : 'аль хэдийн active'}`);

  if (residentCount === 0) {
    console.log('\n⚠️  Оршин суугчгүй — дарга ороход жагсаалт хоосон байна.');
  }

  if (!needsAdmin && !needsActivation) {
    console.log('\n✅ Аль хэдийн бүрэн идэвхтэй — өөрчлөх зүйл алга.');
    return;
  }

  if (!commit) {
    console.log(`\n💡 Бодитоор хийхийн тулд: node scripts/activate-sokh.js --id=${SOKH_ID} --commit`);
    return;
  }

  if (needsAdmin) {
    const password_hash = await bcrypt.hash(username, 12);
    const { error } = await sb.from('admin_users').insert([{
      username,
      password_hash,
      sokh_id: SOKH_ID,
      role: 'admin',
      display_name: org.name,
      status: 'active',
    }]);
    if (error) {
      console.error('❌ Даргын бүртгэл үүсгэж чадсангүй:', error.message);
      process.exit(1);
    }
    console.log(`\n✓ Даргын бүртгэл үүсгэв: ${username}`);
  }

  if (needsActivation) {
    const { error } = await sb
      .from('sokh_organizations')
      .update({ claim_status: 'active', activated_at: new Date().toISOString() })
      .eq('id', SOKH_ID);
    if (error) {
      console.error('❌ Төлөв солиж чадсангүй:', error.message);
      process.exit(1);
    }
    console.log('✓ Төлөв: active');
  }

  console.log('\n✅ Дууслаа. Дарга /admin дээр нэвтэрч, нууц үгээ солино уу.');
}

main().catch(e => { console.error(e); process.exit(1); });
