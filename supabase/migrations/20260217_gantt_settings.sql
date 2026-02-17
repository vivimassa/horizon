-- Gantt chart settings per operator (persisted)
CREATE TABLE IF NOT EXISTS gantt_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
  settings JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(operator_id)
);

ALTER TABLE gantt_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "operator_gantt_settings" ON gantt_settings FOR ALL
  USING (operator_id IN (
    SELECT operator_id FROM user_profiles WHERE user_id = auth.uid()
  ));
