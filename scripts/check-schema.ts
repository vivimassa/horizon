import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  // Check countries columns
  const { data: countries } = await supabase.from('countries').select('*').limit(1)
  console.log('=== COUNTRIES COLUMNS ===')
  if (countries?.[0]) {
    console.log(Object.keys(countries[0]).join(', '))
    console.log('Sample:', JSON.stringify(countries[0], null, 2))
  }

  // Check timezone_zones columns
  const { data: zones } = await supabase.from('timezone_zones').select('*').limit(1)
  console.log('\n=== TIMEZONE_ZONES COLUMNS ===')
  if (zones?.[0]) {
    console.log(Object.keys(zones[0]).join(', '))
    console.log('Sample:', JSON.stringify(zones[0], null, 2))
  } else {
    console.log('(no rows)')
  }

  // Check airports columns
  const { data: airports } = await supabase.from('airports').select('*').limit(1)
  console.log('\n=== AIRPORTS COLUMNS ===')
  if (airports?.[0]) {
    console.log(Object.keys(airports[0]).join(', '))
  }

  // Count existing data
  const { count: countryCount } = await supabase.from('countries').select('*', { count: 'exact', head: true })
  const { count: zoneCount } = await supabase.from('timezone_zones').select('*', { count: 'exact', head: true })
  const { count: airportCount } = await supabase.from('airports').select('*', { count: 'exact', head: true })

  console.log(`\n=== COUNTS ===`)
  console.log(`Countries: ${countryCount}`)
  console.log(`Timezone Zones: ${zoneCount}`)
  console.log(`Airports: ${airportCount}`)
}

main().catch(console.error)
