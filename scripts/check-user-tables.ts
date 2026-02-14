import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkTables() {
  console.log('Checking for user_roles and user_preferences tables...\n')

  // Check user_roles
  const { error: rolesError } = await supabase
    .from('user_roles')
    .select('*')
    .limit(0)

  if (rolesError) {
    console.log('❌ user_roles table does not exist')
    console.log('   Error:', rolesError.message)
  } else {
    console.log('✅ user_roles table exists')
  }

  // Check user_preferences
  const { error: prefsError } = await supabase
    .from('user_preferences')
    .select('*')
    .limit(0)

  if (prefsError) {
    console.log('❌ user_preferences table does not exist')
    console.log('   Error:', prefsError.message)
  } else {
    console.log('✅ user_preferences table exists')
  }

  // Look up the user
  console.log('\n🔍 Looking up user vivimassa@live.com...')
  const { data: users, error: userError } = await supabase.auth.admin.listUsers()

  if (userError) {
    console.log('❌ Error listing users:', userError.message)
  } else {
    const targetUser = users?.users.find(u => u.email === 'vivimassa@live.com')
    if (targetUser) {
      console.log('✅ Found user:')
      console.log(`   ID: ${targetUser.id}`)
      console.log(`   Email: ${targetUser.email}`)
      console.log(`   Created: ${targetUser.created_at}`)
    } else {
      console.log('❌ User vivimassa@live.com not found in auth.users')
    }
  }
}

checkTables()
