'use server'

import { createClient, createAdminClient, getCurrentOperatorId } from '@/lib/supabase/server'

// ─── Types ─────────────────────────────────────────────────────────

export interface UserShortcut {
  id: string
  page_code: string
  page_name: string
  page_path: string
  page_icon: string | null
  position: number
}

// ─── Get Shortcuts ─────────────────────────────────────────────────

export async function getShortcuts(): Promise<UserShortcut[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const operatorId = await getCurrentOperatorId()
  const admin = createAdminClient()

  const { data } = await admin
    .from('user_shortcuts')
    .select('id, page_code, page_name, page_path, page_icon, position')
    .eq('user_id', user.id)
    .eq('operator_id', operatorId)
    .order('position', { ascending: true })

  return data || []
}

// ─── Add Shortcut ──────────────────────────────────────────────────

export async function addShortcut(input: {
  pageCode: string
  pageName: string
  pagePath: string
  pageIcon: string | null
}): Promise<{ success: boolean; shortcut?: UserShortcut; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const operatorId = await getCurrentOperatorId()
  const admin = createAdminClient()

  // Get next position
  const { data: existing } = await admin
    .from('user_shortcuts')
    .select('position')
    .eq('user_id', user.id)
    .eq('operator_id', operatorId)
    .order('position', { ascending: false })
    .limit(1)

  const nextPosition = existing && existing.length > 0 ? existing[0].position + 1 : 0

  const { data, error } = await admin
    .from('user_shortcuts')
    .upsert(
      {
        user_id: user.id,
        operator_id: operatorId,
        page_code: input.pageCode,
        page_name: input.pageName,
        page_path: input.pagePath,
        page_icon: input.pageIcon,
        position: nextPosition,
      },
      { onConflict: 'user_id,operator_id,page_code' }
    )
    .select('id, page_code, page_name, page_path, page_icon, position')
    .single()

  if (error) return { success: false, error: error.message }
  return { success: true, shortcut: data }
}

// ─── Remove Shortcut ──────────────────────────────────────────────

export async function removeShortcut(pageCode: string): Promise<{ success: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false }

  const operatorId = await getCurrentOperatorId()
  const admin = createAdminClient()

  await admin
    .from('user_shortcuts')
    .delete()
    .eq('user_id', user.id)
    .eq('operator_id', operatorId)
    .eq('page_code', pageCode)

  return { success: true }
}

// ─── Reorder Shortcuts ─────────────────────────────────────────────

export async function reorderShortcuts(
  orderedCodes: string[]
): Promise<{ success: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false }

  const operatorId = await getCurrentOperatorId()
  const admin = createAdminClient()

  // Update positions in a batch
  const promises = orderedCodes.map((code, index) =>
    admin
      .from('user_shortcuts')
      .update({ position: index })
      .eq('user_id', user.id)
      .eq('operator_id', operatorId)
      .eq('page_code', code)
  )

  await Promise.all(promises)
  return { success: true }
}
