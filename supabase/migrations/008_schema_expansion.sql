-- Migration 008: Schema expansion for aviation operations
-- Adds timezone_zones, airport operations columns, city_pair_block_hours,
-- aircraft_type expansions, seating configs, cabin_classes, crew_complement_rules,
-- operator_uom_settings, and airport_diversion_alternates

-- ============================================================
-- 1. TIMEZONE ZONES TABLE (new)
-- ============================================================
CREATE TABLE IF NOT EXISTS timezone_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id UUID REFERENCES countries(id) ON DELETE CASCADE,
  zone_code VARCHAR(5) NOT NULL,
  zone_name VARCHAR(100) NOT NULL,
  iana_timezone VARCHAR(50) NOT NULL,
  utc_offset VARCHAR(10) NOT NULL,
  dst_observed BOOLEAN DEFAULT FALSE,
  dst_start_rule TEXT,
  dst_end_rule TEXT,
  dst_offset VARCHAR(10),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(country_id, zone_code)
);

-- ============================================================
-- 2. ALTER airports — add timezone_zone_id
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'airports' AND column_name = 'timezone_zone_id'
  ) THEN
    ALTER TABLE airports ADD COLUMN timezone_zone_id UUID REFERENCES timezone_zones(id);
  END IF;
END $$;

-- ============================================================
-- 3. ALTER airports — add missing operations columns
-- ============================================================
DO $$
BEGIN
  -- latitude already exists (checked), longitude already exists, elevation_ft already exists

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'airports' AND column_name = 'longest_runway_length_m'
  ) THEN
    ALTER TABLE airports ADD COLUMN longest_runway_length_m INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'airports' AND column_name = 'longest_runway_width_m'
  ) THEN
    ALTER TABLE airports ADD COLUMN longest_runway_width_m INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'airports' AND column_name = 'runway_identifiers'
  ) THEN
    ALTER TABLE airports ADD COLUMN runway_identifiers TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'airports' AND column_name = 'ils_category'
  ) THEN
    ALTER TABLE airports ADD COLUMN ils_category VARCHAR(20);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'airports' AND column_name = 'fire_category'
  ) THEN
    ALTER TABLE airports ADD COLUMN fire_category INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'airports' AND column_name = 'slot_classification'
  ) THEN
    ALTER TABLE airports ADD COLUMN slot_classification VARCHAR(30);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'airports' AND column_name = 'slot_departure_tolerance_early'
  ) THEN
    ALTER TABLE airports ADD COLUMN slot_departure_tolerance_early INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'airports' AND column_name = 'slot_departure_tolerance_late'
  ) THEN
    ALTER TABLE airports ADD COLUMN slot_departure_tolerance_late INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'airports' AND column_name = 'slot_arrival_tolerance_early'
  ) THEN
    ALTER TABLE airports ADD COLUMN slot_arrival_tolerance_early INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'airports' AND column_name = 'slot_arrival_tolerance_late'
  ) THEN
    ALTER TABLE airports ADD COLUMN slot_arrival_tolerance_late INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'airports' AND column_name = 'terminals'
  ) THEN
    ALTER TABLE airports ADD COLUMN terminals JSONB;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'airports' AND column_name = 'curfew_times'
  ) THEN
    ALTER TABLE airports ADD COLUMN curfew_times JSONB;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'airports' AND column_name = 'crew_reporting_time_minutes'
  ) THEN
    ALTER TABLE airports ADD COLUMN crew_reporting_time_minutes INTEGER DEFAULT 60;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'airports' AND column_name = 'crew_debrief_time_minutes'
  ) THEN
    ALTER TABLE airports ADD COLUMN crew_debrief_time_minutes INTEGER DEFAULT 15;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'airports' AND column_name = 'is_home_base'
  ) THEN
    ALTER TABLE airports ADD COLUMN is_home_base BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'airports' AND column_name = 'cannot_be_used_for_diversion'
  ) THEN
    ALTER TABLE airports ADD COLUMN cannot_be_used_for_diversion BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'airports' AND column_name = 'weather_limitations'
  ) THEN
    ALTER TABLE airports ADD COLUMN weather_limitations JSONB;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'airports' AND column_name = 'notes'
  ) THEN
    ALTER TABLE airports ADD COLUMN notes TEXT;
  END IF;
