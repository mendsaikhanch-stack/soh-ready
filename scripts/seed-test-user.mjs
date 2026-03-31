import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envContent = readFileSync(resolve(__dirname, '../.env.local'), 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Тест хэрэглэгч үүсгэх
const email = 'test@toot.mn';
const password = 'Test1234';

// Supabase Auth хэрэглэгч
const { data: authUser, error: authErr } = await sb.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { name: 'Тест Хэрэглэгч', phone: '99001122' },
});

if (authErr) {
  if (authErr.message.includes('already been registered')) {
    console.log(`⚠ ${email} аль хэдийн бүртгэлтэй`);
  } else {
    console.error('✗ Auth error:', authErr.message);
    process.exit(1);
  }
} else {
  console.log(`✓ Auth хэрэглэгч: ${email}`);
}

// Эхний СӨХ-г олох
const { data: sokh } = await sb.from('sokh_organizations').select('id, name').limit(1).single();

if (sokh) {
  // Resident бүртгэх
  const { error: resErr } = await sb.from('residents').upsert({
    sokh_id: sokh.id,
    name: 'Тест Хэрэглэгч',
    phone: '99001122',
    apartment: '101',
    debt: 0,
  }, { onConflict: 'sokh_id,apartment' });

  if (resErr) {
    console.log(`⚠ Resident: ${resErr.message}`);
  } else {
    console.log(`✓ Resident → СӨХ: ${sokh.name} (id=${sokh.id}), тоот: 101`);
  }
}

console.log(`\n✅ Тест нэвтрэлт:`);
console.log(`   Имэйл: ${email}`);
console.log(`   Нууц үг: ${password}`);
