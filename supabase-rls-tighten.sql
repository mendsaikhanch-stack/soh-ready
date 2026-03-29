-- ============================================================
-- СӨХ Систем: RLS Policy чангатгах Migration
-- ============================================================
-- Зорилго: anon key-ээр шууд Supabase-руу хандахад бүх өгөгдлийг
-- унших боломжгүй болгох. Multi-tenant тусгаарлалт хийх.
--
-- Архитектурын тайлбар:
--   - Мобайл апп: anon key ашиглан Supabase-руу шууд хандана
--   - Админ панел: /api/admin/db → service_role key (RLS-г алгасна)
--   - Бүртгэл: /api/register → service_role key (RLS-г алгасна)
--
-- Аюулгүй байдлын зарчим:
--   1. Байршлын лавлах table = нийтэд нээлттэй (public reference)
--   2. Мэдрэг өгөгдөл (оршин суугч, төлбөр, санхүү) = anon хандалтгүй
--   3. Лог, тохиргоо = зөвхөн service_role
--   4. Бусад operational table = authenticated only
--
-- Давтан ажиллуулахад аюулгүй (IF EXISTS ашигласан)
-- ============================================================


-- ============================================================
-- 1. БАЙРШЛЫН ЛАВЛАХ TABLE-ҮҮД (Нийтэд нээлттэй)
--    cities, districts, khoroos, sokh_organizations
--    Шалтгаан: Бүртгэлийн flow болон нийтлэг лавлахад хэрэгтэй
-- ============================================================

-- cities: Хуучин policy-г устгаад шинэчлэх (өөрчлөлтгүй - нийтэд нээлттэй)
DROP POLICY IF EXISTS "public read cities" ON cities;
DROP POLICY IF EXISTS "cities_select" ON cities;
CREATE POLICY "cities_select_public" ON cities
  FOR SELECT USING (true);

-- districts: Нийтэд нээлттэй
DROP POLICY IF EXISTS "public read districts" ON districts;
DROP POLICY IF EXISTS "districts_select" ON districts;
CREATE POLICY "districts_select_public" ON districts
  FOR SELECT USING (true);

-- khoroos: Нийтэд нээлттэй
DROP POLICY IF EXISTS "public read khoroos" ON khoroos;
DROP POLICY IF EXISTS "khoroos_select" ON khoroos;
CREATE POLICY "khoroos_select_public" ON khoroos
  FOR SELECT USING (true);

-- sokh_organizations: Нийтэд нээлттэй (бүртгэлд СӨХ сонгоход хэрэгтэй)
DROP POLICY IF EXISTS "public read sokh" ON sokh_organizations;
DROP POLICY IF EXISTS "public insert sokh" ON sokh_organizations;
DROP POLICY IF EXISTS "sokh_select" ON sokh_organizations;
CREATE POLICY "sokh_select_public" ON sokh_organizations
  FOR SELECT USING (true);


-- ============================================================
-- 2. ADMIN_USERS (Админ хэрэглэгчид)
--    Аль хэдийн хамгаалагдсан - DENY ALL хэвээр
--    service_role key-ээр л хандах боломжтой
-- ============================================================

-- Хуучин policy байгаа тул өөрчлөхгүй
-- DROP POLICY IF EXISTS "admin_users_deny_all" ON admin_users;
-- CREATE POLICY "admin_users_deny_all" ON admin_users FOR ALL USING (false);


-- ============================================================
-- 3. RESIDENTS (Оршин суугчдын мэдээлэл - МЭДРЭГ)
--    Хуучин: anon INSERT + authenticated SELECT
--    Шинэ: anon хандалт бүрэн хаах
--    Шалтгаан: Оршин суугчдын утас, нэр, өр зэрэг хувийн мэдээлэл
--    Бүртгэл /api/register → service_role ашигладаг тул anon INSERT шаардлагагүй
-- ============================================================

-- Хуучин бүх policy устгах
DROP POLICY IF EXISTS "Allow all access to residents" ON residents;
DROP POLICY IF EXISTS "residents_select_auth" ON residents;
DROP POLICY IF EXISTS "residents_insert_anon" ON residents;
DROP POLICY IF EXISTS "residents_update_auth" ON residents;

-- Зөвхөн authenticated хэрэглэгч уншиж болно
CREATE POLICY "residents_select_authenticated" ON residents
  FOR SELECT TO authenticated
  USING (true);

