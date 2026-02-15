'use server'

import { cookies } from 'next/headers'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const OPERATOR_COOKIE = 'horizon_operator_id'

export type UserOperator = {
  id: string
  code: string
  iata_code: string | null
  name: string
  role: string
}

/** Get all operators the current user has access to */
export async function getUserOperators(): Promise<UserOperator[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const admin = createAdminClient()
  const { data: roles } = await admin
    .from('user_roles')
    .select('operator_id, role')
    .eq('user_id', user.id)

  if (!roles || roles.length === 0) return []

  const operatorIds = roles.map(r => r.operator_id)
  const { data: operators } = await admin
    .from('operators')
    .select('id, code, iata_code, name')
    .in('id', operatorIds)

  if (!operators) return []

  return roles.map(r => {
    const op = operators.find((o: { id: string }) => o.id === r.operator_id)
    return {
      id: r.operator_id,
      code: op?.code || '',
      iata_code: op?.iata_code || null,
      name: op?.name || '',
      role: r.role,
    }
  })
}

/** Switch the current operator (sets cookie, revalidates layout) */
export async function switchOperator(operatorId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Verify user has access to this operator
  const admin = createAdminClient()
  const { data } = await admin
    .from('user_roles')
    .select('operator_id')
    .eq('user_id', user.id)
    .eq('operator_id', operatorId)
    .maybeSingle()

  if (!data) return { error: 'Access denied' }

  const cookieStore = await cookies()
  cookieStore.set(OPERATOR_COOKIE, operatorId, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 365 * 24 * 60 * 60,
  })

  revalidatePath('/', 'layout')
  return { success: true }
}

/** Get the currently selected operator ID from cookie */
export async function getSelectedOperatorId(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(OPERATOR_COOKIE)?.value || null
}
