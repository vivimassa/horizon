import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testAccess() {
  console.log('Testing operators table access...\n')

  // Try with service role (should bypass RLS)
  const { data, error } = await supabase
    .from('operators')
    .select('*')

  if (error) {
    console.error('❌ Error:', error)
  } else {
    console.log('✅ Success! Found operators:')
    console.log(JSON.stringify(data, null, 2))
  }
}

testAccess()
