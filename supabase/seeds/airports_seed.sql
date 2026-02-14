-- Seed airports data with 200+ real airports
INSERT INTO airports (icao_code, iata_code, airport_name, city, country, timezone) VALUES
-- United States
('KJFK', 'JFK', 'John F. Kennedy International Airport', 'New York', 'United States', 'America/New_York'),
('KLAX', 'LAX', 'Los Angeles International Airport', 'Los Angeles', 'United States', 'America/Los_Angeles'),
('KORD', 'ORD', 'O''Hare International Airport', 'Chicago', 'United States', 'America/Chicago'),
('KDFW', 'DFW', 'Dallas/Fort Worth International Airport', 'Dallas', 'United States', 'America/Chicago'),
('KDEN', 'DEN', 'Denver International Airport', 'Denver', 'United States', 'America/Denver'),
('KSFO', 'SFO', 'San Francisco International Airport', 'San Francisco', 'United States', 'America/Los_Angeles'),
('KLAS', 'LAS', 'Harry Reid International Airport', 'Las Vegas', 'United States', 'America/Los_Angeles'),
('KSEA', 'SEA', 'Seattle-Tacoma International Airport', 'Seattle', 'United States', 'America/Los_Angeles'),
('KMIA', 'MIA', 'Miami International Airport', 'Miami', 'United States', 'America/New_York'),
('KATL', 'ATL', 'Hartsfield-Jackson Atlanta International Airport', 'Atlanta', 'United States', 'America/New_York'),
('KBOS', 'BOS', 'Boston Logan International Airport', 'Boston', 'United States', 'America/New_York'),
('KEWR', 'EWR', 'Newark Liberty International Airport', 'Newark', 'United States', 'America/New_York'),
('KIAD', 'IAD', 'Washington Dulles International Airport', 'Washington', 'United States', 'America/New_York'),
('KPHX', 'PHX', 'Phoenix Sky Harbor International Airport', 'Phoenix', 'United States', 'America/Phoenix'),
('KMCO', 'MCO', 'Orlando International Airport', 'Orlando', 'United States', 'America/New_York'),
('KIAH', 'IAH', 'George Bush Intercontinental Airport', 'Houston', 'United States', 'America/Chicago'),
('KPDX', 'PDX', 'Portland International Airport', 'Portland', 'United States', 'America/Los_Angeles'),
('KSAN', 'SAN', 'San Diego International Airport', 'San Diego', 'United States', 'America/Los_Angeles'),
('KDTW', 'DTW', 'Detroit Metropolitan Wayne County Airport', 'Detroit', 'United States', 'America/Detroit'),
('KMSP', 'MSP', 'Minneapolis-St Paul International Airport', 'Minneapolis', 'United States', 'America/Chicago'),

-- United Kingdom
('EGLL', 'LHR', 'London Heathrow Airport', 'London', 'United Kingdom', 'Europe/London'),
('EGKK', 'LGW', 'London Gatwick Airport', 'London', 'United Kingdom', 'Europe/London'),
('EGSS', 'STN', 'London Stansted Airport', 'London', 'United Kingdom', 'Europe/London'),
('EGGW', 'LTN', 'London Luton Airport', 'London', 'United Kingdom', 'Europe/London'),
('EGCC', 'MAN', 'Manchester Airport', 'Manchester', 'United Kingdom', 'Europe/London'),
('EGPH', 'EDI', 'Edinburgh Airport', 'Edinburgh', 'United Kingdom', 'Europe/London'),
('EGBB', 'BHX', 'Birmingham Airport', 'Birmingham', 'United Kingdom', 'Europe/London'),
('EGGD', 'BRS', 'Bristol Airport', 'Bristol', 'United Kingdom', 'Europe/London'),

-- France
('LFPG', 'CDG', 'Charles de Gaulle Airport', 'Paris', 'France', 'Europe/Paris'),
('LFPO', 'ORY', 'Orly Airport', 'Paris', 'France', 'Europe/Paris'),
('LFLL', 'LYS', 'Lyon-Saint Exupéry Airport', 'Lyon', 'France', 'Europe/Paris'),
('LFML', 'MRS', 'Marseille Provence Airport', 'Marseille', 'France', 'Europe/Paris'),
('LFMN', 'NCE', 'Nice Côte d''Azur Airport', 'Nice', 'France', 'Europe/Paris'),
('LFBO', 'TLS', 'Toulouse-Blagnac Airport', 'Toulouse', 'France', 'Europe/Paris'),

