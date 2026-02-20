-- ═══════════════════════════════════════════════════════════
-- AIRCRAFT PERFORMANCE FACTORS — Period-based PF tracking
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS aircraft_performance_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID NOT NULL REFERENCES operators(id),
  aircraft_id UUID NOT NULL REFERENCES aircraft(id) ON DELETE CASCADE,
  period_name TEXT NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  performance_factor NUMERIC NOT NULL DEFAULT 0,
  variant TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Index for quick lookup of current PF for an aircraft
CREATE INDEX IF NOT EXISTS idx_apf_aircraft_current
  ON aircraft_performance_factors(aircraft_id, effective_from DESC);

-- Index for period queries
CREATE INDEX IF NOT EXISTS idx_apf_period
  ON aircraft_performance_factors(operator_id, period_name);

-- Ensure performance_factor column exists on aircraft (already added, but safe guard)
ALTER TABLE aircraft ADD COLUMN IF NOT EXISTS performance_factor NUMERIC DEFAULT 0;
ALTER TABLE aircraft ADD COLUMN IF NOT EXISTS variant TEXT;
