-- ============================================================
-- Parking + Gate + Elevator модулиудын RLS-г tenant-scoped болгох
-- ============================================================
-- Зорилго: parking_vehicles, blocking_reports, guest_vehicles,
-- gate_settings, gate_events, elevator_calls хүснэгтүүдийг
-- зөвхөн өөрийн СӨХ-ийн оршин суугч хандаж байх.
--
-- Pattern: USING (sokh_id IN (SELECT current_user_sokh_ids()))
-- Эх сурвалж: supabase-tenant-scope-migration.sql (residents pattern)
--
-- Админ нь /api/admin/db proxy (service_role) — RLS bypass хийдэг.
-- Давтан ажиллуулахад аюулгүй.
-- ============================================================

-- ============================================================
-- 1. parking_vehicles
-- ============================================================
-- Оршин суугч өөрийн СӨХ-ийн машинуудыг харна (хэн хэний машин аль
-- зогсоолд гэдгийг харах хэрэгцээтэй учир).
-- Insert/Update/Delete зөвхөн өөрийн нэрээр хийнэ.

DROP POLICY IF EXISTS "Allow all parking_vehicles" ON parking_vehicles;
DROP POLICY IF EXISTS "parking_vehicles_select_tenant" ON parking_vehicles;
DROP POLICY IF EXISTS "parking_vehicles_insert_tenant" ON parking_vehicles;
DROP POLICY IF EXISTS "parking_vehicles_update_owner" ON parking_vehicles;
DROP POLICY IF EXISTS "parking_vehicles_delete_owner" ON parking_vehicles;

CREATE POLICY "parking_vehicles_select_tenant" ON parking_vehicles
  FOR SELECT TO authenticated
  USING (sokh_id IN (SELECT current_user_sokh_ids()));

CREATE POLICY "parking_vehicles_insert_tenant" ON parking_vehicles
  FOR INSERT TO authenticated
  WITH CHECK (sokh_id IN (SELECT current_user_sokh_ids()));

-- Оршин суугч өөрийн нэрээр бүртгэгдсэн машинаа л шинэчилнэ
CREATE POLICY "parking_vehicles_update_owner" ON parking_vehicles
  FOR UPDATE TO authenticated
  USING (
    sokh_id IN (SELECT current_user_sokh_ids())
    AND resident_name IN (SELECT name FROM residents WHERE auth_user_id = auth.uid())
  )
  WITH CHECK (
    sokh_id IN (SELECT current_user_sokh_ids())
    AND resident_name IN (SELECT name FROM residents WHERE auth_user_id = auth.uid())
  );


-- ============================================================
-- 2. blocking_reports
-- ============================================================

DROP POLICY IF EXISTS "Allow all blocking_reports" ON blocking_reports;
DROP POLICY IF EXISTS "blocking_reports_select_tenant" ON blocking_reports;
DROP POLICY IF EXISTS "blocking_reports_insert_tenant" ON blocking_reports;

CREATE POLICY "blocking_reports_select_tenant" ON blocking_reports
  FOR SELECT TO authenticated
  USING (sokh_id IN (SELECT current_user_sokh_ids()));

CREATE POLICY "blocking_reports_insert_tenant" ON blocking_reports
  FOR INSERT TO authenticated
  WITH CHECK (sokh_id IN (SELECT current_user_sokh_ids()));


-- ============================================================
-- 3. guest_vehicles
-- ============================================================

DROP POLICY IF EXISTS "guest_vehicles_read" ON guest_vehicles;
DROP POLICY IF EXISTS "guest_vehicles_all" ON guest_vehicles;
DROP POLICY IF EXISTS "guest_vehicles_select_tenant" ON guest_vehicles;
DROP POLICY IF EXISTS "guest_vehicles_insert_tenant" ON guest_vehicles;

CREATE POLICY "guest_vehicles_select_tenant" ON guest_vehicles
  FOR SELECT TO authenticated
  USING (sokh_id IN (SELECT current_user_sokh_ids()));

CREATE POLICY "guest_vehicles_insert_tenant" ON guest_vehicles
  FOR INSERT TO authenticated
  WITH CHECK (sokh_id IN (SELECT current_user_sokh_ids()));


-- ============================================================
-- 4. gate_settings — зөвхөн SELECT (админ /api/admin/db-р update хийнэ)
-- ============================================================

DROP POLICY IF EXISTS "gate_settings_read" ON gate_settings;
DROP POLICY IF EXISTS "gate_settings_all" ON gate_settings;
DROP POLICY IF EXISTS "gate_settings_select_tenant" ON gate_settings;

CREATE POLICY "gate_settings_select_tenant" ON gate_settings
  FOR SELECT TO authenticated
  USING (sokh_id IN (SELECT current_user_sokh_ids()));


-- ============================================================
-- 5. gate_events
-- ============================================================

DROP POLICY IF EXISTS "gate_events_all" ON gate_events;
DROP POLICY IF EXISTS "gate_events_select_tenant" ON gate_events;
DROP POLICY IF EXISTS "gate_events_insert_tenant" ON gate_events;

CREATE POLICY "gate_events_select_tenant" ON gate_events
  FOR SELECT TO authenticated
  USING (sokh_id IN (SELECT current_user_sokh_ids()));

CREATE POLICY "gate_events_insert_tenant" ON gate_events
  FOR INSERT TO authenticated
  WITH CHECK (sokh_id IN (SELECT current_user_sokh_ids()));


-- ============================================================
-- 6. elevator_calls
-- ============================================================

DROP POLICY IF EXISTS "elevator_calls_all" ON elevator_calls;
DROP POLICY IF EXISTS "elevator_calls_select_tenant" ON elevator_calls;
DROP POLICY IF EXISTS "elevator_calls_insert_tenant" ON elevator_calls;

CREATE POLICY "elevator_calls_select_tenant" ON elevator_calls
  FOR SELECT TO authenticated
  USING (sokh_id IN (SELECT current_user_sokh_ids()));

CREATE POLICY "elevator_calls_insert_tenant" ON elevator_calls
  FOR INSERT TO authenticated
  WITH CHECK (sokh_id IN (SELECT current_user_sokh_ids()));


-- ============================================================
-- ДҮГНЭЛТ
-- ============================================================
-- Mobile resident зөвхөн өөрийн СӨХ-ийн дараах мэдээллийг харна:
--   parking_vehicles, blocking_reports, guest_vehicles,
--   gate_settings, gate_events, elevator_calls
--
-- Insert: бүгд өөрийн sokh_id-р шалгана.
-- parking_vehicles.UPDATE — зөвхөн өөрийн нэрээр бүртгэгдсэн машинаа.
--
-- Админ /api/admin/db proxy (service_role) — RLS bypass хийдэг тул
-- админы CRUD-д нөлөөлөхгүй.
-- ============================================================