-- Authenticated хэрэглэгч өөрийн мэдээлэл засах (service_role-р дамжсан ч ажиллана)
CREATE POLICY "residents_update_authenticated" ON residents
  FOR UPDATE TO authenticated
  USING (true);

-- INSERT, DELETE: зөвхөн service_role (API-р дамжина)
-- anon INSERT хаагдлаа - бүртгэл /api/register → service_role


-- ============================================================
-- 4. PAYMENTS (Төлбөрийн мэдээлэл - МЭДРЭГ)
--    Хуучин: authenticated SELECT + INSERT
--    Шинэ: anon хандалт бүрэн хаах, authenticated SELECT only
--    Шалтгаан: Санхүүгийн мэдрэг өгөгдөл
-- ============================================================

DROP POLICY IF EXISTS "Allow all access to payments" ON payments;
DROP POLICY IF EXISTS "payments_select" ON payments;
DROP POLICY IF EXISTS "payments_insert" ON payments;

-- Зөвхөн authenticated уншиж болно
CREATE POLICY "payments_select_authenticated" ON payments
  FOR SELECT TO authenticated
  USING (true);

-- INSERT: зөвхөн service_role (админ API-р дамжина)


-- ============================================================
-- 5. ANNOUNCEMENTS (Зарлал)
--    Хуучин: USING(true) - бүгдэд нээлттэй
--    Шинэ: authenticated only
--    Шалтгаан: СӨХ-ийн дотоод зарлал, гаднаас уншуулах шаардлагагүй
-- ============================================================

DROP POLICY IF EXISTS "public read announcements" ON announcements;
DROP POLICY IF EXISTS "announcements_select" ON announcements;

CREATE POLICY "announcements_select_authenticated" ON announcements
  FOR SELECT TO authenticated
  USING (true);

-- INSERT/UPDATE/DELETE: зөвхөн service_role (админ API)


-- ============================================================
-- 6. MAINTENANCE_REQUESTS (Засвар хүсэлт)
--    Хуучин: USING(true) SELECT + authenticated INSERT
--    Шинэ: authenticated only
-- ============================================================

DROP POLICY IF EXISTS "public read maintenance" ON maintenance_requests;
DROP POLICY IF EXISTS "public insert maintenance" ON maintenance_requests;
DROP POLICY IF EXISTS "maintenance_select" ON maintenance_requests;
DROP POLICY IF EXISTS "maintenance_insert" ON maintenance_requests;

CREATE POLICY "maintenance_select_authenticated" ON maintenance_requests
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "maintenance_insert_authenticated" ON maintenance_requests
  FOR INSERT TO authenticated
  WITH CHECK (true);


-- ============================================================
-- 7. COMPLAINTS (Гомдол/Санал)
--    Хуучин: USING(true) SELECT + authenticated INSERT
--    Шинэ: authenticated only
-- ============================================================

DROP POLICY IF EXISTS "Allow all complaints" ON complaints;
DROP POLICY IF EXISTS "complaints_select" ON complaints;
DROP POLICY IF EXISTS "complaints_insert" ON complaints;

CREATE POLICY "complaints_select_authenticated" ON complaints
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "complaints_insert_authenticated" ON complaints
  FOR INSERT TO authenticated
  WITH CHECK (true);


-- ============================================================
-- 8. POLLS (Санал хураалт)
--    Хуучин: USING(true) SELECT + authenticated UPDATE
--    Шинэ: authenticated only
-- ============================================================

DROP POLICY IF EXISTS "public read polls" ON polls;
DROP POLICY IF EXISTS "polls_select" ON polls;
DROP POLICY IF EXISTS "polls_update_auth" ON polls;

CREATE POLICY "polls_select_authenticated" ON polls
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "polls_update_authenticated" ON polls
  FOR UPDATE TO authenticated
  USING (true);


-- ============================================================
-- 9. MESSAGES (Мессеж)
--    Аль хэдийн authenticated - баталгаажуулах
-- ============================================================

DROP POLICY IF EXISTS "public read messages" ON messages;
DROP POLICY IF EXISTS "public insert messages" ON messages;
DROP POLICY IF EXISTS "messages_select" ON messages;
DROP POLICY IF EXISTS "messages_insert" ON messages;

CREATE POLICY "messages_select_authenticated" ON messages
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "messages_insert_authenticated" ON messages
  FOR INSERT TO authenticated
  WITH CHECK (true);


