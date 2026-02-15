-- ============================================================
-- Migration 004: Flights table for published/instantiated flights
-- Bridges Network (planning) → Operations (execution)
-- Run manually in Supabase Dashboard SQL Editor
-- ============================================================

CREATE TABLE flights (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  operator_id uuid NOT NULL REFERENCES operators(id),
  flight_number_id uuid REFERENCES flight_numbers(id) ON DELETE SET NULL,
  flight_number text NOT NULL,
  flight_date date NOT NULL,
  departure_iata text NOT NULL,
  arrival_iata text NOT NULL,
  std_utc timestamptz NOT NULL,
  sta_utc timestamptz NOT NULL,
  std_local text NOT NULL DEFAULT '',
  sta_local text NOT NULL DEFAULT '',
  block_minutes integer NOT NULL DEFAULT 0,
  aircraft_type_id uuid REFERENCES aircraft_types(id),
  aircraft_id uuid REFERENCES aircraft(id),
  service_type text NOT NULL DEFAULT 'J',
  status text NOT NULL DEFAULT 'scheduled',
  arrival_day_offset integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(operator_id, flight_number, flight_date)
);

-- Indexes for common queries
CREATE INDEX idx_flights_date ON flights(flight_date);
CREATE INDEX idx_flights_operator_date ON flights(operator_id, flight_date);
CREATE INDEX idx_flights_status ON flights(status);
CREATE INDEX idx_flights_flight_number ON flights(flight_number);

ALTER TABLE flights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read" ON flights FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write" ON flights FOR ALL TO authenticated USING (true);
