-- ============================================================
-- Migration 002: Admin Restructure
-- Run manually in Supabase Dashboard SQL Editor
-- ============================================================

-- 1. Add columns to aircraft_types
ALTER TABLE aircraft_types
  ADD COLUMN default_tat_minutes integer DEFAULT 45,
  ADD COLUMN default_cabin_config jsonb;

-- 2. Create aircraft table (individual registrations)
CREATE TABLE aircraft (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  registration text NOT NULL UNIQUE,
  aircraft_type_id uuid NOT NULL REFERENCES aircraft_types(id),
  status text NOT NULL DEFAULT 'active',
  home_base_id uuid REFERENCES airports(id),
  seating_config jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Create airport_tat_rules table
CREATE TABLE airport_tat_rules (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  airport_id uuid NOT NULL REFERENCES airports(id),
  aircraft_type_id uuid NOT NULL REFERENCES aircraft_types(id),
  tat_minutes integer NOT NULL,
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(airport_id, aircraft_type_id)
);

-- 4. Create flight_service_types table
CREATE TABLE flight_service_types (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  operator_id uuid NOT NULL REFERENCES operators(id),
  code varchar(5) NOT NULL,
  name varchar(50) NOT NULL,
  description text,
  color varchar(7),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(operator_id, code)
);

-- 5. Create delay_codes table
CREATE TABLE delay_codes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  operator_id uuid NOT NULL REFERENCES operators(id),
  code varchar(10) NOT NULL,
  category varchar(50) NOT NULL,
  name varchar(100) NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(operator_id, code)
);

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE aircraft ENABLE ROW LEVEL SECURITY;
ALTER TABLE airport_tat_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE flight_service_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE delay_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read" ON aircraft FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write" ON aircraft FOR ALL TO authenticated USING (true);
CREATE POLICY "auth_read" ON airport_tat_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write" ON airport_tat_rules FOR ALL TO authenticated USING (true);
CREATE POLICY "auth_read" ON flight_service_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write" ON flight_service_types FOR ALL TO authenticated USING (true);
CREATE POLICY "auth_read" ON delay_codes FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write" ON delay_codes FOR ALL TO authenticated USING (true);

-- ============================================================
-- Seed: Update aircraft_types with TAT and cabin config
-- ============================================================
UPDATE aircraft_types SET default_tat_minutes = 35, default_cabin_config = '{"Y": 180}' WHERE icao_type = 'A320';
UPDATE aircraft_types SET default_tat_minutes = 40, default_cabin_config = '{"Y": 220}' WHERE icao_type = 'A321';
UPDATE aircraft_types SET default_tat_minutes = 60, default_cabin_config = '{"J": 30, "W": 36, "Y": 234}' WHERE icao_type = 'A333';

-- ============================================================
-- Seed: flight_service_types for operator HZN
-- ============================================================
INSERT INTO flight_service_types (operator_id, code, name, description, color)
SELECT o.id, v.code, v.name, v.description, v.color
FROM operators o
CROSS JOIN (VALUES
  ('J', 'Scheduled Passenger', 'Regular scheduled passenger service', '#2563EB'),
  ('C', 'Charter', 'Charter/ad-hoc passenger service', '#7C3AED'),
  ('F', 'Ferry/Positioning', 'Ferry or positioning flight without passengers', '#D97706'),
  ('G', 'Cargo', 'Dedicated cargo/freight service', '#059669'),
  ('P', 'Positioning', 'Aircraft positioning flight', '#6B7280')
) AS v(code, name, description, color)
WHERE o.email LIKE '%'  -- first operator; adjust WHERE clause as needed
LIMIT 5;

