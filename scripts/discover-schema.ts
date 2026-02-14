import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function discoverSchema() {
  console.log('🔍 Discovering actual schema by inserting test records...\n')

  const tables = ['countries', 'airports', 'aircraft_types', 'airlines', 'city_pairs']

  for (const table of tables) {
    console.log(`\n📋 Table: ${table}`)

    // Try to select all columns
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(1)

    if (data && data.length > 0) {
      console.log(`   Columns: ${Object.keys(data[0]).join(', ')}`)
    } else if (!error) {
      console.log(`   Table is empty, trying insert to discover required columns...`)

      // Try inserting empty object to see error
      const { error: insertError } = await supabase
        .from(table)
        .insert({} as any)

      if (insertError) {
        console.log(`   Error: ${insertError.message}`)
        // Extract column name from error if possible
        const match = insertError.message.match(/column "([^"]+)"/)
        if (match) {
          console.log(`   Discovered column: ${match[1]}`)
        }
      }
    } else {
      console.log(`   Error querying: ${error.message}`)
    }
  }

  console.log('\n\n📋 Checking operators table specifically:')
  const { data: operators } = await supabase
    .from('operators')
    .select('*')
    .limit(1)

  if (operators && operators.length > 0) {
    console.log(`   Columns: ${Object.keys(operators[0]).join(', ')}`)
  } else {
    console.log(`   Operators table is empty`)
  }
}

discoverSchema()
