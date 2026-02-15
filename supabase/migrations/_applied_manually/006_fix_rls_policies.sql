-- ============================================================
-- Migration 006: Fix RLS policies for ALL tables
-- Drops all existing policies and creates clean authenticated
-- CRUD policies for every table.
-- Run manually in Supabase Dashboard SQL Editor
-- ============================================================

-- ============================================================
-- 1. REFERENCE / CONFIG TABLES (no operator_id)
--    All authenticated users can SELECT + INSERT + UPDATE + DELETE
-- ============================================================

-- COUNTRIES
DROP POLICY IF EXISTS "Allow authenticated users to read countries" ON countries;
DROP POLICY IF EXISTS "Allow admins to insert countries" ON countries;
DROP POLICY IF EXISTS "Allow admins to update countries" ON countries;
DROP POLICY IF EXISTS "Allow admins to delete countries" ON countries;
DROP POLICY IF EXISTS "auth_read" ON countries;
DROP POLICY IF EXISTS "auth_write" ON countries;
CREATE POLICY "auth_select" ON countries FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON countries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON countries FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete" ON countries FOR DELETE TO authenticated USING (true);

-- AIRPORTS
DROP POLICY IF EXISTS "Allow authenticated users to read airports" ON airports;
DROP POLICY IF EXISTS "Allow admins to insert airports" ON airports;
DROP POLICY IF EXISTS "Allow admins to update airports" ON airports;
DROP POLICY IF EXISTS "Allow admins to delete airports" ON airports;
DROP POLICY IF EXISTS "auth_read" ON airports;
DROP POLICY IF EXISTS "auth_write" ON airports;
CREATE POLICY "auth_select" ON airports FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON airports FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON airports FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete" ON airports FOR DELETE TO authenticated USING (true);

-- AIRLINES
DROP POLICY IF EXISTS "Allow authenticated users to read airlines" ON airlines;
DROP POLICY IF EXISTS "Allow admins to insert airlines" ON airlines;
DROP POLICY IF EXISTS "Allow admins to update airlines" ON airlines;
DROP POLICY IF EXISTS "Allow admins to delete airlines" ON airlines;
DROP POLICY IF EXISTS "auth_read" ON airlines;
DROP POLICY IF EXISTS "auth_write" ON airlines;
CREATE POLICY "auth_select" ON airlines FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON airlines FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON airlines FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete" ON airlines FOR DELETE TO authenticated USING (true);

-- CITY_PAIRS
DROP POLICY IF EXISTS "Allow authenticated users to read city_pairs" ON city_pairs;
DROP POLICY IF EXISTS "Allow admins to insert city_pairs" ON city_pairs;
DROP POLICY IF EXISTS "Allow admins to update city_pairs" ON city_pairs;
DROP POLICY IF EXISTS "Allow admins to delete city_pairs" ON city_pairs;
DROP POLICY IF EXISTS "auth_read" ON city_pairs;
DROP POLICY IF EXISTS "auth_write" ON city_pairs;
CREATE POLICY "auth_select" ON city_pairs FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON city_pairs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON city_pairs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete" ON city_pairs FOR DELETE TO authenticated USING (true);

-- AIRCRAFT_TYPES
DROP POLICY IF EXISTS "Users can read their operator's aircraft types" ON aircraft_types;
DROP POLICY IF EXISTS "Users can insert their operator's aircraft types" ON aircraft_types;
DROP POLICY IF EXISTS "Users can update their operator's aircraft types" ON aircraft_types;
DROP POLICY IF EXISTS "Users can delete their operator's aircraft types" ON aircraft_types;
DROP POLICY IF EXISTS "auth_read" ON aircraft_types;
DROP POLICY IF EXISTS "auth_write" ON aircraft_types;
CREATE POLICY "auth_select" ON aircraft_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON aircraft_types FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON aircraft_types FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete" ON aircraft_types FOR DELETE TO authenticated USING (true);

-- AIRCRAFT
DROP POLICY IF EXISTS "auth_read" ON aircraft;
DROP POLICY IF EXISTS "auth_write" ON aircraft;
CREATE POLICY "auth_select" ON aircraft FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON aircraft FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON aircraft FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete" ON aircraft FOR DELETE TO authenticated USING (true);

-- AIRPORT_TAT_RULES
DROP POLICY IF EXISTS "auth_read" ON airport_tat_rules;
DROP POLICY IF EXISTS "auth_write" ON airport_tat_rules;
CREATE POLICY "auth_select" ON airport_tat_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON airport_tat_rules FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON airport_tat_rules FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete" ON airport_tat_rules FOR DELETE TO authenticated USING (true);

-- SCHEDULE_SEASONS
DROP POLICY IF EXISTS "auth_read" ON schedule_seasons;
DROP POLICY IF EXISTS "auth_write" ON schedule_seasons;
CREATE POLICY "auth_select" ON schedule_seasons FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON schedule_seasons FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON schedule_seasons FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete" ON schedule_seasons FOR DELETE TO authenticated USING (true);