-- ============================================================
-- Seed: IATA standard delay codes (all 99 codes)
-- ============================================================
INSERT INTO delay_codes (operator_id, code, category, name, description)
SELECT o.id, v.code, v.category, v.name, v.description
FROM (SELECT id FROM operators LIMIT 1) o
CROSS JOIN (VALUES
  -- Passenger and Baggage (01-09)
  ('01', 'passenger', 'Late Passenger Check-in', 'Passengers arriving late at check-in counter'),
  ('02', 'passenger', 'Late Baggage', 'Late or rush baggage processing'),
  ('03', 'passenger', 'Check-in Congestion', 'Congestion in check-in area causing delays'),
  ('04', 'passenger', 'Oversales / Overbooking', 'Denied boarding due to overbooking'),
  ('05', 'passenger', 'Flight Connections', 'Waiting for connecting passengers or crew'),
  ('06', 'passenger', 'Passenger Documentation', 'Issues with passenger travel documents or visas'),
  ('07', 'passenger', 'Late Passenger at Gate', 'Passenger late to boarding gate'),
  ('08', 'passenger', 'Cabin Baggage', 'Cabin baggage stowage issues or excess items'),
  ('09', 'passenger', 'Other Passenger/Baggage', 'Other passenger and baggage related delays'),

  -- Cargo and Mail (11-19)
  ('11', 'cargo', 'Cargo Documentation', 'Late or inaccurate cargo documentation'),
  ('12', 'cargo', 'Late Cargo Positioning', 'Cargo arriving late at warehouse or aircraft'),
  ('13', 'cargo', 'Late Cargo Acceptance', 'Late acceptance of cargo shipments'),
  ('14', 'cargo', 'Inadequate Cargo Packing', 'Cargo repacked due to inadequate packaging'),
  ('15', 'cargo', 'Cargo Oversales', 'Cargo offloaded due to overbooking'),
  ('16', 'cargo', 'Late Cargo Documents', 'Late or amended cargo shipping documents'),
  ('17', 'cargo', 'Cargo Connections', 'Waiting for connecting cargo transfer'),
  ('18', 'cargo', 'ULD Handling - Cargo', 'ULD or container/pallet issues for cargo'),
  ('19', 'cargo', 'Other Cargo/Mail', 'Other cargo and mail handling delays'),

  -- Mail (21-29)
  ('21', 'mail', 'Mail Documentation', 'Late or inaccurate mail documentation'),
  ('22', 'mail', 'Late Mail Positioning', 'Mail arriving late for loading'),
  ('23', 'mail', 'Late Mail Acceptance', 'Late acceptance of mail consignments'),
  ('24', 'mail', 'Inadequate Mail Packing', 'Mail repacked due to inadequate packaging'),
  ('25', 'mail', 'Mail Oversales', 'Mail offloaded due to capacity constraints'),
  ('26', 'mail', 'Late Post Office Preparation', 'Delay in post office mail preparation'),
  ('27', 'mail', 'Mail Customs Inspection', 'Delay due to customs inspection of mail'),
  ('28', 'mail', 'ULD Handling - Mail', 'ULD or container issues for mail'),
  ('29', 'mail', 'Other Mail', 'Other mail handling delays'),

  -- Aircraft and Ramp Handling (31-39)
  ('31', 'aircraft_ramp', 'Aircraft Documentation', 'Late or inaccurate aircraft documentation'),
  ('32', 'aircraft_ramp', 'Loading/Unloading', 'Delay in loading or unloading aircraft'),
  ('33', 'aircraft_ramp', 'Loading Equipment', 'Loading equipment shortage or failure'),
  ('34', 'aircraft_ramp', 'Servicing Equipment', 'Ground servicing equipment issues'),
  ('35', 'aircraft_ramp', 'Aircraft Cleaning', 'Delay in cabin or aircraft cleaning'),
  ('36', 'aircraft_ramp', 'Fuelling/Defuelling', 'Fuelling or defuelling delays'),
  ('37', 'aircraft_ramp', 'Catering', 'Late or incomplete catering delivery'),
  ('38', 'aircraft_ramp', 'ULD/Container/Pallet', 'ULD, container or pallet shortage or issues'),
  ('39', 'aircraft_ramp', 'Other Ramp Handling', 'Other aircraft and ramp handling delays'),

  -- Technical and Aircraft Equipment (41-49)
  ('41', 'technical', 'Aircraft Defects', 'Aircraft technical defects or malfunctions'),
  ('42', 'technical', 'Scheduled Maintenance', 'Late release from scheduled maintenance'),
  ('43', 'technical', 'Non-Scheduled Maintenance', 'Unscheduled maintenance or repair required'),
  ('44', 'technical', 'Special Checks', 'Special inspections or additional maintenance work'),
  ('45', 'technical', 'AOG Spares', 'Waiting for aircraft-on-ground spare parts'),
  ('46', 'technical', 'Aircraft Change - Technical', 'Aircraft substitution for technical reasons'),
  ('47', 'technical', 'Standby Aircraft', 'Standby aircraft activation delay'),
  ('48', 'technical', 'Cabin Configuration', 'Scheduled cabin reconfiguration delay'),
  ('49', 'technical', 'Other Technical', 'Other technical and equipment delays'),

  -- Damage and Automated Systems (51-59)
  ('51', 'operations', 'Damage in Flight', 'Aircraft damage discovered after flight operations'),
  ('52', 'operations', 'Damage on Ground', 'Aircraft damage during ground operations'),
  ('53', 'operations', 'Bird Strike', 'Bird strike damage or inspection required'),
  ('54', 'operations', 'Lightning Strike', 'Lightning strike damage or inspection required'),
  ('55', 'operations', 'EDP/System Failure', 'Automated system or IT equipment failure'),
  ('56', 'operations', 'Load Control', 'Centralized load control system issues'),
  ('57', 'operations', 'Connection Optimization', 'Segment or connection optimization by systems'),
  ('58', 'operations', 'System Overbooking', 'Overbooking caused by automated systems'),
  ('59', 'operations', 'Other Automated', 'Other damage or automated system delays'),

  -- Flight Operations and Crewing (61-69)
  ('61', 'operations', 'Flight Plan', 'Late completion or change of flight plan'),
  ('62', 'operations', 'Operational Requirements', 'Special operational requirements causing delay'),
  ('63', 'operations', 'Late Flight Crew', 'Late arrival of flight deck crew'),
  ('64', 'operations', 'Late Cabin Crew', 'Late arrival of cabin crew'),
  ('65', 'operations', 'Crew Error at Dispatch', 'Crew error or confusion during dispatch'),
  ('66', 'operations', 'Late Flight Documentation', 'Late or inaccurate flight documentation'),
  ('67', 'operations', 'Flight Crew Shortage', 'Flight deck crew shortage'),
  ('68', 'operations', 'Cabin Crew Shortage', 'Cabin crew shortage or absence'),
  ('69', 'operations', 'Other Flight Ops/Crewing', 'Other flight operations or crewing delays'),

  -- Weather (71-79)
  ('71', 'weather', 'Weather at Departure', 'Adverse weather at departure station'),
  ('72', 'weather', 'Weather at Destination', 'Adverse weather at destination station'),
  ('73', 'weather', 'Weather En-Route', 'Adverse weather en-route or at alternate'),
  ('74', 'weather', 'De-icing of Aircraft', 'Aircraft de-icing or anti-icing required'),
  ('75', 'weather', 'Runway Snow/Ice Removal', 'Snow, ice, water or sand removal from runway'),
  ('76', 'weather', 'Ground Ops Impaired', 'Ground handling impaired by adverse weather'),
  ('77', 'weather', 'De-icing Capacity', 'Insufficient de-icing capacity'),
  ('78', 'weather', 'Fog/Low Visibility', 'Fog or low visibility operations restrictions'),
  ('79', 'weather', 'Other Weather', 'Other weather-related delays'),

  -- ATC and Airport (81-89)
  ('81', 'atc', 'ATFM En-Route Demand', 'ATFM restrictions due to en-route demand/capacity'),
  ('82', 'atc', 'ATFM Staff/Equipment', 'ATFM due to ATC staff or equipment en-route'),
  ('83', 'atc', 'ATFM Destination Restriction', 'ATFM restriction at destination airport'),
  ('84', 'atc', 'ATFM Destination Weather', 'ATFM due to weather at destination'),
  ('85', 'airport', 'Mandatory Security', 'Mandatory security screening delays'),
  ('86', 'government', 'Immigration/Customs/Health', 'Immigration, customs or health authority delays'),
  ('87', 'airport', 'Airport Facilities', 'Airport construction, maintenance or facility failure'),
  ('88', 'airport', 'Industrial Action', 'Strike or industrial action at airport'),
  ('89', 'atc', 'Other ATC/Airport', 'Other ATC or airport authority delays'),

  -- Reactionary (91-96)
  ('91', 'reactionary', 'Load Connection', 'Waiting for load or baggage from delayed flight'),
  ('92', 'reactionary', 'Through Check-in Error', 'Through check-in connection error'),
  ('93', 'reactionary', 'Aircraft Rotation', 'Late inbound aircraft from previous sector'),
  ('94', 'reactionary', 'Cabin Crew Rotation', 'Cabin crew arriving late from previous flight'),
  ('95', 'reactionary', 'Crew Rotation', 'Flight crew arriving late from previous flight'),
  ('96', 'reactionary', 'Operations Control', 'Delay imposed by operations control centre'),

  -- Miscellaneous (97-99)
  ('97', 'miscellaneous', 'Industrial Action - Internal', 'Internal company industrial action or dispute'),
  ('98', 'miscellaneous', 'Undefined Delay', 'Undefined or unclassified delay reason'),
  ('99', 'miscellaneous', 'Other Miscellaneous', 'Other miscellaneous delay causes')
) AS v(code, category, name, description);

-- ============================================================
-- Seed: airport_tat_rules
-- ============================================================
INSERT INTO airport_tat_rules (airport_id, aircraft_type_id, tat_minutes, notes)
SELECT a.id, t.id, v.tat, v.notes
FROM (VALUES
  ('VVTS', 'A320', 45, 'SGN standard turnaround'),
  ('VVTS', 'A321', 45, 'SGN standard turnaround'),
  ('VVTS', 'A333', 75, 'SGN wide-body turnaround'),
  ('VVNB', 'A320', 40, 'HAN standard turnaround'),
  ('VVNB', 'A321', 40, 'HAN standard turnaround'),
  ('VVNB', 'A333', 70, 'HAN wide-body turnaround'),
  ('VTBS', 'A333', 65, 'BKK wide-body turnaround'),
  ('WSSS', 'A333', 60, 'SIN wide-body turnaround')
) AS v(airport_icao, aircraft_icao, tat, notes)
JOIN airports a ON a.icao_code = v.airport_icao
JOIN aircraft_types t ON t.icao_type = v.aircraft_icao;
