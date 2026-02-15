-- ============================================================
-- 011: Multi-operator support + Aircraft seating configs
-- ============================================================

-- 1. Aircraft registration-specific seating configs (effective-dated)
CREATE TABLE IF NOT EXISTS aircraft_seating_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aircraft_id UUID NOT NULL REFERENCES aircraft(id) ON DELETE CASCADE,
  config_name VARCHAR(50) NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  cabin_config JSONB NOT NULL,
  total_capacity INTEGER,
  cockpit_rest_facility_class VARCHAR(10),
  cabin_rest_facility_class VARCHAR(10),
  cockpit_rest_positions INTEGER,
  cabin_rest_positions INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prevent overlapping date ranges for the same aircraft
CREATE OR REPLACE FUNCTION check_seating_config_overlap()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM aircraft_seating_configs
    WHERE aircraft_id = NEW.aircraft_id
      AND id != COALESCE(NEW.id, gen_random_uuid())
      AND effective_from <= COALESCE(NEW.effective_to, '9999-12-31'::date)
      AND COALESCE(effective_to, '9999-12-31'::date) >= NEW.effective_from
  ) THEN
    RAISE EXCEPTION 'Overlapping seating config date range for this aircraft';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_seating_config_overlap ON aircraft_seating_configs;
CREATE TRIGGER trg_check_seating_config_overlap
  BEFORE INSERT OR UPDATE ON aircraft_seating_configs
  FOR EACH ROW EXECUTE FUNCTION check_seating_config_overlap();

-- 2. Add is_default_operator to user_roles for multi-operator default selection
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS is_default_operator BOOLEAN DEFAULT FALSE;

-- Set Horizon as default for existing user
UPDATE user_roles SET is_default_operator = TRUE
WHERE operator_id = '20169cc0-c914-4662-a300-1dbbe20d1416';
