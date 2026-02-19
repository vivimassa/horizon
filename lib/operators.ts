import { cache } from 'react'
import { getAuthUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'
import { ModuleName } from '@/types/database'

const OPERATOR_COOKIE = 'horizon_operator_id'

/**
 * Extended operator type with user role information
 */
export interface OperatorWithRole {
  id: string
  code: string
  iata_code: string | null
  name: string
  country: string
  regulatory_authority: string
  timezone: string
  enabled_modules: string[]
  logo_url: string | null
  created_at: string
  updated_at: string
  // User-specific role from user_roles table
  user_role?: string | null
  user_role_id?: string | null
}

/**
 * Get the current operator's data with user role.
 * Wrapped with React cache() — deduplicates across layout, page,
 * and guard components within the same server render pass.
 */
export const getCurrentOperator = cache(async (): Promise<OperatorWithRole | null> => {
  try {
    const user = await getAuthUser()

    if (!user) {
      return null
    }

    const cookieStore = await cookies()
    const selectedId = cookieStore.get(OPERATOR_COOKIE)?.value

    const adminClient = createAdminClient()

    // Get all roles for this user
    const { data: userRoles } = await adminClient
      .from('user_roles')
      .select('id, operator_id, role')
      .eq('user_id', user.id)

    if (!userRoles || userRoles.length === 0) return null

    // Pick the role matching the cookie, or fall back to first
    let targetRole = userRoles[0]
    if (selectedId) {
      const found = userRoles.find(r => r.operator_id === selectedId)
      if (found) targetRole = found
    }

    // Get operator profile for the selected operator
    const { data: operator, error: opError } = await adminClient
      .from('operators')
      .select('*')
      .eq('id', targetRole.operator_id)
      .single()

    if (opError || !operator) {
      console.error('Error fetching operator:', opError)
      return null
    }

    return {
      ...operator,
      user_role: targetRole.role || null,
      user_role_id: targetRole.id || null
    }
  } catch (error) {
    console.error('getCurrentOperator failed (possible network timeout):', error)
    return null
  }
})

/**
 * Check if operator has access to a specific module
 */
export function hasModuleAccess(operator: OperatorWithRole | null, module: ModuleName): boolean {
  if (!operator) return false

  // Home is always accessible
  if (module === 'home') return true

  // Admin module requires admin or super_admin role
  if (module === 'admin') {
    return operator.user_role === 'admin' || operator.user_role === 'super_admin'
  }

  // Check enabled_modules (cast to ModuleName[] for type safety)
  return (operator.enabled_modules as ModuleName[]).includes(module)
}

/**
 * Get all accessible modules for an operator
 */
export function getAccessibleModules(operator: OperatorWithRole | null): ModuleName[] {
  if (!operator) return ['home']

  const modules: ModuleName[] = ['home']

  // Add enabled modules
  operator.enabled_modules.forEach(module => {
    if (!modules.includes(module as ModuleName)) {
      modules.push(module as ModuleName)
    }
  })

  // Admin module for admin and super_admin roles
  if ((operator.user_role === 'admin' || operator.user_role === 'super_admin') && !modules.includes('admin')) {
    modules.push('admin')
  }

  return modules
}

/**
 * Check if operator is admin (includes super_admin)
 */
export function isAdmin(operator: OperatorWithRole | null): boolean {
  return operator?.user_role === 'admin' || operator?.user_role === 'super_admin'
}

/**
 * Check if operator is super admin
 */
export function isSuperAdmin(operator: OperatorWithRole | null): boolean {
  return operator?.user_role === 'super_admin'
}
