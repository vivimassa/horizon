import { readFileSync } from 'fs'
import { join } from 'path'
import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function applyRLSDirect() {
  console.log('🔒 Applying RLS policies migration directly...\n')

  try {
    // Read the migration file
    const migrationPath = join(process.cwd(), 'supabase', 'migrations', '005_create_rls_policies.sql')
    const migrationSQL = readFileSync(migrationPath, 'utf-8')

    // Extract project reference from URL
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]

    if (!projectRef) {
      console.error('❌ Could not extract project reference from Supabase URL')
      console.log('\n📋 MANUAL APPLICATION REQUIRED:\n')
      console.log('1. Open Supabase Dashboard: https://supabase.com/dashboard/project/' + projectRef)
      console.log('2. Navigate to: SQL Editor')
      console.log('3. Create a new query')
      console.log('4. Copy contents from: supabase/migrations/005_create_rls_policies.sql')
      console.log('5. Paste and click "Run"\n')
      return
    }

    // Use Supabase's REST API to execute SQL
    const apiUrl = `${supabaseUrl}/rest/v1/rpc/exec_sql`

    console.log('📡 Attempting to execute SQL via REST API...\n')

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ query: migrationSQL })
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('❌ API execution failed:', error)
      console.log('\n⚠️  The REST API approach did not work.\n')
      console.log('📋 Please apply the migration manually:\n')
      console.log('1. Open Supabase Dashboard')
      console.log('2. Go to: SQL Editor')
      console.log('3. Copy the file: supabase/migrations/005_create_rls_policies.sql')
      console.log('4. Paste and run the SQL\n')
      return
    }

    console.log('✅ RLS policies applied successfully via REST API!\n')

  } catch (err: any) {
    console.error('❌ Error:', err.message)
    console.log('\n📋 Please apply the RLS migration manually:\n')
    console.log('Method 1 - Supabase Dashboard:')
    console.log('  1. Open Supabase Dashboard')
    console.log('  2. Navigate to SQL Editor')
    console.log('  3. Copy contents from: supabase/migrations/005_create_rls_policies.sql')
    console.log('  4. Paste and click "Run"\n')
    console.log('Method 2 - Supabase CLI (if installed):')
    console.log('  supabase db push\n')
  }
}

applyRLSDirect()
