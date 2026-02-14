-- Seed city pairs data (major routes)
INSERT INTO city_pairs (departure_airport, arrival_airport, block_time, distance, route_type, etops_required) VALUES
-- US Domestic
('KJFK', 'KLAX', 360, 2475, 'domestic', false),
('KLAX', 'KJFK', 330, 2475, 'domestic', false),
('KORD', 'KLAX', 270, 1745, 'domestic', false),
('KDFW', 'KLAX', 195, 1235, 'domestic', false),
('KSFO', 'KJFK', 360, 2586, 'domestic', false),
('KDEN', 'KJFK', 255, 1626, 'domestic', false),
('KATL', 'KLAX', 285, 1946, 'domestic', false),
('KMIA', 'KLAX', 330, 2342, 'domestic', false),
('KSEA', 'KJFK', 345, 2421, 'domestic', false),
('KLAS', 'KJFK', 315, 2248, 'domestic', false),

-- Transatlantic
('KJFK', 'EGLL', 420, 3459, 'international', false),
('EGLL', 'KJFK', 480, 3459, 'international', false),
('KEWR', 'LFPG', 450, 3626, 'international', false),
('KORD', 'EGLL', 480, 3958, 'international', false),
('KLAX', 'EGLL', 630, 5456, 'long-haul', true),
('KJFK', 'LFPG', 450, 3635, 'international', false),
('KBOS', 'EGLL', 390, 3269, 'international', false),
('KMIA', 'EGLL', 540, 4424, 'long-haul', false),
('KATL', 'LFPG', 525, 4394, 'long-haul', false),
('KSFO', 'EGLL', 630, 5367, 'long-haul', true),

-- Europe Intra
('EGLL', 'LFPG', 75, 215, 'regional', false),
('LFPG', 'EDDF', 90, 297, 'regional', false),
('EGLL', 'EDDF', 105, 406, 'regional', false),
('LFPG', 'LEMD', 120, 654, 'regional', false),
('EGLL', 'LIRF', 165, 901, 'regional', false),
('EDDF', 'LOWW', 75, 374, 'regional', false),
('LEMD', 'LEBL', 75, 314, 'regional', false),
('EHAM', 'EGLL', 65, 227, 'regional', false),
('EBBR', 'EGLL', 55, 203, 'regional', false),

-- Transpacific
('KLAX', 'RJTT', 660, 5478, 'long-haul', true),
('RJTT', 'KLAX', 600, 5478, 'long-haul', true),
('KSFO', 'RJTT', 630, 5148, 'long-haul', true),
('KLAX', 'WSSS', 960, 8769, 'ultra-long-haul', true),
('KSFO', 'VHHH', 780, 6927, 'long-haul', true),
('KLAX', 'YSSY', 840, 7488, 'long-haul', true),
('YSSY', 'KLAX', 780, 7488, 'long-haul', true),
('KJFK', 'RJTT', 840, 6737, 'long-haul', true),

-- Asia Intra
('RJTT', 'VHHH', 270, 1798, 'regional', false),
('VHHH', 'WSSS', 240, 1594, 'regional', false),
('RJBB', 'VHHH', 240, 1501, 'regional', false),
('WSSS', 'WMKK', 60, 192, 'regional', false),
('VHHH', 'RCTP', 105, 502, 'regional', false),
('ZBAA', 'RJTT', 225, 1315, 'international', false),
('ZSPD', 'WSSS', 315, 2373, 'international', false),
('VIDP', 'WSSS', 330, 2570, 'international', false),

-- Europe to Middle East
('EGLL', 'OMDB', 420, 3414, 'international', false),
('LFPG', 'OMDB', 390, 3248, 'international', false),
('EDDF', 'OMDB', 360, 3007, 'international', false),
('EGLL', 'OTHH', 405, 3254, 'international', false),
('LEMD', 'OMDB', 420, 3393, 'international', false),

-- Middle East to Asia
('OMDB', 'WSSS', 480, 3835, 'international', true),
('OMDB', 'VHHH', 510, 3726, 'international', true),
('OTHH', 'RJTT', 660, 5201, 'long-haul', true),
('OMDB', 'YSSY', 840, 7483, 'long-haul', true),

-- Europe to Asia
('EGLL', 'WSSS', 810, 6765, 'long-haul', true),
('LFPG', 'RJTT', 720, 6194, 'long-haul', true),
('EDDF', 'VHHH', 720, 5757, 'long-haul', true),
('EGLL', 'VHHH', 750, 5994, 'long-haul', true),

-- Australia/Pacific
('YSSY', 'YMML', 95, 443, 'domestic', false),
('YSSY', 'YBBN', 85, 454, 'domestic', false),
('YSSY', 'NZAA', 195, 1342, 'regional', false),
('YMML', 'NZAA', 225, 1643, 'regional', false),
('YSSY', 'WSSS', 480, 3921, 'international', true),

-- South America
('SBGR', 'SAEZ', 165, 1054, 'regional', false),
('SBGR', 'SCEL', 255, 1848, 'regional', false),
('SAEZ', 'SCEL', 135, 714, 'regional', false),
('SBGR', 'KMIA', 525, 4186, 'international', true),

-- Ultra Long-Haul
('WSSS', 'KEWR', 1095, 9535, 'ultra-long-haul', true),
('WSSS', 'KJFK', 1110, 9537, 'ultra-long-haul', true),
('YSSY', 'EGLL', 1320, 10573, 'ultra-long-haul', true),
('NZAA', 'OMDB', 1020, 8825, 'ultra-long-haul', true)

ON CONFLICT (departure_airport, arrival_airport) DO NOTHING;