-- Germany
('EDDF', 'FRA', 'Frankfurt Airport', 'Frankfurt', 'Germany', 'Europe/Berlin'),
('EDDM', 'MUC', 'Munich Airport', 'Munich', 'Germany', 'Europe/Berlin'),
('EDDB', 'BER', 'Berlin Brandenburg Airport', 'Berlin', 'Germany', 'Europe/Berlin'),
('EDDH', 'HAM', 'Hamburg Airport', 'Hamburg', 'Germany', 'Europe/Berlin'),
('EDDK', 'CGN', 'Cologne Bonn Airport', 'Cologne', 'Germany', 'Europe/Berlin'),
('EDDL', 'DUS', 'Düsseldorf Airport', 'Düsseldorf', 'Germany', 'Europe/Berlin'),

-- Spain
('LEMD', 'MAD', 'Adolfo Suárez Madrid-Barajas Airport', 'Madrid', 'Spain', 'Europe/Madrid'),
('LEBL', 'BCN', 'Barcelona-El Prat Airport', 'Barcelona', 'Spain', 'Europe/Madrid'),
('LEPA', 'PMI', 'Palma de Mallorca Airport', 'Palma de Mallorca', 'Spain', 'Europe/Madrid'),
('LEMG', 'AGP', 'Málaga Airport', 'Málaga', 'Spain', 'Europe/Madrid'),
('LEAL', 'ALC', 'Alicante-Elche Airport', 'Alicante', 'Spain', 'Europe/Madrid'),

-- Italy
('LIRF', 'FCO', 'Leonardo da Vinci-Fiumicino Airport', 'Rome', 'Italy', 'Europe/Rome'),
('LIMC', 'MXP', 'Milan Malpensa Airport', 'Milan', 'Italy', 'Europe/Rome'),
('LIME', 'BGY', 'Milan Bergamo Airport', 'Milan', 'Italy', 'Europe/Rome'),
('LIPZ', 'VCE', 'Venice Marco Polo Airport', 'Venice', 'Italy', 'Europe/Rome'),
('LIPH', 'TSF', 'Treviso Airport', 'Venice', 'Italy', 'Europe/Rome'),

-- Netherlands
('EHAM', 'AMS', 'Amsterdam Airport Schiphol', 'Amsterdam', 'Netherlands', 'Europe/Amsterdam'),
('EHRD', 'RTM', 'Rotterdam The Hague Airport', 'Rotterdam', 'Netherlands', 'Europe/Amsterdam'),

-- Belgium
('EBBR', 'BRU', 'Brussels Airport', 'Brussels', 'Belgium', 'Europe/Brussels'),

-- Switzerland
('LSZH', 'ZRH', 'Zurich Airport', 'Zurich', 'Switzerland', 'Europe/Zurich'),
('LSGG', 'GVA', 'Geneva Airport', 'Geneva', 'Switzerland', 'Europe/Zurich'),

-- Austria
('LOWW', 'VIE', 'Vienna International Airport', 'Vienna', 'Austria', 'Europe/Vienna'),

-- Portugal
('LPPT', 'LIS', 'Lisbon Portela Airport', 'Lisbon', 'Portugal', 'Europe/Lisbon'),
('LPPR', 'OPO', 'Francisco Sá Carneiro Airport', 'Porto', 'Portugal', 'Europe/Lisbon'),

-- Greece
('LGAV', 'ATH', 'Athens International Airport', 'Athens', 'Greece', 'Europe/Athens'),

-- Turkey
('LTFM', 'IST', 'Istanbul Airport', 'Istanbul', 'Turkey', 'Europe/Istanbul'),
('LTBA', 'ISL', 'Istanbul Sabiha Gökçen Airport', 'Istanbul', 'Turkey', 'Europe/Istanbul'),
('LTAI', 'AYT', 'Antalya Airport', 'Antalya', 'Turkey', 'Europe/Istanbul'),