END $$;

-- ============================================================
-- 4. AIRPORT DIVERSION ALTERNATES TABLE (new)
-- ============================================================
CREATE TABLE IF NOT EXISTS airport_diversion_alternates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airport_id UUID REFERENCES airports(id) ON DELETE CASCADE,
  alternate_airport_id UUID REFERENCES airports(id) ON DELETE CASCADE,
  priority INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(airport_id, alternate_airport_id)
);

-- ============================================================
-- 5. AIRPORT TAT RULES — ensure exists (already exists, skip create)
-- ============================================================
CREATE TABLE IF NOT EXISTS airport_tat_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airport_id UUID REFERENCES airports(id) ON DELETE CASCADE,
  aircraft_type_id UUID REFERENCES aircraft_types(id) ON DELETE CASCADE,
  tat_minutes INTEGER NOT NULL,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(airport_id, aircraft_type_id)
);

-- ============================================================
-- 6. ALTER city_pairs — add missing columns
-- ============================================================
DO $$
BEGIN
  -- etops_required already exists, notes already exists

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'city_pairs' AND column_name = 'etops_diversion_time_minutes'
  ) THEN
    ALTER TABLE city_pairs ADD COLUMN etops_diversion_time_minutes INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'city_pairs' AND column_name = 'great_circle_distance_nm'
  ) THEN
    ALTER TABLE city_pairs ADD COLUMN great_circle_distance_nm DECIMAL(8,1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'city_pairs' AND column_name = 'cosmic_radiation_usv'
  ) THEN
    ALTER TABLE city_pairs ADD COLUMN cosmic_radiation_usv DECIMAL(6,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'city_pairs' AND column_name = 'avg_departure_delay_minutes'
  ) THEN
    ALTER TABLE city_pairs ADD COLUMN avg_departure_delay_minutes INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'city_pairs' AND column_name = 'avg_arrival_delay_minutes'
  ) THEN
    ALTER TABLE city_pairs ADD COLUMN avg_arrival_delay_minutes INTEGER;
  END IF;
END $$;

-- ============================================================
-- 7. CITY PAIR BLOCK HOURS TABLE (new)
-- ============================================================
CREATE TABLE IF NOT EXISTS city_pair_block_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_pair_id UUID REFERENCES city_pairs(id) ON DELETE CASCADE,
  aircraft_type_id UUID REFERENCES aircraft_types(id) ON DELETE CASCADE,
  season_type VARCHAR(10) NOT NULL CHECK (season_type IN ('summer', 'winter', 'annual')),
  month_applicable INTEGER CHECK (month_applicable BETWEEN 1 AND 12),
  direction1_block_minutes INTEGER NOT NULL,
  direction2_block_minutes INTEGER NOT NULL,
  direction1_flight_minutes INTEGER,
  direction2_flight_minutes INTEGER,
  direction1_fuel_kg DECIMAL(10,1),
  direction2_fuel_kg DECIMAL(10,1),
  direction1_avg_payload_kg DECIMAL(10,1),
  direction2_avg_payload_kg DECIMAL(10,1),
  cruise_altitude_ft INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(city_pair_id, aircraft_type_id, season_type, month_applicable)
);

