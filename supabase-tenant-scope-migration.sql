-- ============================================================
-- Tenant scope migration — sokh_id-р хэрэглэгчийн RLS-г хязгаарлах
-- ============================================================
-- Зорилго: Authenticated mobile resident зөвхөн өөрийн СӨХ-ийн
-- residents/payments/announcements/maintenance/complaints/polls/chat
-- мэдээллийг харна (cross-tenant data leak хаах).
--
-- Архитектур:
--   1. residents.auth_user_id UUID — auth.users(id)-тэй холбоо
--   2. current_user_sokh_ids() helper — auth.uid()-аас sokh_id-уудыг олно
--   3. Policy-ууд: USING (sokh_id IN (SELECT current_user_sokh_ids()))
--
-- Admin/Super/OSNAA нь service_role-аар (/api/admin/db proxy) дамждаг
-- учир энэ migration нь тэдэнд нөлөөлөхгүй.
--
-- Давтан ажиллуулахад аюулгүй (IF NOT EXISTS, IF EXISTS ашигласан)
-- ============================================================


-- ============================================================
-- 1. residents.auth_user_id багана нэмэх
-- ============================================================

ALTER TABLE residents
  ADD COLUMN IF NOT EXISTS auth_user_id UUID
  REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS residents_auth_user_id_idx ON residents(auth_user_id);


-- ============================================================
-- 2. Одоогийн residents-уудыг auth.users-тэй холбох (phone match)
-- ============================================================
-- Phone дугаар → email format `${phone}@toot.app` (register flow-ийн
-- тогтсон ёсоор)

UPDATE residents r
   SET auth_user_id = u.id
  FROM auth.users u
 WHERE u.email = r.phone || '@toot.app'
   AND r.auth_user_id IS NULL
   AND r.phone IS NOT NULL
   AND length(r.phone) > 0;


-- ============================================================
-- 3. current_user_sokh_ids() helper function
-- ============================================================
-- SECURITY DEFINER — RLS-г bypass хийж хэрэглэгчийн residents-аас
-- sokh_id-уудыг авна. STABLE — нэг query дотор cache хийнэ.

CREATE OR REPLACE FUNCTION public.current_user_sokh_ids()
RETURNS SETOF bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sokh_id
    FROM residents
   WHERE auth_user_id = auth.uid()
     AND sokh_id IS NOT NULL
$$;

GRANT EXECUTE ON FUNCTION public.current_user_sokh_ids() TO authenticated;


-- ============================================================
-- 4. residents — tenant scoped SELECT, өөрийн мөрөө л UPDATE
-- ============================================================

DROP POLICY IF EXISTS "residents_select_authenticated" ON residents;
DROP POLICY IF EXISTS "residents_update_authenticated" ON residents;
DROP POLICY IF EXISTS "residents_select_tenant" ON residents;
DROP POLICY IF EXISTS "residents_update_self" ON residents;
-- Хуучин нэртэй policy-уудыг бас цэвэрлэх (residents_*_auth, residents_insert_anon)
DROP POLICY IF EXISTS "residents_select_auth" ON residents;
DROP POLICY IF EXISTS "residents_update_auth" ON residents;
DROP POLICY IF EXISTS "residents_insert_anon" ON residents;
DROP POLICY IF EXISTS "Allow all access to residents" ON residents;

CREATE POLICY "residents_select_tenant" ON residents
  FOR SELECT TO authenticated
  USING (sokh_id IN (SELECT current_user_sokh_ids()));

CREATE POLICY "residents_update_self" ON residents
  FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());


-- ============================================================
-- 5. payments — resident_id-аар sokh лавлана
-- ============================================================

DROP POLICY IF EXISTS "payments_select_authenticated" ON payments;
DROP POLICY IF EXISTS "payments_select_tenant" ON payments;
-- Хуучин нэртэй policy-уудыг цэвэрлэх
DROP POLICY IF EXISTS "payments_select" ON payments;
DROP POLICY IF EXISTS "payments_insert" ON payments;
DROP POLICY IF EXISTS "Allow all access to payments" ON payments;

CREATE POLICY "payments_select_tenant" ON payments
  FOR SELECT TO authenticated
  USING (
    resident_id IN (
      SELECT id FROM residents
       WHERE sokh_id IN (SELECT current_user_sokh_ids())
    )
  );


-- ============================================================
-- 6. announcements — sokh_id шууд бий
-- ============================================================

DROP POLICY IF EXISTS "public read announcements" ON announcements;
DROP POLICY IF EXISTS "announcements_select" ON announcements;
DROP POLICY IF EXISTS "announcements_select_authenticated" ON announcements;
DROP POLICY IF EXISTS "announcements_select_tenant" ON announcements;

CREATE POLICY "announcements_select_tenant" ON announcements
  FOR SELECT TO authenticated
  USING (sokh_id IN (SELECT current_user_sokh_ids()));


-- ============================================================
-- 7. maintenance_requests — sokh_id шууд бий
-- ============================================================

DROP POLICY IF EXISTS "public read maintenance" ON maintenance_requests;
DROP POLICY IF EXISTS "public insert maintenance" ON maintenance_requests;
DROP POLICY IF EXISTS "maintenance_select" ON maintenance_requests;
DROP POLICY IF EXISTS "maintenance_insert" ON maintenance_requests;
DROP POLICY IF EXISTS "maintenance_select_authenticated" ON maintenance_requests;
DROP POLICY IF EXISTS "maintenance_insert_authenticated" ON maintenance_requests;
DROP POLICY IF EXISTS "maintenance_select_tenant" ON maintenance_requests;
DROP POLICY IF EXISTS "maintenance_insert_tenant" ON maintenance_requests;

