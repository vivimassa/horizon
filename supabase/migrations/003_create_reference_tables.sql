-- Create countries table
CREATE TABLE IF NOT EXISTS countries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iso_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  region TEXT NOT NULL,
  currency TEXT NOT NULL,
  icao_prefix TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_countries_iso_code ON countries(iso_code);
CREATE INDEX IF NOT EXISTS idx_countries_region ON countries(region);

-- Create aircraft_types table
CREATE TABLE IF NOT EXISTS aircraft_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  icao_type TEXT NOT NULL UNIQUE,
  iata_type TEXT,
  name TEXT NOT NULL,
  family TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('narrow-body', 'wide-body', 'regional', 'turboprop', 'freighter', 'business')),
  pax_capacity INTEGER NOT NULL,
  cockpit_crew INTEGER NOT NULL,
  cabin_crew INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aircraft_types_icao_type ON aircraft_types(icao_type);
CREATE INDEX IF NOT EXISTS idx_aircraft_types_family ON aircraft_types(family);
CREATE INDEX IF NOT EXISTS idx_aircraft_types_category ON aircraft_types(category);

-- Create airlines table
CREATE TABLE IF NOT EXISTS airlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  icao_code TEXT NOT NULL UNIQUE,
  iata_code TEXT,
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  alliance TEXT CHECK (alliance IN ('Star Alliance', 'Oneworld', 'SkyTeam', 'None')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_airlines_icao_code ON airlines(icao_code);
CREATE INDEX IF NOT EXISTS idx_airlines_iata_code ON airlines(iata_code);
CREATE INDEX IF NOT EXISTS idx_airlines_country ON airlines(country);

-- Create city_pairs table
CREATE TABLE IF NOT EXISTS city_pairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  departure_airport TEXT NOT NULL,
  arrival_airport TEXT NOT NULL,
  block_time INTEGER NOT NULL,
  distance INTEGER NOT NULL,
  route_type TEXT NOT NULL CHECK (route_type IN ('domestic', 'regional', 'international', 'long-haul', 'ultra-long-haul')),
  etops_required BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(departure_airport, arrival_airport)
);

CREATE INDEX IF NOT EXISTS idx_city_pairs_departure ON city_pairs(departure_airport);
CREATE INDEX IF NOT EXISTS idx_city_pairs_arrival ON city_pairs(arrival_airport);
CREATE INDEX IF NOT EXISTS idx_city_pairs_route_type ON city_pairs(route_type);

-- Enable Row Level Security on all tables
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE aircraft_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE airlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE city_pairs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for countries
CREATE POLICY "Authenticated users can read countries"
  ON countries FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can insert countries"
  ON countries FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM operators WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update countries"
  ON countries FOR UPDATE
  USING (EXISTS (SELECT 1 FROM operators WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can delete countries"
  ON countries FOR DELETE
  USING (EXISTS (SELECT 1 FROM operators WHERE user_id = auth.uid() AND role = 'admin'));

-- RLS Policies for aircraft_types
CREATE POLICY "Authenticated users can read aircraft_types"
  ON aircraft_types FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can insert aircraft_types"
  ON aircraft_types FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM operators WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update aircraft_types"
  ON aircraft_types FOR UPDATE
  USING (EXISTS (SELECT 1 FROM operators WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can delete aircraft_types"
  ON aircraft_types FOR DELETE
  USING (EXISTS (SELECT 1 FROM operators WHERE user_id = auth.uid() AND role = 'admin'));

-- RLS Policies for airlines
CREATE POLICY "Authenticated users can read airlines"
  ON airlines FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can insert airlines"
  ON airlines FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM operators WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update airlines"
  ON airlines FOR UPDATE
  USING (EXISTS (SELECT 1 FROM operators WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can delete airlines"
  ON airlines FOR DELETE
  USING (EXISTS (SELECT 1 FROM operators WHERE user_id = auth.uid() AND role = 'admin'));

-- RLS Policies for city_pairs
CREATE POLICY "Authenticated users can read city_pairs"
  ON city_pairs FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can insert city_pairs"
  ON city_pairs FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM operators WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update city_pairs"
  ON city_pairs FOR UPDATE
  USING (EXISTS (SELECT 1 FROM operators WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can delete city_pairs"
  ON city_pairs FOR DELETE
  USING (EXISTS (SELECT 1 FROM operators WHERE user_id = auth.uid() AND role = 'admin'));

-- Triggers to automatically update updated_at
CREATE TRIGGER update_countries_updated_at
  BEFORE UPDATE ON countries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_aircraft_types_updated_at
  BEFORE UPDATE ON aircraft_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_airlines_updated_at
  BEFORE UPDATE ON airlines
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_city_pairs_updated_at
  BEFORE UPDATE ON city_pairs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
