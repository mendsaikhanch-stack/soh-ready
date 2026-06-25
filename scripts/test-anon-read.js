// Браузерын админ хуудас яг юу хүлээж авахыг ANON key-ээр давтаж тестэлнэ.
const path = require('path'), fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const ENV = path.join(path.resolve(__dirname, '..'), '.env.local');
for (const line of fs.readFileSync(ENV, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) { let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; }
}
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
console.log('URL:', JSON.stringify(URL));
console.log('ANON урт:', ANON ? ANON.length : 0);

const anon = createClient(URL, ANON, { auth: { persistSession: false } });
(async () => {
  // Админ хуудастай ИЖИЛ дуудлага (auth-гүй anon)
  const r1 = await anon.from('residents').select('id,name,sokh_id', { count: 'exact' }).eq('sokh_id', 2679).limit(3);
  console.log('\n[#2679] anon уншсан:', r1.data ? r1.data.length : 0, '| count:', r1.count, '| алдаа:', r1.error ? r1.error.message : 'үгүй');
  if (r1.data && r1.data[0]) console.log('  жишээ:', JSON.stringify(r1.data[0]));

  const r2 = await anon.from('residents').select('id', { count: 'exact' }).eq('sokh_id', 7).limit(1);
  console.log('[#7 Нарантуул] anon count:', r2.count, '| алдаа:', r2.error ? r2.error.message : 'үгүй');
})();
