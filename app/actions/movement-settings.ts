'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getOperatorProfile } from './operator-profile'
import { DEFAULT_MOVEMENT_SETTINGS, type MovementSettingsData } from '@/lib/constants/movement-settings'

export async function getMovementSettings(): Promise<MovementSettingsData | null> {
  try {
    const operator = await getOperatorProfile()
    if (!operator) return null

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('gantt_settings')
      .select('settings')
      .eq('operator_id', operator.id)
      .maybeSingle()

    if (error || !data) return null
    return { ...DEFAULT_MOVEMENT_SETTINGS, ...(data.settings as object) } as MovementSettingsData
  } catch {
    return null
  }
}

export async function saveMovementSettings(settings: MovementSettingsData): Promise<{ error?: string }> {
  try {
    const operator = await getOperatorProfile()
    if (!operator) return { error: 'No operator found' }

    const supabase = createAdminClient()
    const { error } = await supabase
      .from('gantt_settings')
      .upsert(
        {
          operator_id: operator.id,
          settings: settings as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'operator_id' }
      )

    if (error) return { error: error.message }
    return {}
  } catch (e) {
    return { error: String(e) }
  }
}
