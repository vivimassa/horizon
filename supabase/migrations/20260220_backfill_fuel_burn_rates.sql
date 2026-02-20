UPDATE aircraft_types SET fuel_burn_rate_kg_per_hour = 2500 WHERE icao_type = 'A320' AND fuel_burn_rate_kg_per_hour IS NULL;
UPDATE aircraft_types SET fuel_burn_rate_kg_per_hour = 2800 WHERE icao_type = 'A321' AND fuel_burn_rate_kg_per_hour IS NULL;
UPDATE aircraft_types SET fuel_burn_rate_kg_per_hour = 5800 WHERE icao_type = 'A333' AND fuel_burn_rate_kg_per_hour IS NULL;
UPDATE aircraft_types SET fuel_burn_rate_kg_per_hour = 2400 WHERE icao_type = 'A21N' AND fuel_burn_rate_kg_per_hour IS NULL;
ALTER TABLE aircraft_types ALTER COLUMN fuel_burn_rate_kg_per_hour SET DEFAULT 2500;
