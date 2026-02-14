import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  db: { schema: 'public' },
  auth: { persistSession: false }
})

async function inspectColumns() {
  console.log('🔍 Inspecting actual database columns...\n')

  // Try to get the schema from information_schema
  const query = `
    SELECT table_name, column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('operators', 'airports', 'countries', 'aircraft_types', 'airlines', 'city_pairs', 'operator_profile')
    ORDER BY table_name, ordinal_position;
  `

  const { data, error } = await supabase.rpc('exec_sql' as any, { sql: query }).catch(() => ({ data: null, error: null }))

  if (error || !data) {
    console.log('❌ Cannot query information_schema directly\n')
    console.log('Let me try a different approach...\n')

    // Try to query each table with a projection to see what's available
    const tables = ['operators', 'airports', 'countries', 'aircraft_types', 'airlines', 'city_pairs']

    for (const table of tables) {
      console.log(`\n📋 Table: ${table}`)

      // Try inserting with wrong data to get column error
      const testData: any = {
        test_field: 'test'
      }

      const { error: insertError } = await supabase
        .from(table)
        .insert(testData)

      if (insertError) {
        console.log(`   Error message: ${insertError.message}`)
        if (insertError.message.includes('column')) {
          console.log(`   This tells us about the expected columns`)
        }
      }
    }
  } else {
    console.log('✅ Schema information:')
    console.log(JSON.stringify(data, null, 2))
  }
}

inspectColumns()
