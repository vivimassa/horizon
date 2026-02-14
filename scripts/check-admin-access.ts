import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkAdminAccess() {
  console.log('🔍 Checking admin access for vivimassa@live.com...\n')

  // 1. Get user
  const { data: users } = await supabase.auth.admin.listUsers()
  const user = users?.users.find(u => u.email === 'vivimassa@live.com')

  if (!user) {
    console.error('❌ User not found')
    return
  }

  console.log('✅ User found:', user.id)
  console.log('   Email:', user.email)

  // 2. Check user_roles
  const { data: userRole, error: roleError } = await supabase
    .from('user_roles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  console.log('\n📋 user_roles table:')
  if (roleError) {
    console.error('   ❌ Error:', roleError.message)
  } else if (userRole) {
    console.log('   ✅ Role found:', userRole.role)
    console.log('   Operator ID:', userRole.operator_id)
    console.log('   Created:', userRole.created_at)
  } else {
    console.log('   ❌ No role found for this user')
  }

  // 3. Check operators table (old system)
  const { data: operator, error: opError } = await supabase
    .from('operators')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  console.log('\n📋 operators table (legacy):')
  if (opError) {
    console.error('   ❌ Error:', opError.message)
  } else if (operator) {
    console.log('   ⚠️  Found operator record:')
    console.log('   Role:', operator.role || 'N/A')
    console.log('   Enabled modules:', operator.enabled_modules || 'N/A')
  } else {
    console.log('   ℹ️  No operator record (this is OK if using user_roles)')
  }
}

checkAdminAccess()
