-- 011: Simplify timezone_zones + expand countries for full seed
-- Drops DST rule columns, adds missing country columns for restcountries.com seed

-- ─── Countries: add missing columns ──────────────────────────
ALTER TABLE countries ADD COLUMN IF NOT EXISTS currency_name TEXT;
ALTER TABLE countries ADD COLUMN IF NOT EXISTS currency_symbol TEXT;
ALTER TABLE countries ADD COLUMN IF NOT EXISTS phone_code TEXT;
ALTER TABLE countries ADD COLUMN IF NOT EXISTS iso_numeric TEXT;
ALTER TABLE countries ADD COLUMN IF NOT EXISTS flag_emoji TEXT;
ALTER TABLE countries ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE countries ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- ─── Timezone Zones: simplify ────────────────────────────────
-- Drop DST rule columns we no longer need (IANA handles DST at runtime)
ALTER TABLE timezone_zones DROP COLUMN IF EXISTS dst_start;
ALTER TABLE timezone_zones DROP COLUMN IF EXISTS dst_end;
ALTER TABLE timezone_zones DROP COLUMN IF EXISTS dst_offset;

-- Rename has_dst → dst_observed (idempotent)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'timezone_zones' AND column_name = 'has_dst'
  ) THEN
    ALTER TABLE timezone_zones RENAME COLUMN has_dst TO dst_observed;
  END IF;
END $$;

-- Add notes column
ALTER TABLE timezone_zones ADD COLUMN IF NOT EXISTS notes TEXT;

-- Change zone_code from INTEGER to TEXT (supports "1A", "2A" DST variant codes)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'timezone_zones' AND column_name = 'zone_code' AND data_type = 'integer'
  ) THEN
    ALTER TABLE timezone_zones DROP CONSTRAINT IF EXISTS timezone_zones_country_id_zone_code_key;
    ALTER TABLE timezone_zones ALTER COLUMN zone_code TYPE TEXT USING zone_code::TEXT;
    ALTER TABLE timezone_zones ADD CONSTRAINT timezone_zones_country_id_zone_code_key UNIQUE (country_id, zone_code);
  END IF;
END $$;