-- SERVICE_TYPES
DROP POLICY IF EXISTS "auth_read" ON service_types;
DROP POLICY IF EXISTS "auth_write" ON service_types;
CREATE POLICY "auth_select" ON service_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON service_types FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON service_types FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete" ON service_types FOR DELETE TO authenticated USING (true);

-- CABIN_CONFIGURATIONS
DROP POLICY IF EXISTS "auth_read" ON cabin_configurations;
DROP POLICY IF EXISTS "auth_write" ON cabin_configurations;
CREATE POLICY "auth_select" ON cabin_configurations FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON cabin_configurations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON cabin_configurations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete" ON cabin_configurations FOR DELETE TO authenticated USING (true);

-- OPERATORS
DROP POLICY IF EXISTS "Users can read their operator" ON operators;
DROP POLICY IF EXISTS "Admins can update operators" ON operators;
DROP POLICY IF EXISTS "auth_read" ON operators;
DROP POLICY IF EXISTS "auth_write" ON operators;
CREATE POLICY "auth_select" ON operators FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON operators FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON operators FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete" ON operators FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 2. OPERATOR-SCOPED TABLES (have operator_id)
--    All authenticated users can SELECT + INSERT + UPDATE + DELETE
-- ============================================================

-- FLIGHT_SERVICE_TYPES
DROP POLICY IF EXISTS "auth_read" ON flight_service_types;
DROP POLICY IF EXISTS "auth_write" ON flight_service_types;
CREATE POLICY "auth_select" ON flight_service_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON flight_service_types FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON flight_service_types FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete" ON flight_service_types FOR DELETE TO authenticated USING (true);

-- DELAY_CODES
DROP POLICY IF EXISTS "auth_read" ON delay_codes;
DROP POLICY IF EXISTS "auth_write" ON delay_codes;
CREATE POLICY "auth_select" ON delay_codes FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON delay_codes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON delay_codes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete" ON delay_codes FOR DELETE TO authenticated USING (true);

-- FLIGHT_NUMBERS
DROP POLICY IF EXISTS "auth_read" ON flight_numbers;
DROP POLICY IF EXISTS "auth_write" ON flight_numbers;
CREATE POLICY "auth_select" ON flight_numbers FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON flight_numbers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON flight_numbers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete" ON flight_numbers FOR DELETE TO authenticated USING (true);

-- FLIGHTS
DROP POLICY IF EXISTS "auth_read" ON flights;
DROP POLICY IF EXISTS "auth_write" ON flights;
CREATE POLICY "auth_select" ON flights FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON flights FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON flights FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete" ON flights FOR DELETE TO authenticated USING (true);

-- SSIM_IMPORTS
DROP POLICY IF EXISTS "auth_read" ON ssim_imports;
DROP POLICY IF EXISTS "auth_write" ON ssim_imports;
CREATE POLICY "auth_select" ON ssim_imports FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON ssim_imports FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON ssim_imports FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete" ON ssim_imports FOR DELETE TO authenticated USING (true);

-- MESSAGE_LOG
DROP POLICY IF EXISTS "auth_read" ON message_log;
DROP POLICY IF EXISTS "auth_write" ON message_log;
CREATE POLICY "auth_select" ON message_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON message_log FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON message_log FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete" ON message_log FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 3. USER TABLES
-- ============================================================

-- USER_ROLES (keep existing policies — users read own, admins manage all)
-- No changes needed here

-- USER_PREFERENCES (keep existing policies — users manage own)
-- No changes needed here

-- MODULE_DEFINITIONS (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'module_definitions') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can read module definitions" ON module_definitions';
    EXECUTE 'DROP POLICY IF EXISTS "Admins can insert module definitions" ON module_definitions';
    EXECUTE 'DROP POLICY IF EXISTS "Admins can update module definitions" ON module_definitions';
    EXECUTE 'DROP POLICY IF EXISTS "Admins can delete module definitions" ON module_definitions';
    EXECUTE 'DROP POLICY IF EXISTS "auth_read" ON module_definitions';
    EXECUTE 'DROP POLICY IF EXISTS "auth_write" ON module_definitions';
    EXECUTE 'CREATE POLICY "auth_select" ON module_definitions FOR SELECT TO authenticated USING (true)';
    EXECUTE 'CREATE POLICY "auth_insert" ON module_definitions FOR INSERT TO authenticated WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "auth_update" ON module_definitions FOR UPDATE TO authenticated USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "auth_delete" ON module_definitions FOR DELETE TO authenticated USING (true)';
  END IF;
END $$;

-- ============================================================
-- 4. SEED: S26 and W26 schedule seasons
-- ============================================================

INSERT INTO schedule_seasons (code, name, start_date, end_date, status)
VALUES
  ('S26', 'Summer 2026', '2026-03-29', '2026-10-24', 'draft'),
  ('W26', 'Winter 2026/27', '2026-10-25', '2027-03-27', 'draft')
ON CONFLICT (code) DO NOTHING;
