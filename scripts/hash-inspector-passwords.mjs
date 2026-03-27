import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// .env.local-аас уншах
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data: inspectors, error } = await sb.from('inspectors').select('id, username, password');
if (error) { console.error('Error:', error.message); process.exit(1); }

let hashed = 0, skipped = 0;
for (const ins of inspectors || []) {
  if (ins.password.startsWith('$2')) { skipped++; continue; }
  const hash = await bcrypt.hash(ins.password, 12);
  const { error: err } = await sb.from('inspectors').update({ password: hash }).eq('id', ins.id);
  if (err) { console.error(`Failed ${ins.username}:`, err.message); process.exit(1); }
  console.log(`✓ ${ins.username} hash-лагдлаа`);
  hashed++;
}
console.log(`\nДүн: ${hashed} hash-лагдсан, ${skipped} алгассан, нийт ${(inspectors||[]).length}`);