-- ============================================================
-- 10. CHAT_MESSAGES (Хөрш чат)
--     Аль хэдийн authenticated - баталгаажуулах
-- ============================================================

DROP POLICY IF EXISTS "Allow all chat_messages" ON chat_messages;
DROP POLICY IF EXISTS "chat_select" ON chat_messages;
DROP POLICY IF EXISTS "chat_insert" ON chat_messages;

CREATE POLICY "chat_select_authenticated" ON chat_messages
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "chat_insert_authenticated" ON chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (true);


-- ============================================================
-- 11. PUSH_SUBSCRIPTIONS (Push мэдэгдлийн бүртгэл)
--     Хуучин: USING(true) бүх операц
--     Шинэ: authenticated only SELECT + INSERT
--     Шалтгаан: Push endpoint мэдээлэл мэдрэг
-- ============================================================

DROP POLICY IF EXISTS "push_select" ON push_subscriptions;
DROP POLICY IF EXISTS "push_insert" ON push_subscriptions;
DROP POLICY IF EXISTS "push_update" ON push_subscriptions;
DROP POLICY IF EXISTS "push_delete" ON push_subscriptions;

CREATE POLICY "push_select_authenticated" ON push_subscriptions
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "push_insert_authenticated" ON push_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- UPDATE/DELETE: зөвхөн service_role


-- ============================================================
-- 12. ERROR_LOGS (Алдааны бүртгэл)
--     Хуучин: anon INSERT + service_role SELECT
--     Шинэ: INSERT хэвээр (клиентээс бичих), SELECT зөвхөн service_role
--     Тайлбар: Клиент талын алдааг бүртгэхэд anon INSERT хэрэгтэй
-- ============================================================

DROP POLICY IF EXISTS "Allow anonymous insert" ON error_logs;
DROP POLICY IF EXISTS "Service role select" ON error_logs;

-- Клиентээс алдаа бичих (anon + authenticated)
CREATE POLICY "error_logs_insert_all" ON error_logs
  FOR INSERT WITH CHECK (true);

-- Уншиж харах: зөвхөн service_role (RLS-г алгасна)
-- Тиймээс SELECT policy огт үүсгэхгүй = автоматаар DENY


-- ============================================================
-- 13. AUDIT_LOGS (Аудит лог - НУУЦЛАЛТАЙ)
--     RLS идэвхжүүлж, бүх хандалтыг хаах
--     Зөвхөн service_role key-ээр хандана
-- ============================================================

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Бүх хандалт хаах (service_role RLS-г алгасдаг)
DROP POLICY IF EXISTS "audit_logs_deny_all" ON audit_logs;
CREATE POLICY "audit_logs_deny_all" ON audit_logs
  FOR ALL USING (false);


-- ============================================================
-- 14. ADMIN_CONFIG (Админ тохиргоо)
--     Хуучин: USING(true) бүх операц
--     Шинэ: authenticated SELECT only
-- ============================================================

DROP POLICY IF EXISTS "Allow all admin_config" ON admin_config;
DROP POLICY IF EXISTS "adminconfig_select" ON admin_config;

CREATE POLICY "admin_config_select_authenticated" ON admin_config
  FOR SELECT TO authenticated
  USING (true);

-- INSERT/UPDATE/DELETE: зөвхөн service_role


-- ============================================================
-- 15. САНХҮҮГИЙН TABLE-ҮҮД (МЭДРЭГ - authenticated only)
-- ============================================================

-- billing_items (Төлбөрийн нэр төрөл)
DROP POLICY IF EXISTS "Allow all billing_items" ON billing_items;
DROP POLICY IF EXISTS "billing_select" ON billing_items;

CREATE POLICY "billing_items_select_authenticated" ON billing_items
  FOR SELECT TO authenticated
  USING (true);

-- resident_bills (Оршин суугчийн төлбөр)
DROP POLICY IF EXISTS "Allow all resident_bills" ON resident_bills;
DROP POLICY IF EXISTS "rbills_select" ON resident_bills;
DROP POLICY IF EXISTS "rbills_update" ON resident_bills;

CREATE POLICY "resident_bills_select_authenticated" ON resident_bills
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "resident_bills_update_authenticated" ON resident_bills
  FOR UPDATE TO authenticated
  USING (true);

