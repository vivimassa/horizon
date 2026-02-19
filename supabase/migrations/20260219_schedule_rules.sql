-- Schedule Rules: preferences & restrictions for aircraft tail assignment
-- Module 4.3.3

CREATE TABLE IF NOT EXISTS schedule_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID NOT NULL REFERENCES operators(id) ON DELETE CASCADE,

  -- Rule name (auto-generated or user-provided)
  name TEXT,

  -- WHO: Aircraft scope
  scope_type TEXT NOT NULL DEFAULT 'type' CHECK (scope_type IN (
    'all', 'type', 'family', 'registration'
  )),
  scope_values TEXT[] NOT NULL DEFAULT '{}',

  -- ACTION: What the rule does
  action TEXT NOT NULL DEFAULT 'must_not_fly' CHECK (action IN (
    'must_fly',
    'should_fly',
    'must_not_fly',
    'should_avoid',
    'can_only_fly'
  )),

  -- CRITERIA: Which flights the rule applies to
  criteria_type TEXT NOT NULL DEFAULT 'airports' CHECK (criteria_type IN (
    'airports',
    'routes',
    'international',
    'domestic',
    'service_type',
    'departure_time',
    'block_time',
    'overnight',
    'day_of_week'
  )),
  criteria_values JSONB NOT NULL DEFAULT '{}',

  -- ENFORCEMENT
  enforcement TEXT NOT NULL DEFAULT 'hard' CHECK (enforcement IN ('hard', 'soft')),

  -- VALIDITY PERIOD
  valid_from DATE,
  valid_to DATE,

  -- STATUS
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- PRIORITY (lower = higher priority)
  priority INTEGER NOT NULL DEFAULT 100,

  -- NOTES
  notes TEXT,

  -- META
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for operator queries
CREATE INDEX IF NOT EXISTS idx_schedule_rules_operator
  ON schedule_rules(operator_id);

-- Index for active rules lookup
CREATE INDEX IF NOT EXISTS idx_schedule_rules_active
  ON schedule_rules(operator_id, is_active) WHERE is_active = true;

-- RLS
ALTER TABLE schedule_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their operator rules"
  ON schedule_rules FOR SELECT
  USING (operator_id = public.get_user_operator_id());

CREATE POLICY "Users can insert their operator rules"
  ON schedule_rules FOR INSERT
  WITH CHECK (operator_id = public.get_user_operator_id());

CREATE POLICY "Users can update their operator rules"
  ON schedule_rules FOR UPDATE
  USING (operator_id = public.get_user_operator_id());

CREATE POLICY "Users can delete their operator rules"
  ON schedule_rules FOR DELETE
  USING (operator_id = public.get_user_operator_id());
