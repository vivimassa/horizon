-- ============================================================
-- Migration 003: Flight Numbers table for Schedule Builder
-- Run manually in Supabase Dashboard SQL Editor
-- ============================================================

CREATE TABLE flight_numbers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  operator_id uuid NOT NULL REFERENCES operators(id),
  season_id uuid NOT NULL REFERENCES schedule_seasons(id),
  flight_number text NOT NULL,
  departure_iata text NOT NULL,
  arrival_iata text NOT NULL,
  std text NOT NULL DEFAULT '',
  sta text NOT NULL DEFAULT '',
  block_minutes integer NOT NULL DEFAULT 0,
  days_of_week text NOT NULL DEFAULT '1234567',
  aircraft_type_id uuid REFERENCES aircraft_types(id),
  service_type text DEFAULT 'J',
  effective_from date,
  effective_until date,
  arrival_day_offset integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(operator_id, season_id, flight_number)
);

ALTER TABLE flight_numbers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read" ON flight_numbers FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write" ON flight_numbers FOR ALL TO authenticated USING (true);