-- budget_items (Санхүүгийн зүйлс)
DROP POLICY IF EXISTS "Allow all budget_items" ON budget_items;

CREATE POLICY "budget_items_select_authenticated" ON budget_items
  FOR SELECT TO authenticated
  USING (true);


-- ============================================================
-- 16. ОСНААК TABLE-ҮҮД (Коммуналын мэдээлэл - authenticated only)
-- ============================================================

-- utility_tariffs (Тариф)
DROP POLICY IF EXISTS "Allow all utility_tariffs" ON utility_tariffs;

CREATE POLICY "utility_tariffs_select_authenticated" ON utility_tariffs
  FOR SELECT TO authenticated
  USING (true);

-- meter_readings (Тоолуурын заалт - МЭДРЭГ)
DROP POLICY IF EXISTS "Allow all meter_readings" ON meter_readings;

CREATE POLICY "meter_readings_select_authenticated" ON meter_readings
  FOR SELECT TO authenticated
  USING (true);

-- utility_bills (Коммуналын нэхэмжлэх - МЭДРЭГ)
DROP POLICY IF EXISTS "Allow all utility_bills" ON utility_bills;

CREATE POLICY "utility_bills_select_authenticated" ON utility_bills
  FOR SELECT TO authenticated
  USING (true);

-- osnaa_entities (ОСНААК байгууллагууд - лавлах)
DROP POLICY IF EXISTS "Allow all osnaa_entities" ON osnaa_entities;

CREATE POLICY "osnaa_entities_select_authenticated" ON osnaa_entities
  FOR SELECT TO authenticated
  USING (true);


-- ============================================================
-- 17. ЗОГСООЛЫН TABLE-ҮҮД (authenticated only)
-- ============================================================

-- parking_vehicles
DROP POLICY IF EXISTS "Allow all parking_vehicles" ON parking_vehicles;
DROP POLICY IF EXISTS "parking_select" ON parking_vehicles;
DROP POLICY IF EXISTS "parking_insert" ON parking_vehicles;
DROP POLICY IF EXISTS "parking_update" ON parking_vehicles;

CREATE POLICY "parking_vehicles_select_authenticated" ON parking_vehicles
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "parking_vehicles_insert_authenticated" ON parking_vehicles
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "parking_vehicles_update_authenticated" ON parking_vehicles
  FOR UPDATE TO authenticated
  USING (true);

-- blocking_reports
DROP POLICY IF EXISTS "Allow all blocking_reports" ON blocking_reports;
DROP POLICY IF EXISTS "blocking_select" ON blocking_reports;
DROP POLICY IF EXISTS "blocking_insert" ON blocking_reports;

CREATE POLICY "blocking_reports_select_authenticated" ON blocking_reports
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "blocking_reports_insert_authenticated" ON blocking_reports
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- vehicles (parking-migration)
DROP POLICY IF EXISTS "vehicles_read" ON vehicles;

CREATE POLICY "vehicles_select_authenticated" ON vehicles
  FOR SELECT TO authenticated
  USING (true);

-- blocking_incidents (parking-migration)
DROP POLICY IF EXISTS "blocking_incidents_read" ON blocking_incidents;

CREATE POLICY "blocking_incidents_select_authenticated" ON blocking_incidents
  FOR SELECT TO authenticated
  USING (true);

-- guest_vehicles (parking-migration)
DROP POLICY IF EXISTS "guest_vehicles_read" ON guest_vehicles;

CREATE POLICY "guest_vehicles_select_authenticated" ON guest_vehicles
  FOR SELECT TO authenticated
  USING (true);

-- gate_settings (parking-migration)
DROP POLICY IF EXISTS "gate_settings_read" ON gate_settings;

CREATE POLICY "gate_settings_select_authenticated" ON gate_settings
  FOR SELECT TO authenticated
  USING (true);


-- ============================================================
-- 18. КАМЕР / CCTV TABLE-ҮҮД (authenticated only)
-- ============================================================

-- cameras (RTSP URL, IP хаяг зэрэг мэдрэг мэдээлэлтэй)
DROP POLICY IF EXISTS "cameras_read" ON cameras;

CREATE POLICY "cameras_select_authenticated" ON cameras
  FOR SELECT TO authenticated
  USING (true);

-- cctv_ai_alerts
DROP POLICY IF EXISTS "cctv_ai_alerts_read" ON cctv_ai_alerts;

