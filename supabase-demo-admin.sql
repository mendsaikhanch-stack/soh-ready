-- ХОТОЛ — DEMO АДМИН (СӨХ удирдлага талд нэвтрэх)
-- Админ login:  www.khotol.com/admin
--   Нэвтрэх нэр:  demo
--   Нууц үг:      Demo12345!
--
-- УРЬДЧИЛАН: supabase-demo-setup.sql-ийг ЭНЭ project дээр ажиллуулсан байх
-- (demo СӨХ үүссэн байх ёстой). SQL Editor-т хуулж Run. Дахин ажиллуулж болно.

set search_path = public, extensions;

insert into admin_users (username, password_hash, sokh_id, role, display_name, status)
values (
  'demo',
  crypt('Demo12345!', gen_salt('bf')),
  (select id from sokh_organizations where name = 'Туршилтын СӨХ — Хотол демо байр'),
  'admin',
  'Демо админ',
  'active'
)
on conflict (username) do update set
  password_hash = excluded.password_hash,
  sokh_id       = excluded.sokh_id,
  role          = 'admin',
  display_name  = 'Демо админ',
  status        = 'active';
