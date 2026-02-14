'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { ModuleDefinition } from '@/types/database'

export async function getModuleDefinitions(): Promise<ModuleDefinition[]> {
  // Use admin client to ensure access to module definitions
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('module_definitions')
    .select('*')
    .order('module_key', { ascending: true })

  if (error) {
    console.error('Error fetching module definitions:', error)
    return []
  }
  return data || []
}

export async function toggleModule(moduleKey: string, enabled: boolean) {
  // Use admin client for operators table access
  const supabase = createAdminClient()

  // Get current operator profile
  const { data: profile } = await supabase
    .from('operators')
    .select('*')
    .limit(1)
    .maybeSingle()

  if (!profile) {
    return { error: 'Operator profile not found' }
  }

  let newModules = [...profile.enabled_modules]

  if (enabled) {
    // Add module if not already present
    if (!newModules.includes(moduleKey)) {
      newModules.push(moduleKey)
    }

    // Check dependencies and add them
    const { data: moduleDef } = await supabase
      .from('module_definitions')
      .select('depends_on')
      .eq('module_key', moduleKey)
      .single()

    if (moduleDef?.depends_on && moduleDef.depends_on.length > 0) {
      for (const dep of moduleDef.depends_on) {
        if (!newModules.includes(dep)) {
          newModules.push(dep)
        }
      }
    }
  } else {
    // Check if any other modules depend on this one
    const { data: allModules } = await supabase
      .from('module_definitions')
      .select('*')

    const dependentModules = allModules?.filter(m =>
      m.depends_on?.includes(moduleKey) && newModules.includes(m.module_key)
    )

    if (dependentModules && dependentModules.length > 0) {
      const dependentNames = dependentModules.map(m => m.module_name).join(', ')
      return {
        error: `Cannot disable ${moduleKey}. The following modules depend on it: ${dependentNames}. Disable them first.`
      }
    }

    // Remove module
    newModules = newModules.filter(m => m !== moduleKey)
  }

  const { error } = await supabase
    .from('operators')
    .update({ enabled_modules: newModules })
    .eq('id', profile.id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/system/modules')
  return { success: true }
}
