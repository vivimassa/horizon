-- Update aircraft types to use local images instead of external URLs
-- Images are stored in /public/images/aircraft/{family}.jpg

-- Boeing 737 family
UPDATE aircraft_types SET image_url = '/images/aircraft/b737.jpg' WHERE icao_type IN ('B737', 'B738', 'B739', 'B37M', 'B38M', 'B39M');

-- Airbus A320 family
UPDATE aircraft_types SET image_url = '/images/aircraft/a320.jpg' WHERE icao_type IN ('A319', 'A320', 'A321', 'A20N', 'A21N');

-- Boeing 767
UPDATE aircraft_types SET image_url = '/images/aircraft/b767.jpg' WHERE icao_type IN ('B762', 'B763', 'B764', 'B76F');

-- Boeing 777
UPDATE aircraft_types SET image_url = '/images/aircraft/b777.jpg' WHERE icao_type IN ('B772', 'B77L', 'B773', 'B77W', 'B778', 'B779', 'B77F');

-- Boeing 787
UPDATE aircraft_types SET image_url = '/images/aircraft/b787.jpg' WHERE icao_type IN ('B788', 'B789', 'B78X');

-- Airbus A330
UPDATE aircraft_types SET image_url = '/images/aircraft/a330.jpg' WHERE icao_type IN ('A332', 'A333', 'A339');

-- Airbus A350
UPDATE aircraft_types SET image_url = '/images/aircraft/a350.jpg' WHERE icao_type IN ('A359', 'A35K');

-- Airbus A380
UPDATE aircraft_types SET image_url = '/images/aircraft/a380.jpg' WHERE icao_type = 'A388';

-- Boeing 747
UPDATE aircraft_types SET image_url = '/images/aircraft/b747.jpg' WHERE icao_type IN ('B744', 'B748', 'B74F');

-- Embraer E-Jet
UPDATE aircraft_types SET image_url = '/images/aircraft/e190.jpg' WHERE icao_type IN ('E190', 'E195', 'E290', 'E295');

-- Bombardier CRJ
UPDATE aircraft_types SET image_url = '/images/aircraft/crj.jpg' WHERE icao_type IN ('CRJ9', 'CRJX');

-- ATR
UPDATE aircraft_types SET image_url = '/images/aircraft/atr.jpg' WHERE icao_type IN ('AT72', 'AT76');

-- Dash 8
UPDATE aircraft_types SET image_url = '/images/aircraft/dash8.jpg' WHERE icao_type IN ('DH8D', 'DH8C');
