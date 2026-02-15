-- Migration 012: Create airport sub-tables and expand airports columns
-- Creates: airport_runways, airport_terminals, airport_curfews, airport_frequencies, airport_weather_limits
-- Alters: airport_tat_rules (DOM/INT breakdown), airports (additional columns)

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Airport Runways
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS airport_runways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airport_id UUID REFERENCES airports(id) ON DELETE CASCADE,
  identifier VARCHAR(10) NOT NULL,
  length_m INTEGER,
  width_m INTEGER,
  surface VARCHAR(30),
  ils_category VARCHAR(20),
  lighting BOOLEAN DEFAULT TRUE,
  status VARCHAR(20) DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Airport Terminals
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS airport_terminals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airport_id UUID REFERENCES airports(id) ON DELETE CASCADE,
  code VARCHAR(10) NOT NULL,
  name VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Airport Curfews
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS airport_curfews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airport_id UUID REFERENCES airports(id) ON DELETE CASCADE,
  days VARCHAR(20) NOT NULL DEFAULT 'all',
  no_ops_from TIME NOT NULL,
  no_ops_until TIME NOT NULL,
  exception VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Airport Frequencies
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS airport_frequencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airport_id UUID REFERENCES airports(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL,
  frequency VARCHAR(20) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Airport Weather Limits
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS airport_weather_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airport_id UUID REFERENCES airports(id) ON DELETE CASCADE,
  limitation_type VARCHAR(30) NOT NULL,
  warning_value DECIMAL(10,2),
  alert_value DECIMAL(10,2),
  unit VARCHAR(10) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(airport_id, limitation_type)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. ALTER airport_tat_rules — add DOM/INT breakdown columns
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE airport_tat_rules ADD COLUMN IF NOT EXISTS tat_dom_dom_minutes INTEGER;
ALTER TABLE airport_tat_rules ADD COLUMN IF NOT EXISTS tat_dom_int_minutes INTEGER;
ALTER TABLE airport_tat_rules ADD COLUMN IF NOT EXISTS tat_int_dom_minutes INTEGER;
ALTER TABLE airport_tat_rules ADD COLUMN IF NOT EXISTS tat_int_int_minutes INTEGER;

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. ALTER airports — add missing columns
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE airports ADD COLUMN IF NOT EXISTS fuel_available BOOLEAN DEFAULT TRUE;
ALTER TABLE airports ADD COLUMN IF NOT EXISTS fuel_types JSONB;
ALTER TABLE airports ADD COLUMN IF NOT EXISTS airport_authority VARCHAR(100);
ALTER TABLE airports ADD COLUMN IF NOT EXISTS operating_hours_open TIME;
ALTER TABLE airports ADD COLUMN IF NOT EXISTS operating_hours_close TIME;
ALTER TABLE airports ADD COLUMN IF NOT EXISTS is_24_hour BOOLEAN DEFAULT TRUE;
ALTER TABLE airports ADD COLUMN IF NOT EXISTS ground_handling_agents JSONB;
ALTER TABLE airports ADD COLUMN IF NOT EXISTS self_handling_permitted BOOLEAN DEFAULT TRUE;
ALTER TABLE airports ADD COLUMN IF NOT EXISTS slot_coordinator_contact TEXT;
ALTER TABLE airports ADD COLUMN IF NOT EXISTS is_crew_base BOOLEAN DEFAULT FALSE;
ALTER TABLE airports ADD COLUMN IF NOT EXISTS crew_lounge_available BOOLEAN DEFAULT FALSE;
ALTER TABLE airports ADD COLUMN IF NOT EXISTS rest_facility_available BOOLEAN DEFAULT FALSE;
ALTER TABLE airports ADD COLUMN IF NOT EXISTS crew_positioning_reporting_minutes INTEGER;
ALTER TABLE airports ADD COLUMN IF NOT EXISTS is_etops_alternate BOOLEAN DEFAULT FALSE;
ALTER TABLE airports ADD COLUMN IF NOT EXISTS etops_diversion_minutes INTEGER;
ALTER TABLE airports ADD COLUMN IF NOT EXISTS special_notes TEXT;

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. Enable RLS on new tables (matching existing pattern)
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE airport_runways ENABLE ROW LEVEL SECURITY;
ALTER TABLE airport_terminals ENABLE ROW LEVEL SECURITY;
ALTER TABLE airport_curfews ENABLE ROW LEVEL SECURITY;
ALTER TABLE airport_frequencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE airport_weather_limits ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Allow authenticated read" ON airport_runways FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON airport_terminals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON airport_curfews FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON airport_frequencies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON airport_weather_limits FOR SELECT TO authenticated USING (true);

-- Allow service role full access
CREATE POLICY "Allow service role all" ON airport_runways FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role all" ON airport_terminals FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role all" ON airport_curfews FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role all" ON airport_frequencies FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role all" ON airport_weather_limits FOR ALL TO service_role USING (true) WITH CHECK (true);
