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

// maintenance_requests-д image_url column нэмэх
const { error } = await sb.rpc('exec_sql', {
  sql: 'ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS image_url TEXT;'
}).single();

if (error) {
  // rpc ажиллахгүй бол шууд query хийх
  console.log('RPC ажиллахгүй — Supabase Dashboard SQL Editor-т ажиллуулна уу:');
  console.log('ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS image_url TEXT;');
  console.log('\nStorage bucket:');
  console.log("INSERT INTO storage.buckets (id, name, public) VALUES ('uploads', 'uploads', true) ON CONFLICT DO NOTHING;");
} else {
  console.log('✓ image_url column нэмэгдлээ');
}
