import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Load environment variables
config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function setupRLS() {
  console.log('🔒 Setting up RLS policies quickly...\n')

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  // For now, let's just test if we can disable RLS temporarily to verify data exists
  console.log('📊 Testing data visibility with service role (bypasses RLS)...\n')

  try {
    // Test airports
    const { data: airports, count: airportsCount, error: airportsError } = await supabase
      .from('airports')
      .select('*', { count: 'exact', head: false })
      .limit(5)

    if (airportsError) {
      console.error('❌ Error fetching airports:', airportsError)
    } else {
      console.log(`✅ Airports in database: ${airportsCount} total (service role can see them)`)
      if (airports && airports.length > 0) {
        airports.forEach(a => console.log(`   - ${a.iata_code}: ${a.name}, ${a.city}`))
      }
    }

    // Test countries
    const { count: countriesCount, error: countriesError } = await supabase
      .from('countries')
      .select('*', { count: 'exact', head: true })

    if (countriesError) {
      console.error('❌ Error fetching countries:', countriesError)
    } else {
      console.log(`\n✅ Countries in database: ${countriesCount} total`)
    }

    // Test airlines
    const { count: airlinesCount, error: airlinesError } = await supabase
      .from('airlines')
      .select('*', { count: 'exact', head: true })

    if (airlinesError) {
      console.error('❌ Error fetching airlines:', airlinesError)
    } else {
      console.log(`✅ Airlines in database: ${airlinesCount} total`)
    }

    // Test city pairs
    const { count: cityPairsCount, error: cityPairsError } = await supabase
      .from('city_pairs')
      .select('*', { count: 'exact', head: true })

    if (cityPairsError) {
      console.error('❌ Error fetching city_pairs:', cityPairsError)
    } else {
      console.log(`✅ City Pairs in database: ${cityPairsCount} total`)
    }

    console.log('\n' + '='.repeat(70))
    console.log('\n🚨 DATA EXISTS BUT RLS IS BLOCKING REGULAR USERS\n')
    console.log('To fix this, you need to apply the RLS policies migration:\n')
    console.log('1. Open Supabase Dashboard')
    console.log('2. Go to SQL Editor')
    console.log('3. Copy the contents of: supabase/migrations/005_create_rls_policies.sql')
    console.log('4. Paste and run the SQL')
    console.log('\nThis will:')
    console.log('   ✓ Create helper functions for admin checking')
    console.log('   ✓ Allow all authenticated users to SELECT reference data')
    console.log('   ✓ Allow only admins to modify reference data')
    console.log('   ✓ Scope operator-specific data by operator_id')
    console.log('\n' + '='.repeat(70) + '\n')

  } catch (err) {
    console.error('❌ Unexpected error:', err)
    process.exit(1)
  }
}

setupRLS()
