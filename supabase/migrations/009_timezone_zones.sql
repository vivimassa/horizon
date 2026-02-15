-- 009: Extend countries table + create timezone_zones table

-- Add new columns to countries (idempotent)
ALTER TABLE countries ADD COLUMN IF NOT EXISTS iso_numeric TEXT;
ALTER TABLE countries ADD COLUMN IF NOT EXISTS sub_region TEXT;
ALTER TABLE countries ADD COLUMN IF NOT EXISTS currency_name TEXT;
ALTER TABLE countries ADD COLUMN IF NOT EXISTS currency_symbol TEXT;
ALTER TABLE countries ADD COLUMN IF NOT EXISTS phone_code TEXT;

-- Create timezone_zones table
CREATE TABLE IF NOT EXISTS timezone_zones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  country_id UUID NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  zone_code INTEGER NOT NULL,
  zone_name TEXT NOT NULL,
  iana_timezone TEXT NOT NULL,
  utc_offset TEXT NOT NULL,
  has_dst BOOLEAN DEFAULT FALSE,
  dst_start TEXT,
  dst_end TEXT,
  dst_offset TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(country_id, zone_code)
);

-- Disable RLS on timezone_zones (matching project pattern from 007)
ALTER TABLE timezone_zones DISABLE ROW LEVEL SECURITY;