-- ============================================================
-- 8. ALTER aircraft_types — add missing columns
-- ============================================================
DO $$
BEGIN
  -- Already exist: mtow_kg, default_tat_minutes, default_cabin_config

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft_types' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE aircraft_types ADD COLUMN image_url TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft_types' AND column_name = 'iata_type_code'
  ) THEN
    ALTER TABLE aircraft_types ADD COLUMN iata_type_code VARCHAR(5);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft_types' AND column_name = 'manufacturer'
  ) THEN
    ALTER TABLE aircraft_types ADD COLUMN manufacturer VARCHAR(50);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft_types' AND column_name = 'mlw_kg'
  ) THEN
    ALTER TABLE aircraft_types ADD COLUMN mlw_kg DECIMAL(10,1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft_types' AND column_name = 'mzfw_kg'
  ) THEN
    ALTER TABLE aircraft_types ADD COLUMN mzfw_kg DECIMAL(10,1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft_types' AND column_name = 'oew_kg'
  ) THEN
    ALTER TABLE aircraft_types ADD COLUMN oew_kg DECIMAL(10,1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft_types' AND column_name = 'max_fuel_capacity_kg'
  ) THEN
    ALTER TABLE aircraft_types ADD COLUMN max_fuel_capacity_kg DECIMAL(10,1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft_types' AND column_name = 'fuel_unit'
  ) THEN
    ALTER TABLE aircraft_types ADD COLUMN fuel_unit VARCHAR(5) DEFAULT 'kg';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft_types' AND column_name = 'fuel_burn_rate_kg_per_hour'
  ) THEN
    ALTER TABLE aircraft_types ADD COLUMN fuel_burn_rate_kg_per_hour DECIMAL(8,1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft_types' AND column_name = 'max_range_nm'
  ) THEN
    ALTER TABLE aircraft_types ADD COLUMN max_range_nm INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft_types' AND column_name = 'cruising_speed_kts'
  ) THEN
    ALTER TABLE aircraft_types ADD COLUMN cruising_speed_kts INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft_types' AND column_name = 'cruising_mach'
  ) THEN
    ALTER TABLE aircraft_types ADD COLUMN cruising_mach DECIMAL(3,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft_types' AND column_name = 'min_runway_length_m'
  ) THEN
    ALTER TABLE aircraft_types ADD COLUMN min_runway_length_m INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft_types' AND column_name = 'min_runway_width_m'
  ) THEN
    ALTER TABLE aircraft_types ADD COLUMN min_runway_width_m INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft_types' AND column_name = 'fire_category'
  ) THEN
    ALTER TABLE aircraft_types ADD COLUMN fire_category INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft_types' AND column_name = 'wake_turbulence_category'
  ) THEN
    ALTER TABLE aircraft_types ADD COLUMN wake_turbulence_category VARCHAR(5);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft_types' AND column_name = 'etops_capable'
  ) THEN
    ALTER TABLE aircraft_types ADD COLUMN etops_capable BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft_types' AND column_name = 'etops_max_minutes'
  ) THEN
    ALTER TABLE aircraft_types ADD COLUMN etops_max_minutes INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft_types' AND column_name = 'noise_category'
  ) THEN
    ALTER TABLE aircraft_types ADD COLUMN noise_category VARCHAR(20);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft_types' AND column_name = 'emissions_class'
  ) THEN
    ALTER TABLE aircraft_types ADD COLUMN emissions_class VARCHAR(20);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft_types' AND column_name = 'tat_dom_dom_minutes'
  ) THEN
    ALTER TABLE aircraft_types ADD COLUMN tat_dom_dom_minutes INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft_types' AND column_name = 'tat_dom_int_minutes'
  ) THEN
    ALTER TABLE aircraft_types ADD COLUMN tat_dom_int_minutes INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft_types' AND column_name = 'tat_int_dom_minutes'
  ) THEN
    ALTER TABLE aircraft_types ADD COLUMN tat_int_dom_minutes INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft_types' AND column_name = 'tat_int_int_minutes'
  ) THEN
    ALTER TABLE aircraft_types ADD COLUMN tat_int_int_minutes INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft_types' AND column_name = 'max_cargo_weight_kg'
  ) THEN
    ALTER TABLE aircraft_types ADD COLUMN max_cargo_weight_kg DECIMAL(10,1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft_types' AND column_name = 'cargo_positions'
  ) THEN
    ALTER TABLE aircraft_types ADD COLUMN cargo_positions INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft_types' AND column_name = 'uld_types_accepted'
  ) THEN
    ALTER TABLE aircraft_types ADD COLUMN uld_types_accepted JSONB;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft_types' AND column_name = 'bulk_hold_capacity_kg'
  ) THEN
    ALTER TABLE aircraft_types ADD COLUMN bulk_hold_capacity_kg DECIMAL(10,1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft_types' AND column_name = 'cockpit_rest_facility_class'
  ) THEN
    ALTER TABLE aircraft_types ADD COLUMN cockpit_rest_facility_class VARCHAR(10);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft_types' AND column_name = 'cabin_rest_facility_class'
  ) THEN
    ALTER TABLE aircraft_types ADD COLUMN cabin_rest_facility_class VARCHAR(10);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft_types' AND column_name = 'cockpit_rest_positions'
  ) THEN
    ALTER TABLE aircraft_types ADD COLUMN cockpit_rest_positions INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft_types' AND column_name = 'cabin_rest_positions'
  ) THEN
    ALTER TABLE aircraft_types ADD COLUMN cabin_rest_positions INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft_types' AND column_name = 'weather_limitations'
  ) THEN
    ALTER TABLE aircraft_types ADD COLUMN weather_limitations JSONB;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft_types' AND column_name = 'ils_category_required'
  ) THEN
    ALTER TABLE aircraft_types ADD COLUMN ils_category_required VARCHAR(20);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft_types' AND column_name = 'autoland_capable'
  ) THEN
    ALTER TABLE aircraft_types ADD COLUMN autoland_capable BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft_types' AND column_name = 'notes'
  ) THEN
    ALTER TABLE aircraft_types ADD COLUMN notes TEXT;
  END IF;
