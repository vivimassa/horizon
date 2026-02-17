-- Draft → Ready → Published workflow
-- Adds 'ready' + 'cancelled' statuses, scenario linking, indexes

-- aircraft_routes: allow draft/ready/published
ALTER TABLE aircraft_routes DROP CONSTRAINT IF EXISTS aircraft_routes_status_check;
ALTER TABLE aircraft_routes ADD CONSTRAINT aircraft_routes_status_check
  CHECK (status IN ('draft', 'ready', 'published'));

-- scheduled_flights: allow draft/ready/published/cancelled
ALTER TABLE scheduled_flights DROP CONSTRAINT IF EXISTS scheduled_flights_status_check;
ALTER TABLE scheduled_flights ADD CONSTRAINT scheduled_flights_status_check
  CHECK (status IN ('draft', 'ready', 'published', 'cancelled'));

-- Add scenario_id + replaces_flight_id to scheduled_flights
ALTER TABLE scheduled_flights
  ADD COLUMN IF NOT EXISTS scenario_id UUID REFERENCES schedule_scenarios(id),
  ADD COLUMN IF NOT EXISTS replaces_flight_id UUID REFERENCES scheduled_flights(id);

-- Indexes for fast filtering
CREATE INDEX IF NOT EXISTS idx_flights_status ON scheduled_flights(status);
CREATE INDEX IF NOT EXISTS idx_flights_scenario ON scheduled_flights(scenario_id);
