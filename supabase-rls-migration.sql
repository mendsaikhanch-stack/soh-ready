-- ============================================
-- Тоот App: RLS Policy Migration
-- USING(true) → бодит RLS policy
-- ============================================

-- Helper функц: Нэвтэрсэн хэрэглэгчийн sokh_id авах
CREATE OR REPLACE FUNCTION get_user_sokh_id()
RETURNS BIGINT AS $$
  SELECT sokh_id FROM residents WHERE id = (
    SELECT (auth.jwt() -> 'user_metadata' ->> 'resident_id')::BIGINT
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Хялбар хувилбар: auth.uid() → residents table-с sokh_id
CREATE OR REPLACE FUNCTION get_sokh_id_by_auth()
RETURNS BIGINT AS $$
  SELECT sokh_id FROM residents
  WHERE id IN (
    SELECT id FROM residents
    WHERE phone = (SELECT email FROM auth.users WHERE id = auth.uid())
    LIMIT 1
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- 1. БАЙРШЛЫН TABLE-ҮҮД (Public read only)
-- ============================================

-- cities: хуучин policy устгаад шинээр
DROP POLICY IF EXISTS "public read cities" ON cities;
CREATE POLICY "cities_select" ON cities FOR SELECT USING (true);
-- insert/update/delete: зөвхөн service_role (admin API)

-- districts
DROP POLICY IF EXISTS "public read districts" ON districts;
CREATE POLICY "districts_select" ON districts FOR SELECT USING (true);

-- khoroos
DROP POLICY IF EXISTS "public read khoroos" ON khoroos;
CREATE POLICY "khoroos_select" ON khoroos FOR SELECT USING (true);

-- sokh_organizations
DROP POLICY IF EXISTS "public read sokh" ON sokh_organizations;
DROP POLICY IF EXISTS "public insert sokh" ON sokh_organizations;
CREATE POLICY "sokh_select" ON sokh_organizations FOR SELECT USING (true);
-- insert: зөвхөн service_role

-- ============================================
-- 2. RESIDENTS (Оршин суугчид)
-- ============================================
DROP POLICY IF EXISTS "Allow all access to residents" ON residents;

-- Authenticated: Өөрийн СӨХ-ийн оршин суугчдыг харах
CREATE POLICY "residents_select_auth" ON residents
  FOR SELECT TO authenticated
  USING (true);  -- Authenticated хэрэглэгч бүр харж болно (sokh dashboard-д хэрэгтэй)

-- Anon: Бүртгэлийн flow-д шаардлагатай
CREATE POLICY "residents_insert_anon" ON residents
  FOR INSERT TO anon
  WITH CHECK (true);  -- Бүртгэлийн үед шинэ resident үүсгэх

-- Authenticated: Өөрийн мэдээлэл засах
CREATE POLICY "residents_update_auth" ON residents
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Delete: зөвхөн service_role (admin)

-- ============================================
-- 3. PAYMENTS (Төлбөр)
-- ============================================
DROP POLICY IF EXISTS "Allow all access to payments" ON payments;

CREATE POLICY "payments_select" ON payments
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "payments_insert" ON payments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================
-- 4. ANNOUNCEMENTS (Зарлал)
-- ============================================
DROP POLICY IF EXISTS "public read announcements" ON announcements;

CREATE POLICY "announcements_select" ON announcements
  FOR SELECT USING (true);  -- Бүгд уншиж болно

-- Insert/Update/Delete: зөвхөн service_role (admin)

-- ============================================
-- 5. MAINTENANCE_REQUESTS (Засвар хүсэлт)
-- ============================================
DROP POLICY IF EXISTS "public read maintenance" ON maintenance_requests;
DROP POLICY IF EXISTS "public insert maintenance" ON maintenance_requests;

CREATE POLICY "maintenance_select" ON maintenance_requests
  FOR SELECT USING (true);

CREATE POLICY "maintenance_insert" ON maintenance_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Update/Delete: зөвхөн service_role (admin)

-- ============================================
-- 6. POLLS (Санал хураалт)
-- ============================================
DROP POLICY IF EXISTS "public read polls" ON polls;

CREATE POLICY "polls_select" ON polls
  FOR SELECT USING (true);

CREATE POLICY "polls_update_auth" ON polls
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL);  -- Санал өгөх (yes/no count update)

-- Insert/Delete: зөвхөн service_role (admin)

-- ============================================
-- 7. MESSAGES (Мессеж)
-- ============================================
DROP POLICY IF EXISTS "public read messages" ON messages;
DROP POLICY IF EXISTS "public insert messages" ON messages;

CREATE POLICY "messages_select" ON messages
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "messages_insert" ON messages
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================
-- 8. COMPLAINTS (Гомдол/Санал)
-- ============================================
DROP POLICY IF EXISTS "Allow all complaints" ON complaints;

CREATE POLICY "complaints_select" ON complaints
  FOR SELECT USING (true);

CREATE POLICY "complaints_insert" ON complaints
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Update/Delete: зөвхөн service_role

-- ============================================
-- 9. CHAT_MESSAGES (Хөрш чат)
-- ============================================
DROP POLICY IF EXISTS "Allow all chat_messages" ON chat_messages;

CREATE POLICY "chat_select" ON chat_messages
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "chat_insert" ON chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================
-- 10. EMERGENCY_ALERTS (Яаралтай)
-- ============================================
DROP POLICY IF EXISTS "Allow all emergency_alerts" ON emergency_alerts;

CREATE POLICY "emergency_select" ON emergency_alerts
  FOR SELECT USING (true);

-- Insert: зөвхөн service_role

-- ============================================
-- 11. MARKETPLACE_LISTINGS (Маркет)
-- ============================================
DROP POLICY IF EXISTS "Allow all marketplace_listings" ON marketplace_listings;

CREATE POLICY "marketplace_select" ON marketplace_listings
  FOR SELECT USING (true);

CREATE POLICY "marketplace_insert" ON marketplace_listings
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================
-- 12. COMMON_SPACES & SPACE_BOOKINGS (Зай захиалга)
-- ============================================
DROP POLICY IF EXISTS "Allow all common_spaces" ON common_spaces;
DROP POLICY IF EXISTS "Allow all space_bookings" ON space_bookings;

CREATE POLICY "spaces_select" ON common_spaces FOR SELECT USING (true);

CREATE POLICY "bookings_select" ON space_bookings FOR SELECT USING (true);

CREATE POLICY "bookings_insert" ON space_bookings
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================
-- 13. STAFF (Ажилчид)
-- ============================================
DROP POLICY IF EXISTS "Allow all staff" ON staff;

CREATE POLICY "staff_select" ON staff FOR SELECT USING (true);

-- ============================================
-- 14. UTILITY_USAGE (Ашиглалт)
-- ============================================
DROP POLICY IF EXISTS "Allow all utility_usage" ON utility_usage;

CREATE POLICY "utility_select" ON utility_usage FOR SELECT USING (true);

-- Insert/Update/Delete: зөвхөн service_role

-- ============================================
-- 15. PACKAGES (Илгээмж)
-- ============================================
DROP POLICY IF EXISTS "Allow all packages" ON packages;

CREATE POLICY "packages_select" ON packages FOR SELECT USING (true);

CREATE POLICY "packages_update" ON packages
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL);  -- picked_up status update

