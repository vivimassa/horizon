-- Seed airlines data
INSERT INTO airlines (icao_code, iata_code, name, country, alliance) VALUES
-- Star Alliance
('UAL', 'UA', 'United Airlines', 'United States', 'Star Alliance'),
('AAL', 'AA', 'American Airlines', 'United States', 'Oneworld'),
('DAL', 'DL', 'Delta Air Lines', 'United States', 'SkyTeam'),
('SWA', 'WN', 'Southwest Airlines', 'United States', 'None'),
('JBU', 'B6', 'JetBlue Airways', 'United States', 'None'),
('ACA', 'AC', 'Air Canada', 'Canada', 'Star Alliance'),
('AMX', 'AM', 'Aeroméxico', 'Mexico', 'SkyTeam'),

-- European Airlines
('BAW', 'BA', 'British Airways', 'United Kingdom', 'Oneworld'),
('AFR', 'AF', 'Air France', 'France', 'SkyTeam'),
('DLH', 'LH', 'Lufthansa', 'Germany', 'Star Alliance'),
('KLM', 'KL', 'KLM Royal Dutch Airlines', 'Netherlands', 'SkyTeam'),
('IBE', 'IB', 'Iberia', 'Spain', 'Oneworld'),
('AZA', 'AZ', 'ITA Airways', 'Italy', 'SkyTeam'),
('SWR', 'LX', 'Swiss International Air Lines', 'Switzerland', 'Star Alliance'),
('AUA', 'OS', 'Austrian Airlines', 'Austria', 'Star Alliance'),
('TAP', 'TP', 'TAP Air Portugal', 'Portugal', 'Star Alliance'),
('SAS', 'SK', 'Scandinavian Airlines', 'Sweden', 'Star Alliance'),
('FIN', 'AY', 'Finnair', 'Finland', 'Oneworld'),
('THY', 'TK', 'Turkish Airlines', 'Turkey', 'Star Alliance'),
('AFL', 'SU', 'Aeroflot', 'Russia', 'SkyTeam'),
('RYR', 'FR', 'Ryanair', 'Ireland', 'None'),
('EZY', 'U2', 'easyJet', 'United Kingdom', 'None'),
('WZZ', 'W6', 'Wizz Air', 'Hungary', 'None'),

-- Asian Airlines
('CCA', 'CA', 'Air China', 'China', 'Star Alliance'),
('CES', 'MU', 'China Eastern Airlines', 'China', 'SkyTeam'),
('CSN', 'CZ', 'China Southern Airlines', 'China', 'SkyTeam'),
('CHH', 'HU', 'Hainan Airlines', 'China', 'None'),
('JAL', 'JL', 'Japan Airlines', 'Japan', 'Oneworld'),
('ANA', 'NH', 'All Nippon Airways', 'Japan', 'Star Alliance'),
('KAL', 'KE', 'Korean Air', 'South Korea', 'SkyTeam'),
('AAR', 'OZ', 'Asiana Airlines', 'South Korea', 'Star Alliance'),
('SIA', 'SQ', 'Singapore Airlines', 'Singapore', 'Star Alliance'),
('MAS', 'MH', 'Malaysia Airlines', 'Malaysia', 'Oneworld'),
('THA', 'TG', 'Thai Airways', 'Thailand', 'Star Alliance'),
('CPA', 'CX', 'Cathay Pacific', 'Hong Kong', 'Oneworld'),
('EVA', 'BR', 'EVA Air', 'Taiwan', 'Star Alliance'),
('AIC', 'AI', 'Air India', 'India', 'Star Alliance'),

-- Middle Eastern Airlines
('UAE', 'EK', 'Emirates', 'United Arab Emirates', 'None'),
('ETD', 'EY', 'Etihad Airways', 'United Arab Emirates', 'None'),
('QTR', 'QR', 'Qatar Airways', 'Qatar', 'Oneworld'),
('SVA', 'SV', 'Saudia', 'Saudi Arabia', 'SkyTeam'),
('ELY', 'LY', 'El Al', 'Israel', 'None'),

-- Oceania Airlines
('QFA', 'QF', 'Qantas', 'Australia', 'Oneworld'),
('VOZ', 'VA', 'Virgin Australia', 'Australia', 'None'),
('ANZ', 'NZ', 'Air New Zealand', 'New Zealand', 'Star Alliance'),

-- South American Airlines
('GLO', 'G3', 'GOL Linhas Aéreas', 'Brazil', 'None'),
('TAM', 'JJ', 'LATAM Brasil', 'Brazil', 'Oneworld'),
('ARG', 'AR', 'Aerolíneas Argentinas', 'Argentina', 'SkyTeam'),
('LAN', 'LA', 'LATAM Airlines', 'Chile', 'Oneworld'),
('AVA', 'AV', 'Avianca', 'Colombia', 'Star Alliance'),

-- African Airlines
('SAA', 'SA', 'South African Airways', 'South Africa', 'Star Alliance'),
('MSR', 'MS', 'EgyptAir', 'Egypt', 'Star Alliance'),
('RAM', 'AT', 'Royal Air Maroc', 'Morocco', 'Oneworld'),
('ETH', 'ET', 'Ethiopian Airlines', 'Ethiopia', 'Star Alliance'),
('KQA', 'KQ', 'Kenya Airways', 'Kenya', 'SkyTeam')

ON CONFLICT (icao_code) DO NOTHING;