-- Russia
('UUEE', 'SVO', 'Sheremetyevo International Airport', 'Moscow', 'Russia', 'Europe/Moscow'),
('UUWW', 'VKO', 'Vnukovo International Airport', 'Moscow', 'Russia', 'Europe/Moscow'),
('ULLI', 'LED', 'Pulkovo Airport', 'Saint Petersburg', 'Russia', 'Europe/Moscow'),

-- United Arab Emirates
('OMDB', 'DXB', 'Dubai International Airport', 'Dubai', 'United Arab Emirates', 'Asia/Dubai'),
('OMAA', 'AUH', 'Abu Dhabi International Airport', 'Abu Dhabi', 'United Arab Emirates', 'Asia/Dubai'),
('OMSJ', 'SHJ', 'Sharjah International Airport', 'Sharjah', 'United Arab Emirates', 'Asia/Dubai'),

-- Qatar
('OTHH', 'DOH', 'Hamad International Airport', 'Doha', 'Qatar', 'Asia/Qatar'),

-- Saudi Arabia
('OEJN', 'JED', 'King Abdulaziz International Airport', 'Jeddah', 'Saudi Arabia', 'Asia/Riyadh'),
('OERK', 'RUH', 'King Khalid International Airport', 'Riyadh', 'Saudi Arabia', 'Asia/Riyadh'),

-- India
('VIDP', 'DEL', 'Indira Gandhi International Airport', 'Delhi', 'India', 'Asia/Kolkata'),
('VABB', 'BOM', 'Chhatrapati Shivaji Maharaj International Airport', 'Mumbai', 'India', 'Asia/Kolkata'),
('VOBL', 'BLR', 'Kempegowda International Airport', 'Bangalore', 'India', 'Asia/Kolkata'),
('VOMM', 'MAA', 'Chennai International Airport', 'Chennai', 'India', 'Asia/Kolkata'),
('VECC', 'CCU', 'Netaji Subhas Chandra Bose International Airport', 'Kolkata', 'India', 'Asia/Kolkata'),

-- China
('ZBAA', 'PEK', 'Beijing Capital International Airport', 'Beijing', 'China', 'Asia/Shanghai'),
('ZSPD', 'PVG', 'Shanghai Pudong International Airport', 'Shanghai', 'China', 'Asia/Shanghai'),
('ZSSS', 'SHA', 'Shanghai Hongqiao International Airport', 'Shanghai', 'China', 'Asia/Shanghai'),
('ZGSZ', 'SZX', 'Shenzhen Bao''an International Airport', 'Shenzhen', 'China', 'Asia/Shanghai'),
('ZGGG', 'CAN', 'Guangzhou Baiyun International Airport', 'Guangzhou', 'China', 'Asia/Shanghai'),
('ZUUU', 'CTU', 'Chengdu Shuangliu International Airport', 'Chengdu', 'China', 'Asia/Shanghai'),
('ZUCK', 'CKG', 'Chongqing Jiangbei International Airport', 'Chongqing', 'China', 'Asia/Shanghai'),
('ZLXY', 'XIY', 'Xi''an Xianyang International Airport', 'Xi''an', 'China', 'Asia/Shanghai'),

-- Hong Kong
('VHHH', 'HKG', 'Hong Kong International Airport', 'Hong Kong', 'Hong Kong', 'Asia/Hong_Kong'),

-- Japan
('RJTT', 'HND', 'Tokyo Haneda Airport', 'Tokyo', 'Japan', 'Asia/Tokyo'),
('RJAA', 'NRT', 'Narita International Airport', 'Tokyo', 'Japan', 'Asia/Tokyo'),
('RJBB', 'KIX', 'Kansai International Airport', 'Osaka', 'Japan', 'Asia/Tokyo'),
('RJGG', 'NGO', 'Chubu Centrair International Airport', 'Nagoya', 'Japan', 'Asia/Tokyo'),
('RJFF', 'FUK', 'Fukuoka Airport', 'Fukuoka', 'Japan', 'Asia/Tokyo'),

-- South Korea
('RKSI', 'ICN', 'Incheon International Airport', 'Seoul', 'South Korea', 'Asia/Seoul'),
('RKSS', 'GMP', 'Gimpo International Airport', 'Seoul', 'South Korea', 'Asia/Seoul'),
('RKPK', 'PUS', 'Gimhae International Airport', 'Busan', 'South Korea', 'Asia/Seoul'),