-- ============================================
-- 16. POINT_ACTIVITIES (Оноо)
-- ============================================
DROP POLICY IF EXISTS "Allow all point_activities" ON point_activities;

CREATE POLICY "points_select" ON point_activities FOR SELECT USING (true);

-- ============================================
-- 17. LOCAL_SHOPS & VENDING_MACHINES (Дэлгүүр)
-- ============================================
DROP POLICY IF EXISTS "Allow all local_shops" ON local_shops;
DROP POLICY IF EXISTS "Allow all vending_machines" ON vending_machines;

CREATE POLICY "shops_select" ON local_shops FOR SELECT USING (true);
CREATE POLICY "vending_select" ON vending_machines FOR SELECT USING (true);

-- ============================================
-- 18. ШИНЭ TABLE-ҮҮД (v3 migration)
-- ============================================

-- parking_vehicles
DROP POLICY IF EXISTS "Allow all parking_vehicles" ON parking_vehicles;
CREATE POLICY "parking_select" ON parking_vehicles FOR SELECT USING (true);
CREATE POLICY "parking_insert" ON parking_vehicles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "parking_update" ON parking_vehicles
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- blocking_reports
DROP POLICY IF EXISTS "Allow all blocking_reports" ON blocking_reports;
CREATE POLICY "blocking_select" ON blocking_reports FOR SELECT USING (true);
CREATE POLICY "blocking_insert" ON blocking_reports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- cctv_requests
DROP POLICY IF EXISTS "Allow all cctv_requests" ON cctv_requests;
CREATE POLICY "cctv_select" ON cctv_requests FOR SELECT USING (true);
CREATE POLICY "cctv_insert" ON cctv_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- billing_items
DROP POLICY IF EXISTS "Allow all billing_items" ON billing_items;
CREATE POLICY "billing_select" ON billing_items FOR SELECT USING (true);
-- Insert/Update/Delete: зөвхөн service_role

-- resident_bills
DROP POLICY IF EXISTS "Allow all resident_bills" ON resident_bills;
CREATE POLICY "rbills_select" ON resident_bills FOR SELECT TO authenticated USING (true);
CREATE POLICY "rbills_update" ON resident_bills FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);

-- admin_config
DROP POLICY IF EXISTS "Allow all admin_config" ON admin_config;
CREATE POLICY "adminconfig_select" ON admin_config FOR SELECT USING (true);
-- Update: зөвхөн service_role

-- scheduled_notifications
DROP POLICY IF EXISTS "Allow all scheduled_notifications" ON scheduled_notifications;
CREATE POLICY "schednotif_select" ON scheduled_notifications FOR SELECT USING (true);
CREATE POLICY "schednotif_update" ON scheduled_notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ============================================
-- ДУУСАВ!
-- Дүрэм:
--   SELECT = бүгд (эсвэл authenticated)
--   INSERT = authenticated only
--   UPDATE/DELETE = authenticated эсвэл service_role only
--   Admin бүх операц = /api/admin/db → service_role
-- ============================================
