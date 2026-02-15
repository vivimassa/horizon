import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables from .env.local
config({ path: resolve(__dirname, '../.env.local') })

// Initialize Supabase client with service role key for admin operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables!')
  console.error('   Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function seedDatabase() {
  console.log('🌱 Starting database seeding...\n')

  try {
    // 1. Update operator profile
    console.log('📋 Updating operator profile...')
    const { error: profileError } = await supabase
      .from('operator_profile')
      .update({
        company_name: 'Horizon Airlines',
        icao_code: 'HZN',
        iata_code: 'HZ',
        country: 'Vietnam',
        regulatory_authority: 'CAAV',
        timezone: 'Asia/Ho_Chi_Minh',
        enabled_modules: ['platform', 'network', 'operations', 'workforce']
      })
      .eq('id', (await supabase.from('operator_profile').select('id').single()).data?.id)

    if (profileError) {
      console.error('❌ Error updating operator profile:', profileError)
    } else {
      console.log('✅ Operator profile updated\n')
    }

    // 2. Seed Countries
    console.log('🌍 Seeding countries...')
    const countries = [
      // ASEAN Countries
      { iso_code: 'VN', name: 'Vietnam', region: 'Southeast Asia', currency: 'VND', icao_prefix: 'VV' },
      { iso_code: 'TH', name: 'Thailand', region: 'Southeast Asia', currency: 'THB', icao_prefix: 'VT' },
      { iso_code: 'SG', name: 'Singapore', region: 'Southeast Asia', currency: 'SGD', icao_prefix: 'WS' },
      { iso_code: 'MY', name: 'Malaysia', region: 'Southeast Asia', currency: 'MYR', icao_prefix: 'WM' },
      { iso_code: 'ID', name: 'Indonesia', region: 'Southeast Asia', currency: 'IDR', icao_prefix: 'WI' },
      { iso_code: 'PH', name: 'Philippines', region: 'Southeast Asia', currency: 'PHP', icao_prefix: 'RP' },
      { iso_code: 'MM', name: 'Myanmar', region: 'Southeast Asia', currency: 'MMK', icao_prefix: 'VY' },
      { iso_code: 'KH', name: 'Cambodia', region: 'Southeast Asia', currency: 'KHR', icao_prefix: 'VD' },
      { iso_code: 'LA', name: 'Laos', region: 'Southeast Asia', currency: 'LAK', icao_prefix: 'VL' },
      { iso_code: 'BN', name: 'Brunei', region: 'Southeast Asia', currency: 'BND', icao_prefix: 'WB' },

      // East Asia
      { iso_code: 'JP', name: 'Japan', region: 'East Asia', currency: 'JPY', icao_prefix: 'RJ' },
      { iso_code: 'KR', name: 'South Korea', region: 'East Asia', currency: 'KRW', icao_prefix: 'RK' },
      { iso_code: 'CN', name: 'China', region: 'East Asia', currency: 'CNY', icao_prefix: 'ZB' },
      { iso_code: 'TW', name: 'Taiwan', region: 'East Asia', currency: 'TWD', icao_prefix: 'RC' },
      { iso_code: 'HK', name: 'Hong Kong', region: 'East Asia', currency: 'HKD', icao_prefix: 'VH' },
      { iso_code: 'MO', name: 'Macau', region: 'East Asia', currency: 'MOP', icao_prefix: 'VM' },

      // South Asia
      { iso_code: 'IN', name: 'India', region: 'South Asia', currency: 'INR', icao_prefix: 'VI' },
      { iso_code: 'PK', name: 'Pakistan', region: 'South Asia', currency: 'PKR', icao_prefix: 'OP' },
      { iso_code: 'BD', name: 'Bangladesh', region: 'South Asia', currency: 'BDT', icao_prefix: 'VG' },
      { iso_code: 'LK', name: 'Sri Lanka', region: 'South Asia', currency: 'LKR', icao_prefix: 'VC' },
      { iso_code: 'NP', name: 'Nepal', region: 'South Asia', currency: 'NPR', icao_prefix: 'VN' },

      // Oceania
      { iso_code: 'AU', name: 'Australia', region: 'Oceania', currency: 'AUD', icao_prefix: 'YM' },
      { iso_code: 'NZ', name: 'New Zealand', region: 'Oceania', currency: 'NZD', icao_prefix: 'NZ' },

      // Middle East
      { iso_code: 'AE', name: 'United Arab Emirates', region: 'Middle East', currency: 'AED', icao_prefix: 'OM' },
      { iso_code: 'QA', name: 'Qatar', region: 'Middle East', currency: 'QAR', icao_prefix: 'OT' },
      { iso_code: 'SA', name: 'Saudi Arabia', region: 'Middle East', currency: 'SAR', icao_prefix: 'OE' },
      { iso_code: 'TR', name: 'Turkey', region: 'Middle East', currency: 'TRY', icao_prefix: 'LT' },

      // Europe
      { iso_code: 'GB', name: 'United Kingdom', region: 'Europe', currency: 'GBP', icao_prefix: 'EG' },
      { iso_code: 'FR', name: 'France', region: 'Europe', currency: 'EUR', icao_prefix: 'LF' },
      { iso_code: 'DE', name: 'Germany', region: 'Europe', currency: 'EUR', icao_prefix: 'ED' },
      { iso_code: 'NL', name: 'Netherlands', region: 'Europe', currency: 'EUR', icao_prefix: 'EH' },
      { iso_code: 'IT', name: 'Italy', region: 'Europe', currency: 'EUR', icao_prefix: 'LI' },
      { iso_code: 'ES', name: 'Spain', region: 'Europe', currency: 'EUR', icao_prefix: 'LE' },
      { iso_code: 'CH', name: 'Switzerland', region: 'Europe', currency: 'CHF', icao_prefix: 'LS' },
      { iso_code: 'AT', name: 'Austria', region: 'Europe', currency: 'EUR', icao_prefix: 'LO' },
      { iso_code: 'RU', name: 'Russia', region: 'Europe', currency: 'RUB', icao_prefix: 'UU' },

      // Americas
      { iso_code: 'US', name: 'United States', region: 'North America', currency: 'USD', icao_prefix: 'K' },
      { iso_code: 'CA', name: 'Canada', region: 'North America', currency: 'CAD', icao_prefix: 'C' },
      { iso_code: 'MX', name: 'Mexico', region: 'North America', currency: 'MXN', icao_prefix: 'MM' },
      { iso_code: 'BR', name: 'Brazil', region: 'South America', currency: 'BRL', icao_prefix: 'SB' },
      { iso_code: 'AR', name: 'Argentina', region: 'South America', currency: 'ARS', icao_prefix: 'SA' },
      { iso_code: 'CL', name: 'Chile', region: 'South America', currency: 'CLP', icao_prefix: 'SC' },

      // Africa
      { iso_code: 'ZA', name: 'South Africa', region: 'Africa', currency: 'ZAR', icao_prefix: 'FA' },
      { iso_code: 'EG', name: 'Egypt', region: 'Africa', currency: 'EGP', icao_prefix: 'HE' },
      { iso_code: 'KE', name: 'Kenya', region: 'Africa', currency: 'KES', icao_prefix: 'HK' },
      { iso_code: 'NG', name: 'Nigeria', region: 'Africa', currency: 'NGN', icao_prefix: 'DN' },
      { iso_code: 'MA', name: 'Morocco', region: 'Africa', currency: 'MAD', icao_prefix: 'GM' },
      { iso_code: 'ET', name: 'Ethiopia', region: 'Africa', currency: 'ETB', icao_prefix: 'HA' },
    ]

    const { error: countriesError } = await supabase
      .from('countries')
      .upsert(countries, { onConflict: 'iso_code' })

    if (countriesError) {
      console.error('❌ Error seeding countries:', countriesError)
    } else {
      console.log(`✅ Seeded ${countries.length} countries\n`)
    }

    // 3. Seed Airports
    console.log('✈️  Seeding airports...')
    const airports = [
      // Vietnam Airports
      { icao_code: 'VVTS', iata_code: 'SGN', airport_name: 'Tan Son Nhat International Airport', city: 'Ho Chi Minh City', country: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },
      { icao_code: 'VVNB', iata_code: 'HAN', airport_name: 'Noi Bai International Airport', city: 'Hanoi', country: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },
      { icao_code: 'VVDN', iata_code: 'DAD', airport_name: 'Da Nang International Airport', city: 'Da Nang', country: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },
      { icao_code: 'VVCR', iata_code: 'CXR', airport_name: 'Cam Ranh International Airport', city: 'Nha Trang', country: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },
      { icao_code: 'VVPQ', iata_code: 'PQC', airport_name: 'Phu Quoc International Airport', city: 'Phu Quoc', country: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },
      { icao_code: 'VVVD', iata_code: 'VDO', airport_name: 'Van Don International Airport', city: 'Quang Ninh', country: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },
      { icao_code: 'VVCI', iata_code: 'HPH', airport_name: 'Cat Bi International Airport', city: 'Hai Phong', country: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },
      { icao_code: 'VVVH', iata_code: 'VII', airport_name: 'Vinh International Airport', city: 'Vinh', country: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },
      { icao_code: 'VVPB', iata_code: 'HUI', airport_name: 'Phu Bai International Airport', city: 'Hue', country: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },
      { icao_code: 'VVBM', iata_code: 'BMV', airport_name: 'Buon Ma Thuot Airport', city: 'Buon Ma Thuot', country: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },
      { icao_code: 'VVCT', iata_code: 'VCA', airport_name: 'Can Tho International Airport', city: 'Can Tho', country: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },
      { icao_code: 'VVPC', iata_code: 'UIH', airport_name: 'Phu Cat Airport', city: 'Quy Nhon', country: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },
      { icao_code: 'VVTH', iata_code: 'TBB', airport_name: 'Dong Tac Airport', city: 'Tuy Hoa', country: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },
      { icao_code: 'VVDL', iata_code: 'DLI', airport_name: 'Lien Khuong Airport', city: 'Da Lat', country: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },
      { icao_code: 'VVCS', iata_code: 'VCS', airport_name: 'Co Ong Airport', city: 'Con Dao', country: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },
      { icao_code: 'VVCA', iata_code: 'VCL', airport_name: 'Chu Lai International Airport', city: 'Tam Ky', country: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },
      { icao_code: 'VVTX', iata_code: 'THD', airport_name: 'Tho Xuan Airport', city: 'Thanh Hoa', country: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },
      { icao_code: 'VVRG', iata_code: 'VKG', airport_name: 'Rach Gia Airport', city: 'Rach Gia', country: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },
      { icao_code: 'VVDB', iata_code: 'DIN', airport_name: 'Dien Bien Phu Airport', city: 'Dien Bien Phu', country: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },
      { icao_code: 'VVPK', iata_code: 'PXU', airport_name: 'Pleiku Airport', city: 'Pleiku', country: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },

      // Thailand
      { icao_code: 'VTBS', iata_code: 'BKK', airport_name: 'Suvarnabhumi Airport', city: 'Bangkok', country: 'Thailand', timezone: 'Asia/Bangkok' },
      { icao_code: 'VTBD', iata_code: 'DMK', airport_name: 'Don Mueang International Airport', city: 'Bangkok', country: 'Thailand', timezone: 'Asia/Bangkok' },
      { icao_code: 'VTSP', iata_code: 'HKT', airport_name: 'Phuket International Airport', city: 'Phuket', country: 'Thailand', timezone: 'Asia/Bangkok' },
      { icao_code: 'VTCC', iata_code: 'CNX', airport_name: 'Chiang Mai International Airport', city: 'Chiang Mai', country: 'Thailand', timezone: 'Asia/Bangkok' },
      { icao_code: 'VTSM', iata_code: 'USM', airport_name: 'Samui Airport', city: 'Ko Samui', country: 'Thailand', timezone: 'Asia/Bangkok' },

      // Singapore
      { icao_code: 'WSSS', iata_code: 'SIN', airport_name: 'Singapore Changi Airport', city: 'Singapore', country: 'Singapore', timezone: 'Asia/Singapore' },

      // Malaysia
      { icao_code: 'WMKK', iata_code: 'KUL', airport_name: 'Kuala Lumpur International Airport', city: 'Kuala Lumpur', country: 'Malaysia', timezone: 'Asia/Kuala_Lumpur' },
      { icao_code: 'WMSA', iata_code: 'SZB', airport_name: 'Sultan Abdul Aziz Shah Airport', city: 'Subang', country: 'Malaysia', timezone: 'Asia/Kuala_Lumpur' },
      { icao_code: 'WMKP', iata_code: 'PEN', airport_name: 'Penang International Airport', city: 'Penang', country: 'Malaysia', timezone: 'Asia/Kuala_Lumpur' },
      { icao_code: 'WBKK', iata_code: 'BKI', airport_name: 'Kota Kinabalu International Airport', city: 'Kota Kinabalu', country: 'Malaysia', timezone: 'Asia/Kuching' },
      { icao_code: 'WMKC', iata_code: 'KCH', airport_name: 'Kuching International Airport', city: 'Kuching', country: 'Malaysia', timezone: 'Asia/Kuching' },
      { icao_code: 'WMKJ', iata_code: 'JHB', airport_name: 'Senai International Airport', city: 'Johor Bahru', country: 'Malaysia', timezone: 'Asia/Kuala_Lumpur' },

      // Philippines
      { icao_code: 'RPLL', iata_code: 'MNL', airport_name: 'Ninoy Aquino International Airport', city: 'Manila', country: 'Philippines', timezone: 'Asia/Manila' },
      { icao_code: 'RPVM', iata_code: 'CEB', airport_name: 'Mactan-Cebu International Airport', city: 'Cebu', country: 'Philippines', timezone: 'Asia/Manila' },
      { icao_code: 'RPMD', iata_code: 'DVO', airport_name: 'Francisco Bangoy International Airport', city: 'Davao', country: 'Philippines', timezone: 'Asia/Manila' },
      { icao_code: 'RPVK', iata_code: 'KLO', airport_name: 'Kalibo International Airport', city: 'Kalibo', country: 'Philippines', timezone: 'Asia/Manila' },
      { icao_code: 'RPVI', iata_code: 'ILO', airport_name: 'Iloilo International Airport', city: 'Iloilo', country: 'Philippines', timezone: 'Asia/Manila' },

      // Indonesia
      { icao_code: 'WIII', iata_code: 'CGK', airport_name: 'Soekarno-Hatta International Airport', city: 'Jakarta', country: 'Indonesia', timezone: 'Asia/Jakarta' },
      { icao_code: 'WADD', iata_code: 'DPS', airport_name: 'Ngurah Rai International Airport', city: 'Denpasar', country: 'Indonesia', timezone: 'Asia/Makassar' },
      { icao_code: 'WARR', iata_code: 'SUB', airport_name: 'Juanda International Airport', city: 'Surabaya', country: 'Indonesia', timezone: 'Asia/Jakarta' },
      { icao_code: 'WICC', iata_code: 'UPG', airport_name: 'Sultan Hasanuddin International Airport', city: 'Makassar', country: 'Indonesia', timezone: 'Asia/Makassar' },
      { icao_code: 'WIMM', iata_code: 'BTH', airport_name: 'Hang Nadim International Airport', city: 'Batam', country: 'Indonesia', timezone: 'Asia/Jakarta' },

      // Myanmar
      { icao_code: 'VYYY', iata_code: 'RGN', airport_name: 'Yangon International Airport', city: 'Yangon', country: 'Myanmar', timezone: 'Asia/Yangon' },
      { icao_code: 'VYMD', iata_code: 'MDL', airport_name: 'Mandalay International Airport', city: 'Mandalay', country: 'Myanmar', timezone: 'Asia/Yangon' },

      // Cambodia
      { icao_code: 'VDPP', iata_code: 'PNH', airport_name: 'Phnom Penh International Airport', city: 'Phnom Penh', country: 'Cambodia', timezone: 'Asia/Phnom_Penh' },
      { icao_code: 'VDSR', iata_code: 'REP', airport_name: 'Siem Reap International Airport', city: 'Siem Reap', country: 'Cambodia', timezone: 'Asia/Phnom_Penh' },

      // Laos
      { icao_code: 'VLVT', iata_code: 'VTE', airport_name: 'Wattay International Airport', city: 'Vientiane', country: 'Laos', timezone: 'Asia/Vientiane' },
      { icao_code: 'VLLB', iata_code: 'LPQ', airport_name: 'Luang Prabang International Airport', city: 'Luang Prabang', country: 'Laos', timezone: 'Asia/Vientiane' },

      // Brunei
      { icao_code: 'WBSB', iata_code: 'BWN', airport_name: 'Brunei International Airport', city: 'Bandar Seri Begawan', country: 'Brunei', timezone: 'Asia/Brunei' },

      // Japan
      { icao_code: 'RJTT', iata_code: 'HND', airport_name: 'Tokyo Haneda Airport', city: 'Tokyo', country: 'Japan', timezone: 'Asia/Tokyo' },
      { icao_code: 'RJAA', iata_code: 'NRT', airport_name: 'Narita International Airport', city: 'Tokyo', country: 'Japan', timezone: 'Asia/Tokyo' },
      { icao_code: 'RJBB', iata_code: 'KIX', airport_name: 'Kansai International Airport', city: 'Osaka', country: 'Japan', timezone: 'Asia/Tokyo' },
      { icao_code: 'RJGG', iata_code: 'NGO', airport_name: 'Chubu Centrair International Airport', city: 'Nagoya', country: 'Japan', timezone: 'Asia/Tokyo' },
      { icao_code: 'RJFF', iata_code: 'FUK', airport_name: 'Fukuoka Airport', city: 'Fukuoka', country: 'Japan', timezone: 'Asia/Tokyo' },

      // South Korea
      { icao_code: 'RKSI', iata_code: 'ICN', airport_name: 'Incheon International Airport', city: 'Seoul', country: 'South Korea', timezone: 'Asia/Seoul' },
      { icao_code: 'RKSS', iata_code: 'GMP', airport_name: 'Gimpo International Airport', city: 'Seoul', country: 'South Korea', timezone: 'Asia/Seoul' },
      { icao_code: 'RKPC', iata_code: 'PUS', airport_name: 'Gimhae International Airport', city: 'Busan', country: 'South Korea', timezone: 'Asia/Seoul' },

      // China
      { icao_code: 'ZBAA', iata_code: 'PEK', airport_name: 'Beijing Capital International Airport', city: 'Beijing', country: 'China', timezone: 'Asia/Shanghai' },
      { icao_code: 'ZSPD', iata_code: 'PVG', airport_name: 'Shanghai Pudong International Airport', city: 'Shanghai', country: 'China', timezone: 'Asia/Shanghai' },
      { icao_code: 'ZGGG', iata_code: 'CAN', airport_name: 'Guangzhou Baiyun International Airport', city: 'Guangzhou', country: 'China', timezone: 'Asia/Shanghai' },
      { icao_code: 'ZGSZ', iata_code: 'SZX', airport_name: 'Shenzhen Bao\'an International Airport', city: 'Shenzhen', country: 'China', timezone: 'Asia/Shanghai' },
      { icao_code: 'ZUUU', iata_code: 'CTU', airport_name: 'Chengdu Shuangliu International Airport', city: 'Chengdu', country: 'China', timezone: 'Asia/Shanghai' },
      { icao_code: 'ZUCK', iata_code: 'CKG', airport_name: 'Chongqing Jiangbei International Airport', city: 'Chongqing', country: 'China', timezone: 'Asia/Shanghai' },

      // Taiwan
      { icao_code: 'RCTP', iata_code: 'TPE', airport_name: 'Taiwan Taoyuan International Airport', city: 'Taipei', country: 'Taiwan', timezone: 'Asia/Taipei' },
      { icao_code: 'RCSS', iata_code: 'TSA', airport_name: 'Taipei Songshan Airport', city: 'Taipei', country: 'Taiwan', timezone: 'Asia/Taipei' },
      { icao_code: 'RCKH', iata_code: 'KHH', airport_name: 'Kaohsiung International Airport', city: 'Kaohsiung', country: 'Taiwan', timezone: 'Asia/Taipei' },

      // Hong Kong
      { icao_code: 'VHHH', iata_code: 'HKG', airport_name: 'Hong Kong International Airport', city: 'Hong Kong', country: 'Hong Kong', timezone: 'Asia/Hong_Kong' },

      // India
      { icao_code: 'VIDP', iata_code: 'DEL', airport_name: 'Indira Gandhi International Airport', city: 'New Delhi', country: 'India', timezone: 'Asia/Kolkata' },
      { icao_code: 'VABB', iata_code: 'BOM', airport_name: 'Chhatrapati Shivaji Maharaj International Airport', city: 'Mumbai', country: 'India', timezone: 'Asia/Kolkata' },
      { icao_code: 'VOBL', iata_code: 'BLR', airport_name: 'Kempegowda International Airport', city: 'Bangalore', country: 'India', timezone: 'Asia/Kolkata' },
      { icao_code: 'VOMM', iata_code: 'MAA', airport_name: 'Chennai International Airport', city: 'Chennai', country: 'India', timezone: 'Asia/Kolkata' },

      // Australia
      { icao_code: 'YSSY', iata_code: 'SYD', airport_name: 'Sydney Kingsford Smith Airport', city: 'Sydney', country: 'Australia', timezone: 'Australia/Sydney' },
      { icao_code: 'YMML', iata_code: 'MEL', airport_name: 'Melbourne Airport', city: 'Melbourne', country: 'Australia', timezone: 'Australia/Melbourne' },
      { icao_code: 'YBBN', iata_code: 'BNE', airport_name: 'Brisbane Airport', city: 'Brisbane', country: 'Australia', timezone: 'Australia/Brisbane' },
      { icao_code: 'YPPH', iata_code: 'PER', airport_name: 'Perth Airport', city: 'Perth', country: 'Australia', timezone: 'Australia/Perth' },

      // New Zealand
      { icao_code: 'NZAA', iata_code: 'AKL', airport_name: 'Auckland Airport', city: 'Auckland', country: 'New Zealand', timezone: 'Pacific/Auckland' },
      { icao_code: 'NZCH', iata_code: 'CHC', airport_name: 'Christchurch International Airport', city: 'Christchurch', country: 'New Zealand', timezone: 'Pacific/Auckland' },

      // Middle East
      { icao_code: 'OMDB', iata_code: 'DXB', airport_name: 'Dubai International Airport', city: 'Dubai', country: 'United Arab Emirates', timezone: 'Asia/Dubai' },
      { icao_code: 'OMAA', iata_code: 'AUH', airport_name: 'Abu Dhabi International Airport', city: 'Abu Dhabi', country: 'United Arab Emirates', timezone: 'Asia/Dubai' },
      { icao_code: 'OTHH', iata_code: 'DOH', airport_name: 'Hamad International Airport', city: 'Doha', country: 'Qatar', timezone: 'Asia/Qatar' },
      { icao_code: 'LTFM', iata_code: 'IST', airport_name: 'Istanbul Airport', city: 'Istanbul', country: 'Turkey', timezone: 'Europe/Istanbul' },

      // Europe
      { icao_code: 'EGLL', iata_code: 'LHR', airport_name: 'London Heathrow Airport', city: 'London', country: 'United Kingdom', timezone: 'Europe/London' },
      { icao_code: 'EGKK', iata_code: 'LGW', airport_name: 'London Gatwick Airport', city: 'London', country: 'United Kingdom', timezone: 'Europe/London' },
      { icao_code: 'LFPG', iata_code: 'CDG', airport_name: 'Charles de Gaulle Airport', city: 'Paris', country: 'France', timezone: 'Europe/Paris' },
      { icao_code: 'EDDF', iata_code: 'FRA', airport_name: 'Frankfurt Airport', city: 'Frankfurt', country: 'Germany', timezone: 'Europe/Berlin' },
      { icao_code: 'EHAM', iata_code: 'AMS', airport_name: 'Amsterdam Airport Schiphol', city: 'Amsterdam', country: 'Netherlands', timezone: 'Europe/Amsterdam' },
      { icao_code: 'LSZH', iata_code: 'ZRH', airport_name: 'Zurich Airport', city: 'Zurich', country: 'Switzerland', timezone: 'Europe/Zurich' },
      { icao_code: 'LEMD', iata_code: 'MAD', airport_name: 'Adolfo Suárez Madrid-Barajas Airport', city: 'Madrid', country: 'Spain', timezone: 'Europe/Madrid' },
      { icao_code: 'LIRF', iata_code: 'FCO', airport_name: 'Leonardo da Vinci-Fiumicino Airport', city: 'Rome', country: 'Italy', timezone: 'Europe/Rome' },

      // North America
      { icao_code: 'KJFK', iata_code: 'JFK', airport_name: 'John F. Kennedy International Airport', city: 'New York', country: 'United States', timezone: 'America/New_York' },
      { icao_code: 'KLAX', iata_code: 'LAX', airport_name: 'Los Angeles International Airport', city: 'Los Angeles', country: 'United States', timezone: 'America/Los_Angeles' },
      { icao_code: 'KSFO', iata_code: 'SFO', airport_name: 'San Francisco International Airport', city: 'San Francisco', country: 'United States', timezone: 'America/Los_Angeles' },
      { icao_code: 'KORD', iata_code: 'ORD', airport_name: 'O\'Hare International Airport', city: 'Chicago', country: 'United States', timezone: 'America/Chicago' },
      { icao_code: 'KDFW', iata_code: 'DFW', airport_name: 'Dallas/Fort Worth International Airport', city: 'Dallas', country: 'United States', timezone: 'America/Chicago' },
      { icao_code: 'KSEA', iata_code: 'SEA', airport_name: 'Seattle-Tacoma International Airport', city: 'Seattle', country: 'United States', timezone: 'America/Los_Angeles' },
      { icao_code: 'CYYZ', iata_code: 'YYZ', airport_name: 'Toronto Pearson International Airport', city: 'Toronto', country: 'Canada', timezone: 'America/Toronto' },
      { icao_code: 'CYVR', iata_code: 'YVR', airport_name: 'Vancouver International Airport', city: 'Vancouver', country: 'Canada', timezone: 'America/Vancouver' },
    ]

    const { error: airportsError } = await supabase
      .from('airports')
      .upsert(airports, { onConflict: 'icao_code' })

    if (airportsError) {
      console.error('❌ Error seeding airports:', airportsError)
    } else {
      console.log(`✅ Seeded ${airports.length} airports\n`)
    }

    // 4. Seed Aircraft Types
    console.log('🛩️  Seeding aircraft types...')
    const aircraftTypes = [
      {
        icao_type: 'A320',
        iata_type: '320',
        name: 'Airbus A320',
        family: 'A320',
        category: 'narrow-body' as const,
        pax_capacity: 180,
        cockpit_crew: 2,
        cabin_crew: 4
      },
      {
        icao_type: 'A321',
        iata_type: '321',
        name: 'Airbus A321',
        family: 'A320',
        category: 'narrow-body' as const,
        pax_capacity: 220,
        cockpit_crew: 2,
        cabin_crew: 5
      },
      {
        icao_type: 'A333',
        iata_type: '333',
        name: 'Airbus A330-300',
        family: 'A330',
        category: 'wide-body' as const,
        pax_capacity: 300,
        cockpit_crew: 2,
        cabin_crew: 8
      }
    ]

    const { error: aircraftTypesError } = await supabase
      .from('aircraft_types')
      .upsert(aircraftTypes, { onConflict: 'icao_type' })

    if (aircraftTypesError) {
      console.error('❌ Error seeding aircraft types:', aircraftTypesError)
    } else {
      console.log(`✅ Seeded ${aircraftTypes.length} aircraft types\n`)
    }

    // 5. Seed Airlines
    console.log('✈️  Seeding airlines...')
    const airlines = [
      // Vietnamese Airlines
      { icao_code: 'HVN', iata_code: 'VN', name: 'Vietnam Airlines', country: 'Vietnam', alliance: 'SkyTeam' },
      { icao_code: 'VJC', iata_code: 'VJ', name: 'VietJet Air', country: 'Vietnam', alliance: 'None' },
      { icao_code: 'VBL', iata_code: 'BL', name: 'Jetstar Pacific Airlines', country: 'Vietnam', alliance: 'None' },
      { icao_code: 'VAP', iata_code: 'QH', name: 'Bamboo Airways', country: 'Vietnam', alliance: 'None' },
      { icao_code: 'VAG', iata_code: 'VU', name: 'Vietravel Airlines', country: 'Vietnam', alliance: 'None' },

      // Thai Airlines
      { icao_code: 'THA', iata_code: 'TG', name: 'Thai Airways', country: 'Thailand', alliance: 'Star Alliance' },
      { icao_code: 'AIQ', iata_code: 'FD', name: 'Thai AirAsia', country: 'Thailand', alliance: 'None' },
      { icao_code: 'NOK', iata_code: 'DD', name: 'Nok Air', country: 'Thailand', alliance: 'None' },
      { icao_code: 'TGW', iata_code: 'SL', name: 'Thai Lion Air', country: 'Thailand', alliance: 'None' },
      { icao_code: 'BKP', iata_code: 'PG', name: 'Bangkok Airways', country: 'Thailand', alliance: 'None' },

      // Singapore Airlines
      { icao_code: 'SIA', iata_code: 'SQ', name: 'Singapore Airlines', country: 'Singapore', alliance: 'Star Alliance' },
      { icao_code: 'TGW', iata_code: 'TR', name: 'Scoot', country: 'Singapore', alliance: 'None' },
      { icao_code: 'JSA', iata_code: '3K', name: 'Jetstar Asia Airways', country: 'Singapore', alliance: 'None' },

      // Malaysian Airlines
      { icao_code: 'MAS', iata_code: 'MH', name: 'Malaysia Airlines', country: 'Malaysia', alliance: 'Oneworld' },
      { icao_code: 'AXM', iata_code: 'AK', name: 'AirAsia', country: 'Malaysia', alliance: 'None' },
      { icao_code: 'MXD', iata_code: 'OD', name: 'Malindo Air', country: 'Malaysia', alliance: 'None' },

      // Indonesian Airlines
      { icao_code: 'GIA', iata_code: 'GA', name: 'Garuda Indonesia', country: 'Indonesia', alliance: 'SkyTeam' },
      { icao_code: 'LNI', iata_code: 'JT', name: 'Lion Air', country: 'Indonesia', alliance: 'None' },
      { icao_code: 'AWQ', iata_code: 'QZ', name: 'Indonesia AirAsia', country: 'Indonesia', alliance: 'None' },
      { icao_code: 'BTK', iata_code: 'ID', name: 'Batik Air', country: 'Indonesia', alliance: 'None' },

      // Philippine Airlines
      { icao_code: 'PAL', iata_code: 'PR', name: 'Philippine Airlines', country: 'Philippines', alliance: 'None' },
      { icao_code: 'CEB', iata_code: '5J', name: 'Cebu Pacific', country: 'Philippines', alliance: 'None' },
      { icao_code: 'APG', iata_code: 'Z2', name: 'Philippines AirAsia', country: 'Philippines', alliance: 'None' },

      // Other ASEAN
      { icao_code: 'UBA', iata_code: 'PG', name: 'Myanmar National Airlines', country: 'Myanmar', alliance: 'None' },
      { icao_code: 'KMR', iata_code: 'K6', name: 'Cambodia Angkor Air', country: 'Cambodia', alliance: 'None' },
      { icao_code: 'LAO', iata_code: 'QV', name: 'Lao Airlines', country: 'Laos', alliance: 'None' },
      { icao_code: 'RBA', iata_code: 'BI', name: 'Royal Brunei Airlines', country: 'Brunei', alliance: 'None' },

      // East Asia
      { icao_code: 'JAL', iata_code: 'JL', name: 'Japan Airlines', country: 'Japan', alliance: 'Oneworld' },
      { icao_code: 'ANA', iata_code: 'NH', name: 'All Nippon Airways', country: 'Japan', alliance: 'Star Alliance' },
      { icao_code: 'KAL', iata_code: 'KE', name: 'Korean Air', country: 'South Korea', alliance: 'SkyTeam' },
      { icao_code: 'AAR', iata_code: 'OZ', name: 'Asiana Airlines', country: 'South Korea', alliance: 'Star Alliance' },
      { icao_code: 'CCA', iata_code: 'CA', name: 'Air China', country: 'China', alliance: 'Star Alliance' },
      { icao_code: 'CES', iata_code: 'MU', name: 'China Eastern Airlines', country: 'China', alliance: 'SkyTeam' },
      { icao_code: 'CSN', iata_code: 'CZ', name: 'China Southern Airlines', country: 'China', alliance: 'SkyTeam' },
      { icao_code: 'CAL', iata_code: 'CI', name: 'China Airlines', country: 'Taiwan', alliance: 'SkyTeam' },
      { icao_code: 'CPA', iata_code: 'CX', name: 'Cathay Pacific', country: 'Hong Kong', alliance: 'Oneworld' },

      // South Asia & Oceania
      { icao_code: 'AIC', iata_code: 'AI', name: 'Air India', country: 'India', alliance: 'Star Alliance' },
      { icao_code: 'QFA', iata_code: 'QF', name: 'Qantas', country: 'Australia', alliance: 'Oneworld' },
      { icao_code: 'ANZ', iata_code: 'NZ', name: 'Air New Zealand', country: 'New Zealand', alliance: 'Star Alliance' },

      // Middle East
      { icao_code: 'UAE', iata_code: 'EK', name: 'Emirates', country: 'United Arab Emirates', alliance: 'None' },
      { icao_code: 'QTR', iata_code: 'QR', name: 'Qatar Airways', country: 'Qatar', alliance: 'Oneworld' },
      { icao_code: 'THY', iata_code: 'TK', name: 'Turkish Airlines', country: 'Turkey', alliance: 'Star Alliance' },

      // Europe
      { icao_code: 'BAW', iata_code: 'BA', name: 'British Airways', country: 'United Kingdom', alliance: 'Oneworld' },
      { icao_code: 'AFR', iata_code: 'AF', name: 'Air France', country: 'France', alliance: 'SkyTeam' },
      { icao_code: 'DLH', iata_code: 'LH', name: 'Lufthansa', country: 'Germany', alliance: 'Star Alliance' },
      { icao_code: 'KLM', iata_code: 'KL', name: 'KLM Royal Dutch Airlines', country: 'Netherlands', alliance: 'SkyTeam' },

      // North America
      { icao_code: 'UAL', iata_code: 'UA', name: 'United Airlines', country: 'United States', alliance: 'Star Alliance' },
      { icao_code: 'AAL', iata_code: 'AA', name: 'American Airlines', country: 'United States', alliance: 'Oneworld' },
      { icao_code: 'DAL', iata_code: 'DL', name: 'Delta Air Lines', country: 'United States', alliance: 'SkyTeam' },
    ]

    const { error: airlinesError } = await supabase
      .from('airlines')
      .upsert(airlines, { onConflict: 'icao_code' })

    if (airlinesError) {
      console.error('❌ Error seeding airlines:', airlinesError)
    } else {
      console.log(`✅ Seeded ${airlines.length} airlines\n`)
    }

    // 6. Seed City Pairs
    console.log('🗺️  Seeding city pairs...')
    const cityPairs = [
      // Domestic Vietnam
      { departure_airport: 'SGN', arrival_airport: 'HAN', block_time: 130, distance: 1166, route_type: 'domestic' as const, etops_required: false },
      { departure_airport: 'HAN', arrival_airport: 'SGN', block_time: 130, distance: 1166, route_type: 'domestic' as const, etops_required: false },
      { departure_airport: 'SGN', arrival_airport: 'DAD', block_time: 80, distance: 608, route_type: 'domestic' as const, etops_required: false },
      { departure_airport: 'DAD', arrival_airport: 'SGN', block_time: 80, distance: 608, route_type: 'domestic' as const, etops_required: false },
      { departure_airport: 'SGN', arrival_airport: 'CXR', block_time: 60, distance: 320, route_type: 'domestic' as const, etops_required: false },
      { departure_airport: 'CXR', arrival_airport: 'SGN', block_time: 60, distance: 320, route_type: 'domestic' as const, etops_required: false },
      { departure_airport: 'SGN', arrival_airport: 'PQC', block_time: 60, distance: 300, route_type: 'domestic' as const, etops_required: false },
      { departure_airport: 'PQC', arrival_airport: 'SGN', block_time: 60, distance: 300, route_type: 'domestic' as const, etops_required: false },
      { departure_airport: 'SGN', arrival_airport: 'HPH', block_time: 125, distance: 1100, route_type: 'domestic' as const, etops_required: false },
      { departure_airport: 'HPH', arrival_airport: 'SGN', block_time: 125, distance: 1100, route_type: 'domestic' as const, etops_required: false },
      { departure_airport: 'SGN', arrival_airport: 'VII', block_time: 90, distance: 750, route_type: 'domestic' as const, etops_required: false },
      { departure_airport: 'VII', arrival_airport: 'SGN', block_time: 90, distance: 750, route_type: 'domestic' as const, etops_required: false },
      { departure_airport: 'HAN', arrival_airport: 'DAD', block_time: 75, distance: 608, route_type: 'domestic' as const, etops_required: false },
      { departure_airport: 'DAD', arrival_airport: 'HAN', block_time: 75, distance: 608, route_type: 'domestic' as const, etops_required: false },
      { departure_airport: 'HAN', arrival_airport: 'CXR', block_time: 105, distance: 950, route_type: 'domestic' as const, etops_required: false },
      { departure_airport: 'CXR', arrival_airport: 'HAN', block_time: 105, distance: 950, route_type: 'domestic' as const, etops_required: false },
      { departure_airport: 'HAN', arrival_airport: 'PQC', block_time: 140, distance: 1350, route_type: 'domestic' as const, etops_required: false },
      { departure_airport: 'PQC', arrival_airport: 'HAN', block_time: 140, distance: 1350, route_type: 'domestic' as const, etops_required: false },
      { departure_airport: 'SGN', arrival_airport: 'DLI', block_time: 55, distance: 250, route_type: 'domestic' as const, etops_required: false },
      { departure_airport: 'DLI', arrival_airport: 'SGN', block_time: 55, distance: 250, route_type: 'domestic' as const, etops_required: false },
      { departure_airport: 'SGN', arrival_airport: 'VCA', block_time: 50, distance: 160, route_type: 'domestic' as const, etops_required: false },
      { departure_airport: 'VCA', arrival_airport: 'SGN', block_time: 50, distance: 160, route_type: 'domestic' as const, etops_required: false },
      { departure_airport: 'HAN', arrival_airport: 'HUI', block_time: 70, distance: 540, route_type: 'domestic' as const, etops_required: false },
      { departure_airport: 'HUI', arrival_airport: 'HAN', block_time: 70, distance: 540, route_type: 'domestic' as const, etops_required: false },

      // Regional from SGN
      { departure_airport: 'SGN', arrival_airport: 'BKK', block_time: 90, distance: 720, route_type: 'regional' as const, etops_required: false },
      { departure_airport: 'BKK', arrival_airport: 'SGN', block_time: 90, distance: 720, route_type: 'regional' as const, etops_required: false },
      { departure_airport: 'SGN', arrival_airport: 'SIN', block_time: 120, distance: 1070, route_type: 'regional' as const, etops_required: false },
      { departure_airport: 'SIN', arrival_airport: 'SGN', block_time: 120, distance: 1070, route_type: 'regional' as const, etops_required: false },
      { departure_airport: 'SGN', arrival_airport: 'KUL', block_time: 130, distance: 1170, route_type: 'regional' as const, etops_required: false },
      { departure_airport: 'KUL', arrival_airport: 'SGN', block_time: 130, distance: 1170, route_type: 'regional' as const, etops_required: false },
      { departure_airport: 'SGN', arrival_airport: 'HKG', block_time: 150, distance: 1510, route_type: 'international' as const, etops_required: false },
      { departure_airport: 'HKG', arrival_airport: 'SGN', block_time: 150, distance: 1510, route_type: 'international' as const, etops_required: false },
      { departure_airport: 'SGN', arrival_airport: 'TPE', block_time: 175, distance: 1650, route_type: 'international' as const, etops_required: false },
      { departure_airport: 'TPE', arrival_airport: 'SGN', block_time: 175, distance: 1650, route_type: 'international' as const, etops_required: false },
      { departure_airport: 'SGN', arrival_airport: 'ICN', block_time: 290, distance: 2880, route_type: 'international' as const, etops_required: false },
      { departure_airport: 'ICN', arrival_airport: 'SGN', block_time: 290, distance: 2880, route_type: 'international' as const, etops_required: false },
      { departure_airport: 'SGN', arrival_airport: 'NRT', block_time: 340, distance: 3360, route_type: 'international' as const, etops_required: false },
      { departure_airport: 'NRT', arrival_airport: 'SGN', block_time: 340, distance: 3360, route_type: 'international' as const, etops_required: false },
      { departure_airport: 'SGN', arrival_airport: 'PNH', block_time: 55, distance: 230, route_type: 'regional' as const, etops_required: false },
      { departure_airport: 'PNH', arrival_airport: 'SGN', block_time: 55, distance: 230, route_type: 'regional' as const, etops_required: false },
      { departure_airport: 'SGN', arrival_airport: 'VTE', block_time: 90, distance: 770, route_type: 'regional' as const, etops_required: false },
      { departure_airport: 'VTE', arrival_airport: 'SGN', block_time: 90, distance: 770, route_type: 'regional' as const, etops_required: false },
      { departure_airport: 'SGN', arrival_airport: 'CGK', block_time: 150, distance: 1410, route_type: 'international' as const, etops_required: false },
      { departure_airport: 'CGK', arrival_airport: 'SGN', block_time: 150, distance: 1410, route_type: 'international' as const, etops_required: false },
      { departure_airport: 'SGN', arrival_airport: 'MNL', block_time: 160, distance: 1480, route_type: 'international' as const, etops_required: false },
      { departure_airport: 'MNL', arrival_airport: 'SGN', block_time: 160, distance: 1480, route_type: 'international' as const, etops_required: false },

      // Regional from HAN
      { departure_airport: 'HAN', arrival_airport: 'BKK', block_time: 130, distance: 1120, route_type: 'international' as const, etops_required: false },
      { departure_airport: 'BKK', arrival_airport: 'HAN', block_time: 130, distance: 1120, route_type: 'international' as const, etops_required: false },
      { departure_airport: 'HAN', arrival_airport: 'SIN', block_time: 210, distance: 2150, route_type: 'international' as const, etops_required: false },
      { departure_airport: 'SIN', arrival_airport: 'HAN', block_time: 210, distance: 2150, route_type: 'international' as const, etops_required: false },
      { departure_airport: 'HAN', arrival_airport: 'PVG', block_time: 185, distance: 1780, route_type: 'international' as const, etops_required: false },
      { departure_airport: 'PVG', arrival_airport: 'HAN', block_time: 185, distance: 1780, route_type: 'international' as const, etops_required: false },
      { departure_airport: 'HAN', arrival_airport: 'ICN', block_time: 240, distance: 2310, route_type: 'international' as const, etops_required: false },
      { departure_airport: 'ICN', arrival_airport: 'HAN', block_time: 240, distance: 2310, route_type: 'international' as const, etops_required: false },
      { departure_airport: 'HAN', arrival_airport: 'NRT', block_time: 280, distance: 2770, route_type: 'international' as const, etops_required: false },
      { departure_airport: 'NRT', arrival_airport: 'HAN', block_time: 280, distance: 2770, route_type: 'international' as const, etops_required: false },
      { departure_airport: 'HAN', arrival_airport: 'HKG', block_time: 135, distance: 1070, route_type: 'international' as const, etops_required: false },
      { departure_airport: 'HKG', arrival_airport: 'HAN', block_time: 135, distance: 1070, route_type: 'international' as const, etops_required: false },
      { departure_airport: 'HAN', arrival_airport: 'KUL', block_time: 180, distance: 1770, route_type: 'international' as const, etops_required: false },
      { departure_airport: 'KUL', arrival_airport: 'HAN', block_time: 180, distance: 1770, route_type: 'international' as const, etops_required: false },

      // Long haul
      { departure_airport: 'SGN', arrival_airport: 'LHR', block_time: 770, distance: 10600, route_type: 'ultra-long-haul' as const, etops_required: true },
      { departure_airport: 'LHR', arrival_airport: 'SGN', block_time: 740, distance: 10600, route_type: 'ultra-long-haul' as const, etops_required: true },
      { departure_airport: 'SGN', arrival_airport: 'CDG', block_time: 760, distance: 10400, route_type: 'ultra-long-haul' as const, etops_required: true },
      { departure_airport: 'CDG', arrival_airport: 'SGN', block_time: 730, distance: 10400, route_type: 'ultra-long-haul' as const, etops_required: true },
      { departure_airport: 'SGN', arrival_airport: 'SYD', block_time: 490, distance: 6050, route_type: 'long-haul' as const, etops_required: true },
      { departure_airport: 'SYD', arrival_airport: 'SGN', block_time: 520, distance: 6050, route_type: 'long-haul' as const, etops_required: true },
      { departure_airport: 'SGN', arrival_airport: 'FRA', block_time: 750, distance: 10300, route_type: 'ultra-long-haul' as const, etops_required: true },
      { departure_airport: 'FRA', arrival_airport: 'SGN', block_time: 720, distance: 10300, route_type: 'ultra-long-haul' as const, etops_required: true },
      { departure_airport: 'HAN', arrival_airport: 'FRA', block_time: 720, distance: 9800, route_type: 'ultra-long-haul' as const, etops_required: true },
      { departure_airport: 'FRA', arrival_airport: 'HAN', block_time: 690, distance: 9800, route_type: 'ultra-long-haul' as const, etops_required: true },
      { departure_airport: 'SGN', arrival_airport: 'MEL', block_time: 510, distance: 6300, route_type: 'long-haul' as const, etops_required: true },
      { departure_airport: 'MEL', arrival_airport: 'SGN', block_time: 540, distance: 6300, route_type: 'long-haul' as const, etops_required: true },
    ]

    const { error: cityPairsError } = await supabase
      .from('city_pairs')
      .upsert(cityPairs, { onConflict: 'departure_airport,arrival_airport' })

    if (cityPairsError) {
      console.error('❌ Error seeding city pairs:', cityPairsError)
    } else {
      console.log(`✅ Seeded ${cityPairs.length} city pairs\n`)
    }

    // 7. Update user to super_admin
    console.log('👤 Updating user role to super_admin...')
    const { data: userData, error: userLookupError } = await supabase.auth.admin.listUsers()

    if (userLookupError) {
      console.error('❌ Error looking up user:', userLookupError)
    } else {
      const targetUser = userData?.users.find(u => u.email === 'vivimassa@live.com')

      if (targetUser) {
        const { error: operatorUpdateError } = await supabase
          .from('operators')
          .update({
            role: 'super_admin',
            enabled_modules: ['home', 'network', 'operations', 'workforce', 'reports', 'admin']
          })
          .eq('user_id', targetUser.id)

        if (operatorUpdateError) {
          console.error('❌ Error updating operator role:', operatorUpdateError)
        } else {
          console.log(`✅ Updated user ${targetUser.email} to super_admin\n`)
        }
      } else {
        console.log('⚠️  User vivimassa@live.com not found\n')
      }
    }

    console.log('✨ Database seeding completed successfully!\n')
    console.log('📊 Summary:')
    console.log(`   - ${countries.length} countries`)
    console.log(`   - ${airports.length} airports`)
    console.log(`   - ${aircraftTypes.length} aircraft types`)
    console.log(`   - ${airlines.length} airlines`)
    console.log(`   - ${cityPairs.length} city pairs`)
    console.log('\n⚠️  Note: user_roles and user_preferences tables do not exist in current schema')
    console.log('   Consider creating migrations for these tables if needed.')

  } catch (error) {
    console.error('💥 Fatal error during seeding:', error)
    process.exit(1)
  }
}

seedDatabase()
