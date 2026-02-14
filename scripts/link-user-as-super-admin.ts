import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function linkUser() {
  console.log('🔗 Linking user vivimassa@live.com as super_admin for operator HZN...\n')

  // 1. Get user ID
  console.log('1️⃣  Looking up user...')
  const { data: users, error: userError } = await supabase.auth.admin.listUsers()
  
  if (userError) {
    console.error('❌ Error listing users:', userError.message)
    return
  }

  const targetUser = users?.users.find(u => u.email === 'vivimassa@live.com')
  
  if (!targetUser) {
    console.error('❌ User vivimassa@live.com not found')
    return
  }

  const userId = targetUser.id
  console.log(`   ✅ Found user: ${userId}\n`)

  // 2. Get operator ID for HZN
  console.log('2️⃣  Looking up operator HZN...')
  const { data: operator, error: opError } = await supabase
    .from('operators')
    .select('id, code, name')
    .eq('code', 'HZN')
    .single()

  if (opError || !operator) {
    console.error('❌ Error finding operator HZN:', opError?.message)
    return
  }

  const operatorId = operator.id
  console.log(`   ✅ Found operator: ${operator.name} (${operatorId})\n`)

  // 3. Check if user_role already exists
  console.log('3️⃣  Checking existing user_roles...')
  const { data: existingRole } = await supabase
    .from('user_roles')
    .select('*')
    .eq('user_id', userId)
    .eq('operator_id', operatorId)
    .maybeSingle()

  if (existingRole) {
    console.log('   ⚠️  User role already exists, updating...')
    const { error: updateError } = await supabase
      .from('user_roles')
      .update({ role: 'super_admin' })
      .eq('id', existingRole.id)

    if (updateError) {
      console.error('   ❌ Error updating user role:', updateError.message)
    } else {
      console.log('   ✅ Updated user role to super_admin\n')
    }
  } else {
    console.log('   Creating new user role...')
    const { error: insertError } = await supabase
      .from('user_roles')
      .insert({
        user_id: userId,
        operator_id: operatorId,
        role: 'super_admin'
      })

    if (insertError) {
      console.error('   ❌ Error creating user role:', insertError.message)
    } else {
      console.log('   ✅ Created user role: super_admin\n')
    }
  }

  // 4. Check if user_preferences already exists
  console.log('4️⃣  Checking existing user_preferences...')
  const { data: existingPrefs } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .eq('operator_id', operatorId)
    .maybeSingle()

  if (existingPrefs) {
    console.log('   ⚠️  User preferences already exist, updating...')
    const { error: updateError } = await supabase
      .from('user_preferences')
      .update({
        dock_position: 'bottom',
        theme: 'light',
        time_display: 'both'
      })
      .eq('id', existingPrefs.id)

    if (updateError) {
      console.error('   ❌ Error updating user preferences:', updateError.message)
    } else {
      console.log('   ✅ Updated user preferences\n')
    }
  } else {
    console.log('   Creating new user preferences...')
    const { error: insertError } = await supabase
      .from('user_preferences')
      .insert({
        user_id: userId,
        operator_id: operatorId,
        dock_position: 'bottom',
        theme: 'light',
        time_display: 'both'
      })

    if (insertError) {
      console.error('   ❌ Error creating user preferences:', insertError.message)
    } else {
      console.log('   ✅ Created user preferences\n')
    }
  }

  // 5. Verify
  console.log('5️⃣  Verification:')
  const { data: finalRole } = await supabase
    .from('user_roles')
    .select('*')
    .eq('user_id', userId)
    .eq('operator_id', operatorId)
    .single()

  const { data: finalPrefs } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .eq('operator_id', operatorId)
    .single()

  if (finalRole && finalPrefs) {
    console.log('   ✅ User role:', finalRole.role)
    console.log('   ✅ User preferences:', {
      dock_position: finalPrefs.dock_position,
      theme: finalPrefs.theme,
      time_display: finalPrefs.time_display
    })
    console.log('\n✨ Successfully linked user vivimassa@live.com as super_admin for operator HZN!')
  } else {
    console.error('   ❌ Verification failed')
  }
}

linkUser()
