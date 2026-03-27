import bcrypt from 'bcryptjs';
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

const users = [
  { username: 'admin', password: env.ADMIN_PASSWORD, sokh_id: 7, role: 'admin', display_name: 'Админ' },
  { username: 'superadmin', password: env.SUPER_PASSWORD, sokh_id: null, role: 'superadmin', display_name: 'Супер Админ' },
  { username: 'osnaa', password: env.OSNAA_PASSWORD, sokh_id: 7, role: 'osnaa', display_name: 'ОСНААК Админ' },
];

for (const u of users) {
  const hash = await bcrypt.hash(u.password, 12);

  const { error } = await sb.from('admin_users').upsert({
    username: u.username,
    password_hash: hash,
    sokh_id: u.sokh_id,
    role: u.role,
    display_name: u.display_name,
    status: 'active',
  }, { onConflict: 'username' });

  if (error) {
    console.error(`✗ ${u.username}: ${error.message}`);
  } else {
    console.log(`✓ ${u.username} (${u.role}) → sokh_id=${u.sokh_id}`);
  }
}
console.log('\nДууслаа!');
