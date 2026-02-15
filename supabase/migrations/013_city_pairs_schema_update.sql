-- Add status column to city_pairs
ALTER TABLE city_pairs ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