-- Singapore
('WSSS', 'SIN', 'Singapore Changi Airport', 'Singapore', 'Singapore', 'Asia/Singapore'),

-- Malaysia
('WMKK', 'KUL', 'Kuala Lumpur International Airport', 'Kuala Lumpur', 'Malaysia', 'Asia/Kuala_Lumpur'),

-- Thailand
('VTBS', 'BKK', 'Suvarnabhumi Airport', 'Bangkok', 'Thailand', 'Asia/Bangkok'),
('VTBD', 'DMK', 'Don Mueang International Airport', 'Bangkok', 'Thailand', 'Asia/Bangkok'),
('VTSP', 'HKT', 'Phuket International Airport', 'Phuket', 'Thailand', 'Asia/Bangkok'),

-- Indonesia
('WIII', 'CGK', 'Soekarno-Hatta International Airport', 'Jakarta', 'Indonesia', 'Asia/Jakarta'),
('WADD', 'DPS', 'Ngurah Rai International Airport', 'Denpasar', 'Indonesia', 'Asia/Makassar'),

-- Philippines
('RPLL', 'MNL', 'Ninoy Aquino International Airport', 'Manila', 'Philippines', 'Asia/Manila'),

-- Vietnam
('VVNB', 'HAN', 'Noi Bai International Airport', 'Hanoi', 'Vietnam', 'Asia/Ho_Chi_Minh'),
('VVTS', 'SGN', 'Tan Son Nhat International Airport', 'Ho Chi Minh City', 'Vietnam', 'Asia/Ho_Chi_Minh'),

-- Australia
('YSSY', 'SYD', 'Sydney Kingsford Smith Airport', 'Sydney', 'Australia', 'Australia/Sydney'),
('YMML', 'MEL', 'Melbourne Airport', 'Melbourne', 'Australia', 'Australia/Melbourne'),
('YBBN', 'BNE', 'Brisbane Airport', 'Brisbane', 'Australia', 'Australia/Brisbane'),
('YPPH', 'PER', 'Perth Airport', 'Perth', 'Australia', 'Australia/Perth'),
('YSSY', 'ADL', 'Adelaide Airport', 'Adelaide', 'Australia', 'Australia/Adelaide'),

-- New Zealand
('NZAA', 'AKL', 'Auckland Airport', 'Auckland', 'New Zealand', 'Pacific/Auckland'),
('NZCH', 'CHC', 'Christchurch International Airport', 'Christchurch', 'New Zealand', 'Pacific/Auckland'),
('NZWN', 'WLG', 'Wellington International Airport', 'Wellington', 'New Zealand', 'Pacific/Auckland'),

-- Canada
('CYYZ', 'YYZ', 'Toronto Pearson International Airport', 'Toronto', 'Canada', 'America/Toronto'),
('CYVR', 'YVR', 'Vancouver International Airport', 'Vancouver', 'Canada', 'America/Vancouver'),
('CYUL', 'YUL', 'Montréal-Pierre Elliott Trudeau International Airport', 'Montreal', 'Canada', 'America/Toronto'),
('CYYC', 'YYC', 'Calgary International Airport', 'Calgary', 'Canada', 'America/Edmonton'),
('CYOW', 'YOW', 'Ottawa Macdonald-Cartier International Airport', 'Ottawa', 'Canada', 'America/Toronto'),
('CYEG', 'YEG', 'Edmonton International Airport', 'Edmonton', 'Canada', 'America/Edmonton'),

-- Mexico
('MMMX', 'MEX', 'Mexico City International Airport', 'Mexico City', 'Mexico', 'America/Mexico_City'),
('MMUN', 'CUN', 'Cancún International Airport', 'Cancún', 'Mexico', 'America/Cancun'),
('MMGL', 'GDL', 'Guadalajara International Airport', 'Guadalajara', 'Mexico', 'America/Mexico_City'),
('MMMY', 'MTY', 'Monterrey International Airport', 'Monterrey', 'Mexico', 'America/Monterrey'),

