import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkFullSchema() {
  console.log('🔍 Checking full schema by attempting inserts...\n')

  // Test countries
  console.log('1️⃣  COUNTRIES TABLE:')
  const { error: c1 } = await supabase.from('countries').insert({ iso_code_2: 'US', name: 'Test' } as any)
  console.log(`   - iso_code_2, name: ${c1 ? c1.message : 'OK'}`)

  const { error: c2 } = await supabase.from('countries').insert({ iso_code_2: 'US2', name: 'Test', region: 'Test' } as any)
  console.log(`   - with region: ${c2 ? c2.message : 'OK'}`)

  const { error: c3 } = await supabase.from('countries').insert({
    iso_code_2: 'US3',
    name: 'Test',
    region: 'Test',
    icao_prefix: 'K'
  } as any)
  console.log(`   - with icao_prefix: ${c3 ? c3.message : 'OK - SUCCESS'}`)

  if (!c3) {
    await supabase.from('countries').delete().in('iso_code_2', ['US', 'US2', 'US3'])
  }

  // Test airports
  console.log('\n2️⃣  AIRPORTS TABLE:')
  const { error: a1 } = await supabase.from('airports').insert({
    icao_code: 'TEST',
    name: 'Test Airport',
    city: 'Test City',
    country_id: '00000000-0000-0000-0000-000000000000'
  } as any)
  console.log(`   Result: ${a1 ? a1.message : 'OK'}`)

  // Test aircraft_types with operator
  console.log('\n3️⃣  AIRCRAFT_TYPES TABLE:')
  console.log('   Note: Requires operator_id (foreign key)')

  // Test airlines
  console.log('\n4️⃣  AIRLINES TABLE:')
  const { error: al1 } = await supabase.from('airlines').insert({
    icao_code: 'TST',
    name: 'Test Airline'
  } as any)
  console.log(`   Result: ${al1 ? al1.message : 'OK'}`)

  // Test city_pairs
  console.log('\n5️⃣  CITY_PAIRS TABLE:')
  console.log('   Note: Uses departure_airport_id, arrival_airport_id (foreign keys to airports)')

  console.log('\n✅ Schema discovery complete!')
  console.log('\n📝 Summary:')
  console.log('   - countries: iso_code_2, name, region, icao_prefix')
  console.log('   - airports: icao_code, name, city, country_id (FK)')
  console.log('   - aircraft_types: operator_id (FK), other fields TBD')
  console.log('   - airlines: icao_code, name, other fields TBD')
  console.log('   - city_pairs: departure_airport_id (FK), arrival_airport_id (FK), other fields TBD')
}

checkFullSchema()