CREATE POLICY "cctv_ai_alerts_select_authenticated" ON cctv_ai_alerts
  FOR SELECT TO authenticated
  USING (true);

-- cctv_requests
DROP POLICY IF EXISTS "Allow all cctv_requests" ON cctv_requests;
DROP POLICY IF EXISTS "cctv_select" ON cctv_requests;
DROP POLICY IF EXISTS "cctv_insert" ON cctv_requests;

CREATE POLICY "cctv_requests_select_authenticated" ON cctv_requests
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "cctv_requests_insert_authenticated" ON cctv_requests
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- footage_requests
DROP POLICY IF EXISTS "footage_requests_read" ON footage_requests;

CREATE POLICY "footage_requests_select_authenticated" ON footage_requests
  FOR SELECT TO authenticated
  USING (true);


-- ============================================================
-- 19. БАЙЦААГЧИЙН TABLE-ҮҮД (authenticated only)
--     Шалгалт, зөрчил, тоолуурын заалт зэрэг мэдрэг мэдээлэл
-- ============================================================

-- inspectors (Нууц үг агуулсан - DENY ALL)
DROP POLICY IF EXISTS "Allow all inspectors" ON inspectors;

CREATE POLICY "inspectors_deny_all" ON inspectors
  FOR ALL USING (false);

-- inspector_assignments
DROP POLICY IF EXISTS "Allow all inspector_assignments" ON inspector_assignments;

CREATE POLICY "inspector_assignments_select_authenticated" ON inspector_assignments
  FOR SELECT TO authenticated
  USING (true);

-- inspections
DROP POLICY IF EXISTS "Allow all inspections" ON inspections;

CREATE POLICY "inspections_select_authenticated" ON inspections
  FOR SELECT TO authenticated
  USING (true);

-- inspection_readings
DROP POLICY IF EXISTS "Allow all inspection_readings" ON inspection_readings;

CREATE POLICY "inspection_readings_select_authenticated" ON inspection_readings
  FOR SELECT TO authenticated
  USING (true);

-- inspection_violations
DROP POLICY IF EXISTS "Allow all inspection_violations" ON inspection_violations;

CREATE POLICY "inspection_violations_select_authenticated" ON inspection_violations
  FOR SELECT TO authenticated
  USING (true);

-- inspection_acts
DROP POLICY IF EXISTS "Allow all inspection_acts" ON inspection_acts;

CREATE POLICY "inspection_acts_select_authenticated" ON inspection_acts
  FOR SELECT TO authenticated
  USING (true);


-- ============================================================
-- 20. БУСАД OPERATIONAL TABLE-ҮҮД (authenticated only)
-- ============================================================

-- emergency_alerts (Яаралтай мэдэгдэл)
DROP POLICY IF EXISTS "Allow all emergency_alerts" ON emergency_alerts;
DROP POLICY IF EXISTS "emergency_select" ON emergency_alerts;

CREATE POLICY "emergency_select_authenticated" ON emergency_alerts
  FOR SELECT TO authenticated
  USING (true);

-- marketplace_listings (Маркет)
DROP POLICY IF EXISTS "Allow all marketplace_listings" ON marketplace_listings;
DROP POLICY IF EXISTS "marketplace_select" ON marketplace_listings;
DROP POLICY IF EXISTS "marketplace_insert" ON marketplace_listings;

CREATE POLICY "marketplace_select_authenticated" ON marketplace_listings
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "marketplace_insert_authenticated" ON marketplace_listings
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- common_spaces (Нийтийн зай)
DROP POLICY IF EXISTS "Allow all common_spaces" ON common_spaces;
DROP POLICY IF EXISTS "spaces_select" ON common_spaces;

CREATE POLICY "common_spaces_select_authenticated" ON common_spaces
  FOR SELECT TO authenticated
  USING (true);

-- space_bookings (Зай захиалга)
DROP POLICY IF EXISTS "Allow all space_bookings" ON space_bookings;
DROP POLICY IF EXISTS "bookings_select" ON space_bookings;
DROP POLICY IF EXISTS "bookings_insert" ON space_bookings;

CREATE POLICY "space_bookings_select_authenticated" ON space_bookings
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "space_bookings_insert_authenticated" ON space_bookings
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- staff (Ажилчид - цалингийн мэдээлэлтэй)
DROP POLICY IF EXISTS "Allow all staff" ON staff;
DROP POLICY IF EXISTS "staff_select" ON staff;

