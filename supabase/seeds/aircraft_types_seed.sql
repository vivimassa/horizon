-- Seed aircraft types data
INSERT INTO aircraft_types (icao_type, iata_type, name, family, category, pax_capacity, cockpit_crew, cabin_crew) VALUES
-- Boeing 737 Family (Narrow-body)
('B737', '737', 'Boeing 737-700', 'Boeing 737 NG', 'narrow-body', 149, 2, 4),
('B738', '738', 'Boeing 737-800', 'Boeing 737 NG', 'narrow-body', 189, 2, 4),
('B739', '739', 'Boeing 737-900', 'Boeing 737 NG', 'narrow-body', 215, 2, 5),
('B37M', '7M8', 'Boeing 737 MAX 8', 'Boeing 737 MAX', 'narrow-body', 178, 2, 4),
('B38M', '7M9', 'Boeing 737 MAX 9', 'Boeing 737 MAX', 'narrow-body', 193, 2, 4),
('B39M', '7MJ', 'Boeing 737 MAX 10', 'Boeing 737 MAX', 'narrow-body', 230, 2, 5),

-- Airbus A320 Family (Narrow-body)
('A319', '319', 'Airbus A319', 'Airbus A320 Family', 'narrow-body', 156, 2, 3),
('A320', '320', 'Airbus A320', 'Airbus A320 Family', 'narrow-body', 180, 2, 4),
('A321', '321', 'Airbus A321', 'Airbus A320 Family', 'narrow-body', 220, 2, 5),
('A20N', '32N', 'Airbus A320neo', 'Airbus A320neo Family', 'narrow-body', 165, 2, 4),
('A21N', '32Q', 'Airbus A321neo', 'Airbus A320neo Family', 'narrow-body', 206, 2, 5),

-- Boeing 767 (Wide-body)
('B762', '762', 'Boeing 767-200', 'Boeing 767', 'wide-body', 224, 2, 7),
('B763', '763', 'Boeing 767-300', 'Boeing 767', 'wide-body', 269, 2, 7),
('B764', '764', 'Boeing 767-400', 'Boeing 767', 'wide-body', 304, 2, 8),

-- Boeing 777 (Wide-body)
('B772', '772', 'Boeing 777-200', 'Boeing 777', 'wide-body', 400, 2, 10),
('B77L', '77L', 'Boeing 777-200LR', 'Boeing 777', 'wide-body', 317, 2, 9),
('B773', '773', 'Boeing 777-300', 'Boeing 777', 'wide-body', 451, 2, 12),
('B77W', '77W', 'Boeing 777-300ER', 'Boeing 777', 'wide-body', 396, 2, 10),
('B778', '779', 'Boeing 777-8', 'Boeing 777X', 'wide-body', 384, 2, 10),
('B779', '77X', 'Boeing 777-9', 'Boeing 777X', 'wide-body', 426, 2, 11),

-- Boeing 787 Dreamliner (Wide-body)
('B788', '788', 'Boeing 787-8', 'Boeing 787', 'wide-body', 248, 2, 7),
('B789', '789', 'Boeing 787-9', 'Boeing 787', 'wide-body', 296, 2, 8),
('B78X', '78J', 'Boeing 787-10', 'Boeing 787', 'wide-body', 336, 2, 9),

-- Airbus A330 (Wide-body)
('A332', '332', 'Airbus A330-200', 'Airbus A330', 'wide-body', 293, 2, 8),
('A333', '333', 'Airbus A330-300', 'Airbus A330', 'wide-body', 335, 2, 9),
('A339', '339', 'Airbus A330-900neo', 'Airbus A330neo', 'wide-body', 287, 2, 8),

-- Airbus A350 (Wide-body)
('A359', '359', 'Airbus A350-900', 'Airbus A350', 'wide-body', 325, 2, 9),
('A35K', '351', 'Airbus A350-1000', 'Airbus A350', 'wide-body', 366, 2, 10),

-- Airbus A380 (Wide-body)
('A388', '388', 'Airbus A380-800', 'Airbus A380', 'wide-body', 575, 2, 15),

-- Boeing 747 (Wide-body)
('B744', '744', 'Boeing 747-400', 'Boeing 747', 'wide-body', 524, 2, 13),
('B748', '748', 'Boeing 747-8', 'Boeing 747', 'wide-body', 467, 2, 12),

-- Regional Jets
('E190', '190', 'Embraer 190', 'Embraer E-Jet', 'regional', 106, 2, 3),
('E195', '195', 'Embraer 195', 'Embraer E-Jet', 'regional', 124, 2, 3),
('E290', '290', 'Embraer E190-E2', 'Embraer E-Jet E2', 'regional', 114, 2, 3),
('E295', '295', 'Embraer E195-E2', 'Embraer E-Jet E2', 'regional', 146, 2, 4),
('CRJ9', 'CR9', 'Bombardier CRJ-900', 'Bombardier CRJ', 'regional', 90, 2, 2),
('CRJX', 'CRK', 'Bombardier CRJ-1000', 'Bombardier CRJ', 'regional', 104, 2, 3),

-- Turboprops
('AT72', 'AT7', 'ATR 72-600', 'ATR 72', 'turboprop', 78, 2, 2),
('AT76', 'ATR', 'ATR 72-500', 'ATR 72', 'turboprop', 74, 2, 2),
('DH8D', 'DH4', 'Bombardier Dash 8 Q400', 'Dash 8', 'turboprop', 86, 2, 2),
('DH8C', 'DH3', 'Bombardier Dash 8 Q300', 'Dash 8', 'turboprop', 56, 2, 2),

-- Freighters
('B74F', '74Y', 'Boeing 747-400F', 'Boeing 747 Freighter', 'freighter', 0, 2, 0),
('B77F', '77F', 'Boeing 777F', 'Boeing 777 Freighter', 'freighter', 0, 2, 0),
('B76F', '76F', 'Boeing 767-300F', 'Boeing 767 Freighter', 'freighter', 0, 2, 0),

-- Business Jets
('GLF5', 'GV', 'Gulfstream G550', 'Gulfstream', 'business', 18, 2, 1),
('GL7T', 'G7', 'Gulfstream G700', 'Gulfstream', 'business', 19, 2, 1),
('FA7X', 'F7X', 'Dassault Falcon 7X', 'Falcon', 'business', 16, 2, 1)

ON CONFLICT (icao_type) DO NOTHING;
