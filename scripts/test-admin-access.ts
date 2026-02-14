import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '../lib/supabase/admin'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(__dirname, '../.env.local') })

async function testAdminAccess() {
  console.log('🧪 Testing admin access logic...\n')

  const adminClient = createAdminClient()
  
  // Get the test user
  const { data: users } = await adminClient.auth.admin.listUsers()
  const user = users?.users.find(u => u.email === 'vivimassa@live.com')

  if (!user) {
    console.error('❌ User not found')
    return
  }

  console.log('✅ User ID:', user.id)

  // Simulate getCurrentOperator logic
  const { data: operator } = await adminClient
    .from('operators')
    .select('*')
    .limit(1)
    .maybeSingle()

  console.log('✅ Operator:', operator?.name)

  // Get user's role
  const { data: userRole } = await adminClient
    .from('user_roles')
    .select('*')
    .eq('user_id', user.id)
    .eq('operator_id', operator!.id)
    .maybeSingle()

  console.log('✅ User role:', userRole?.role)

  // Test access logic
  const operatorWithRole = {
    ...operator!,
    user_role: userRole?.role || null,
    user_role_id: userRole?.id || null
  }

  console.log('\n📋 Access checks:')
  console.log('   Has admin module access:', 
    operatorWithRole.user_role === 'admin' || operatorWithRole.user_role === 'super_admin'
  )
  console.log('   Is admin:', 
    operatorWithRole.user_role === 'admin' || operatorWithRole.user_role === 'super_admin'
  )
  console.log('   Is super admin:', 
    operatorWithRole.user_role === 'super_admin'
  )

  console.log('\n✨ Admin access should work now!')
}

testAdminAccess()
