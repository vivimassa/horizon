-- ============================================================
-- Migration 005: SSIM Imports + Message Log tables
-- For Schedule Message Manager (1.1.3)
-- Run manually in Supabase Dashboard SQL Editor
-- ============================================================

-- SSIM import/export log
CREATE TABLE ssim_imports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  operator_id uuid NOT NULL REFERENCES operators(id),
  season_id uuid NOT NULL REFERENCES schedule_seasons(id),
  filename text,
  direction text NOT NULL DEFAULT 'import',
  total_records integer NOT NULL DEFAULT 0,
  new_records integer NOT NULL DEFAULT 0,
  updated_records integer NOT NULL DEFAULT 0,
  unchanged_records integer NOT NULL DEFAULT 0,
  error_records integer NOT NULL DEFAULT 0,
  errors jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

-- ASM/SSM message log
CREATE TABLE message_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  operator_id uuid NOT NULL REFERENCES operators(id),
  message_type text NOT NULL,
  action_code text NOT NULL,
  direction text NOT NULL,
  flight_number text,
  flight_date text,
  status text NOT NULL DEFAULT 'pending',
  summary text,
  raw_message text,
  changes jsonb,
  reject_reason text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_ssim_imports_operator ON ssim_imports(operator_id);
CREATE INDEX idx_message_log_operator ON message_log(operator_id);
CREATE INDEX idx_message_log_status ON message_log(status);
CREATE INDEX idx_message_log_flight ON message_log(flight_number);

ALTER TABLE ssim_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read" ON ssim_imports FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write" ON ssim_imports FOR ALL TO authenticated USING (true);
CREATE POLICY "auth_read" ON message_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write" ON message_log FOR ALL TO authenticated USING (true);
