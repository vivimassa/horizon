-- Create operator_profile table (company-wide settings)
CREATE TABLE IF NOT EXISTS operator_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  icao_code TEXT UNIQUE,
  iata_code TEXT UNIQUE,
  country TEXT NOT NULL,
  regulatory_authority TEXT NOT NULL,
  timezone TEXT NOT NULL,
  enabled_modules TEXT[] NOT NULL DEFAULT ARRAY['network', 'operations', 'workforce', 'reports']::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default operator profile
INSERT INTO operator_profile (company_name, country, regulatory_authority, timezone, enabled_modules)
VALUES (
  'HORIZON Operations',
  'United States',
  'FAA',
  'America/New_York',
  ARRAY['network', 'operations', 'workforce', 'reports']::TEXT[]
)
ON CONFLICT DO NOTHING;

-- Update operators table to support more roles
ALTER TABLE operators DROP CONSTRAINT IF EXISTS operators_role_check;
ALTER TABLE operators ADD CONSTRAINT operators_role_check
  CHECK (role IN ('super_admin', 'admin', 'ops_controller', 'crew_controller', 'roster_planner', 'crew_member', 'viewer'));

-- Add status field to operators
ALTER TABLE operators ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'inactive', 'suspended'));

-- Create module definitions table
CREATE TABLE IF NOT EXISTS module_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key TEXT NOT NULL UNIQUE,
  module_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('core', 'addon')),
  depends_on TEXT[], -- Array of module_keys this module depends on
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed module definitions
INSERT INTO module_definitions (module_key, module_name, description, category, depends_on) VALUES
('home', 'Home', 'Dashboard and overview', 'core', ARRAY[]::TEXT[]),
('network', 'Network', 'Network infrastructure and route management', 'core', ARRAY[]::TEXT[]),
('operations', 'Operations', 'Flight operations and scheduling', 'core', ARRAY['network']::TEXT[]),
('workforce', 'Workforce', 'Crew management and rostering', 'core', ARRAY['operations']::TEXT[]),
('reports', 'Reports', 'Analytics and reporting', 'core', ARRAY[]::TEXT[]),
('admin', 'Administration', 'System administration', 'core', ARRAY[]::TEXT[])
ON CONFLICT (module_key) DO NOTHING;

-- Enable Row Level Security
ALTER TABLE operator_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_definitions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for operator_profile
CREATE POLICY "Authenticated users can read operator_profile"
  ON operator_profile FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can update operator_profile"
  ON operator_profile FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM operators
      WHERE user_id = auth.uid() AND role IN ('super_admin', 'admin')
    )
  );

-- RLS Policies for module_definitions
CREATE POLICY "Authenticated users can read module_definitions"
  ON module_definitions FOR SELECT USING (auth.role() = 'authenticated');

-- Trigger for operator_profile
CREATE TRIGGER update_operator_profile_updated_at
  BEFORE UPDATE ON operator_profile
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create index on operator status
CREATE INDEX IF NOT EXISTS idx_operators_status ON operators(status);
CREATE INDEX IF NOT EXISTS idx_operators_role ON operators(role);
