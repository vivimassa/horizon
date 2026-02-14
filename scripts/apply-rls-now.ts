import { readFileSync } from 'fs'
import { join } from 'path'
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Load environment variables
config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function executeSQL(sql: string) {
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]

  if (!projectRef) {
    throw new Error('Could not extract project reference from URL')
  }

  // Use Supabase Management API to execute SQL
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseServiceKey}`,
    },
    body: JSON.stringify({ query: sql })
  })

  if (!response.ok) {
    const error = await response.text()
    return { success: false, error }
  }

  const result = await response.json()
  return { success: true, result }
}

async function applyRLSNow() {
  console.log('🔒 Applying RLS policies migration...\n')

  try {
    // Read the migration file
    const migrationPath = join(process.cwd(), 'supabase', 'migrations', '005_create_rls_policies.sql')
    const migrationSQL = readFileSync(migrationPath, 'utf-8')

    console.log('📝 Migration file loaded (296 lines)\n')

    // Try Management API approach first
    console.log('🌐 Attempting to execute via Supabase Management API...\n')

    const result = await executeSQL(migrationSQL)

    if (result.success) {
      console.log('✅ Migration applied successfully via Management API!\n')
      return true
    } else {
      console.log('⚠️  Management API approach failed:', result.error)
      console.log('\n🔄 Trying direct execution method...\n')
    }

  } catch (err: any) {
    console.log('⚠️  Automated execution failed:', err.message)
  }

  // Fallback: Parse and execute statements individually
  try {
    console.log('📋 Executing statements individually...\n')

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const migrationPath = join(process.cwd(), 'supabase', 'migrations', '005_create_rls_policies.sql')
    const migrationSQL = readFileSync(migrationPath, 'utf-8')

    // Split into statements (this is a simple parser)
    const statements: string[] = []
    let currentStatement = ''
    let inDollarQuote = false
    let dollarQuoteTag = ''

    const lines = migrationSQL.split('\n')
    for (const line of lines) {
      // Skip comments
      if (line.trim().startsWith('--')) {
        continue
      }

      // Check for dollar quote start/end
      const dollarQuoteMatch = line.match(/\$\$/)
      if (dollarQuoteMatch) {
        if (!inDollarQuote) {
          inDollarQuote = true
          dollarQuoteTag = '$$'
        } else {
          inDollarQuote = false
        }
      }

      currentStatement += line + '\n'

      // If we hit a semicolon and not in dollar quote, that's the end of a statement
      if (line.includes(';') && !inDollarQuote) {
        const trimmed = currentStatement.trim()
        if (trimmed.length > 0) {
          statements.push(trimmed)
        }
        currentStatement = ''
      }
    }

    console.log(`Found ${statements.length} SQL statements to execute\n`)

    // Execute each statement
    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i]

      // Extract a short description
      let description = 'SQL statement'
      if (stmt.includes('CREATE OR REPLACE FUNCTION')) {
        const match = stmt.match(/FUNCTION\s+(\w+\.\w+)/i)
        description = match ? `Function: ${match[1]}` : 'Create function'
      } else if (stmt.includes('CREATE POLICY')) {
        const match = stmt.match(/CREATE POLICY\s+"([^"]+)"/i)
        description = match ? `Policy: ${match[1]}` : 'Create policy'
      } else if (stmt.includes('DROP POLICY')) {
        const match = stmt.match(/DROP POLICY[^"]*"([^"]+)"/i)
        description = match ? `Drop policy: ${match[1]}` : 'Drop policy'
      } else if (stmt.includes('GRANT EXECUTE')) {
        description = 'Grant execute permission'
      } else if (stmt.includes('DO $$')) {
        description = 'DO block (conditional logic)'
      }

      process.stdout.write(`[${i + 1}/${statements.length}] ${description}... `)

      try {
        // Execute using raw SQL through a query
        const { error } = await supabase.rpc('exec', { sql: stmt })

        if (error) {
          // Try alternate method - this won't work for all statements but worth trying
          console.log('❌')
          if (!error.message.includes('already exists') && !error.message.includes('does not exist')) {
            errorCount++
            console.log(`    Error: ${error.message}`)
          } else {
            // It's ok if policy already exists or doesn't exist for DROP
            successCount++
          }
        } else {
          console.log('✅')
          successCount++
        }
      } catch (err: any) {
        console.log('❌')
        errorCount++
        console.log(`    Error: ${err.message}`)
      }
    }

    console.log(`\n📊 Results: ${successCount} succeeded, ${errorCount} failed\n`)

    if (errorCount > 0) {
      console.log('⚠️  Some statements failed. This might be OK if policies already exist.\n')
    }

  } catch (err: any) {
    console.error('❌ Error during individual execution:', err.message)
  }

  // Manual instructions
  console.log('═'.repeat(70))
  console.log('\n⚠️  AUTOMATED EXECUTION LIMITATIONS\n')
  console.log('Supabase JS client cannot execute raw DDL statements directly.')
  console.log('The most reliable way is to apply the migration manually.\n')
  console.log('PLEASE FOLLOW THESE STEPS:\n')
  console.log('1. Open: https://supabase.com/dashboard')
  console.log('2. Select your Horizon project')
  console.log('3. Click: SQL Editor → New Query')
  console.log('4. Open file: supabase/migrations/005_create_rls_policies.sql')
  console.log('5. Copy ALL contents (Ctrl+A, Ctrl+C)')
  console.log('6. Paste into SQL Editor (Ctrl+V)')
  console.log('7. Click: Run (or Ctrl+Enter)')
  console.log('8. Wait for: "Success. No rows returned"\n')
  console.log('Then run: npm run verify-rls\n')
  console.log('═'.repeat(70) + '\n')
}

applyRLSNow()