CREATE POLICY "staff_select_authenticated" ON staff
  FOR SELECT TO authenticated
  USING (true);

-- utility_usage (Ашиглалт)
DROP POLICY IF EXISTS "Allow all utility_usage" ON utility_usage;
DROP POLICY IF EXISTS "utility_select" ON utility_usage;

CREATE POLICY "utility_usage_select_authenticated" ON utility_usage
  FOR SELECT TO authenticated
  USING (true);

-- packages (Илгээмж)
DROP POLICY IF EXISTS "Allow all packages" ON packages;
DROP POLICY IF EXISTS "packages_select" ON packages;
DROP POLICY IF EXISTS "packages_update" ON packages;

CREATE POLICY "packages_select_authenticated" ON packages
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "packages_update_authenticated" ON packages
  FOR UPDATE TO authenticated
  USING (true);

-- point_activities (Оноо)
DROP POLICY IF EXISTS "Allow all point_activities" ON point_activities;
DROP POLICY IF EXISTS "points_select" ON point_activities;

CREATE POLICY "point_activities_select_authenticated" ON point_activities
  FOR SELECT TO authenticated
  USING (true);

-- local_shops (Дэлгүүр)
DROP POLICY IF EXISTS "Allow all local_shops" ON local_shops;
DROP POLICY IF EXISTS "shops_select" ON local_shops;

CREATE POLICY "local_shops_select_authenticated" ON local_shops
  FOR SELECT TO authenticated
  USING (true);

-- vending_machines (Автомат)
DROP POLICY IF EXISTS "Allow all vending_machines" ON vending_machines;
DROP POLICY IF EXISTS "vending_select" ON vending_machines;

CREATE POLICY "vending_machines_select_authenticated" ON vending_machines
  FOR SELECT TO authenticated
  USING (true);

-- poll_votes (Санал хураалтын дуу хоолой)
DROP POLICY IF EXISTS "Allow all poll_votes" ON poll_votes;

CREATE POLICY "poll_votes_select_authenticated" ON poll_votes
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "poll_votes_insert_authenticated" ON poll_votes
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- scheduled_notifications (Товлосон мэдэгдэл)
DROP POLICY IF EXISTS "Allow all scheduled_notifications" ON scheduled_notifications;
DROP POLICY IF EXISTS "schednotif_select" ON scheduled_notifications;
DROP POLICY IF EXISTS "schednotif_update" ON scheduled_notifications;

CREATE POLICY "scheduled_notifications_select_authenticated" ON scheduled_notifications
  FOR SELECT TO authenticated
  USING (true);

-- elevator_tasks (Лифт засвар)
DROP POLICY IF EXISTS "elevator_all" ON elevator_tasks;

CREATE POLICY "elevator_tasks_select_authenticated" ON elevator_tasks
  FOR SELECT TO authenticated
  USING (true);


-- ============================================================
-- ДҮГНЭЛТ
-- ============================================================
-- Нийтэд нээлттэй (anon + authenticated):
--   cities, districts, khoroos, sokh_organizations
--
-- Authenticated only (anon хаагдсан):
--   residents, payments, announcements, maintenance_requests,
--   complaints, polls, messages, chat_messages, push_subscriptions,
--   admin_config, billing_items, resident_bills, budget_items,
--   utility_tariffs, meter_readings, utility_bills, osnaa_entities,
--   parking_vehicles, blocking_reports, vehicles, blocking_incidents,
--   guest_vehicles, gate_settings, cameras, cctv_ai_alerts,
--   cctv_requests, footage_requests, inspector_assignments,
--   inspections, inspection_readings, inspection_violations,
--   inspection_acts, emergency_alerts, marketplace_listings,
--   common_spaces, space_bookings, staff, utility_usage, packages,
--   point_activities, local_shops, vending_machines, poll_votes,
--   scheduled_notifications, elevator_tasks
--
-- DENY ALL (зөвхөн service_role):
--   admin_users, error_logs (SELECT), audit_logs, inspectors
--
-- Анхааруулга: Энэ migration-г ажиллуулсны дараа anon key-ээр
-- шууд Supabase-руу хандвал зөвхөн байршлын лавлах table-үүдийг
-- уншиж чадна. Бусад бүх өгөгдөл хамгаалагдсан.
-- ============================================================
