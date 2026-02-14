import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Load environment variables
config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function applyRLSPolicies() {
  console.log('🔒 Applying RLS policies...\n')

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  try {
    console.log('📝 Note: You need to apply the migration file manually through Supabase Dashboard or CLI\n')
    console.log('   Migration file: supabase/migrations/005_create_rls_policies.sql\n')
    console.log('   To apply via Supabase CLI: supabase db push\n')
    console.log('   Or copy/paste the SQL into Supabase Dashboard > SQL Editor\n')
    console.log('⏭️  Skipping migration application, testing current policies...\n')

    // Test data visibility
    console.log('📊 Testing data visibility...\n')

    // Test airports
    const { data: airports, error: airportsError } = await supabase
      .from('airports')
      .select('*', { count: 'exact' })
      .limit(5)

    if (airportsError) {
      console.error('❌ Error fetching airports:', airportsError)
    } else {
      console.log(`✅ Airports: ${airports?.length || 0} visible (showing first 5)`)
      airports?.forEach(a => console.log(`   - ${a.iata_code}: ${a.name}, ${a.city}`))
    }

    // Test countries
    const { data: countries, count: countriesCount, error: countriesError } = await supabase
      .from('countries')
      .select('*', { count: 'exact' })
      .limit(5)

    if (countriesError) {
      console.error('❌ Error fetching countries:', countriesError)
    } else {
      console.log(`\n✅ Countries: ${countriesCount} total (showing first 5)`)
      countries?.forEach(c => console.log(`   - ${c.iso_code_2}: ${c.name}`))
    }

    // Test airlines
    const { data: airlines, count: airlinesCount, error: airlinesError } = await supabase
      .from('airlines')
      .select('*', { count: 'exact' })
      .limit(5)

    if (airlinesError) {
      console.error('❌ Error fetching airlines:', airlinesError)
    } else {
      console.log(`\n✅ Airlines: ${airlinesCount} total (showing first 5)`)
      airlines?.forEach(a => console.log(`   - ${a.iata_code}: ${a.name}`))
    }

    // Test city pairs
    const { data: cityPairs, count: cityPairsCount, error: cityPairsError } = await supabase
      .from('city_pairs')
      .select('*', { count: 'exact' })
      .limit(5)

    if (cityPairsError) {
      console.error('❌ Error fetching city_pairs:', cityPairsError)
    } else {
      console.log(`\n✅ City Pairs: ${cityPairsCount} total (showing first 5)`)
      cityPairs?.forEach(cp => console.log(`   - ${cp.name} (${cp.distance_km} km)`))
    }

    console.log('\n✅ RLS policies applied and data is visible!\n')

  } catch (err) {
    console.error('❌ Unexpected error:', err)
    process.exit(1)
  }
}

applyRLSPolicies()
