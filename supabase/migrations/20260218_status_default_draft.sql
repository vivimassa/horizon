-- Backfill NULL status to 'draft' and set column default
-- Fixes: draft flights not appearing in Gantt / Movement Control
-- Root cause: SSIM import and manual creation didn't set status,
-- leaving it NULL which was excluded by IN ('draft', 'published')

UPDATE scheduled_flights SET status = 'draft' WHERE status IS NULL;

ALTER TABLE scheduled_flights ALTER COLUMN status SET DEFAULT 'draft';
