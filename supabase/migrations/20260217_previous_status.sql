-- Add previous_status column for cancel/restore workflow
ALTER TABLE scheduled_flights
  ADD COLUMN IF NOT EXISTS previous_status TEXT DEFAULT NULL;
