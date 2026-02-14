import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

/** Anon-key client bound to user session (respects RLS) */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

/** Service-role client that bypasses RLS. Use for server-side mutations. */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/**
 * Get the current user's operator_id from their auth session.
 * Uses the user_roles table (user_id → operator_id mapping).
 * Throws if not authenticated or no operator found.
 */
export async function getCurrentOperatorId(): Promise<string> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Not authenticated')

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('user_roles')
    .select('operator_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (error || !data) throw new Error('No operator found for current user')
  return data.operator_id
}
