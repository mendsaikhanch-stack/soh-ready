-- Банкны SMS хүснэгтүүдийн RLS шалгалт. ЗӨВХӨН УНШИНА, юу ч өөрчлөхгүй.
-- supabase-bank-sms-migration.sql-ийн дараа Supabase ▸ SQL Editor-т ажиллуулна.
--
-- Хүлээгдэж буй үр дүн:
--   1) 4 хүснэгт бүгд rls = true
--   2) policy 0 мөр
--   3) anon / authenticated эрхээр SELECT хийхэд 0 мөр (эсвэл permission denied)
--   4) bank_sms_apply_payment / bank_sms_purge_raw-г anon, authenticated дуудаж чадахгүй (false)

-- 1)
SELECT relname, relrowsecurity AS rls
  FROM pg_class
 WHERE relname IN ('bank_sms_devices', 'bank_sms_events', 'payment_reference_mappings', 'bank_transactions')
 ORDER BY relname;

-- 2)
SELECT c.relname, p.polname
  FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
 WHERE c.relname IN ('bank_sms_devices', 'bank_sms_events', 'payment_reference_mappings', 'bank_transactions');

-- 3) Оршин суугчийн апп (anon / authenticated key)-аас харагдах эсэх
BEGIN;
SET LOCAL ROLE authenticated;
SELECT 'bank_transactions' AS t, COUNT(*) FROM bank_transactions
UNION ALL SELECT 'bank_sms_events', COUNT(*) FROM bank_sms_events
UNION ALL SELECT 'payment_reference_mappings', COUNT(*) FROM payment_reference_mappings
UNION ALL SELECT 'bank_sms_devices', COUNT(*) FROM bank_sms_devices;
ROLLBACK;
-- ↑ "permission denied" алдаа гарвал энэ нь ЗӨВ (REVOKE ажилласан).

-- 4)
SELECT r.rolname,
       has_function_privilege(r.rolname, 'public.bank_sms_apply_payment(bigint,bigint,bigint,bigint,text,text)', 'EXECUTE') AS apply_payment,
       has_function_privilege(r.rolname, 'public.bank_sms_purge_raw(integer)', 'EXECUTE') AS purge_raw
  FROM pg_roles r
 WHERE r.rolname IN ('anon', 'authenticated', 'service_role');