CREATE POLICY "maintenance_select_tenant" ON maintenance_requests
  FOR SELECT TO authenticated
  USING (sokh_id IN (SELECT current_user_sokh_ids()));

CREATE POLICY "maintenance_insert_tenant" ON maintenance_requests
  FOR INSERT TO authenticated
  WITH CHECK (sokh_id IN (SELECT current_user_sokh_ids()));


-- ============================================================
-- 8. complaints — sokh_id шууд бий
-- ============================================================

DROP POLICY IF EXISTS "Allow all complaints" ON complaints;
DROP POLICY IF EXISTS "complaints_select" ON complaints;
DROP POLICY IF EXISTS "complaints_insert" ON complaints;
DROP POLICY IF EXISTS "complaints_select_authenticated" ON complaints;
DROP POLICY IF EXISTS "complaints_insert_authenticated" ON complaints;
DROP POLICY IF EXISTS "complaints_select_tenant" ON complaints;
DROP POLICY IF EXISTS "complaints_insert_tenant" ON complaints;

CREATE POLICY "complaints_select_tenant" ON complaints
  FOR SELECT TO authenticated
  USING (sokh_id IN (SELECT current_user_sokh_ids()));

CREATE POLICY "complaints_insert_tenant" ON complaints
  FOR INSERT TO authenticated
  WITH CHECK (sokh_id IN (SELECT current_user_sokh_ids()));


-- ============================================================
-- 9. polls — sokh_id шууд бий
-- ============================================================

DROP POLICY IF EXISTS "public read polls" ON polls;
DROP POLICY IF EXISTS "polls_select" ON polls;
DROP POLICY IF EXISTS "polls_update_auth" ON polls;
DROP POLICY IF EXISTS "polls_select_authenticated" ON polls;
DROP POLICY IF EXISTS "polls_update_authenticated" ON polls;
DROP POLICY IF EXISTS "polls_select_tenant" ON polls;

CREATE POLICY "polls_select_tenant" ON polls
  FOR SELECT TO authenticated
  USING (sokh_id IN (SELECT current_user_sokh_ids()));


-- ============================================================
-- 10. chat_messages — sokh_id шууд бий (хэрэв байхгүй бол алгасах)
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'chat_messages' AND column_name = 'sokh_id'
  ) THEN
    DROP POLICY IF EXISTS "Allow all chat_messages" ON chat_messages;
    DROP POLICY IF EXISTS "chat_select" ON chat_messages;
    DROP POLICY IF EXISTS "chat_insert" ON chat_messages;
    DROP POLICY IF EXISTS "chat_select_authenticated" ON chat_messages;
    DROP POLICY IF EXISTS "chat_insert_authenticated" ON chat_messages;
    DROP POLICY IF EXISTS "chat_messages_select_tenant" ON chat_messages;
    DROP POLICY IF EXISTS "chat_messages_insert_tenant" ON chat_messages;

    CREATE POLICY "chat_messages_select_tenant" ON chat_messages
      FOR SELECT TO authenticated
      USING (sokh_id IN (SELECT current_user_sokh_ids()));

    CREATE POLICY "chat_messages_insert_tenant" ON chat_messages
      FOR INSERT TO authenticated
      WITH CHECK (sokh_id IN (SELECT current_user_sokh_ids()));
  END IF;
END $$;


-- ============================================================
-- 11. messages — sokh_id шууд бий (хэрэв байхгүй бол алгасах)
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'messages' AND column_name = 'sokh_id'
  ) THEN
    DROP POLICY IF EXISTS "public read messages" ON messages;
    DROP POLICY IF EXISTS "public insert messages" ON messages;
    DROP POLICY IF EXISTS "messages_select" ON messages;
    DROP POLICY IF EXISTS "messages_insert" ON messages;
    DROP POLICY IF EXISTS "messages_select_authenticated" ON messages;
    DROP POLICY IF EXISTS "messages_insert_authenticated" ON messages;
    DROP POLICY IF EXISTS "messages_select_tenant" ON messages;
    DROP POLICY IF EXISTS "messages_insert_tenant" ON messages;

    CREATE POLICY "messages_select_tenant" ON messages
      FOR SELECT TO authenticated
      USING (sokh_id IN (SELECT current_user_sokh_ids()));

    CREATE POLICY "messages_insert_tenant" ON messages
      FOR INSERT TO authenticated
      WITH CHECK (sokh_id IN (SELECT current_user_sokh_ids()));
  END IF;
END $$;


-- ============================================================
-- ДҮГНЭЛТ
-- ============================================================
-- Authenticated mobile resident зөвхөн өөрийн sokh_id-ийн дараах
-- мэдээллийг харна:
--   residents (өөрийн СӨХ-ийн нийт оршин суугч)
--   payments  (өөрийн СӨХ-ийн residents-ийн төлбөрүүд)
--   announcements, maintenance_requests, complaints, polls
--   chat_messages, messages (хэрэв sokh_id-тэй бол)
--
-- residents.UPDATE — зөвхөн auth_user_id = auth.uid() мөрөө л шинэчилнэ.
--
-- Бусад operational table-ууд хэвээрээ TO authenticated USING(true) —
-- хэрэв тэдэнд cross-tenant эрсдэл гарвал дахин tighten хийнэ.
--
-- Admin/Super/OSNAA → /api/admin/db proxy (service_role) — RLS bypass.
-- ============================================================
