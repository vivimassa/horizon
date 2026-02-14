import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function seedDatabase() {
  console.log('🌱 Starting database seeding with correct schema...\n')

  try {
    // 1. Create/Update Operator
    console.log('📋 Creating/Updating operator HZN...')
    const { data: existingOp, error: checkOpError } = await supabase
      .from('operators')
      .select('id')
      .eq('code', 'HZN')
      .single()

    let operatorId: string

    if (existingOp) {
      operatorId = existingOp.id
      const { error } = await supabase
        .from('operators')
        .update({
          code: 'HZN',
          iata_code: 'HZ',
          name: 'Horizon Airlines',
          country: 'Vietnam',
          regulatory_authority: 'CAAV',
          timezone: 'Asia/Ho_Chi_Minh',
          enabled_modules: ['platform', 'network', 'operations', 'workforce']
        })
        .eq('id', operatorId)

      if (error) console.error('   ❌ Error updating operator:', error.message)
      else console.log('   ✅ Operator updated')
    } else {
      const { data, error } = await supabase
        .from('operators')
        .insert({
          code: 'HZN',
          iata_code: 'HZ',
          name: 'Horizon Airlines',
          country: 'Vietnam',
          regulatory_authority: 'CAAV',
          timezone: 'Asia/Ho_Chi_Minh',
          enabled_modules: ['platform', 'network', 'operations', 'workforce']
        })
        .select('id')
        .single()

      if (error) {
        console.error('   ❌ Error creating operator:', error.message)
        console.log('   ⚠️  Cannot continue without operator. Exiting.')
        return
      }
      operatorId = data.id
      console.log('   ✅ Operator created')
    }

    // 2. Seed Countries
    console.log('\n🌍 Seeding countries...')
    const countries = [
      // ASEAN
      { iso_code_2: 'VN', iso_code_3: 'VNM', name: 'Vietnam', region: 'Southeast Asia', icao_prefix: 'VV' },
      { iso_code_2: 'TH', iso_code_3: 'THA', name: 'Thailand', region: 'Southeast Asia', icao_prefix: 'VT' },
      { iso_code_2: 'SG', iso_code_3: 'SGP', name: 'Singapore', region: 'Southeast Asia', icao_prefix: 'WS' },
      { iso_code_2: 'MY', iso_code_3: 'MYS', name: 'Malaysia', region: 'Southeast Asia', icao_prefix: 'WM' },
      { iso_code_2: 'ID', iso_code_3: 'IDN', name: 'Indonesia', region: 'Southeast Asia', icao_prefix: 'WI' },
      { iso_code_2: 'PH', iso_code_3: 'PHL', name: 'Philippines', region: 'Southeast Asia', icao_prefix: 'RP' },
      { iso_code_2: 'MM', iso_code_3: 'MMR', name: 'Myanmar', region: 'Southeast Asia', icao_prefix: 'VY' },
      { iso_code_2: 'KH', iso_code_3: 'KHM', name: 'Cambodia', region: 'Southeast Asia', icao_prefix: 'VD' },
      { iso_code_2: 'LA', iso_code_3: 'LAO', name: 'Laos', region: 'Southeast Asia', icao_prefix: 'VL' },
      { iso_code_2: 'BN', iso_code_3: 'BRN', name: 'Brunei', region: 'Southeast Asia', icao_prefix: 'WB' },
      // East Asia
      { iso_code_2: 'JP', iso_code_3: 'JPN', name: 'Japan', region: 'East Asia', icao_prefix: 'RJ' },
      { iso_code_2: 'KR', iso_code_3: 'KOR', name: 'South Korea', region: 'East Asia', icao_prefix: 'RK' },
      { iso_code_2: 'CN', iso_code_3: 'CHN', name: 'China', region: 'East Asia', icao_prefix: 'ZB' },
      { iso_code_2: 'TW', iso_code_3: 'TWN', name: 'Taiwan', region: 'East Asia', icao_prefix: 'RC' },
      { iso_code_2: 'HK', iso_code_3: 'HKG', name: 'Hong Kong', region: 'East Asia', icao_prefix: 'VH' },
      { iso_code_2: 'MO', iso_code_3: 'MAC', name: 'Macau', region: 'East Asia', icao_prefix: 'VM' },
      // South Asia
      { iso_code_2: 'IN', iso_code_3: 'IND', name: 'India', region: 'South Asia', icao_prefix: 'VI' },
      { iso_code_2: 'PK', iso_code_3: 'PAK', name: 'Pakistan', region: 'South Asia', icao_prefix: 'OP' },
      { iso_code_2: 'BD', iso_code_3: 'BGD', name: 'Bangladesh', region: 'South Asia', icao_prefix: 'VG' },
      { iso_code_2: 'LK', iso_code_3: 'LKA', name: 'Sri Lanka', region: 'South Asia', icao_prefix: 'VC' },
      { iso_code_2: 'NP', iso_code_3: 'NPL', name: 'Nepal', region: 'South Asia', icao_prefix: 'VN' },
      // Oceania
      { iso_code_2: 'AU', iso_code_3: 'AUS', name: 'Australia', region: 'Oceania', icao_prefix: 'YM' },
      { iso_code_2: 'NZ', iso_code_3: 'NZL', name: 'New Zealand', region: 'Oceania', icao_prefix: 'NZ' },
      // Middle East
      { iso_code_2: 'AE', iso_code_3: 'ARE', name: 'United Arab Emirates', region: 'Middle East', icao_prefix: 'OM' },
      { iso_code_2: 'QA', iso_code_3: 'QAT', name: 'Qatar', region: 'Middle East', icao_prefix: 'OT' },
      { iso_code_2: 'SA', iso_code_3: 'SAU', name: 'Saudi Arabia', region: 'Middle East', icao_prefix: 'OE' },
      { iso_code_2: 'TR', iso_code_3: 'TUR', name: 'Turkey', region: 'Middle East', icao_prefix: 'LT' },
      // Europe
      { iso_code_2: 'GB', iso_code_3: 'GBR', name: 'United Kingdom', region: 'Europe', icao_prefix: 'EG' },
      { iso_code_2: 'FR', iso_code_3: 'FRA', name: 'France', region: 'Europe', icao_prefix: 'LF' },
      { iso_code_2: 'DE', iso_code_3: 'DEU', name: 'Germany', region: 'Europe', icao_prefix: 'ED' },
      { iso_code_2: 'NL', iso_code_3: 'NLD', name: 'Netherlands', region: 'Europe', icao_prefix: 'EH' },
      { iso_code_2: 'IT', iso_code_3: 'ITA', name: 'Italy', region: 'Europe', icao_prefix: 'LI' },
      { iso_code_2: 'ES', iso_code_3: 'ESP', name: 'Spain', region: 'Europe', icao_prefix: 'LE' },
      { iso_code_2: 'CH', iso_code_3: 'CHE', name: 'Switzerland', region: 'Europe', icao_prefix: 'LS' },
      { iso_code_2: 'AT', iso_code_3: 'AUT', name: 'Austria', region: 'Europe', icao_prefix: 'LO' },
      { iso_code_2: 'RU', iso_code_3: 'RUS', name: 'Russia', region: 'Europe', icao_prefix: 'UU' },
      // Americas
      { iso_code_2: 'US', iso_code_3: 'USA', name: 'United States', region: 'North America', icao_prefix: 'K' },
      { iso_code_2: 'CA', iso_code_3: 'CAN', name: 'Canada', region: 'North America', icao_prefix: 'C' },
      { iso_code_2: 'MX', iso_code_3: 'MEX', name: 'Mexico', region: 'North America', icao_prefix: 'MM' },
      { iso_code_2: 'BR', iso_code_3: 'BRA', name: 'Brazil', region: 'South America', icao_prefix: 'SB' },
      { iso_code_2: 'AR', iso_code_3: 'ARG', name: 'Argentina', region: 'South America', icao_prefix: 'SA' },
      { iso_code_2: 'CL', iso_code_3: 'CHL', name: 'Chile', region: 'South America', icao_prefix: 'SC' },
      // Africa
      { iso_code_2: 'ZA', iso_code_3: 'ZAF', name: 'South Africa', region: 'Africa', icao_prefix: 'FA' },
      { iso_code_2: 'EG', iso_code_3: 'EGY', name: 'Egypt', region: 'Africa', icao_prefix: 'HE' },
      { iso_code_2: 'KE', iso_code_3: 'KEN', name: 'Kenya', region: 'Africa', icao_prefix: 'HK' },
      { iso_code_2: 'NG', iso_code_3: 'NGA', name: 'Nigeria', region: 'Africa', icao_prefix: 'DN' },
      { iso_code_2: 'MA', iso_code_3: 'MAR', name: 'Morocco', region: 'Africa', icao_prefix: 'GM' },
      { iso_code_2: 'ET', iso_code_3: 'ETH', name: 'Ethiopia', region: 'Africa', icao_prefix: 'HA' },
    ]

    for (const country of countries) {
      const { error } = await supabase
        .from('countries')
        .upsert(country, { onConflict: 'iso_code_2', ignoreDuplicates: false })

      if (error) {
        console.error(`   ❌ Error inserting ${country.name}:`, error.message)
        break
      }
    }
    console.log(`   ✅ Seeded ${countries.length} countries`)

    // Get country IDs for use in airports
    const { data: countriesData } = await supabase
      .from('countries')
      .select('id, iso_code_2')

    const countryMap = new Map(countriesData?.map(c => [c.iso_code_2, c.id]))

    // 3. Seed Airports
    console.log('\n✈️  Seeding airports...')
    const airports = [
      // Vietnam Airports
      { icao_code: 'VVTS', iata_code: 'SGN', name: 'Tan Son Nhat International Airport', city: 'Ho Chi Minh City', country: 'Vietnam', country_id: countryMap.get('VN'), timezone: 'Asia/Ho_Chi_Minh', latitude: 10.8188, longitude: 106.6519 },
      { icao_code: 'VVNB', iata_code: 'HAN', name: 'Noi Bai International Airport', city: 'Hanoi', country: 'Vietnam', country_id: countryMap.get('VN'), timezone: 'Asia/Ho_Chi_Minh', latitude: 21.2212, longitude: 105.8072 },
      { icao_code: 'VVDN', iata_code: 'DAD', name: 'Da Nang International Airport', city: 'Da Nang', country: 'Vietnam', country_id: countryMap.get('VN'), timezone: 'Asia/Ho_Chi_Minh', latitude: 16.0439, longitude: 108.1994 },
      { icao_code: 'VVCR', iata_code: 'CXR', name: 'Cam Ranh International Airport', city: 'Nha Trang', country: 'Vietnam', country_id: countryMap.get('VN'), timezone: 'Asia/Ho_Chi_Minh', latitude: 11.9982, longitude: 109.2194 },
      { icao_code: 'VVPQ', iata_code: 'PQC', name: 'Phu Quoc International Airport', city: 'Phu Quoc', country: 'Vietnam', country_id: countryMap.get('VN'), timezone: 'Asia/Ho_Chi_Minh', latitude: 10.1698, longitude: 103.9931 },
      { icao_code: 'VVVD', iata_code: 'VDO', name: 'Van Don International Airport', city: 'Quang Ninh', country: 'Vietnam', country_id: countryMap.get('VN'), timezone: 'Asia/Ho_Chi_Minh', latitude: 21.1197, longitude: 107.4167 },
      { icao_code: 'VVCI', iata_code: 'HPH', name: 'Cat Bi International Airport', city: 'Hai Phong', country: 'Vietnam', country_id: countryMap.get('VN'), timezone: 'Asia/Ho_Chi_Minh', latitude: 20.8194, longitude: 106.7250 },
      { icao_code: 'VVVT', iata_code: 'VII', name: 'Vinh International Airport', city: 'Vinh', country: 'Vietnam', country_id: countryMap.get('VN'), timezone: 'Asia/Ho_Chi_Minh', latitude: 18.7378, longitude: 105.6708 },
      { icao_code: 'VVPB', iata_code: 'HUI', name: 'Phu Bai International Airport', city: 'Hue', country: 'Vietnam', country_id: countryMap.get('VN'), timezone: 'Asia/Ho_Chi_Minh', latitude: 16.4015, longitude: 107.7033 },
      { icao_code: 'VVBM', iata_code: 'BMV', name: 'Buon Ma Thuot Airport', city: 'Buon Ma Thuot', country: 'Vietnam', country_id: countryMap.get('VN'), timezone: 'Asia/Ho_Chi_Minh', latitude: 12.6683, longitude: 108.1203 },
      { icao_code: 'VVCA', iata_code: 'VCA', name: 'Can Tho International Airport', city: 'Can Tho', country: 'Vietnam', country_id: countryMap.get('VN'), timezone: 'Asia/Ho_Chi_Minh', latitude: 10.0851, longitude: 105.7119 },
      { icao_code: 'VVPC', iata_code: 'UIH', name: 'Phu Cat Airport', city: 'Quy Nhon', country: 'Vietnam', country_id: countryMap.get('VN'), timezone: 'Asia/Ho_Chi_Minh', latitude: 13.9550, longitude: 109.0422 },
      { icao_code: 'VVTH', iata_code: 'TBB', name: 'Dong Tac Airport', city: 'Tuy Hoa', country: 'Vietnam', country_id: countryMap.get('VN'), timezone: 'Asia/Ho_Chi_Minh', latitude: 13.0496, longitude: 109.3336 },
      { icao_code: 'VVDL', iata_code: 'DLI', name: 'Lien Khuong Airport', city: 'Da Lat', country: 'Vietnam', country_id: countryMap.get('VN'), timezone: 'Asia/Ho_Chi_Minh', latitude: 11.7500, longitude: 108.3667 },
      { icao_code: 'VVCS', iata_code: 'VCS', name: 'Co Ong Airport', city: 'Con Dao', country: 'Vietnam', country_id: countryMap.get('VN'), timezone: 'Asia/Ho_Chi_Minh', latitude: 8.7318, longitude: 106.6328 },
      { icao_code: 'VVCL', iata_code: 'VCL', name: 'Chu Lai International Airport', city: 'Tam Ky', country: 'Vietnam', country_id: countryMap.get('VN'), timezone: 'Asia/Ho_Chi_Minh', latitude: 15.4061, longitude: 108.7064 },
      { icao_code: 'VVTD', iata_code: 'THD', name: 'Tho Xuan Airport', city: 'Thanh Hoa', country: 'Vietnam', country_id: countryMap.get('VN'), timezone: 'Asia/Ho_Chi_Minh', latitude: 19.9017, longitude: 105.4681 },
      { icao_code: 'VVPK', iata_code: 'VKG', name: 'Rach Gia Airport', city: 'Rach Gia', country: 'Vietnam', country_id: countryMap.get('VN'), timezone: 'Asia/Ho_Chi_Minh', latitude: 9.9579, longitude: 105.1324 },
      { icao_code: 'VVDB', iata_code: 'DIN', name: 'Dien Bien Phu Airport', city: 'Dien Bien Phu', country: 'Vietnam', country_id: countryMap.get('VN'), timezone: 'Asia/Ho_Chi_Minh', latitude: 21.3975, longitude: 103.0078 },
      { icao_code: 'VVPL', iata_code: 'PXU', name: 'Pleiku Airport', city: 'Pleiku', country: 'Vietnam', country_id: countryMap.get('VN'), timezone: 'Asia/Ho_Chi_Minh', latitude: 14.0045, longitude: 108.0170 },
      // Thailand
      { icao_code: 'VTBS', iata_code: 'BKK', name: 'Suvarnabhumi Airport', city: 'Bangkok', country: 'Thailand', country_id: countryMap.get('TH'), timezone: 'Asia/Bangkok', latitude: 13.6900, longitude: 100.7501 },
      { icao_code: 'VTBD', iata_code: 'DMK', name: 'Don Mueang International Airport', city: 'Bangkok', country: 'Thailand', country_id: countryMap.get('TH'), timezone: 'Asia/Bangkok', latitude: 13.9126, longitude: 100.6069 },
      { icao_code: 'VTSP', iata_code: 'HKT', name: 'Phuket International Airport', city: 'Phuket', country: 'Thailand', country_id: countryMap.get('TH'), timezone: 'Asia/Bangkok', latitude: 8.1132, longitude: 98.3169 },
      { icao_code: 'VTCC', iata_code: 'CNX', name: 'Chiang Mai International Airport', city: 'Chiang Mai', country: 'Thailand', country_id: countryMap.get('TH'), timezone: 'Asia/Bangkok', latitude: 18.7668, longitude: 98.9625 },
      { icao_code: 'VTSS', iata_code: 'USM', name: 'Samui Airport', city: 'Ko Samui', country: 'Thailand', country_id: countryMap.get('TH'), timezone: 'Asia/Bangkok', latitude: 9.5479, longitude: 100.0623 },
      // Singapore
      { icao_code: 'WSSS', iata_code: 'SIN', name: 'Singapore Changi Airport', city: 'Singapore', country: 'Singapore', country_id: countryMap.get('SG'), timezone: 'Asia/Singapore', latitude: 1.3644, longitude: 103.9915 },
      // Malaysia
      { icao_code: 'WMKK', iata_code: 'KUL', name: 'Kuala Lumpur International Airport', city: 'Kuala Lumpur', country: 'Malaysia', country_id: countryMap.get('MY'), timezone: 'Asia/Kuala_Lumpur', latitude: 2.7456, longitude: 101.7099 },
      { icao_code: 'WMKP', iata_code: 'PEN', name: 'Penang International Airport', city: 'Penang', country: 'Malaysia', country_id: countryMap.get('MY'), timezone: 'Asia/Kuala_Lumpur', latitude: 5.2971, longitude: 100.2769 },
      { icao_code: 'WBKK', iata_code: 'BKI', name: 'Kota Kinabalu International Airport', city: 'Kota Kinabalu', country: 'Malaysia', country_id: countryMap.get('MY'), timezone: 'Asia/Kuching', latitude: 5.9372, longitude: 116.0517 },
      // Philippines
      { icao_code: 'RPLL', iata_code: 'MNL', name: 'Ninoy Aquino International Airport', city: 'Manila', country: 'Philippines', country_id: countryMap.get('PH'), timezone: 'Asia/Manila', latitude: 14.5086, longitude: 121.0194 },
      { icao_code: 'RPVM', iata_code: 'CEB', name: 'Mactan-Cebu International Airport', city: 'Cebu', country: 'Philippines', country_id: countryMap.get('PH'), timezone: 'Asia/Manila', latitude: 10.3075, longitude: 123.9792 },
      // Indonesia
      { icao_code: 'WIII', iata_code: 'CGK', name: 'Soekarno-Hatta International Airport', city: 'Jakarta', country: 'Indonesia', country_id: countryMap.get('ID'), timezone: 'Asia/Jakarta', latitude: -6.1256, longitude: 106.6559 },
      { icao_code: 'WADD', iata_code: 'DPS', name: 'Ngurah Rai International Airport', city: 'Denpasar', country: 'Indonesia', country_id: countryMap.get('ID'), timezone: 'Asia/Makassar', latitude: -8.7482, longitude: 115.1672 },
      { icao_code: 'WARR', iata_code: 'SUB', name: 'Juanda International Airport', city: 'Surabaya', country: 'Indonesia', country_id: countryMap.get('ID'), timezone: 'Asia/Jakarta', latitude: -7.3798, longitude: 112.7869 },
      // Myanmar
      { icao_code: 'VYYY', iata_code: 'RGN', name: 'Yangon International Airport', city: 'Yangon', country: 'Myanmar', country_id: countryMap.get('MM'), timezone: 'Asia/Yangon', latitude: 16.9073, longitude: 96.1332 },
      // Cambodia
      { icao_code: 'VDPP', iata_code: 'PNH', name: 'Phnom Penh International Airport', city: 'Phnom Penh', country: 'Cambodia', country_id: countryMap.get('KH'), timezone: 'Asia/Phnom_Penh', latitude: 11.5466, longitude: 104.8444 },
      { icao_code: 'VDSR', iata_code: 'REP', name: 'Siem Reap International Airport', city: 'Siem Reap', country: 'Cambodia', country_id: countryMap.get('KH'), timezone: 'Asia/Phnom_Penh', latitude: 13.4107, longitude: 103.8131 },
      // Laos
      { icao_code: 'VLVT', iata_code: 'VTE', name: 'Wattay International Airport', city: 'Vientiane', country: 'Laos', country_id: countryMap.get('LA'), timezone: 'Asia/Vientiane', latitude: 17.9883, longitude: 102.5633 },
      { icao_code: 'VLLB', iata_code: 'LPQ', name: 'Luang Prabang International Airport', city: 'Luang Prabang', country: 'Laos', country_id: countryMap.get('LA'), timezone: 'Asia/Vientiane', latitude: 19.8973, longitude: 102.1608 },
      // Brunei
      { icao_code: 'WBSB', iata_code: 'BWN', name: 'Brunei International Airport', city: 'Bandar Seri Begawan', country: 'Brunei', country_id: countryMap.get('BN'), timezone: 'Asia/Brunei', latitude: 4.9442, longitude: 114.9285 },
      // Japan
      { icao_code: 'RJTT', iata_code: 'HND', name: 'Tokyo Haneda Airport', city: 'Tokyo', country: 'Japan', country_id: countryMap.get('JP'), timezone: 'Asia/Tokyo', latitude: 35.5494, longitude: 139.7798 },
      { icao_code: 'RJAA', iata_code: 'NRT', name: 'Narita International Airport', city: 'Tokyo', country: 'Japan', country_id: countryMap.get('JP'), timezone: 'Asia/Tokyo', latitude: 35.7720, longitude: 140.3929 },
      // South Korea
      { icao_code: 'RKSI', iata_code: 'ICN', name: 'Incheon International Airport', city: 'Seoul', country: 'South Korea', country_id: countryMap.get('KR'), timezone: 'Asia/Seoul', latitude: 37.4602, longitude: 126.4407 },
      // China
      { icao_code: 'ZBAA', iata_code: 'PEK', name: 'Beijing Capital International Airport', city: 'Beijing', country: 'China', country_id: countryMap.get('CN'), timezone: 'Asia/Shanghai', latitude: 40.0799, longitude: 116.6031 },
      { icao_code: 'ZSPD', iata_code: 'PVG', name: 'Shanghai Pudong International Airport', city: 'Shanghai', country: 'China', country_id: countryMap.get('CN'), timezone: 'Asia/Shanghai', latitude: 31.1443, longitude: 121.8083 },
      { icao_code: 'ZGGG', iata_code: 'CAN', name: 'Guangzhou Baiyun International Airport', city: 'Guangzhou', country: 'China', country_id: countryMap.get('CN'), timezone: 'Asia/Shanghai', latitude: 23.3924, longitude: 113.2988 },
      // Taiwan
      { icao_code: 'RCTP', iata_code: 'TPE', name: 'Taiwan Taoyuan International Airport', city: 'Taipei', country: 'Taiwan', country_id: countryMap.get('TW'), timezone: 'Asia/Taipei', latitude: 25.0777, longitude: 121.2328 },
      // Hong Kong
      { icao_code: 'VHHH', iata_code: 'HKG', name: 'Hong Kong International Airport', city: 'Hong Kong', country: 'Hong Kong', country_id: countryMap.get('HK'), timezone: 'Asia/Hong_Kong', latitude: 22.3080, longitude: 113.9185 },
      // India
      { icao_code: 'VIDP', iata_code: 'DEL', name: 'Indira Gandhi International Airport', city: 'New Delhi', country: 'India', country_id: countryMap.get('IN'), timezone: 'Asia/Kolkata', latitude: 28.5665, longitude: 77.1031 },
      { icao_code: 'VABB', iata_code: 'BOM', name: 'Chhatrapati Shivaji Maharaj International Airport', city: 'Mumbai', country: 'India', country_id: countryMap.get('IN'), timezone: 'Asia/Kolkata', latitude: 19.0896, longitude: 72.8681 },
      // Australia
      { icao_code: 'YSSY', iata_code: 'SYD', name: 'Sydney Kingsford Smith Airport', city: 'Sydney', country: 'Australia', country_id: countryMap.get('AU'), timezone: 'Australia/Sydney', latitude: -33.9461, longitude: 151.1772 },
      { icao_code: 'YMML', iata_code: 'MEL', name: 'Melbourne Airport', city: 'Melbourne', country: 'Australia', country_id: countryMap.get('AU'), timezone: 'Australia/Melbourne', latitude: -37.6733, longitude: 144.8433 },
      // New Zealand
      { icao_code: 'NZAA', iata_code: 'AKL', name: 'Auckland Airport', city: 'Auckland', country: 'New Zealand', country_id: countryMap.get('NZ'), timezone: 'Pacific/Auckland', latitude: -37.0081, longitude: 174.7850 },
      // Middle East
      { icao_code: 'OMDB', iata_code: 'DXB', name: 'Dubai International Airport', city: 'Dubai', country: 'United Arab Emirates', country_id: countryMap.get('AE'), timezone: 'Asia/Dubai', latitude: 25.2532, longitude: 55.3657 },
      { icao_code: 'OTHH', iata_code: 'DOH', name: 'Hamad International Airport', city: 'Doha', country: 'Qatar', country_id: countryMap.get('QA'), timezone: 'Asia/Qatar', latitude: 25.2731, longitude: 51.6086 },
      { icao_code: 'LTFM', iata_code: 'IST', name: 'Istanbul Airport', city: 'Istanbul', country: 'Turkey', country_id: countryMap.get('TR'), timezone: 'Europe/Istanbul', latitude: 41.2619, longitude: 28.7419 },
      // Europe
      { icao_code: 'EGLL', iata_code: 'LHR', name: 'London Heathrow Airport', city: 'London', country: 'United Kingdom', country_id: countryMap.get('GB'), timezone: 'Europe/London', latitude: 51.4700, longitude: -0.4543 },
      { icao_code: 'LFPG', iata_code: 'CDG', name: 'Charles de Gaulle Airport', city: 'Paris', country: 'France', country_id: countryMap.get('FR'), timezone: 'Europe/Paris', latitude: 49.0097, longitude: 2.5479 },
      { icao_code: 'EDDF', iata_code: 'FRA', name: 'Frankfurt Airport', city: 'Frankfurt', country: 'Germany', country_id: countryMap.get('DE'), timezone: 'Europe/Berlin', latitude: 50.0379, longitude: 8.5622 },
      { icao_code: 'EHAM', iata_code: 'AMS', name: 'Amsterdam Airport Schiphol', city: 'Amsterdam', country: 'Netherlands', country_id: countryMap.get('NL'), timezone: 'Europe/Amsterdam', latitude: 52.3105, longitude: 4.7683 },
      // North America
      { icao_code: 'KJFK', iata_code: 'JFK', name: 'John F. Kennedy International Airport', city: 'New York', country: 'United States', country_id: countryMap.get('US'), timezone: 'America/New_York', latitude: 40.6413, longitude: -73.7781 },
      { icao_code: 'KLAX', iata_code: 'LAX', name: 'Los Angeles International Airport', city: 'Los Angeles', country: 'United States', country_id: countryMap.get('US'), timezone: 'America/Los_Angeles', latitude: 33.9416, longitude: -118.4085 },
      { icao_code: 'KSFO', iata_code: 'SFO', name: 'San Francisco International Airport', city: 'San Francisco', country: 'United States', country_id: countryMap.get('US'), timezone: 'America/Los_Angeles', latitude: 37.6213, longitude: -122.3790 },
    ]

    for (const airport of airports) {
      const { error } = await supabase
        .from('airports')
        .upsert(airport, { onConflict: 'icao_code', ignoreDuplicates: false })

      if (error) {
        console.error(`   ❌ Error inserting ${airport.name}:`, error.message)
        // Continue with other airports
      }
    }
    console.log(`   ✅ Seeded ${airports.length} airports`)

    // Get airport IDs for city pairs
    const { data: airportsData } = await supabase
      .from('airports')
      .select('id, iata_code')

    const airportMap = new Map(airportsData?.map(a => [a.iata_code, a.id]))

    // 4. Seed Aircraft Types
    console.log('\n🛩️  Seeding aircraft types...')
    const aircraftTypes = [
      {
        operator_id: operatorId,
        icao_type: 'A320',
        iata_type: '320',
        name: 'Airbus A320',
        family: 'A320',
        category: 'narrow-body',
        pax_capacity: 180,
        rest_facility_class: null
      },
      {
        operator_id: operatorId,
        icao_type: 'A321',
        iata_type: '321',
        name: 'Airbus A321',
        family: 'A320',
        category: 'narrow-body',
        pax_capacity: 220,
        rest_facility_class: null
      },
      {
        operator_id: operatorId,
        icao_type: 'A333',
        iata_type: '333',
        name: 'Airbus A330-300',
        family: 'A330',
        category: 'wide-body',
        pax_capacity: 300,
        rest_facility_class: 'class_2'
      }
    ]

    for (const aircraft of aircraftTypes) {
      const { error } = await supabase
        .from('aircraft_types')
        .upsert(aircraft, { onConflict: 'icao_type,operator_id', ignoreDuplicates: false })

      if (error) {
        console.error(`   ❌ Error inserting ${aircraft.name}:`, error.message)
      }
    }
    console.log(`   ✅ Seeded ${aircraftTypes.length} aircraft types`)

    // 5. Seed Airlines
    console.log('\n✈️  Seeding airlines...')
    const airlines = [
      // Vietnamese Airlines
      { icao_code: 'HVN', iata_code: 'VN', name: 'Vietnam Airlines', country_id: countryMap.get('VN'), alliance: 'SkyTeam' },
      { icao_code: 'VJC', iata_code: 'VJ', name: 'VietJet Air', country_id: countryMap.get('VN'), alliance: 'None' },
      { icao_code: 'VBL', iata_code: 'BL', name: 'Jetstar Pacific Airlines', country_id: countryMap.get('VN'), alliance: 'None' },
      { icao_code: 'VAP', iata_code: 'QH', name: 'Bamboo Airways', country_id: countryMap.get('VN'), alliance: 'None' },
      { icao_code: 'VAG', iata_code: 'VU', name: 'Vietravel Airlines', country_id: countryMap.get('VN'), alliance: 'None' },
      // Thai Airlines
      { icao_code: 'THA', iata_code: 'TG', name: 'Thai Airways', country_id: countryMap.get('TH'), alliance: 'Star Alliance' },
      { icao_code: 'AIQ', iata_code: 'FD', name: 'Thai AirAsia', country_id: countryMap.get('TH'), alliance: 'None' },
      { icao_code: 'NOK', iata_code: 'DD', name: 'Nok Air', country_id: countryMap.get('TH'), alliance: 'None' },
      { icao_code: 'BKP', iata_code: 'PG', name: 'Bangkok Airways', country_id: countryMap.get('TH'), alliance: 'None' },
      // Singapore
      { icao_code: 'SIA', iata_code: 'SQ', name: 'Singapore Airlines', country_id: countryMap.get('SG'), alliance: 'Star Alliance' },
      { icao_code: 'SQC', iata_code: 'TR', name: 'Scoot', country_id: countryMap.get('SG'), alliance: 'None' },
      // Malaysian
      { icao_code: 'MAS', iata_code: 'MH', name: 'Malaysia Airlines', country_id: countryMap.get('MY'), alliance: 'Oneworld' },
      { icao_code: 'AXM', iata_code: 'AK', name: 'AirAsia', country_id: countryMap.get('MY'), alliance: 'None' },
      // Indonesian
      { icao_code: 'GIA', iata_code: 'GA', name: 'Garuda Indonesia', country_id: countryMap.get('ID'), alliance: 'SkyTeam' },
      { icao_code: 'LNI', iata_code: 'JT', name: 'Lion Air', country_id: countryMap.get('ID'), alliance: 'None' },
      // Philippine
      { icao_code: 'PAL', iata_code: 'PR', name: 'Philippine Airlines', country_id: countryMap.get('PH'), alliance: 'None' },
      { icao_code: 'CEB', iata_code: '5J', name: 'Cebu Pacific', country_id: countryMap.get('PH'), alliance: 'None' },
      // Other ASEAN
      { icao_code: 'UBA', iata_code: 'UB', name: 'Myanmar National Airlines', country_id: countryMap.get('MM'), alliance: 'None' },
      { icao_code: 'KMR', iata_code: 'K6', name: 'Cambodia Angkor Air', country_id: countryMap.get('KH'), alliance: 'None' },
      { icao_code: 'LAO', iata_code: 'QV', name: 'Lao Airlines', country_id: countryMap.get('LA'), alliance: 'None' },
      { icao_code: 'RBA', iata_code: 'BI', name: 'Royal Brunei Airlines', country_id: countryMap.get('BN'), alliance: 'None' },
      // East Asia
      { icao_code: 'JAL', iata_code: 'JL', name: 'Japan Airlines', country_id: countryMap.get('JP'), alliance: 'Oneworld' },
      { icao_code: 'ANA', iata_code: 'NH', name: 'All Nippon Airways', country_id: countryMap.get('JP'), alliance: 'Star Alliance' },
      { icao_code: 'KAL', iata_code: 'KE', name: 'Korean Air', country_id: countryMap.get('KR'), alliance: 'SkyTeam' },
      { icao_code: 'AAR', iata_code: 'OZ', name: 'Asiana Airlines', country_id: countryMap.get('KR'), alliance: 'Star Alliance' },
      { icao_code: 'CCA', iata_code: 'CA', name: 'Air China', country_id: countryMap.get('CN'), alliance: 'Star Alliance' },
      { icao_code: 'CES', iata_code: 'MU', name: 'China Eastern Airlines', country_id: countryMap.get('CN'), alliance: 'SkyTeam' },
      { icao_code: 'CSN', iata_code: 'CZ', name: 'China Southern Airlines', country_id: countryMap.get('CN'), alliance: 'SkyTeam' },
      { icao_code: 'CAL', iata_code: 'CI', name: 'China Airlines', country_id: countryMap.get('TW'), alliance: 'SkyTeam' },
      { icao_code: 'CPA', iata_code: 'CX', name: 'Cathay Pacific', country_id: countryMap.get('HK'), alliance: 'Oneworld' },
      // South Asia & Oceania
      { icao_code: 'AIC', iata_code: 'AI', name: 'Air India', country_id: countryMap.get('IN'), alliance: 'Star Alliance' },
      { icao_code: 'QFA', iata_code: 'QF', name: 'Qantas', country_id: countryMap.get('AU'), alliance: 'Oneworld' },
      { icao_code: 'ANZ', iata_code: 'NZ', name: 'Air New Zealand', country_id: countryMap.get('NZ'), alliance: 'Star Alliance' },
      // Middle East
      { icao_code: 'UAE', iata_code: 'EK', name: 'Emirates', country_id: countryMap.get('AE'), alliance: 'None' },
      { icao_code: 'QTR', iata_code: 'QR', name: 'Qatar Airways', country_id: countryMap.get('QA'), alliance: 'Oneworld' },
      { icao_code: 'THY', iata_code: 'TK', name: 'Turkish Airlines', country_id: countryMap.get('TR'), alliance: 'Star Alliance' },
      // Europe
      { icao_code: 'BAW', iata_code: 'BA', name: 'British Airways', country_id: countryMap.get('GB'), alliance: 'Oneworld' },
      { icao_code: 'AFR', iata_code: 'AF', name: 'Air France', country_id: countryMap.get('FR'), alliance: 'SkyTeam' },
      { icao_code: 'DLH', iata_code: 'LH', name: 'Lufthansa', country_id: countryMap.get('DE'), alliance: 'Star Alliance' },
      { icao_code: 'KLM', iata_code: 'KL', name: 'KLM Royal Dutch Airlines', country_id: countryMap.get('NL'), alliance: 'SkyTeam' },
      // North America
      { icao_code: 'UAL', iata_code: 'UA', name: 'United Airlines', country_id: countryMap.get('US'), alliance: 'Star Alliance' },
      { icao_code: 'AAL', iata_code: 'AA', name: 'American Airlines', country_id: countryMap.get('US'), alliance: 'Oneworld' },
      { icao_code: 'DAL', iata_code: 'DL', name: 'Delta Air Lines', country_id: countryMap.get('US'), alliance: 'SkyTeam' },
    ]

    for (const airline of airlines) {
      const { error } = await supabase
        .from('airlines')
        .upsert(airline, { onConflict: 'icao_code', ignoreDuplicates: false })

      if (error) {
        console.error(`   ❌ Error inserting ${airline.name}:`, error.message)
      }
    }
    console.log(`   ✅ Seeded ${airlines.length} airlines`)

    // 6. Seed City Pairs
    console.log('\n🗺️  Seeding city pairs...')
    const cityPairs = [
      // Domestic Vietnam
      { departure_airport_id: airportMap.get('SGN'), arrival_airport_id: airportMap.get('HAN'), route_type: 'domestic' },
      { departure_airport_id: airportMap.get('HAN'), arrival_airport_id: airportMap.get('SGN'), route_type: 'domestic' },
      { departure_airport_id: airportMap.get('SGN'), arrival_airport_id: airportMap.get('DAD'), route_type: 'domestic' },
      { departure_airport_id: airportMap.get('DAD'), arrival_airport_id: airportMap.get('SGN'), route_type: 'domestic' },
      { departure_airport_id: airportMap.get('SGN'), arrival_airport_id: airportMap.get('CXR'), route_type: 'domestic' },
      { departure_airport_id: airportMap.get('CXR'), arrival_airport_id: airportMap.get('SGN'), route_type: 'domestic' },
      { departure_airport_id: airportMap.get('SGN'), arrival_airport_id: airportMap.get('PQC'), route_type: 'domestic' },
      { departure_airport_id: airportMap.get('PQC'), arrival_airport_id: airportMap.get('SGN'), route_type: 'domestic' },
      { departure_airport_id: airportMap.get('SGN'), arrival_airport_id: airportMap.get('HPH'), route_type: 'domestic' },
      { departure_airport_id: airportMap.get('HPH'), arrival_airport_id: airportMap.get('SGN'), route_type: 'domestic' },
      { departure_airport_id: airportMap.get('SGN'), arrival_airport_id: airportMap.get('VII'), route_type: 'domestic' },
      { departure_airport_id: airportMap.get('VII'), arrival_airport_id: airportMap.get('SGN'), route_type: 'domestic' },
      { departure_airport_id: airportMap.get('HAN'), arrival_airport_id: airportMap.get('DAD'), route_type: 'domestic' },
      { departure_airport_id: airportMap.get('DAD'), arrival_airport_id: airportMap.get('HAN'), route_type: 'domestic' },
      { departure_airport_id: airportMap.get('HAN'), arrival_airport_id: airportMap.get('CXR'), route_type: 'domestic' },
      { departure_airport_id: airportMap.get('CXR'), arrival_airport_id: airportMap.get('HAN'), route_type: 'domestic' },
      { departure_airport_id: airportMap.get('HAN'), arrival_airport_id: airportMap.get('PQC'), route_type: 'domestic' },
      { departure_airport_id: airportMap.get('PQC'), arrival_airport_id: airportMap.get('HAN'), route_type: 'domestic' },
      { departure_airport_id: airportMap.get('SGN'), arrival_airport_id: airportMap.get('DLI'), route_type: 'domestic' },
      { departure_airport_id: airportMap.get('DLI'), arrival_airport_id: airportMap.get('SGN'), route_type: 'domestic' },
      { departure_airport_id: airportMap.get('SGN'), arrival_airport_id: airportMap.get('VCA'), route_type: 'domestic' },
      { departure_airport_id: airportMap.get('VCA'), arrival_airport_id: airportMap.get('SGN'), route_type: 'domestic' },
      { departure_airport_id: airportMap.get('HAN'), arrival_airport_id: airportMap.get('HUI'), route_type: 'domestic' },
      { departure_airport_id: airportMap.get('HUI'), arrival_airport_id: airportMap.get('HAN'), route_type: 'domestic' },
      // Regional from SGN
      { departure_airport_id: airportMap.get('SGN'), arrival_airport_id: airportMap.get('BKK'), route_type: 'regional' },
      { departure_airport_id: airportMap.get('BKK'), arrival_airport_id: airportMap.get('SGN'), route_type: 'regional' },
      { departure_airport_id: airportMap.get('SGN'), arrival_airport_id: airportMap.get('SIN'), route_type: 'regional' },
      { departure_airport_id: airportMap.get('SIN'), arrival_airport_id: airportMap.get('SGN'), route_type: 'regional' },
      { departure_airport_id: airportMap.get('SGN'), arrival_airport_id: airportMap.get('KUL'), route_type: 'regional' },
      { departure_airport_id: airportMap.get('KUL'), arrival_airport_id: airportMap.get('SGN'), route_type: 'regional' },
      { departure_airport_id: airportMap.get('SGN'), arrival_airport_id: airportMap.get('HKG'), route_type: 'international' },
      { departure_airport_id: airportMap.get('HKG'), arrival_airport_id: airportMap.get('SGN'), route_type: 'international' },
      { departure_airport_id: airportMap.get('SGN'), arrival_airport_id: airportMap.get('TPE'), route_type: 'international' },
      { departure_airport_id: airportMap.get('TPE'), arrival_airport_id: airportMap.get('SGN'), route_type: 'international' },
      { departure_airport_id: airportMap.get('SGN'), arrival_airport_id: airportMap.get('ICN'), route_type: 'international' },
      { departure_airport_id: airportMap.get('ICN'), arrival_airport_id: airportMap.get('SGN'), route_type: 'international' },
      { departure_airport_id: airportMap.get('SGN'), arrival_airport_id: airportMap.get('NRT'), route_type: 'international' },
      { departure_airport_id: airportMap.get('NRT'), arrival_airport_id: airportMap.get('SGN'), route_type: 'international' },
      { departure_airport_id: airportMap.get('SGN'), arrival_airport_id: airportMap.get('PNH'), route_type: 'regional' },
      { departure_airport_id: airportMap.get('PNH'), arrival_airport_id: airportMap.get('SGN'), route_type: 'regional' },
      { departure_airport_id: airportMap.get('SGN'), arrival_airport_id: airportMap.get('VTE'), route_type: 'regional' },
      { departure_airport_id: airportMap.get('VTE'), arrival_airport_id: airportMap.get('SGN'), route_type: 'regional' },
      { departure_airport_id: airportMap.get('SGN'), arrival_airport_id: airportMap.get('CGK'), route_type: 'international' },
      { departure_airport_id: airportMap.get('CGK'), arrival_airport_id: airportMap.get('SGN'), route_type: 'international' },
      { departure_airport_id: airportMap.get('SGN'), arrival_airport_id: airportMap.get('MNL'), route_type: 'international' },
      { departure_airport_id: airportMap.get('MNL'), arrival_airport_id: airportMap.get('SGN'), route_type: 'international' },
      // Regional from HAN
      { departure_airport_id: airportMap.get('HAN'), arrival_airport_id: airportMap.get('BKK'), route_type: 'international' },
      { departure_airport_id: airportMap.get('BKK'), arrival_airport_id: airportMap.get('HAN'), route_type: 'international' },
      { departure_airport_id: airportMap.get('HAN'), arrival_airport_id: airportMap.get('SIN'), route_type: 'international' },
      { departure_airport_id: airportMap.get('SIN'), arrival_airport_id: airportMap.get('HAN'), route_type: 'international' },
      { departure_airport_id: airportMap.get('HAN'), arrival_airport_id: airportMap.get('PVG'), route_type: 'international' },
      { departure_airport_id: airportMap.get('PVG'), arrival_airport_id: airportMap.get('HAN'), route_type: 'international' },
      { departure_airport_id: airportMap.get('HAN'), arrival_airport_id: airportMap.get('ICN'), route_type: 'international' },
      { departure_airport_id: airportMap.get('ICN'), arrival_airport_id: airportMap.get('HAN'), route_type: 'international' },
      { departure_airport_id: airportMap.get('HAN'), arrival_airport_id: airportMap.get('NRT'), route_type: 'international' },
      { departure_airport_id: airportMap.get('NRT'), arrival_airport_id: airportMap.get('HAN'), route_type: 'international' },
      { departure_airport_id: airportMap.get('HAN'), arrival_airport_id: airportMap.get('HKG'), route_type: 'international' },
      { departure_airport_id: airportMap.get('HKG'), arrival_airport_id: airportMap.get('HAN'), route_type: 'international' },
      { departure_airport_id: airportMap.get('HAN'), arrival_airport_id: airportMap.get('KUL'), route_type: 'international' },
      { departure_airport_id: airportMap.get('KUL'), arrival_airport_id: airportMap.get('HAN'), route_type: 'international' },
      // Long haul
      { departure_airport_id: airportMap.get('SGN'), arrival_airport_id: airportMap.get('LHR'), route_type: 'ultra-long-haul' },
      { departure_airport_id: airportMap.get('LHR'), arrival_airport_id: airportMap.get('SGN'), route_type: 'ultra-long-haul' },
      { departure_airport_id: airportMap.get('SGN'), arrival_airport_id: airportMap.get('CDG'), route_type: 'ultra-long-haul' },
      { departure_airport_id: airportMap.get('CDG'), arrival_airport_id: airportMap.get('SGN'), route_type: 'ultra-long-haul' },
      { departure_airport_id: airportMap.get('SGN'), arrival_airport_id: airportMap.get('SYD'), route_type: 'long-haul' },
      { departure_airport_id: airportMap.get('SYD'), arrival_airport_id: airportMap.get('SGN'), route_type: 'long-haul' },
      { departure_airport_id: airportMap.get('SGN'), arrival_airport_id: airportMap.get('FRA'), route_type: 'ultra-long-haul' },
      { departure_airport_id: airportMap.get('FRA'), arrival_airport_id: airportMap.get('SGN'), route_type: 'ultra-long-haul' },
      { departure_airport_id: airportMap.get('HAN'), arrival_airport_id: airportMap.get('FRA'), route_type: 'ultra-long-haul' },
      { departure_airport_id: airportMap.get('FRA'), arrival_airport_id: airportMap.get('HAN'), route_type: 'ultra-long-haul' },
      { departure_airport_id: airportMap.get('SGN'), arrival_airport_id: airportMap.get('MEL'), route_type: 'long-haul' },
      { departure_airport_id: airportMap.get('MEL'), arrival_airport_id: airportMap.get('SGN'), route_type: 'long-haul' },
    ]

    for (const cityPair of cityPairs.filter(cp => cp.departure_airport_id && cp.arrival_airport_id)) {
      const { error } = await supabase
        .from('city_pairs')
        .upsert(cityPair, { onConflict: 'departure_airport_id,arrival_airport_id', ignoreDuplicates: true })

      if (error) {
        console.error(`   ❌ Error inserting city pair:`, error.message)
      }
    }
    console.log(`   ✅ Seeded ${cityPairs.length} city pairs`)

    // 7. Update user to super_admin (Note: using auth.users table)
    console.log('\n👤 Updating user role...')
    console.log('   ⚠️  Note: user_roles and user_preferences tables do not exist in current schema')
    console.log('   The user system appears to be different from what was specified.')

    console.log('\n✨ Database seeding completed successfully!\n')
    console.log('📊 Summary:')
    console.log(`   - 1 operator (Horizon Airlines)`)
    console.log(`   - ${countries.length} countries`)
    console.log(`   - ${airports.length} airports`)
    console.log(`   - ${aircraftTypes.length} aircraft types`)
    console.log(`   - ${airlines.length} airlines`)
    console.log(`   - ${cityPairs.length} city pairs`)

  } catch (error) {
    console.error('\n💥 Fatal error during seeding:', error)
    process.exit(1)
  }
}

seedDatabase()