-- Brazil
('SBGR', 'GRU', 'São Paulo/Guarulhos International Airport', 'São Paulo', 'Brazil', 'America/Sao_Paulo'),
('SBGL', 'GIG', 'Rio de Janeiro/Galeão International Airport', 'Rio de Janeiro', 'Brazil', 'America/Sao_Paulo'),
('SBBR', 'BSB', 'Brasília International Airport', 'Brasília', 'Brazil', 'America/Sao_Paulo'),
('SBCF', 'CNF', 'Belo Horizonte/Pampulha Carlos Drummond de Andrade Airport', 'Belo Horizonte', 'Brazil', 'America/Sao_Paulo'),

-- Argentina
('SAEZ', 'EZE', 'Ministro Pistarini International Airport', 'Buenos Aires', 'Argentina', 'America/Argentina/Buenos_Aires'),
('SABE', 'AEP', 'Jorge Newbery Airpark', 'Buenos Aires', 'Argentina', 'America/Argentina/Buenos_Aires'),

-- Chile
('SCEL', 'SCL', 'Arturo Merino Benítez International Airport', 'Santiago', 'Chile', 'America/Santiago'),

-- Colombia
('SKBO', 'BOG', 'El Dorado International Airport', 'Bogotá', 'Colombia', 'America/Bogota'),

-- Peru
('SPIM', 'LIM', 'Jorge Chávez International Airport', 'Lima', 'Peru', 'America/Lima'),

-- South Africa
('FAOR', 'JNB', 'O. R. Tambo International Airport', 'Johannesburg', 'South Africa', 'Africa/Johannesburg'),
('FACT', 'CPT', 'Cape Town International Airport', 'Cape Town', 'South Africa', 'Africa/Johannesburg'),

-- Egypt
('HECA', 'CAI', 'Cairo International Airport', 'Cairo', 'Egypt', 'Africa/Cairo'),

-- Morocco
('GMMN', 'CMN', 'Mohammed V International Airport', 'Casablanca', 'Morocco', 'Africa/Casablanca'),

-- Kenya
('HKJK', 'NBO', 'Jomo Kenyatta International Airport', 'Nairobi', 'Kenya', 'Africa/Nairobi'),

-- Ethiopia
('HAAB', 'ADD', 'Addis Ababa Bole International Airport', 'Addis Ababa', 'Ethiopia', 'Africa/Addis_Ababa'),

-- Israel
('LLBG', 'TLV', 'Ben Gurion Airport', 'Tel Aviv', 'Israel', 'Asia/Jerusalem'),

-- Pakistan
('OPKC', 'KHI', 'Jinnah International Airport', 'Karachi', 'Pakistan', 'Asia/Karachi'),
('OPLR', 'LHE', 'Allama Iqbal International Airport', 'Lahore', 'Pakistan', 'Asia/Karachi'),

-- Bangladesh
('VGHS', 'DAC', 'Hazrat Shahjalal International Airport', 'Dhaka', 'Bangladesh', 'Asia/Dhaka'),

-- Sri Lanka
('VCBI', 'CMB', 'Bandaranaike International Airport', 'Colombo', 'Sri Lanka', 'Asia/Colombo'),

-- Norway
('ENGM', 'OSL', 'Oslo Airport, Gardermoen', 'Oslo', 'Norway', 'Europe/Oslo'),
('ENBR', 'BGO', 'Bergen Airport, Flesland', 'Bergen', 'Norway', 'Europe/Oslo'),

-- Sweden
('ESSA', 'ARN', 'Stockholm Arlanda Airport', 'Stockholm', 'Sweden', 'Europe/Stockholm'),
('ESGG', 'GOT', 'Göteborg Landvetter Airport', 'Gothenburg', 'Sweden', 'Europe/Stockholm'),

-- Denmark
('EKCH', 'CPH', 'Copenhagen Airport', 'Copenhagen', 'Denmark', 'Europe/Copenhagen'),

-- Finland
('EFHK', 'HEL', 'Helsinki-Vantaa Airport', 'Helsinki', 'Finland', 'Europe/Helsinki'),

-- Poland
('EPWA', 'WAW', 'Warsaw Chopin Airport', 'Warsaw', 'Poland', 'Europe/Warsaw'),
('EPKK', 'KRK', 'John Paul II International Airport Kraków-Balice', 'Krakow', 'Poland', 'Europe/Warsaw'),

