-- Seed countries data
INSERT INTO countries (iso_code, name, region, currency, icao_prefix) VALUES
-- North America
('US', 'United States', 'North America', 'USD', 'K'),
('CA', 'Canada', 'North America', 'CAD', 'C'),
('MX', 'Mexico', 'North America', 'MXN', 'MM'),

-- Europe
('GB', 'United Kingdom', 'Europe', 'GBP', 'EG'),
('FR', 'France', 'Europe', 'EUR', 'LF'),
('DE', 'Germany', 'Europe', 'EUR', 'ED'),
('IT', 'Italy', 'Europe', 'EUR', 'LI'),
('ES', 'Spain', 'Europe', 'EUR', 'LE'),
('NL', 'Netherlands', 'Europe', 'EUR', 'EH'),
('BE', 'Belgium', 'Europe', 'EUR', 'EB'),
('CH', 'Switzerland', 'Europe', 'CHF', 'LS'),
('AT', 'Austria', 'Europe', 'EUR', 'LO'),
('PT', 'Portugal', 'Europe', 'EUR', 'LP'),
('GR', 'Greece', 'Europe', 'EUR', 'LG'),
('TR', 'Turkey', 'Europe', 'TRY', 'LT'),
('RU', 'Russia', 'Europe', 'RUB', 'U'),
('NO', 'Norway', 'Europe', 'NOK', 'EN'),
('SE', 'Sweden', 'Europe', 'SEK', 'ES'),
('DK', 'Denmark', 'Europe', 'DKK', 'EK'),
('FI', 'Finland', 'Europe', 'EUR', 'EF'),
('PL', 'Poland', 'Europe', 'PLN', 'EP'),
('CZ', 'Czech Republic', 'Europe', 'CZK', 'LK'),
('HU', 'Hungary', 'Europe', 'HUF', 'LH'),
('RO', 'Romania', 'Europe', 'RON', 'LR'),
('IE', 'Ireland', 'Europe', 'EUR', 'EI'),
('IS', 'Iceland', 'Europe', 'ISK', 'BI'),
('UA', 'Ukraine', 'Europe', 'UAH', 'UK'),

-- Asia
('CN', 'China', 'Asia', 'CNY', 'Z'),
('JP', 'Japan', 'Asia', 'JPY', 'RJ'),
('KR', 'South Korea', 'Asia', 'KRW', 'RK'),
('IN', 'India', 'Asia', 'INR', 'V'),
('SG', 'Singapore', 'Asia', 'SGD', 'WS'),
('MY', 'Malaysia', 'Asia', 'MYR', 'WM'),
('TH', 'Thailand', 'Asia', 'THB', 'VT'),
('ID', 'Indonesia', 'Asia', 'IDR', 'W'),
('PH', 'Philippines', 'Asia', 'PHP', 'RP'),
('VN', 'Vietnam', 'Asia', 'VND', 'VV'),
('HK', 'Hong Kong', 'Asia', 'HKD', 'VH'),
('TW', 'Taiwan', 'Asia', 'TWD', 'RC'),

-- Middle East
('AE', 'United Arab Emirates', 'Middle East', 'AED', 'OM'),
('QA', 'Qatar', 'Middle East', 'QAR', 'OT'),
('SA', 'Saudi Arabia', 'Middle East', 'SAR', 'OE'),
('IL', 'Israel', 'Middle East', 'ILS', 'LL'),
('JO', 'Jordan', 'Middle East', 'JOD', 'OJ'),
('LB', 'Lebanon', 'Middle East', 'LBP', 'OL'),
('KW', 'Kuwait', 'Middle East', 'KWD', 'OK'),
('BH', 'Bahrain', 'Middle East', 'BHD', 'OB'),
('OM', 'Oman', 'Middle East', 'OMR', 'OO'),

-- Oceania
('AU', 'Australia', 'Oceania', 'AUD', 'Y'),
('NZ', 'New Zealand', 'Oceania', 'NZD', 'NZ'),

-- South America
('BR', 'Brazil', 'South America', 'BRL', 'SB'),
('AR', 'Argentina', 'South America', 'ARS', 'SA'),
('CL', 'Chile', 'South America', 'CLP', 'SC'),
('CO', 'Colombia', 'South America', 'COP', 'SK'),
('PE', 'Peru', 'South America', 'PEN', 'SP'),

-- Africa
('ZA', 'South Africa', 'Africa', 'ZAR', 'FA'),
('EG', 'Egypt', 'Africa', 'EGP', 'HE'),
('MA', 'Morocco', 'Africa', 'MAD', 'GM'),
('KE', 'Kenya', 'Africa', 'KES', 'HK'),
('ET', 'Ethiopia', 'Africa', 'ETB', 'HA')

ON CONFLICT (iso_code) DO NOTHING;
