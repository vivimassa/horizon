import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function discoverSchema() {
  console.log('🔍 Discovering schema for user tables...\n')

  // Common column names to test
  const commonColumns = [
    'id', 'created_at', 'updated_at',
    'user_id', 'operator_id', 'role', 'status',
    'dock_position', 'theme', 'time_display', 'language',
    'notifications_enabled', 'timezone_override'
  ]

  // Test user_roles
  console.log('📋 user_roles table:')
  const rolesColumns = []
  for (const col of commonColumns) {
    const { error } = await supabase
      .from('user_roles')
      .select(col)
      .limit(0)
    if (!error) rolesColumns.push(col)
  }
  console.log(`   Columns: ${rolesColumns.join(', ')}\n`)

  // Test user_preferences
  console.log('📋 user_preferences table:')
  const prefsColumns = []
  for (const col of commonColumns) {
    const { error } = await supabase
      .from('user_preferences')
      .select(col)
      .limit(0)
    if (!error) prefsColumns.push(col)
  }
  console.log(`   Columns: ${prefsColumns.join(', ')}\n`)

  // Try inserting to see required fields
  console.log('🧪 Testing insert to find required fields...\n')

  console.log('Testing user_roles:')
  const { error: rolesError } = await supabase
    .from('user_roles')
    .insert({ test: 'test' } as any)
  console.log(`   Error: ${rolesError?.message || 'Unknown'}\n`)

  console.log('Testing user_preferences:')
  const { error: prefsError } = await supabase
    .from('user_preferences')
    .insert({ test: 'test' } as any)
  console.log(`   Error: ${prefsError?.message || 'Unknown'}`)
}

discoverSchema()
