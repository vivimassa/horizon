-- Migration: Add finalize workflow columns
-- Three flight states:
--   status='draft', finalized=false → Work in Progress (WIP)
--   status='draft', finalized=true  → Finalized (ready for publish review)
--   status='published'              → Published (live; finalized is irrelevant)

ALTER TABLE scheduled_flights ADD COLUMN IF NOT EXISTS finalized BOOLEAN DEFAULT FALSE;
ALTER TABLE scheduled_flights ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE scheduled_flights ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'manual';
ALTER TABLE aircraft_routes ADD COLUMN IF NOT EXISTS finalized BOOLEAN DEFAULT FALSE;
