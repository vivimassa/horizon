-- Add aircraft_reg column to scheduled_flights
-- Allows manual tail assignment from the Gantt chart

ALTER TABLE scheduled_flights
  ADD COLUMN IF NOT EXISTS aircraft_reg TEXT DEFAULT NULL;

-- Index for quick lookups by registration
CREATE INDEX IF NOT EXISTS idx_scheduled_flights_aircraft_reg
  ON scheduled_flights (aircraft_reg)
  WHERE aircraft_reg IS NOT NULL;

COMMENT ON COLUMN scheduled_flights.aircraft_reg IS 'Manual tail assignment — aircraft registration code (e.g. VN-A501). NULL = auto-assigned by virtual engine.';
