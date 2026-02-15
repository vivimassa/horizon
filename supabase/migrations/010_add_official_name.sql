-- 010: Add official_name column to countries table
ALTER TABLE countries ADD COLUMN IF NOT EXISTS official_name VARCHAR(200);

-- Seed official names for all countries
UPDATE countries SET official_name = CASE iso_code_2
  -- Southeast Asia
  WHEN 'VN' THEN 'Socialist Republic of Vietnam'
  WHEN 'TH' THEN 'Kingdom of Thailand'
  WHEN 'SG' THEN 'Republic of Singapore'
  WHEN 'MY' THEN 'Federation of Malaysia'
  WHEN 'ID' THEN 'Republic of Indonesia'
  WHEN 'PH' THEN 'Republic of the Philippines'
  WHEN 'MM' THEN 'Republic of the Union of Myanmar'
  WHEN 'KH' THEN 'Kingdom of Cambodia'
  WHEN 'LA' THEN 'Lao People''s Democratic Republic'
  WHEN 'BN' THEN 'Nation of Brunei, the Abode of Peace'
  -- East Asia
  WHEN 'JP' THEN 'State of Japan'
  WHEN 'KR' THEN 'Republic of Korea'
  WHEN 'CN' THEN 'People''s Republic of China'
  WHEN 'TW' THEN 'Republic of China (Taiwan)'
  WHEN 'HK' THEN 'Hong Kong Special Administrative Region'
  WHEN 'MO' THEN 'Macao Special Administrative Region'
  -- South Asia
  WHEN 'IN' THEN 'Republic of India'
  WHEN 'PK' THEN 'Islamic Republic of Pakistan'
  WHEN 'BD' THEN 'People''s Republic of Bangladesh'
  WHEN 'LK' THEN 'Democratic Socialist Republic of Sri Lanka'
  WHEN 'NP' THEN 'Federal Democratic Republic of Nepal'
  -- Oceania
  WHEN 'AU' THEN 'Commonwealth of Australia'
  WHEN 'NZ' THEN 'New Zealand'
  -- Middle East
  WHEN 'AE' THEN 'United Arab Emirates'
  WHEN 'QA' THEN 'State of Qatar'
  WHEN 'SA' THEN 'Kingdom of Saudi Arabia'
  WHEN 'TR' THEN 'Republic of Türkiye'
  -- Europe
  WHEN 'GB' THEN 'United Kingdom of Great Britain and Northern Ireland'
  WHEN 'FR' THEN 'French Republic'
  WHEN 'DE' THEN 'Federal Republic of Germany'
  WHEN 'NL' THEN 'Kingdom of the Netherlands'
  WHEN 'IT' THEN 'Italian Republic'
  WHEN 'ES' THEN 'Kingdom of Spain'
  WHEN 'CH' THEN 'Swiss Confederation'
  WHEN 'AT' THEN 'Republic of Austria'
  WHEN 'RU' THEN 'Russian Federation'
  -- Americas
  WHEN 'US' THEN 'United States of America'
  WHEN 'CA' THEN 'Canada'
  WHEN 'MX' THEN 'United Mexican States'
  WHEN 'BR' THEN 'Federative Republic of Brazil'
  WHEN 'AR' THEN 'Argentine Republic'
  WHEN 'CL' THEN 'Republic of Chile'
  -- Africa
  WHEN 'ZA' THEN 'Republic of South Africa'
  WHEN 'EG' THEN 'Arab Republic of Egypt'
  WHEN 'KE' THEN 'Republic of Kenya'
  WHEN 'NG' THEN 'Federal Republic of Nigeria'
  WHEN 'MA' THEN 'Kingdom of Morocco'
  WHEN 'ET' THEN 'Federal Democratic Republic of Ethiopia'
  ELSE name
END
WHERE official_name IS NULL;
