'use server'

import { createClient, getCurrentOperatorId } from '@/lib/supabase/server'

export type DockPosition = 'bottom' | 'left' | 'top'
export type ThemePreference = 'light' | 'dark' | 'system'

export interface UserPreferencesData {
  theme: ThemePreference
  dock_position: DockPosition
}

export async function getUserPreferences(): Promise<UserPreferencesData | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data } = await supabase
    .from('user_preferences')
    .select('theme, dock_position')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!data) return null

  return {
    theme: data.theme || 'system',
    dock_position: data.dock_position || 'bottom',
  }
}

export async function updateUserPreferences(prefs: Partial<UserPreferencesData>): Promise<{ success: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { success: false }

  let operatorId: string
  try {
    operatorId = await getCurrentOperatorId()
  } catch {
    return { success: false }
  }

  const { error } = await supabase
    .from('user_preferences')
    .upsert(
      {
        user_id: user.id,
        operator_id: operatorId,
        ...prefs,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

  return { success: !error }
}
