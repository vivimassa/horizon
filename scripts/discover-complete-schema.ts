import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function discoverCompleteSchema() {
  console.log('🔍 Discovering complete schema from database...\n')
  console.log('This will test column by column to understand the schema.\n')

  // Helper to test if a column exists
  const testColumn = async (table: string, column: string) => {
    const { error } = await supabase
      .from(table)
      .select(column)
      .limit(0)
    return !error
  }

  // Test common column names for each table
  const commonColumns = [
    'id', 'created_at', 'updated_at',
    // Country columns
    'iso_code', 'iso_code_2', 'iso_code_3', 'name', 'region', 'currency', 'icao_prefix',
    // Airport columns
    'icao_code', 'iata_code', 'airport_name', 'city', 'country', 'country_id', 'timezone', 'latitude', 'longitude',
    // Aircraft columns
    'operator_id', 'icao_type', 'iata_type', 'family', 'category', 'pax_capacity', 'cockpit_crew', 'cabin_crew', 'rest_facility_class',
    // Airline columns
    'alliance', 'callsign',
    // City pair columns
    'departure_airport', 'arrival_airport', 'departure_airport_id', 'arrival_airport_id', 'block_time', 'distance', 'route_type', 'etops_required'
  ]

  const tables = ['countries', 'airports', 'aircraft_types', 'airlines', 'city_pairs', 'operators']

  for (const table of tables) {
    console.log(`\n📋 Table: ${table}`)
    const existingColumns = []

    for (const column of commonColumns) {
      if (await testColumn(table, column)) {
        existingColumns.push(column)
      }
    }

    console.log(`   Columns found: ${existingColumns.join(', ')}`)
  }

  console.log('\n✅ Schema discovery complete!')
}

discoverCompleteSchema()
