-- ============================================================
-- Migration: Aircraft Registrations Schema
-- Run this in the Supabase Dashboard SQL Editor
-- ============================================================

-- 1. Add missing columns to aircraft table
ALTER TABLE aircraft ADD COLUMN IF NOT EXISTS sub_operator TEXT;
ALTER TABLE aircraft ADD COLUMN IF NOT EXISTS date_of_delivery DATE;
ALTER TABLE aircraft ADD COLUMN IF NOT EXISTS current_location_id UUID REFERENCES airports(id);
ALTER TABLE aircraft ADD COLUMN IF NOT EXISTS current_location_updated_at TIMESTAMPTZ;
ALTER TABLE aircraft ADD COLUMN IF NOT EXISTS last_maintenance_date DATE;
ALTER TABLE aircraft ADD COLUMN IF NOT EXISTS last_maintenance_description TEXT;
ALTER TABLE aircraft ADD COLUMN IF NOT EXISTS aircraft_version TEXT;
ALTER TABLE aircraft ADD COLUMN IF NOT EXISTS mtow_kg_override NUMERIC;
ALTER TABLE aircraft ADD COLUMN IF NOT EXISTS max_range_nm_override NUMERIC;
ALTER TABLE aircraft ADD COLUMN IF NOT EXISTS cockpit_rest_facility_class_override TEXT;
ALTER TABLE aircraft ADD COLUMN IF NOT EXISTS cabin_rest_facility_class_override TEXT;
ALTER TABLE aircraft ADD COLUMN IF NOT EXISTS cockpit_rest_positions_override INTEGER;
ALTER TABLE aircraft ADD COLUMN IF NOT EXISTS cabin_rest_positions_override INTEGER;

-- 2. Create aircraft_seating_configs table (effective-dated registration configs)
CREATE TABLE IF NOT EXISTS aircraft_seating_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aircraft_id UUID NOT NULL REFERENCES aircraft(id) ON DELETE CASCADE,
  config_name TEXT NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  cabin_config JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_capacity INTEGER NOT NULL DEFAULT 0,
  cockpit_rest_facility_class TEXT,
  cabin_rest_facility_class TEXT,
  cockpit_rest_positions INTEGER,
  cabin_rest_positions INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS on new table
ALTER TABLE aircraft_seating_configs ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies for aircraft_seating_configs
CREATE POLICY "Allow authenticated read" ON aircraft_seating_configs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow service role all" ON aircraft_seating_configs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_aircraft_seating_configs_aircraft_id
  ON aircraft_seating_configs(aircraft_id);
CREATE INDEX IF NOT EXISTS idx_aircraft_seating_configs_dates
  ON aircraft_seating_configs(effective_from, effective_to);

-- 6. Notify PostgREST to refresh schema cache
NOTIFY pgrst, 'reload schema';