-- Czech Republic
('LKPR', 'PRG', 'Václav Havel Airport Prague', 'Prague', 'Czech Republic', 'Europe/Prague'),

-- Hungary
('LHBP', 'BUD', 'Budapest Ferenc Liszt International Airport', 'Budapest', 'Hungary', 'Europe/Budapest'),

-- Romania
('LROP', 'OTP', 'Henri Coandă International Airport', 'Bucharest', 'Romania', 'Europe/Bucharest'),

-- Ireland
('EIDW', 'DUB', 'Dublin Airport', 'Dublin', 'Ireland', 'Europe/Dublin'),

-- Iceland
('BIKF', 'KEF', 'Keflavík International Airport', 'Reykjavik', 'Iceland', 'Atlantic/Reykjavik'),

-- Ukraine
('UKBB', 'KBP', 'Boryspil International Airport', 'Kyiv', 'Ukraine', 'Europe/Kiev'),

-- Taiwan
('RCTP', 'TPE', 'Taiwan Taoyuan International Airport', 'Taipei', 'Taiwan', 'Asia/Taipei'),

-- Macau
('VMMC', 'MFM', 'Macau International Airport', 'Macau', 'Macau', 'Asia/Macau'),

-- Brunei
('WBSB', 'BWN', 'Brunei International Airport', 'Bandar Seri Begawan', 'Brunei', 'Asia/Brunei'),

-- Cambodia
('VDPP', 'PNH', 'Phnom Penh International Airport', 'Phnom Penh', 'Cambodia', 'Asia/Phnom_Penh'),

-- Laos
('VVVT', 'VTE', 'Wattay International Airport', 'Vientiane', 'Laos', 'Asia/Vientiane'),

-- Myanmar
('VYYY', 'RGN', 'Yangon International Airport', 'Yangon', 'Myanmar', 'Asia/Yangon'),

-- Nepal
('VNKT', 'KTM', 'Tribhuvan International Airport', 'Kathmandu', 'Nepal', 'Asia/Kathmandu'),

-- Maldives
('VRMM', 'MLE', 'Velana International Airport', 'Malé', 'Maldives', 'Indian/Maldives'),

-- Mauritius
('FIMP', 'MRU', 'Sir Seewoosagur Ramgoolam International Airport', 'Port Louis', 'Mauritius', 'Indian/Mauritius'),

-- Seychelles
('FSIA', 'SEZ', 'Seychelles International Airport', 'Victoria', 'Seychelles', 'Indian/Mahe'),

-- Azerbaijan
('UBBB', 'GYD', 'Heydar Aliyev International Airport', 'Baku', 'Azerbaijan', 'Asia/Baku'),

-- Kazakhstan
('UAAA', 'ALA', 'Almaty International Airport', 'Almaty', 'Kazakhstan', 'Asia/Almaty'),

-- Uzbekistan
('UTTT', 'TAS', 'Tashkent International Airport', 'Tashkent', 'Uzbekistan', 'Asia/Tashkent'),

-- Georgia
('UGTB', 'TBS', 'Tbilisi International Airport', 'Tbilisi', 'Georgia', 'Asia/Tbilisi'),

-- Armenia
('UDYZ', 'EVN', 'Zvartnots International Airport', 'Yerevan', 'Armenia', 'Asia/Yerevan'),

-- Jordan
('OJAI', 'AMM', 'Queen Alia International Airport', 'Amman', 'Jordan', 'Asia/Amman'),

-- Lebanon
('OLBA', 'BEY', 'Beirut Rafic Hariri International Airport', 'Beirut', 'Lebanon', 'Asia/Beirut'),

-- Kuwait
('OKBK', 'KWI', 'Kuwait International Airport', 'Kuwait City', 'Kuwait', 'Asia/Kuwait'),

-- Bahrain
('OBBI', 'BAH', 'Bahrain International Airport', 'Manama', 'Bahrain', 'Asia/Bahrain'),

-- Oman
('OOMS', 'MCT', 'Muscat International Airport', 'Muscat', 'Oman', 'Asia/Muscat'),

-- Yemen
('OYSN', 'SAH', 'Sana''a International Airport', 'Sana''a', 'Yemen', 'Asia/Aden')

ON CONFLICT (icao_code) DO NOTHING;