END $$;

-- ============================================================
-- 9. AIRCRAFT TYPE SEATING CONFIGS TABLE (new)
-- ============================================================
CREATE TABLE IF NOT EXISTS aircraft_type_seating_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aircraft_type_id UUID REFERENCES aircraft_types(id) ON DELETE CASCADE,
  config_name VARCHAR(50) NOT NULL,
  cabin_config JSONB NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 10. ALTER aircraft — add missing columns
-- ============================================================
DO $$
BEGIN
  -- aircraft table already exists with: id, operator_id, aircraft_type_id, registration,
  -- serial_number, name, home_base_id, status, delivery_date, lease_expiry_date,
  -- next_maintenance_due, current_airport_id, seating_config, is_active, created_at, updated_at

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft' AND column_name = 'date_of_manufacture'
  ) THEN
    ALTER TABLE aircraft ADD COLUMN date_of_manufacture DATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft' AND column_name = 'seating_config_override'
  ) THEN
    ALTER TABLE aircraft ADD COLUMN seating_config_override JSONB;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft' AND column_name = 'cargo_config_override'
  ) THEN
    ALTER TABLE aircraft ADD COLUMN cargo_config_override JSONB;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft' AND column_name = 'mtow_override_kg'
  ) THEN
    ALTER TABLE aircraft ADD COLUMN mtow_override_kg DECIMAL(10,1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft' AND column_name = 'range_override_nm'
  ) THEN
    ALTER TABLE aircraft ADD COLUMN range_override_nm INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft' AND column_name = 'cockpit_rest_facility_override'
  ) THEN
    ALTER TABLE aircraft ADD COLUMN cockpit_rest_facility_override VARCHAR(10);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft' AND column_name = 'cabin_rest_facility_override'
  ) THEN
    ALTER TABLE aircraft ADD COLUMN cabin_rest_facility_override VARCHAR(10);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft' AND column_name = 'cockpit_rest_positions_override'
  ) THEN
    ALTER TABLE aircraft ADD COLUMN cockpit_rest_positions_override INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft' AND column_name = 'cabin_rest_positions_override'
  ) THEN
    ALTER TABLE aircraft ADD COLUMN cabin_rest_positions_override INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft' AND column_name = 'current_location_airport_id'
  ) THEN
    ALTER TABLE aircraft ADD COLUMN current_location_airport_id UUID REFERENCES airports(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft' AND column_name = 'flight_hours_total'
  ) THEN
    ALTER TABLE aircraft ADD COLUMN flight_hours_total DECIMAL(10,1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft' AND column_name = 'cycles_total'
  ) THEN
    ALTER TABLE aircraft ADD COLUMN cycles_total INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE aircraft ADD COLUMN image_url TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft' AND column_name = 'notes'
  ) THEN
    ALTER TABLE aircraft ADD COLUMN notes TEXT;
  END IF;
