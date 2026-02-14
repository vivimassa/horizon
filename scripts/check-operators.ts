import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkOperators() {
  const commonColumns = [
    'id', 'created_at', 'updated_at',
    'code', 'icao_code', 'iata_code', 'name', 'company_name',
    'country', 'country_id', 'timezone', 'regulatory_authority',
    'enabled_modules', 'user_id', 'email', 'role', 'status'
  ]

  const existingColumns = []

  for (const column of commonColumns) {
    const { error } = await supabase
      .from('operators')
      .select(column)
      .limit(0)
    
    if (!error) {
      existingColumns.push(column)
    }
  }

  console.log('📋 Operators table columns:')
  console.log(`   ${existingColumns.join(', ')}`)

  // Try inserting with minimal fields to see what's required
  console.log('\n🧪 Testing insert with minimal fields...')
  const { error } = await supabase.from('operators').insert({
    code: 'HZN'
  } as any)
  
  if (error) {
    console.log(`   Error: ${error.message}`)
  }
}

checkOperators()
