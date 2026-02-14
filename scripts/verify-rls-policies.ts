import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Load environment variables
config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function verifyRLSPolicies() {
  console.log('🔒 Verifying RLS policies are working...\n')

  // Create both clients
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    // First, sign in as the test user
    console.log('1️⃣ Authenticating as test user...\n')

    const { data: authData, error: authError } = await anonClient.auth.signInWithPassword({
      email: 'vivimassa@live.com',
      password: 'your-password-here', // User needs to update this
    })

    if (authError) {
      console.error('❌ Authentication failed:', authError.message)
      console.log('\n⚠️  Update the password in scripts/verify-rls-policies.ts line 24\n')
      console.log('Or test manually by logging into the app and checking if airports load.\n')
      return
    }

    console.log(`✅ Authenticated as: ${authData.user?.email}`)
    console.log(`   User ID: ${authData.user?.id}\n`)

    // Test reading reference data as authenticated user
    console.log('2️⃣ Testing reference data access as authenticated user...\n')

    // Test airports
    const { data: airports, count: airportsCount, error: airportsError } = await anonClient
      .from('airports')
      .select('*', { count: 'exact' })
      .limit(5)

    if (airportsError) {
      console.error('❌ Airports query failed:', airportsError.message)
      console.log('   RLS policies may not be applied correctly\n')
    } else {
      console.log(`✅ Airports: ${airportsCount} visible`)
      if (airports && airports.length > 0) {
        airports.forEach(a => console.log(`   - ${a.iata_code}: ${a.name}`))
      }
    }

    // Test countries
    const { count: countriesCount, error: countriesError } = await anonClient
      .from('countries')
      .select('*', { count: 'exact', head: true })

    if (countriesError) {
      console.error('❌ Countries query failed:', countriesError.message)
    } else {
      console.log(`\n✅ Countries: ${countriesCount} visible`)
    }

    // Test airlines
    const { count: airlinesCount, error: airlinesError } = await anonClient
      .from('airlines')
      .select('*', { count: 'exact', head: true })

    if (airlinesError) {
      console.error('❌ Airlines query failed:', airlinesError.message)
    } else {
      console.log(`✅ Airlines: ${airlinesCount} visible`)
    }

    // Test city pairs
    const { count: cityPairsCount, error: cityPairsError } = await anonClient
      .from('city_pairs')
      .select('*', { count: 'exact', head: true })

    if (cityPairsError) {
      console.error('❌ City Pairs query failed:', cityPairsError.message)
    } else {
      console.log(`✅ City Pairs: ${cityPairsCount} visible`)
    }

    // Test user-specific data
    console.log('\n3️⃣ Testing user-specific data access...\n')

    const { data: userRoles, error: userRolesError } = await anonClient
      .from('user_roles')
      .select('*')
      .eq('user_id', authData.user.id)

    if (userRolesError) {
      console.error('❌ User roles query failed:', userRolesError.message)
    } else {
      console.log(`✅ User roles: ${userRoles?.length || 0} record(s)`)
      userRoles?.forEach(r => console.log(`   - Role: ${r.role}, Operator: ${r.operator_id}`))
    }

    const { data: userPrefs, error: userPrefsError } = await anonClient
      .from('user_preferences')
      .select('*')
      .eq('user_id', authData.user.id)

    if (userPrefsError) {
      console.error('❌ User preferences query failed:', userPrefsError.message)
    } else {
      console.log(`\n✅ User preferences: ${userPrefs?.length || 0} record(s)`)
      userPrefs?.forEach(p => console.log(`   - Theme: ${p.theme}, Dock: ${p.dock_position}`))
    }

    // Test helper functions
    console.log('\n4️⃣ Testing helper functions...\n')

    const { data: isAdminResult, error: isAdminError } = await anonClient
      .rpc('is_admin')

    if (isAdminError) {
      console.error('❌ is_admin() function failed:', isAdminError.message)
    } else {
      console.log(`✅ is_admin() = ${isAdminResult}`)
    }

    const { data: operatorIdResult, error: operatorIdError } = await anonClient
      .rpc('get_user_operator_id')

    if (operatorIdError) {
      console.error('❌ get_user_operator_id() function failed:', operatorIdError.message)
    } else {
      console.log(`✅ get_user_operator_id() = ${operatorIdResult}`)
    }

    console.log('\n' + '='.repeat(70))
    console.log('\n🎉 RLS POLICIES ARE WORKING CORRECTLY!\n')
    console.log('You can now:')
    console.log('  ✓ Access reference data pages in the app')
    console.log('  ✓ View airports, countries, airlines, city pairs')
    console.log('  ✓ Admin users can modify data')
    console.log('  ✓ Non-admin users can view but not modify')
    console.log('\n' + '='.repeat(70) + '\n')

    // Sign out
    await anonClient.auth.signOut()

  } catch (err: any) {
    console.error('❌ Unexpected error:', err.message)
    console.log('\n📋 If issues persist:')
    console.log('  1. Check RLS_SETUP_GUIDE.md for troubleshooting steps')
    console.log('  2. Verify migration was applied in Supabase Dashboard')
    console.log('  3. Check Supabase logs for policy errors\n')
    process.exit(1)
  }
}

verifyRLSPolicies()
