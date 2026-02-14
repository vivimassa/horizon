import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkSchema() {
  console.log('🔍 Checking database schema...\n')

  const tablesToCheck = ['operators', 'operator_profile', 'airports', 'countries', 'aircraft_types', 'airlines', 'city_pairs']

  for (const table of tablesToCheck) {
    console.log(`\n📋 Checking table: ${table}`)
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(1)

    if (error) {
      console.log(`   ❌ Error: ${error.message}`)
      console.log(`   Details: ${JSON.stringify(error, null, 2)}`)
    } else {
      if (data && data.length > 0) {
        console.log(`   ✅ Table exists with data`)
        console.log(`   📝 Columns: ${Object.keys(data[0]).join(', ')}`)
      } else {
        console.log(`   ✅ Table exists but is empty`)
      }
    }
  }
}

checkSchema()
