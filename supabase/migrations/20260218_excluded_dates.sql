-- Add excluded_dates column to scheduled_flights for date-specific deletion
ALTER TABLE scheduled_flights ADD COLUMN IF NOT EXISTS excluded_dates DATE[] DEFAULT '{}';
