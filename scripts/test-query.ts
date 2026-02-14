import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testQueries() {
  console.log('Testing simple queries on each table...\n')

  // Test countries with minimal columns that should exist based on migration
  console.log('1. Testing countries table:')
  const { data: c1, error: e1 } = await supabase.from('countries').select('iso_code, name').limit(1)
  console.log('   Result:', e1 ? e1.message : 'Success')

  // Test airports
  console.log('\n2. Testing airports table:')
  const { data: a1, error: e2 } = await supabase.from('airports').select('icao_code, iata_code').limit(1)
  console.log('   Result:', e2 ? e2.message : 'Success')

  // Try with old column names that might exist
  console.log('\n3. Testing airports with name column:')
  const { data: a2, error: e3 } = await supabase.from('airports').select('icao_code, name').limit(1)
  console.log('   Result:', e3 ? e3.message : 'Success - name column exists!')

  // Test aircraft_types
  console.log('\n4. Testing aircraft_types:')
  const { data: at1, error: e4 } = await supabase.from('aircraft_types').select('icao_type, name').limit(1)
  console.log('   Result:', e4 ? e4.message : 'Success')

  // Test airlines
  console.log('\n5. Testing airlines:')
  const { data: al1, error: e5 } = await supabase.from('airlines').select('icao_code, name').limit(1)
  console.log('   Result:', e5 ? e5.message : 'Success')

  // Test city_pairs
  console.log('\n6. Testing city_pairs:')
  const { data: cp1, error: e6 } = await supabase.from('city_pairs').select('departure_airport').limit(1)
  console.log('   Result:', e6 ? e6.message : 'Success')

  // Try inserting a test country to see what columns are required
  console.log('\n7. Trying test insert to see required columns:')
  const { error: e7 } = await supabase.from('countries').insert({
    iso_code: 'XX',
    name: 'Test Country'
  })
  console.log('   Result:', e7 ? e7.message : 'Insert succeeded (will rollback)')

  // Delete it
  if (!e7) {
    await supabase.from('countries').delete().eq('iso_code', 'XX')
  }
}

testQueries()
