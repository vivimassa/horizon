import { createClient } from '@/lib/supabase/server'
import { Operator, ModuleName } from '@/types/database'

/**
 * Get the current operator's data
 */
export async function getCurrentOperator(): Promise<Operator | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data: operator } = await supabase
    .from('operators')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return operator
}

/**
 * Check if operator has access to a specific module
 */
export function hasModuleAccess(operator: Operator | null, module: ModuleName): boolean {
  if (!operator) return false

  // Home is always accessible
  if (module === 'home') return true

  // Admin module requires admin role
  if (module === 'admin') {
    return operator.role === 'admin'
  }

  // Check enabled_modules
  return operator.enabled_modules.includes(module)
}

/**
 * Get all accessible modules for an operator
 */
export function getAccessibleModules(operator: Operator | null): ModuleName[] {
  if (!operator) return ['home']

  const modules: ModuleName[] = ['home']

  // Add enabled modules
  operator.enabled_modules.forEach(module => {
    if (!modules.includes(module)) {
      modules.push(module)
    }
  })

  // Admin module only for admins
  if (operator.role === 'admin' && !modules.includes('admin')) {
    modules.push('admin')
  }

  return modules
}

/**
 * Check if operator is admin
 */
export function isAdmin(operator: Operator | null): boolean {
  return operator?.role === 'admin'
}
