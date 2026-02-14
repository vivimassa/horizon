-- Create airports table
CREATE TABLE IF NOT EXISTS airports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  icao_code TEXT NOT NULL UNIQUE,
  iata_code TEXT,
  airport_name TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  timezone TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_airports_icao_code ON airports(icao_code);
CREATE INDEX IF NOT EXISTS idx_airports_iata_code ON airports(iata_code);
CREATE INDEX IF NOT EXISTS idx_airports_country ON airports(country);
CREATE INDEX IF NOT EXISTS idx_airports_city ON airports(city);

-- Enable Row Level Security
ALTER TABLE airports ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can read airports
CREATE POLICY "Authenticated users can read airports"
  ON airports
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy: Only admins can insert airports
CREATE POLICY "Admins can insert airports"
  ON airports
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM operators
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Policy: Only admins can update airports
CREATE POLICY "Admins can update airports"
  ON airports
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM operators
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Policy: Only admins can delete airports
CREATE POLICY "Admins can delete airports"
  ON airports
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM operators
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Trigger to automatically update updated_at
CREATE TRIGGER update_airports_updated_at
  BEFORE UPDATE ON airports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
