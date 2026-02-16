-- Populate city_pairs.standard_block_minutes from flight_numbers average block times
-- For each city pair, find all flight_numbers that match the pair's airports (via IATA codes)
-- and compute the average block_minutes across both directions.

UPDATE city_pairs cp
SET standard_block_minutes = sub.avg_block
FROM (
  SELECT
    cp2.id AS city_pair_id,
    ROUND(AVG(fn.block_minutes)) AS avg_block
  FROM city_pairs cp2
  JOIN airports dep_apt ON dep_apt.id = cp2.departure_airport_id
  JOIN airports arr_apt ON arr_apt.id = cp2.arrival_airport_id
  JOIN flight_numbers fn ON (
    (fn.departure_iata = dep_apt.iata_code AND fn.arrival_iata = arr_apt.iata_code)
    OR
    (fn.departure_iata = arr_apt.iata_code AND fn.arrival_iata = dep_apt.iata_code)
  )
  WHERE fn.block_minutes > 0
  GROUP BY cp2.id
) sub
WHERE cp.id = sub.city_pair_id
  AND (cp.standard_block_minutes IS NULL OR cp.standard_block_minutes = 0);
