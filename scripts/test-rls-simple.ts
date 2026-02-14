import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function testRLS() {
  console.log('🔒 Testing RLS policies (using service role to check policy existence)...\n')

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    // Check if helper functions exist
    console.log('1️⃣ Testing helper functions...\n')

    const { data: functions, error: funcError } = await supabase
      .rpc('is_admin')
      .then(() => ({ data: 'exists', error: null }))
      .catch((err) => ({ data: null, error: err }))

    if (funcError) {
      console.log('❌ is_admin() function not found - RLS policies may not be applied')
      console.log('   Please apply the migration in Supabase Dashboard\n')
    } else {
      console.log('✅ is_admin() function exists')
    }

    // Check policies on airports table
    console.log('\n2️⃣ Checking policies on airports table...\n')

    const { data: policies, error: policyError } = await supabase
      .from('pg_policies')
      .select('policyname, tablename, cmd')
      .eq('tablename', 'airports')
      .eq('schemaname', 'public')

    if (policyError) {
      console.log('⚠️  Could not query pg_policies table')
    } else if (policies && policies.length > 0) {
      console.log(`✅ Found ${policies.length} policies on airports table:`)
      policies.forEach((p: any) => {
        console.log(`   - ${p.policyname} (${p.cmd})`)
      })
    } else {
      console.log('❌ No policies found on airports table')
      console.log('   RLS migration needs to be applied\n')
    }

    // Test data access
    console.log('\n3️⃣ Testing data access...\n')

    const { data: airports, count, error } = await supabase
      .from('airports')
      .select('*', { count: 'exact' })
      .limit(5)

    if (error) {
      console.log('❌ Error fetching airports:', error.message)
    } else {
      console.log(`✅ Can access airports: ${count} total`)
      airports?.forEach(a => console.log(`   - ${a.iata_code}: ${a.name}`))
    }

    console.log('\n' + '='.repeat(70))
    console.log('\n✅ RLS POLICIES VERIFICATION COMPLETE\n')
    console.log('To fully test authenticated user access:')
    console.log('  1. Open: http://localhost:3000/login')
    console.log('  2. Login with your credentials')
    console.log('  3. Navigate to: Admin > Reference Data > Airports')
    console.log('  4. Verify you can see all 63 airports\n')
    console.log('='.repeat(70) + '\n')

  } catch (err: any) {
    console.error('❌ Error:', err.message)
  }
}

testRLS()
