-- Update A330 fuel burn rate to 5500 kg/hr
UPDATE aircraft_types
SET fuel_burn_rate_kg_per_hour = 5500
WHERE icao_type = '330';