END $$;

-- ============================================================
-- 11. FLIGHT SERVICE TYPES — ensure exists (already exists, skip)
-- ============================================================
CREATE TABLE IF NOT EXISTS flight_service_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID REFERENCES operators(id),
  code VARCHAR(5) NOT NULL,
  name VARCHAR(50) NOT NULL,
  description TEXT,
  color VARCHAR(7),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(operator_id, code)
);

-- ============================================================
-- 12. DELAY CODES — ensure exists (already exists, skip)
-- ============================================================
CREATE TABLE IF NOT EXISTS delay_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID REFERENCES operators(id),
  code VARCHAR(10) NOT NULL,
  category VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(operator_id, code)
);

-- ============================================================
-- 13. CABIN CLASSES TABLE (new)
-- ============================================================
CREATE TABLE IF NOT EXISTS cabin_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID REFERENCES operators(id),
  code VARCHAR(5) NOT NULL,
  name VARCHAR(30) NOT NULL,
  color VARCHAR(7),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(operator_id, code)
);

-- ============================================================
-- 14. CREW COMPLEMENT RULES TABLE (new)
-- ============================================================
CREATE TABLE IF NOT EXISTS crew_complement_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID REFERENCES operators(id),
  aircraft_type_id UUID REFERENCES aircraft_types(id),
  flight_service_type_id UUID REFERENCES flight_service_types(id),
  min_cockpit_crew INTEGER NOT NULL DEFAULT 2,
  min_cabin_crew INTEGER NOT NULL DEFAULT 4,
  additional_cabin_per_x_pax INTEGER,
  additional_cabin_pax_threshold INTEGER,
  augmented_cockpit_flight_hours_threshold DECIMAL(4,1),
  augmented_cockpit_crew_count INTEGER,
  augmented_cockpit_ultra_long_hours DECIMAL(4,1),
  augmented_cockpit_ultra_long_count INTEGER,
  augmented_cabin_duty_hours_threshold DECIMAL(4,1),
  augmented_cabin_additional_count INTEGER,
  regulatory_reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(operator_id, aircraft_type_id, flight_service_type_id)
);

-- ============================================================
-- 15. OPERATOR UOM SETTINGS TABLE (new)
-- ============================================================
CREATE TABLE IF NOT EXISTS operator_uom_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID REFERENCES operators(id) UNIQUE,
  fuel_unit VARCHAR(5) DEFAULT 'kg' CHECK (fuel_unit IN ('kg','lbs')),
  distance_unit VARCHAR(5) DEFAULT 'nm' CHECK (distance_unit IN ('nm','km')),
  weight_unit VARCHAR(5) DEFAULT 'kg' CHECK (weight_unit IN ('kg','lbs')),
  altitude_unit VARCHAR(5) DEFAULT 'ft' CHECK (altitude_unit IN ('ft','m')),
  speed_unit VARCHAR(10) DEFAULT 'kts' CHECK (speed_unit IN ('kts','kmh','mach')),
  temperature_unit VARCHAR(5) DEFAULT 'C' CHECK (temperature_unit IN ('C','F')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DONE — Verify by listing all tables
-- ============================================================
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;
