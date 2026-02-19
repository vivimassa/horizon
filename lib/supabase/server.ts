import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { cache } from 'react'

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
 * Cached auth user — deduplicates getUser() calls within a single
 * React server-component render pass (layout + page + guards).
 * Safe: cache() scopes to one request, never leaks across users.
 */
export const getAuthUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
})

const OPERATOR_COOKIE = 'horizon_operator_id'

/**
 * Get the current user's operator_id.
 * Reads from the horizon_operator_id cookie first (set during login / operator switch),
 * falling back to the first entry in user_roles.
 */
export async function getCurrentOperatorId(): Promise<string> {
  const user = await getAuthUser()
  if (!user) throw new Error('Not authenticated')

  const cookieStore = await cookies()
  const selectedId = cookieStore.get(OPERATOR_COOKIE)?.value

  const admin = createAdminClient()

  // If a cookie is set, verify the user still has access
  if (selectedId) {
    const { data } = await admin
      .from('user_roles')
      .select('operator_id')
      .eq('user_id', user.id)
      .eq('operator_id', selectedId)
      .maybeSingle()

    if (data) return data.operator_id
  }

  // Fallback: first operator in user_roles
  const { data, error } = await admin
    .from('user_roles')
    .select('operator_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (error || !data) throw new Error('No operator found for current user')
  return data.operator_id
}
