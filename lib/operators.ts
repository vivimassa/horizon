import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ModuleName } from '@/types/database'

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
  created_at: string
  updated_at: string
  // User-specific role from user_roles table
  user_role?: string | null
  user_role_id?: string | null
}

/**
 * Get the current operator's data with user role
 */
export async function getCurrentOperator(): Promise<OperatorWithRole | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // Get operator profile (company-wide data)
  const adminClient = createAdminClient()
  const { data: operator, error: opError } = await adminClient
    .from('operators')
    .select('*')
    .limit(1)
    .maybeSingle()

  if (opError || !operator) {
    console.error('Error fetching operator:', opError)
    return null
  }

  // Get user's role from user_roles table
  const { data: userRole } = await adminClient
    .from('user_roles')
    .select('id, role, operator_id')
    .eq('user_id', user.id)
    .eq('operator_id', operator.id)
    .maybeSingle()

  return {
    ...operator,
    user_role: userRole?.role || null,
    user_role_id: userRole?.id || null
  }
}

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
