-- ============================================================
-- Migration 007: Disable RLS on ALL tables
-- Will re-enable with proper policies once core features are complete.
-- Run manually in Supabase Dashboard SQL Editor
-- ============================================================

ALTER TABLE operators DISABLE ROW LEVEL SECURITY;
ALTER TABLE countries DISABLE ROW LEVEL SECURITY;
ALTER TABLE airports DISABLE ROW LEVEL SECURITY;
ALTER TABLE airlines DISABLE ROW LEVEL SECURITY;
ALTER TABLE city_pairs DISABLE ROW LEVEL SECURITY;
ALTER TABLE aircraft_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE aircraft DISABLE ROW LEVEL SECURITY;
ALTER TABLE airport_tat_rules DISABLE ROW LEVEL SECURITY;
ALTER TABLE flight_service_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE delay_codes DISABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_seasons DISABLE ROW LEVEL SECURITY;
ALTER TABLE service_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE cabin_configurations DISABLE ROW LEVEL SECURITY;
ALTER TABLE flight_numbers DISABLE ROW LEVEL SECURITY;
ALTER TABLE flights DISABLE ROW LEVEL SECURITY;
ALTER TABLE ssim_imports DISABLE ROW LEVEL SECURITY;
ALTER TABLE message_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences DISABLE ROW LEVEL SECURITY;

-- Also disable on user_roles and module_definitions if they exist
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_roles') THEN
    EXECUTE 'ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY';
  END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'module_definitions') THEN
    EXECUTE 'ALTER TABLE module_definitions DISABLE ROW LEVEL SECURITY';
  END IF;
END $$;
