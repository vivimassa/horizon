-- Fix SSIM-imported flights that stored IATA codes as ICAO codes
-- e.g. '320' instead of 'A320', '321' instead of 'A321'

UPDATE scheduled_flights
SET aircraft_type_icao = CASE aircraft_type_icao
  WHEN '320' THEN 'A320'
  WHEN '321' THEN 'A321'
  WHEN '330' THEN 'A330'
  WHEN '319' THEN 'A319'
  WHEN '32Q' THEN 'A21N'
  WHEN '32N' THEN 'A20N'
  WHEN '333' THEN 'A333'
  WHEN '332' THEN 'A332'
  WHEN '359' THEN 'A359'
  WHEN '789' THEN 'B789'
  WHEN '788' THEN 'B788'
  WHEN '773' THEN 'B77W'
  WHEN '738' THEN 'B738'
  WHEN '739' THEN 'B739'
  ELSE aircraft_type_icao
END
WHERE aircraft_type_icao IN ('320','321','330','319','32Q','32N','333','332','359','789','788','773','738','739');

-- Backfill aircraft_type_id for rows that were null due to the mismatch
UPDATE scheduled_flights sf
SET aircraft_type_id = at.id
FROM aircraft_types at
WHERE sf.aircraft_type_icao = at.icao_type
  AND sf.aircraft_type_id IS NULL;
